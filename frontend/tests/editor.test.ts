import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EditorModal from '../src/components/EditorModal.vue'
import { modalControls, store } from '../src/store'
import { flush, loadFiles, mockFetch, mountWithStubs, resetStore } from './helpers'

const { sessionMock, editorMock, editSpy } = vi.hoisted(() => {
  const sessionMock = {
    content: '',
    mode: 'ace/mode/text',
    opts: {} as Record<string, unknown>,
    setValue(v: string) {
      sessionMock.content = v
    },
    setMode(m: string) {
      sessionMock.mode = m
    },
    setOption(k: string, v: unknown) {
      sessionMock.opts[k] = v
    },
    getOption(k: string) {
      return sessionMock.opts[k]
    },
  }
  const editorMock = {
    changeCb: null as null | (() => void),
    destroyed: false,
    getSession: () => sessionMock,
    getValue: () => sessionMock.content,
    setTheme: vi.fn(),
    setShowInvisibles: vi.fn(),
    setOption: vi.fn(),
    getOption: vi.fn(),
    focus: vi.fn(),
    resize: vi.fn(),
    destroy() {
      editorMock.destroyed = true
    },
    on(_ev: string, cb: () => void) {
      editorMock.changeCb = cb
    },
    commands: { addCommand: vi.fn() },
    container: {},
    $blockScrolling: 0,
  }
  return { sessionMock, editorMock, editSpy: vi.fn(() => editorMock) }
})

vi.mock('../src/ace', () => ({
  ace: { edit: editSpy },
  availableModes: () => ['ace/mode/text', 'ace/mode/javascript'],
  modeForFilename: () => 'ace/mode/text',
  modeLabel: (m: string) => String(m).replace('ace/mode/', ''),
}))

function mountEditor(payload = { filename: 'fresh.txt', content: 'hello', isNew: true }) {
  return mountWithStubs(EditorModal, { props: { payload } })
}

beforeEach(() => {
  loadFiles()
  sessionMock.content = ''
  sessionMock.mode = 'ace/mode/text'
  sessionMock.opts = {}
  editorMock.changeCb = null
  editorMock.destroyed = false
  editSpy.mockClear()
  window.confirm = vi.fn(() => true) as unknown as typeof window.confirm
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  resetStore()
})

describe('EditorModal', () => {
  it('loads content and saves without closing', async () => {
    const calls: string[] = []
    mockFetch((api, body) => {
      calls.push(api)
      if (api === 'saveFile') {
        expect(body.get('filename')).toBe('fresh.txt')
        expect(body.get('content')).toBe('hello')
        return { status: 'OK' }
      }
      return []
    })
    const wrapper = mountEditor()
    expect(editSpy).toHaveBeenCalled()
    expect(sessionMock.content).toBe('hello')
    // editing marks the file dirty
    editorMock.changeCb?.()
    await wrapper.find('form').trigger('submit')
    await flush()
    expect(calls).toContain('saveFile')
    expect(store.toasts.at(-1)?.kind).toBe('success')
    // save keeps the dialog open, dirty flag cleared
    expect(wrapper.find('#editor-content').exists()).toBe(true)
  })
  it('blocks saving taken names', async () => {
    let calls = 0
    mockFetch(() => {
      calls++
      return { status: 'OK' }
    })
    const wrapper = mountEditor({ filename: 'notes.txt', content: 'x', isNew: true })
    expect(wrapper.find('#editor-filename').classes()).toContain('is-invalid')
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()
    await wrapper.find('form').trigger('submit')
    expect(calls).toBe(0)
    // renaming an existing file to its own name is fine
    const wrapper2 = mountEditor({ filename: 'notes.txt', content: 'x', isNew: false })
    expect(wrapper2.find('#editor-filename').classes()).not.toContain('is-invalid')
  })
  it('guards unsaved changes on close', async () => {
    const wrapper = mountEditor()
    editorMock.changeCb?.()
    ;(window.confirm as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false)
    await wrapper.findAll('.modal-footer .btn').find((b) => b.text() === 'Close')?.trigger('click')
    expect(wrapper.find('#editor-content').exists()).toBe(true)
    ;(window.confirm as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true)
    await wrapper.findAll('.modal-footer .btn').find((b) => b.text() === 'Close')?.trigger('click')
    expect(store.modal.kind).toBeNull()
  })
  it('applies editor options and fullscreen', async () => {
    const wrapper = mountEditor()
    await wrapper.find('.btn-secondary').trigger('click') // options toggle
    await wrapper.find('#editor-wordwrap').setValue(false)
    expect(sessionMock.opts['wrap']).toBe('off')
    await wrapper.find('#editor-invisible-chars').setValue(true)
    await wrapper.find('#editor-softtabs').setValue(false)
    await wrapper.find('#editor-tabsize').setValue(2)
    await wrapper.find('#editor-tabsize').trigger('keydown.enter')
    expect(sessionMock.opts['tabSize']).toBe(2)
    await wrapper.find('select').setValue('ace/mode/javascript')
    expect(sessionMock.mode).toBe('ace/mode/javascript')
    // renaming through the filename field feeds the next save
    await wrapper.find('#editor-filename').setValue('renamed.txt')
    await wrapper.find('#editor-filename').trigger('keydown.enter')
    expect(wrapper.find('#editor-filename').classes()).not.toContain('is-invalid')
    expect(wrapper.find('.editor-fullscreen').exists()).toBe(false)
    await wrapper.findAll('.mt-2 .btn-secondary')[1]?.trigger('click')
    expect(wrapper.find('.editor-fullscreen').exists()).toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 60))
  })
  it('clears the close guard on unmount', () => {
    const wrapper = mountEditor()
    expect(modalControls.guard).not.toBeNull()
    wrapper.unmount()
    expect(modalControls.guard).toBeNull()
  })
  it('toggles fullscreen through the ace shortcut', async () => {
    const wrapper = mountEditor()
    const mocked = editorMock.commands.addCommand as unknown as { mock: { calls: unknown[][] } }
    expect(mocked.mock.calls).toHaveLength(1)
    const cmd = mocked.mock.calls[0]?.[0] as { exec: (e: unknown) => void }
    expect(cmd.exec).toBeTypeOf('function')
    cmd.exec(editorMock)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.editor-fullscreen').exists()).toBe(true)
  })
})
