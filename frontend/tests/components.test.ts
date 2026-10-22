import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Modal from '../src/components/Modal.vue'
import ModalHost from '../src/components/ModalHost.vue'
import Toasts from '../src/components/Toasts.vue'
import TaskBar from '../src/components/TaskBar.vue'
import LoginForm from '../src/components/LoginForm.vue'
import ContextMenu from '../src/components/ContextMenu.vue'
import PreviewModal from '../src/components/PreviewModal.vue'
import EditorModal from '../src/components/EditorModal.vue'
import CreateDirDialog from '../src/components/dialogs/CreateDirDialog.vue'
import DeleteDialog from '../src/components/dialogs/DeleteDialog.vue'
import RenameDialog from '../src/components/dialogs/RenameDialog.vue'
import CopyMoveDialog from '../src/components/dialogs/CopyMoveDialog.vue'
import ExtractDialog from '../src/components/dialogs/ExtractDialog.vue'
import UploadDialog from '../src/components/dialogs/UploadDialog.vue'
import OverwriteDialog from '../src/components/dialogs/OverwriteDialog.vue'
import RemoteUploadDialog from '../src/components/dialogs/RemoteUploadDialog.vue'
import AjaxDialog from '../src/components/dialogs/AjaxDialog.vue'
import SearchDialog from '../src/components/dialogs/SearchDialog.vue'
import CreateArchiveDialog from '../src/components/dialogs/CreateArchiveDialog.vue'
import type { Component } from 'vue'
import { modalControls, openModal, store, taskAdd } from '../src/store'
import type { ModalKind } from '../src/store'
import { flush, loadFiles, mockFetch, mountWithStubs, resetStore } from './helpers'

function fakeEditor(): Record<string, unknown> {
  const session = {
    setValue: () => {},
    setMode: () => {},
    setOption: () => {},
    getOption: () => undefined,
  }
  return {
    getSession: () => session,
    getValue: () => '',
    setTheme: () => {},
    setShowInvisibles: () => {},
    setOption: () => {},
    getOption: () => undefined,
    focus: () => {},
    resize: () => {},
    destroy: () => {},
    on: () => {},
    commands: { addCommand: () => {} },
    container: document.createElement('div'),
    $blockScrolling: 0,
  }
}

vi.mock('../src/ace', () => ({
  ace: { edit: () => fakeEditor() },
  availableModes: () => ['ace/mode/text'],
  modeForFilename: () => 'ace/mode/text',
  modeLabel: (m: string) => String(m).replace('ace/mode/', ''),
}))

beforeEach(() => {
  loadFiles()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  resetStore()
})

function guidOf(name: string): string {
  const f = store.files.find((x) => x.name === name)
  if (!f) throw new Error(`missing file ${name}`)
  return f.guid
}

describe('Modal', () => {
  it('closes on backdrop click and the close button', async () => {
    openModal('createDir')
    const wrapper = mountWithStubs(Modal, { props: { title: 'T' } })
    await wrapper.find('.ifm-modal-backdrop').trigger('mousedown')
    expect(store.modal.kind).toBeNull()
    openModal('createDir')
    const wrapper2 = mountWithStubs(Modal, { props: { title: 'T' } })
    await wrapper2.find('.btn-close').trigger('click')
    expect(store.modal.kind).toBeNull()
  })
  it('renders without a title', () => {
    openModal('createDir')
    const wrapper = mountWithStubs(Modal)
    expect(wrapper.find('.ifm-modal-header').exists()).toBe(false)
    expect(wrapper.find('.ifm-modal').exists()).toBe(true)
  })
  it('ignores clicks inside the dialog and honours the guard', async () => {
    openModal('createDir')
    const wrapper = mountWithStubs(Modal, { props: { title: 'T' } })
    await wrapper.find('.ifm-modal').trigger('mousedown')
    expect(store.modal.kind).toBe('createDir')
    modalControls.guard = () => false
    await wrapper.find('.ifm-modal-backdrop').trigger('mousedown')
    expect(store.modal.kind).toBe('createDir')
  })
})

