// IFM backend API client.
//
// The PHP backend (src/main.php, IFM::dispatch) speaks POST form-encoded
// requests with an `api` action field and answers JSON. Successful data
// responses are returned as-is; `{status: "ERROR", message}` responses throw
// ApiError. State-changing actions additionally require the X-IFM-CSRF header
// (the token comes from `getConfig`).

export interface IfmConfig {
  auth: number
  ajaxrequest: number
  chmod: number
  copymove: number
  createdir: number
  createfile: number
  edit: number
  delete: number
  download: number
  extract: number
  upload: number
  remoteupload: number
  rename: number
  zipnload: number
  createarchive: number
  search: number
  paging: number
  pageLength: number
  showlastmodified: number
  showfilesize: number
  showowner: number
  showgroup: number
  showpermissions: number
  showhtdocs: number
  showhiddenfiles: number
  showpath: number
  contextmenu: number
  disable_mime_detection: number
  showrefresh: number
  forceproxy: number
  confirmoverwrite: number
  customDateFormat: string | false
  language: string
  timezone: string
  inline: boolean
  isDocroot: boolean
  root_public_url: string
  csrf_token: string
  [key: string]: unknown
}

// Raw file item as returned by getFiles / searchItems.
export interface FileItem {
  name: string
  type: 'dir' | 'file'
  icon: string
  ext?: string
  mime_type?: string
  size?: string
  size_raw?: number
  lastmodified?: number
  fileperms?: string
  filepermmode?: 'short' | 'long'
  owner?: string | false
  group?: string | false
  [key: string]: unknown
}

export interface FileButton {
  action: 'edit' | 'extract' | 'copymove' | 'rename' | 'delete'
  icon: string
  title: string
}

// File item with the derived presentation fields the old Mustache templates
// used to compute in rebuildFileTable().
export interface EnrichedFile extends FileItem {
  guid: string
  linkname: string
  link: string
  fixtop: boolean
  draggable: boolean
  rowclasses: string
  eaction?: 'edit' | 'extract'
  popover: boolean
  readonly: boolean
  lastmodified_hr: string
  buttons: FileButton[]
  download: { name: string; action?: 'download' | 'zipnload'; icon?: string; link?: string }
}

export interface FolderNode {
  text: string
  path: string
  children: FolderNode[] | null
}

export interface SearchResult extends FileItem {
  folder: string
  linkname: string
  guid: string
}

export class ApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

let csrfToken = ''

// Actions that mutate state. Must stay in sync with the CSRF check in
// IFM::dispatch() (src/main.php).
const MUTATING = new Set([
  'createDir',
  'saveFile',
  'delete',
  'rename',
  'extract',
  'upload',
  'copyMove',
  'changePermissions',
  'remoteUpload',
  'createArchive',
])

export function setCsrfToken(token: string): void {
  csrfToken = token
}

// Base URL of the PHP backend. Same rule as the legacy client: the current
// page URL without the hash. `?api-dev=<url>` overrides it so `npm run dev`
// can talk to a local `php -S` backend.
export function apiBase(): string {
  const dev = new URLSearchParams(window.location.search).get('api-dev')
  if (dev) return dev
  return window.location.href.replace(/#.*/, '')
}

function encodeFields(action: string, fields: Record<string, unknown>): URLSearchParams {
  const body = new URLSearchParams()
  body.append('api', action)
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue
    if (Array.isArray(value)) {
      for (const v of value) body.append(`${key}[]`, String(v))
    } else {
      body.append(key, String(value))
    }
  }
  return body
}

function headersFor(action: string): Record<string, string> {
  if (MUTATING.has(action) && csrfToken) return { 'X-IFM-CSRF': csrfToken }
  return {}
}

function throwIfError(json: unknown): void {
  if (json !== null && typeof json === 'object' && 'status' in json) {
    const rec = json as Record<string, unknown>
    if (rec['status'] === 'ERROR') throw new ApiError(String(rec['message'] ?? 'Error'))
  }
}

// Generic POST. `dir` is passed explicitly by callers (mirrors the legacy
// client which sent `dir: currentDir` with every file operation).
export async function apiPost<T>(action: string, fields: Record<string, unknown> = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(apiBase(), {
      method: 'POST',
      headers: { ...headersFor(action) },
      body: encodeFields(action, fields),
    })
  } catch {
    throw new ApiError('general_error')
  }
  let json: unknown
  try {
    json = await res.json()
  } catch {
    throw new ApiError('general_error')
  }
  throwIfError(json)
  return json as T
}

