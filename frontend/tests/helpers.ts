// Shared fixtures for the frontend unit tests.
import { mount, type VueWrapper } from '@vue/test-utils'
import type { Component } from 'vue'
import { vi } from 'vitest'
import { enrichFileList, type FileItem, type IfmConfig } from '../src/api'
import { modalControls, store } from '../src/store'

export const FaIconStub = {
  name: 'FaIcon',
  props: ['icon', 'spin'],
  template: '<span class="fa-stub">{{ icon }}</span>',
}

type MountOptions = {
  props?: Record<string, unknown>
  global?: Record<string, unknown>
  attachTo?: HTMLElement | string
}

// All mounts attach to the document so document-level queries, focus and
// keyboard handling behave like in the browser. resetStore() clears the body
// between tests.
export function mountWithStubs(component: Component, options: MountOptions = {}): VueWrapper<unknown> {
  return mount(component, {
    props: options.props,
    attachTo: options.attachTo ?? document.body,
    global: { stubs: { FaIcon: FaIconStub }, ...(options.global ?? {}) },
  })
}

export function fakeConfig(over: Partial<IfmConfig> = {}): IfmConfig {
  return {
    auth: 0,
    ajaxrequest: 1,
    chmod: 1,
    copymove: 1,
    createdir: 1,
    createfile: 1,
    edit: 1,
    delete: 1,
    download: 1,
    extract: 1,
    upload: 1,
    remoteupload: 1,
    rename: 1,
    zipnload: 1,
    createarchive: 1,
    search: 1,
    paging: 0,
    pageLength: 50,
    showlastmodified: 1,
    showfilesize: 1,
    showowner: 1,
    showgroup: 1,
    showpermissions: 2,
    showhtdocs: 0,
    showhiddenfiles: 1,
    showpath: 0,
    contextmenu: 1,
    disable_mime_detection: 0,
    showrefresh: 1,
    forceproxy: 0,
    confirmoverwrite: 1,
    customDateFormat: false,
    language: 'en',
    timezone: '',
    inline: false,
    isDocroot: false,
    root_public_url: '',
    csrf_token: 'test-csrf-token',
    ...over,
  }
}

function fileItem(name: string, extra: Partial<FileItem> = {}): FileItem {
  return { name, type: 'file', icon: 'icon fa fa-file-o', ...extra }
}

export function rawFiles(): FileItem[] {
  return [
    { name: '..', type: 'dir', icon: 'icon fa fa-angle-up' },
    { name: 'docs', type: 'dir', icon: 'icon fa fa-folder-o' },
    fileItem('notes.txt', {
      icon: 'icon fa fa-file-text-o',
      ext: 'txt',
      mime_type: 'text/plain',
      size: '17 Bytes',
      size_raw: 17,
      lastmodified: 1700000000,
      fileperms: 'rw- r-- r--',
      filepermmode: 'long',
      owner: 'u',
      group: 'g',
    }),
    fileItem('photo.jpg', {
      icon: 'icon fa fa-file-image-o',
      ext: 'jpg',
      mime_type: 'image/jpeg',
      size: '1 KB',
      size_raw: 1024,
      lastmodified: 1700000100,
      fileperms: 'rw- r-- r--',
      filepermmode: 'long',
      owner: 'u',
      group: 'g',
    }),
    fileItem('archive.zip', {
      icon: 'icon fa fa-file-archive-o',
      ext: 'zip',
      mime_type: 'application/zip',
      size: '2 KB',
      size_raw: 2048,
      lastmodified: 1700000200,
      fileperms: 'rw- r-- r--',
      filepermmode: 'long',
      owner: 'u',
      group: 'g',
    }),
    fileItem('song.mp3', {
      icon: 'icon fa fa-file-audio-o',
      ext: 'mp3',
      mime_type: 'audio/mpeg',
      size: '3 KB',
      size_raw: 3072,
      lastmodified: 1700000300,
      fileperms: 'rw- r-- r--',
      filepermmode: 'long',
      owner: 'u',
      group: 'g',
    }),
    fileItem('clip.mp4', {
      icon: 'icon fa fa-file-video-o',
      ext: 'mp4',
      mime_type: 'video/mp4',
      size: '4 KB',
      size_raw: 4096,
      lastmodified: 1700000400,
      fileperms: 'rw- r-- r--',
      filepermmode: 'long',
      owner: 'u',
      group: 'g',
    }),
    fileItem('blob.bin', {
      ext: 'bin',
      mime_type: 'application/octet-stream',
      size: '5 KB',
      size_raw: 5120,
      lastmodified: 1700000500,
      fileperms: 'rw- r-- r--',
      filepermmode: 'long',
      owner: 'u',
      group: 'g',
    }),
  ]
}