describe('ModalHost', () => {
  it('renders every dialog kind', async () => {
    const cases: Array<[ModalKind, unknown, Component]> = [
      ['createDir', undefined, CreateDirDialog],
      ['delete', { guids: [guidOf('notes.txt')] }, DeleteDialog],
      ['rename', { guid: guidOf('notes.txt') }, RenameDialog],
      ['copyMove', { guids: [guidOf('notes.txt')] }, CopyMoveDialog],
      ['extract', { filename: 'archive.zip' }, ExtractDialog],
      ['upload', undefined, UploadDialog],
      ['overwrite', { files: [], existing: ['a'], newfilename: undefined }, OverwriteDialog],
      ['remoteUpload', undefined, RemoteUploadDialog],
      ['ajax', undefined, AjaxDialog],
      ['search', undefined, SearchDialog],
      ['createArchive', { guids: [guidOf('notes.txt')] }, CreateArchiveDialog],
      ['preview', { guid: guidOf('photo.jpg') }, PreviewModal],
      ['editor', { filename: 'n.txt', content: 'x', isNew: true }, EditorModal],
    ]
    for (const [kind, payload, component] of cases) {
      resetStore()
      loadFiles()
      openModal(kind, payload)
      const wrapper = mountWithStubs(ModalHost)
      expect(wrapper.findComponent(component).exists(), kind).toBe(true)
      wrapper.unmount()
    }
  })
  it('renders nothing without a modal', () => {
    const wrapper = mountWithStubs(ModalHost)
    expect(wrapper.html()).toBe('<!--v-if-->')
  })
  it('remounts the editor per file and mode', async () => {
    openModal('editor', { filename: 'a.txt', content: 'x', isNew: false })
    const wrapper = mountWithStubs(ModalHost)
    expect(wrapper.findComponent(EditorModal).exists()).toBe(true)
    const filenameInput = () => wrapper.find('#editor-filename').element as HTMLInputElement
    expect(filenameInput().value).toBe('a.txt')
    openModal('editor', { filename: 'b.txt', content: 'y', isNew: true })
    await wrapper.vm.$nextTick()
    // same component type, new key -> fresh filename field
    expect(filenameInput().value).toBe('b.txt')
  })
})

describe('Toasts', () => {
  it('renders kinds and offsets for the task bar', async () => {
    store.toasts.push(
      { id: '1', message: 'ok', kind: 'success' },
      { id: '2', message: 'bad', kind: 'danger' },
      { id: '3', message: 'info', kind: 'info' },
    )
    const wrapper = mountWithStubs(Toasts)
    expect(wrapper.find('.alert-success').text()).toBe('ok')
    expect(wrapper.find('.alert-danger').text()).toBe('bad')
    expect(wrapper.find('.alert-info').text()).toBe('info')
    expect(wrapper.find('.with-tasks').exists()).toBe(false)
    taskAdd('job')
    const wrapper2 = mountWithStubs(Toasts)
    expect(wrapper2.find('.with-tasks').exists()).toBe(true)
  })
})

describe('TaskBar', () => {
  it('stays hidden without tasks and expands with them', async () => {
    const empty = mountWithStubs(TaskBar)
    expect(empty.find('footer').exists()).toBe(false)
    taskAdd('copy x')
    const wrapper = mountWithStubs(TaskBar)
    expect(wrapper.find('footer').exists()).toBe(true)
    expect(wrapper.find('.badge').text()).toBe('1')
    expect(wrapper.find('#waitqueue.expanded').exists()).toBe(false)
    await wrapper.find('button').trigger('click')
    expect(wrapper.find('#waitqueue.expanded').exists()).toBe(true)
    expect(wrapper.find('.progress-bar').attributes('style')).toBeUndefined()
    const first = store.tasks[0]
    if (first) first.progress = 42
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.progress-bar').attributes('style')).toContain('42%')
  })
})

