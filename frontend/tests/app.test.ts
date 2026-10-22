import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App.vue'
import { store } from '../src/store'
import { fakeConfig, flush, loadFiles, mockFetch, MockXHR, mockXHR, mountWithStubs, rawFiles, resetStore } from './helpers'

function mockBootAll(): void {
  mockFetch((api, body) => {
    switch (api) {
      case 'getConfig':
        return { ...fakeConfig({ auth: 1 }), csrf_token: 'tok' }
      case 'getI18N':
        return {}
      case 'checkAuth':
        return { status: 'OK' }
      case 'getRealpath':
        return { realpath: body.get('dir') }
      case 'getFiles':
        return rawFiles()
      default:
        return { status: 'OK', message: 'ok' }
    }
  })
}

function filesDragEvent(type: string, files: File[]): Event {
  const e = new Event(type, { bubbles: true, cancelable: true }) as Event & {
    dataTransfer: { types: string[]; files: File[] }
  }
  e.dataTransfer = { types: ['Files'], files }
  return e
}

beforeEach(() => {
  resetStore()
  store.booted = false
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  resetStore()
})

describe('App boot states', () => {
  it('shows fatal boot errors', async () => {
    mockFetch(() => new Error('down'))
    const wrapper = mountWithStubs(App)
    await flush(20)
    expect(wrapper.find('.alert-danger').exists()).toBe(true)
    expect(store.booted).toBe(true)
  })
  it('shows the login when unauthenticated', async () => {
    mockFetch((api) => {
      if (api === 'getConfig') return { csrf_token: 't' }
      if (api === 'getI18N') return {}
      return { status: 'ERROR', message: 'no' }
    })
    const wrapper = mountWithStubs(App)
    await flush(20)
    expect(wrapper.find('.form-signin').exists()).toBe(true)
  })
  it('shows the file manager when authenticated', async () => {
    mockBootAll()
    const wrapper = mountWithStubs(App)
    await flush(20)
    expect(wrapper.find('.navbar').exists()).toBe(true)
    expect(wrapper.find('#filetable').exists()).toBe(true)
    expect(wrapper.find('#filetable tbody tr.clickable-row').exists()).toBe(true)
  })
})

describe('app shell extras', () => {
  it('shows a spinner while booting and cleans up on unmount', async () => {
    mockFetch(() => new Promise(() => {}))
    const wrapper = mountWithStubs(App)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.fa-stub').exists()).toBe(true)
    wrapper.unmount()
  })
  it('clears the context menu on document clicks', async () => {
    mockBootAll()
    loadFiles()
    store.authenticated = true
    store.contextMenu = { x: 1, y: 1, guid: 'whatever' }
    mountWithStubs(App)
    document.dispatchEvent(new Event('click', { bubbles: true }))
    expect(store.contextMenu).toBeNull()
  })
})

describe('drop overlay', () => {
  it('uploads dropped files and asks on overwrite', async () => {
    mockBootAll()
    mockXHR()
    loadFiles()
    store.authenticated = true
    const wrapper = mountWithStubs(App)
    document.dispatchEvent(filesDragEvent('dragover', [new File(['x'], 'fresh.txt')]))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('#filedropoverlay.visible').exists()).toBe(true)
    const overlay = wrapper.find('#filedropoverlay').element
    overlay.dispatchEvent(filesDragEvent('drop', [new File(['x'], 'fresh.txt')]))
    expect(MockXHR.last).not.toBeNull()
    MockXHR.last?.respondOk({ status: 'OK', cd: '' })
    await flush()
    // existing name with confirmoverwrite -> overwrite dialog
    document.dispatchEvent(filesDragEvent('dragover', [new File(['x'], 'notes.txt')]))
    overlay.dispatchEvent(filesDragEvent('drop', [new File(['x'], 'notes.txt')]))
    expect(store.modal.kind).toBe('overwrite')
  })
  it('never lets the browser navigate away with files', async () => {
    mockBootAll()
    loadFiles()
    store.authenticated = true
    mountWithStubs(App)
    const e = filesDragEvent('drop', [new File(['x'], 'a.txt')])
    document.dispatchEvent(e)
    expect(e.defaultPrevented).toBe(true)
  })
  it('stays hidden without upload rights', async () => {
    mockBootAll()
    loadFiles({ upload: 0 })
    store.authenticated = true
    const wrapper = mountWithStubs(App)
    document.dispatchEvent(filesDragEvent('dragover', [new File(['x'], 'a.txt')]))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('#filedropoverlay.visible').exists()).toBe(false)
  })
  it('ignores guarded drops', async () => {
    mockBootAll()
    mockXHR()
    loadFiles()
    store.authenticated = true
    const wrapper = mountWithStubs(App)
    const overlay = wrapper.find('#filedropoverlay').element
    const emptyFiles = filesDragEvent('drop', [])
    overlay.dispatchEvent(emptyFiles)
    // internal move payloads are not uploads either
    const internal = new Event('drop', { bubbles: true, cancelable: true }) as Event & {
      dataTransfer: { types: string[]; files: File[] }
    }
    internal.dataTransfer = { types: ['text/plain'], files: [] }
    overlay.dispatchEvent(internal)
    expect(MockXHR.last).toBeNull()
    expect(store.modal.kind).toBeNull()
    // without upload rights nothing happens at all
    resetStore()
    loadFiles({ upload: 0 })
    store.authenticated = true
    const wrapper2 = mountWithStubs(App)
    wrapper2.find('#filedropoverlay').element.dispatchEvent(filesDragEvent('drop', [new File(['x'], 'a.txt')]))
    expect(MockXHR.last).toBeNull()
  })
  it('hides on dragleave and ignores non-file drags', async () => {
    mockBootAll()
    loadFiles()
    store.authenticated = true
    const wrapper = mountWithStubs(App)
    document.dispatchEvent(filesDragEvent('dragover', [new File(['x'], 'a.txt')]))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('#filedropoverlay.visible').exists()).toBe(true)
    wrapper.find('#filedropoverlay').element.dispatchEvent(new Event('dragleave', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('#filedropoverlay.visible').exists()).toBe(false)
    // dragover without any transfer payload is not an upload
    document.dispatchEvent(new Event('dragover', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('#filedropoverlay.visible').exists()).toBe(false)
  })
})

describe('main entry', () => {
  it('mounts the app on #app', async () => {
    mockBootAll()
    document.body.innerHTML = '<div id="app"></div>'
    await import('../src/main')
    await flush(20)
    expect(document.querySelector('#app .navbar')).not.toBeNull()
  })
})