// Multipart upload with progress events (fetch has no upload progress, hence XHR).
export function apiUpload(
  dir: string,
  file: File,
  newfilename: string | undefined,
  onProgress: (ratio: number) => void,
): Promise<{ status: string; message?: string; cd?: string }> {
  return new Promise((resolve, reject) => {
    const data = new FormData()
    data.append('api', 'upload')
    data.append('dir', dir)
    data.append('file', file)
    if (newfilename) data.append('newfilename', newfilename)
    const xhr = new XMLHttpRequest()
    xhr.open('POST', apiBase())
    const headers = headersFor('upload')
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v)
    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable && evt.total > 0) onProgress(evt.loaded / evt.total)
    }
    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText) as unknown
        try {
          throwIfError(json)
        } catch (e) {
          reject(e)
          return
        }
        resolve(json as { status: string; message?: string; cd?: string })
      } catch {
        reject(new ApiError('general_error'))
      }
    }
    xhr.onerror = () => reject(new ApiError('general_error'))
    xhr.send(data)
  })
}

// Direct (non-JSON) backend URLs: download, proxy and zipnload stream file
// bytes, logout navigates away.
export function downloadUrl(action: 'download' | 'proxy' | 'zipnload', dir: string, filename: string): string {
  return `${apiBase()}?api=${action}&dir=${hrefEncode(dir)}&filename=${hrefEncode(filename)}`
}

export function logoutUrl(): string {
  return `${apiBase()}?api=logout`
}

// --- helpers ported 1:1 from the legacy client ---