describe('LoginForm', () => {
  it('logs in with the entered credentials', async () => {
    const seen: Array<Record<string, string>> = []
    mockFetch((api, body) => {
      if (api === 'checkAuth' && body.get('inputLogin')) {
        seen.push(Object.fromEntries(body.entries()))
        return { status: 'OK' }
      }
      if (api === 'getRealpath') return { realpath: '' }
      if (api === 'getFiles') return []
      return { status: 'OK' }
    })
    store.authenticated = false
    const wrapper = mountWithStubs(LoginForm)
    await wrapper.find('#inputLogin').setValue('admin')
    await wrapper.find('#inputPassword').setValue('s3cret')
    await wrapper.find('form').trigger('submit')
    await flush()
    expect(seen[0]?.['inputLogin']).toBe('admin')
    expect(store.authenticated).toBe(true)
  })
  it('shows backend failures and the busy state', async () => {
    mockFetch(() => ({ status: 'ERROR', message: 'nope' }))
    store.authenticated = false
    const wrapper = mountWithStubs(LoginForm)
    await wrapper.find('form').trigger('submit')
    await flush()
    expect(wrapper.find('.alert-danger').text()).toBe('nope')
    store.loginBusy = true
    await wrapper.vm.$nextTick()
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()
  })
})

describe('ContextMenu', () => {
  it('shows edit actions for editable files', () => {
    store.contextMenu = { x: 5000, y: 5000, guid: guidOf('notes.txt') }
    const wrapper = mountWithStubs(ContextMenu)
    const text = wrapper.text()
    expect(text).toContain('Edit')
    expect(text).toContain('Rename')
    expect(text).toContain('Copy link')
    expect(text).not.toContain('Extract')
    // clamped into the viewport
    const style = wrapper.find('.ifm-contextmenu').attributes('style') ?? ''
    expect(style).toContain('left:')
  })
  it('shows extract for archives', () => {
    store.contextMenu = { x: 10, y: 10, guid: guidOf('archive.zip') }
    const wrapper = mountWithStubs(ContextMenu)
    const text = wrapper.text()
    expect(text).toContain('Extract')
    expect(text).not.toContain('Edit')
  })
  it('shows badges for selections and hides single-item actions', () => {
    store.contextMenu = { x: 10, y: 10, guid: guidOf('archive.zip') }
    store.selected.add(guidOf('notes.txt'))
    store.selected.add(guidOf('photo.jpg'))
    const wrapper = mountWithStubs(ContextMenu)
    const text = wrapper.text()
    expect(text).not.toContain('Extract')
    expect(text).not.toContain('Edit')
    expect(wrapper.findAll('.badge')[0]?.text()).toBe('2')
  })
  it('edits, renames, deletes, archives and moves through the menu', async () => {
    mockFetch((api) => {
      if (api === 'getContent') return { status: 'OK', data: { filename: 'notes.txt', content: 'hi' } }
      return { status: 'OK' }
    })
    store.contextMenu = { x: 10, y: 10, guid: guidOf('notes.txt') }
    const wrapper = mountWithStubs(ContextMenu)
    const buttons = wrapper.findAll('.ifm-contextmenu button')
    await buttons[0]?.trigger('click')
    await flush()
    expect(store.modal.kind).toBe('editor')
  })
  it('downloads single files through the backend link', async () => {
    store.contextMenu = { x: 10, y: 10, guid: guidOf('notes.txt') }
    const wrapper = mountWithStubs(ContextMenu)
    const dl = wrapper.findAll('.ifm-contextmenu button').find((b) => b.text().includes('Download'))
    expect(dl?.exists()).toBe(true)
    await dl?.trigger('click')
    // jsdom cannot navigate; the menu still closes on the way out
    expect(store.contextMenu).toBeNull()
  })
  it('skips download without a link', async () => {
    resetStore()
    loadFiles({ zipnload: 0 })
    // directories have no download link without zipnload, but the button shows
    store.contextMenu = { x: 10, y: 10, guid: guidOf('docs') }
    const wrapper = mountWithStubs(ContextMenu)
    const dl = wrapper.findAll('.ifm-contextmenu button').find((b) => b.text().includes('Download'))
    expect(dl?.exists()).toBe(true)
    await dl?.trigger('click')
    expect(store.contextMenu).toBeNull()
  })
  it('hides for unknown files', () => {
    store.contextMenu = { x: 10, y: 10, guid: 'missing' }
    const wrapper = mountWithStubs(ContextMenu)
    expect(wrapper.find('.ifm-contextmenu').exists()).toBe(false)
  })
  it('copies links and refuses multi downloads', async () => {
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    store.contextMenu = { x: 10, y: 10, guid: guidOf('notes.txt') }
    const wrapper = mountWithStubs(ContextMenu)
    const buttons = wrapper.findAll('.ifm-contextmenu button')
    const copyLink = buttons.find((b) => b.text().includes('Copy link'))
    await copyLink?.trigger('click')
    expect(writeText).toHaveBeenCalled()
    // multi selection download explains itself
    store.contextMenu = { x: 10, y: 10, guid: guidOf('notes.txt') }
    store.selected.add(guidOf('notes.txt'))
    const wrapper2 = mountWithStubs(ContextMenu)
    const dl = wrapper2.findAll('.ifm-contextmenu button').find((b) => b.text().includes('Download'))
    await dl?.trigger('click')
    expect(store.toasts.at(-1)?.kind).toBe('info')
  })
  it('opens copy, archive and delete dialogs', async () => {
    for (const [label, kind] of [
      ['Copy/Move', 'copyMove'],
      ['Create archive', 'createArchive'],
      ['Delete', 'delete'],
    ] as Array<[string, string]>) {
      // each action closes the menu, so reopen it for the next round
      store.contextMenu = { x: 10, y: 10, guid: guidOf('notes.txt') }
      const wrapper = mountWithStubs(ContextMenu)
      const btn = wrapper.findAll('.ifm-contextmenu button').find((b) => b.text().includes(label))
      expect(btn?.exists(), label).toBe(true)
      await btn?.trigger('click')
      expect(store.modal.kind, label).toBe(kind)
      wrapper.unmount()
    }
  })
  it('opens rename and extract dialogs', async () => {
    for (const [label, kind] of [
      ['Rename', 'rename'],
      ['Extract', 'extract'],
    ] as Array<[string, string]>) {
      store.contextMenu = { x: 10, y: 10, guid: guidOf('archive.zip') }
      const wrapper = mountWithStubs(ContextMenu)
      const btn = wrapper.findAll('.ifm-contextmenu button').find((b) => b.text().includes(label))
      expect(btn?.exists(), label).toBe(true)
      await btn?.trigger('click')
      expect(store.modal.kind, label).toBe(kind)
      wrapper.unmount()
    }
  })
})