export function resetStore(configOver: Partial<IfmConfig> = {}): void {
  store.config = fakeConfig(configOver)
  store.booted = true
  store.bootError = ''
  store.authenticated = true
  store.loginError = ''
  store.loginBusy = false
  store.currentDir = ''
  store.files = []
  store.filesLoading = false
  store.selected = new Set<string>()
  store.highlighted = ''
  store.sortKey = 'name'
  store.sortDir = 1
  store.filter = ''
  store.page = 1
  store.tasks = []
  store.tasksExpanded = false
  store.toasts = []
  store.modal = { kind: null, payload: undefined }
  store.contextMenu = null
  store.searchBaseDir = ''
  store.searchPattern = ''
  store.searchResults = []
  store.searchBusy = false
  store.copyMoveDest = ''
  modalControls.guard = null
  window.localStorage.clear()
  window.location.hash = ''
  document.onkeydown = null
  document.body.innerHTML = ''
}

export function loadFiles(configOver: Partial<IfmConfig> = {}): void {
  resetStore(configOver)
  store.files = enrichFileList(rawFiles(), store.config as IfmConfig, '')
}

// Route fetch() by the `api` form field. The handler returns the JSON body,
// throws to simulate a network failure, or returns the INVALID_JSON marker.
export const INVALID_JSON = Symbol('invalid-json')

export type FetchHandler = (api: string, body: URLSearchParams, headers: Record<string, string>) => unknown

export function mockFetch(handler: FetchHandler): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: unknown, init?: { body?: unknown; headers?: Record<string, string> }) => {
      const raw = init?.body
      const body = raw instanceof URLSearchParams ? raw : new URLSearchParams(String(raw ?? ''))
      const result = handler(body.get('api') ?? '', body, init?.headers ?? {})
      if (result instanceof Error) throw result
      if (result === INVALID_JSON) {
        return {
          ok: false,
          json: async (): Promise<unknown> => {
            throw new Error('no json')
          },
        }
      }
      return { ok: true, json: async () => result }
    }),
  )
}

// Minimal XHR stand-in for upload tests (fetch has no upload progress).
export class MockXHR {
  static last: MockXHR | null = null
  upload: {
    onprogress: ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) | null
    onload: (() => void) | null
  } = { onprogress: null, onload: null }
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  responseText = ''
  headers: Record<string, string> = {}
  open(): void {}
  setRequestHeader(k: string, v: string): void {
    this.headers[k] = v
  }
  send(): void {
    MockXHR.last = this
  }
  respondOk(obj: unknown): void {
    this.responseText = JSON.stringify(obj)
    this.onload?.()
  }
  respondRaw(text: string): void {
    this.responseText = text
    this.onload?.()
  }
  fail(): void {
    this.onerror?.()
  }
}

export function mockXHR(): void {
  MockXHR.last = null
  vi.stubGlobal('XMLHttpRequest', MockXHR)
}

export async function flush(times = 10): Promise<void> {
  for (let i = 0; i < times; i++) await Promise.resolve()
}