export function pathCombine(...args: unknown[]): string {
  const parts = (args as unknown[]).filter((x) => typeof x === 'string' && x !== '') as string[]
  if (parts.length === 0) return ''
  let first = ''
  while (first.length < 1 && parts.length > 0) first = parts.shift() as string
  first = first.replace(/\/+$/g, '')
  if (parts.length === 0) return first
  const rest = parts.map((v) => v.replace(/^\/*|\/*$/g, ''))
  return [first, ...rest].join('/')
}

export function hrefEncode(s: string): string {
  return s
    .replace(/%/g, '%25')
    .replace(/;/g, '%3B')
    .replace(/\?/g, '%3F')
    .replace(/:/g, '%3A')
    .replace(/@/g, '%40')
    .replace(/&/g, '%26')
    .replace(/=/g, '%3D')
    .replace(/\+/g, '%2B')
    .replace(/\$/g, '%24')
    .replace(/,/g, '%2C')
    .replace(/</g, '%3C')
    .replace(/>/g, '%3E')
    .replace(/#/g, '%23')
    .replace(/"/g, '%22')
    .replace(/{/g, '%7B')
    .replace(/}/g, '%7D')
    .replace(/\|/g, '%7C')
    .replace(/\^/g, '%5E')
    .replace(/\[/g, '%5B')
    .replace(/\]/g, '%5D')
    .replace(/\\/g, '%5C')
    .replace(/`/g, '%60')
}

export function customStrftime(date: Date, format: string): string {
  const pad = (num: number, size = 2): string => String(num).padStart(size, '0')
  const replacements: Record<string, string | number> = {
    '%Y': date.getFullYear(),
    '%m': pad(date.getMonth() + 1),
    '%d': pad(date.getDate()),
    '%H': pad(date.getHours()),
    '%M': pad(date.getMinutes()),
    '%S': pad(date.getSeconds()),
    '%y': String(date.getFullYear()).slice(-2),
    '%b': date.toLocaleString('default', { month: 'short' }),
    '%B': date.toLocaleString('default', { month: 'long' }),
    '%a': date.toLocaleString('default', { weekday: 'short' }),
    '%A': date.toLocaleString('default', { weekday: 'long' }),
  }
  return format.replace(/%[a-zA-Z]/g, (match) => String(replacements[match] ?? match))
}

export function formatDate(timestamp: number | undefined, customFormat: string | false | undefined): string {
  if (timestamp === undefined) return ''
  const d = new Date(timestamp * 1000)
  if (customFormat) return customStrftime(d, customFormat)
  return d.toLocaleString(navigator.language || 'en-US')
}

export function guid(): string {
  let result = ''
  for (let j = 0; j < 20; j++) result += Math.floor(Math.random() * 16).toString(16).toUpperCase()
  return result
}

export function isDesktop(): boolean {
  return typeof window.orientation === 'undefined'
}

// Mirrors the enrichment rebuildFileTable() applied to every item before
// rendering the Mustache filetable template.
export function enrichFileList(items: FileItem[], config: IfmConfig, currentDir: string): EnrichedFile[] {
  return items.map((item) => {
    const e = item as EnrichedFile
    e.guid = guid()
    e.linkname = item.name === '..' ? '[ up ]' : item.name
    e.fixtop = item.name === '..'
    e.draggable = item.name !== '.' && item.name !== '..'
    e.rowclasses = ''
    e.buttons = []
    e.popover = false
    e.readonly = !config.chmod
    e.lastmodified_hr = formatDate(item.lastmodified, config.customDateFormat)
    e.download = { name: item.name === '..' ? '.' : item.name }

    if (item.type === 'dir') {
      if (config.download && config.zipnload) {
        e.download.action = 'zipnload'
        e.download.icon = 'icon fa fa-fw fa-cloud-download'
      }
      e.rowclasses = 'isDir'
    } else {
      if (config.download) {
        e.download.action = 'download'
        e.download.icon = 'icon fa fa-fw fa-download'
      }
      if (item.icon.indexOf('file-image') !== -1 && isDesktop()) e.popover = true
      const extractable = ['zip', 'tar', 'tgz', 'tar.gz', 'tar.xz', 'tar.bz2']
      if (config.extract && item.ext && extractable.includes(item.ext)) {
        e.eaction = 'extract'
        e.buttons.push({ action: 'extract', icon: 'icon fa fa-fw fa-file-archive-o', title: 'extract' })
      } else if (
        config.edit &&
        (config.disable_mime_detection ||
          (typeof item.mime_type === 'string' &&
            (item.mime_type.substring(0, 4) === 'text' ||
              item.mime_type.indexOf('x-empty') !== -1 ||
              item.mime_type.indexOf('xml') !== -1 ||
              item.mime_type.indexOf('json') !== -1)))
      ) {
        e.eaction = 'edit'
        e.buttons.push({ action: 'edit', icon: 'icon fa fa-fw fa-pencil', title: 'edit' })
      }
    }

    e.download.link = e.download.action
      ? downloadUrl(e.download.action, currentDir, e.download.name)
      : undefined

    if (config.isDocroot && !config.forceproxy) {
      e.link = pathCombine(hrefEncode(currentDir), hrefEncode(item.name))
    } else if (config.download && config.zipnload) {
      if (config.root_public_url) {
        if (config.root_public_url.charAt(0) === '/') {
          e.link = pathCombine(window.location.origin, config.root_public_url, hrefEncode(currentDir), hrefEncode(item.name))
        } else {
          e.link = pathCombine(config.root_public_url, hrefEncode(currentDir), hrefEncode(item.name))
        }
      } else {
        e.link = downloadUrl(e.download.action === 'zipnload' ? 'zipnload' : 'proxy', currentDir, e.download.name)
      }
    } else {
      e.link = '#'
    }

    if (item.name !== '.' && item.name !== '..') {
      if (config.copymove) e.buttons.push({ action: 'copymove', icon: 'icon fa fa-fw fa-files-o', title: 'copy/move' })
      if (config.rename) e.buttons.push({ action: 'rename', icon: 'icon fa fa-fw fa-terminal', title: 'rename' })
      if (config.delete) e.buttons.push({ action: 'delete', icon: 'icon fa fa-fw fa-trash', title: 'delete' })
    }
    return e
  })
}

// Absolute shareable link for the "copy link" action (same rules as the
// legacy context menu).
export function clipboardLink(item: EnrichedFile): string {
  if (item.link.toLowerCase().substring(0, 4) === 'http') return item.link
  const pathname = window.location.pathname.replace(/^\/*/g, '').split('/')
  pathname.pop()
  let link = pathCombine(window.location.origin, item.link)
  if (pathname.length > 0 && pathname[0] !== '') link = pathCombine(window.location.origin, pathname.join('/'), item.link)
  return link
}

export async function copyToClipboard(str: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(str)
    return
  } catch {
    // fall through to the legacy textarea hack
  }
  const el = document.createElement('textarea')
  el.value = str
  el.setAttribute('readonly', '')
  el.style.position = 'absolute'
  el.style.left = '-9999px'
  document.body.appendChild(el)
  const selected = document.getSelection() && document.getSelection()?.rangeCount ? document.getSelection()?.getRangeAt(0) : null
  el.select()
  document.execCommand('copy')
  document.body.removeChild(el)
  if (selected && document.getSelection()) {
    document.getSelection()?.removeAllRanges()
    document.getSelection()?.addRange(selected)
  }
}