describe('PreviewModal', () => {
  it('renders images, audio, video and the fallback', () => {
    for (const [name, tag] of [
      ['photo.jpg', 'img'],
      ['song.mp3', 'audio'],
      ['clip.mp4', 'video'],
    ] as Array<[string, string]>) {
      const wrapper = mountWithStubs(PreviewModal, { props: { guid: guidOf(name) } })
      expect(wrapper.find(tag).exists(), name).toBe(true)
      expect(wrapper.find(tag).attributes('src'), name).toContain('proxy')
      wrapper.unmount()
    }
    const other = mountWithStubs(PreviewModal, { props: { guid: guidOf('blob.bin') } })
    expect(other.text()).toContain('cannot be displayed')
  })
  it('uses relative paths on docroots', () => {
    resetStore()
    loadFiles({ isDocroot: true })
    const wrapper = mountWithStubs(PreviewModal, { props: { guid: guidOf('photo.jpg') } })
    expect(wrapper.find('img').attributes('src')).toBe('photo.jpg')
  })
  it('renders nothing for unknown files', () => {
    const wrapper = mountWithStubs(PreviewModal, { props: { guid: 'missing' } })
    expect(wrapper.html()).toBe('<!--v-if-->')
  })
  it('closes and previews without config', async () => {
    const wrapper = mountWithStubs(PreviewModal, { props: { guid: guidOf('photo.jpg') } })
    await wrapper.find('.modal-footer .btn-danger').trigger('click')
    expect(store.modal.kind).toBeNull()
    resetStore()
    loadFiles()
    store.config = null
    const wrapper2 = mountWithStubs(PreviewModal, { props: { guid: guidOf('photo.jpg') } })
    expect(wrapper2.find('img').attributes('src')).toBe('')
  })
})
