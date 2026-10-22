import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Toolbar from '../src/components/Toolbar.vue'
import { store } from '../src/store'
import { flush, loadFiles, mockFetch, mountWithStubs, resetStore } from './helpers'

beforeEach(() => {
  loadFiles()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  resetStore()
})

describe('toolbar', () => {
  it('opens dialogs from the action buttons', async () => {
    const wrapper = mountWithStubs(Toolbar)
    const cases: Array<[string, string]> = [
      ['Search', 'search'],
      ['Upload', 'upload'],
      ['Remote Upload', 'remoteUpload'],
      ['AJAX request', 'ajax'],
      ['New Folder', 'createDir'],
    ]
    for (const [title, kind] of cases) {
      const btn = wrapper.findAll('.nav-link').find((a) => a.attributes('title') === title)
      expect(btn?.exists(), title).toBe(true)
      await btn?.trigger('click')
      expect(store.modal.kind, title).toBe(kind)
    }
  })
  it('creates a new file and refreshes the table', async () => {
    const seen: string[] = []
    mockFetch((api) => {
      seen.push(api)
      return []
    })
    const wrapper = mountWithStubs(Toolbar)
    const fileBtn = wrapper.findAll('.nav-link').find((a) => a.attributes('title') === 'New file')
    await fileBtn?.trigger('click')
    expect(store.modal.kind).toBe('editor')
    const refreshBtn = wrapper.findAll('.nav-link').find((a) => a.attributes('title') === 'Refresh')
    await refreshBtn?.trigger('click')
    await flush()
    expect(seen).toContain('getFiles')
  })
  it('navigates to absolute paths and back to root', async () => {
    const dirs: Array<string | null> = []
    mockFetch((api, body) => {
      if (api === 'getRealpath') {
        dirs.push(body.get('dir'))
        return { realpath: body.get('dir') }
      }
      return []
    })
    const wrapper = mountWithStubs(Toolbar)
    await wrapper.find('#currentDir').setValue('sub/dir')
    await wrapper.find('form').trigger('submit')
    await flush()
    expect(dirs).toContain('sub/dir')
    await wrapper.find('.navbar-brand').trigger('click')
    await flush()
    expect(dirs).toContain('')
  })
  it('hides disabled features and links logout', async () => {
    resetStore()
    loadFiles({ upload: 0, auth: 0, remoteupload: 0, ajaxrequest: 0, createfile: 0, createdir: 0, search: 0 })
    const wrapper = mountWithStubs(Toolbar)
    for (const title of ['Upload', 'Remote Upload', 'AJAX request', 'New file', 'New Folder', 'Search']) {
      expect(wrapper.find(`.nav-link[title="${title}"]`).exists(), title).toBe(false)
    }
    expect(wrapper.find('a[href*="api=logout"]').exists()).toBe(false)
  })
  it('shows logout when auth is on', () => {
    resetStore()
    loadFiles({ auth: 1 })
    const wrapper = mountWithStubs(Toolbar)
    expect(wrapper.find('a[href*="api=logout"]').exists()).toBe(true)
  })
  it('toggles the mobile menu', async () => {
    const wrapper = mountWithStubs(Toolbar)
    expect(wrapper.find('#navbarCollapse.show').exists()).toBe(false)
    await wrapper.find('.navbar-toggler').trigger('click')
    expect(wrapper.find('#navbarCollapse.show').exists()).toBe(true)
  })
})
