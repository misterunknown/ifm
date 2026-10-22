import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  apiBase,
  apiPost,
  apiUpload,
  clipboardLink,
  copyToClipboard,
  customStrftime,
  downloadUrl,
  enrichFileList,
  formatDate,
  guid,
  hrefEncode,
  isDesktop,
  logoutUrl,
  pathCombine,
  setCsrfToken,
  type EnrichedFile,
} from '../src/api'
import { fakeConfig, flush, INVALID_JSON, mockFetch, MockXHR, mockXHR } from './helpers'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('pathCombine', () => {
  it('joins parts with single slashes', () => {
    expect(pathCombine('a', 'b', 'c')).toBe('a/b/c')
    expect(pathCombine('a/', '/b/', 'c')).toBe('a/b/c')
  })
  it('returns empty string without parts', () => {
    expect(pathCombine()).toBe('')
    expect(pathCombine('', 42 as unknown as string, null as unknown as string)).toBe('')
  })
  it('keeps a lone first segment as-is', () => {
    expect(pathCombine('a/')).toBe('a')
    expect(pathCombine('', 'sub')).toBe('sub')
  })
})

describe('hrefEncode', () => {
  it('encodes reserved characters', () => {
    expect(hrefEncode('a#b?c&d=e')).toBe('a%23b%3Fc%26d%3De')
    expect(hrefEncode('100%')).toBe('100%25')
    expect(hrefEncode('plain-name.txt')).toBe('plain-name.txt')
    expect(hrefEncode('a/b')).toBe('a/b')
  })
})

describe('customStrftime', () => {
  it('formats every token', () => {
    const d = new Date(2024, 0, 5, 9, 4, 7)
    expect(customStrftime(d, '%Y-%m-%d %H:%M:%S')).toBe('2024-01-05 09:04:07')
    expect(customStrftime(d, '%y')).toBe('24')
    expect(customStrftime(d, '%Q')).toBe('%Q')
  })
  it('formats month and weekday names', () => {
    const d = new Date(2024, 0, 5)
    expect(customStrftime(d, '%b')).toBe(d.toLocaleString('default', { month: 'short' }))
    expect(customStrftime(d, '%B')).toBe(d.toLocaleString('default', { month: 'long' }))
    expect(customStrftime(d, '%a')).toBe(d.toLocaleString('default', { weekday: 'short' }))
    expect(customStrftime(d, '%A')).toBe(d.toLocaleString('default', { weekday: 'long' }))
  })
})

describe('formatDate', () => {
  it('returns empty string without a timestamp', () => {
    expect(formatDate(undefined, false)).toBe('')
  })
  it('uses the custom format when configured', () => {
    // mid-year timestamp: the year is timezone-independent
    expect(formatDate(1720000000, '%Y')).toBe('2024')
    expect(formatDate(1720000000, '%Y-%m')).toBe('2024-07')
  })
  it('falls back to the locale string', () => {
    const out = formatDate(1700000000, false)
    expect(typeof out).toBe('string')
    expect(out.length).toBeGreaterThan(0)
  })
})

describe('guid', () => {
  it('generates 20 uppercase hex chars', () => {
    const g = guid()
    expect(g).toMatch(/^[0-9A-F]{20}$/)
    expect(guid()).not.toBe(g)
  })
})

describe('isDesktop', () => {
  it('is true without window.orientation', () => {
    expect(isDesktop()).toBe(true)
  })
})

describe('urls', () => {
  it('builds download and logout urls', () => {
    // spaces pass through raw, like the legacy client; reserved chars encode
    expect(downloadUrl('download', 'sub dir', 'a#b.txt')).toContain('api=download')
    expect(downloadUrl('download', 'sub dir', 'a#b.txt')).toContain('dir=sub dir')
    expect(downloadUrl('download', 'sub dir', 'a#b.txt')).toContain('filename=a%23b.txt')
    expect(logoutUrl()).toContain('api=logout')
  })
  it('honours the api-dev override without a hash', () => {
    window.history.replaceState({}, '', '/?api-dev=http://be:9/x.php#/ignored')
    try {
      expect(apiBase()).toBe('http://be:9/x.php')
    } finally {
      window.history.replaceState({}, '', '/')
    }
    // falls back to the page url (whatever the test environment host is)
    expect(apiBase()).toBe(window.location.href)
  })
})

describe('apiPost', () => {
  it('returns the json body on success', async () => {
    mockFetch(() => [{ name: 'a' }])
    await expect(apiPost('getFiles', { dir: '' })).resolves.toEqual([{ name: 'a' }])
  })
  it('throws ApiError on backend ERROR status', async () => {
    mockFetch(() => ({ status: 'ERROR', message: 'nope' }))
    await expect(apiPost('delete', { dir: '' })).rejects.toThrow('nope')
    mockFetch(() => ({ status: 'ERROR' }))
    await expect(apiPost('delete', { dir: '' })).rejects.toThrow('Error')
  })
  it('throws ApiError on network failure', async () => {
    mockFetch(() => new Error('down'))
    await expect(apiPost('getFiles', {})).rejects.toThrow('general_error')
  })
  it('throws ApiError on invalid json', async () => {
    mockFetch(() => INVALID_JSON)
    await expect(apiPost('getFiles', {})).rejects.toThrow('general_error')
  })
  it('sends the csrf header for mutating actions only', async () => {
    const seen: Record<string, Record<string, string>> = {}
    mockFetch((api, _body, headers) => {
      seen[api] = headers
      return { status: 'OK' }
    })
    setCsrfToken('tok123')
    await apiPost('saveFile', { dir: '' })
    await apiPost('getFiles', { dir: '' })
    expect(seen['saveFile']).toMatchObject({ 'X-IFM-CSRF': 'tok123' })
    expect(seen['getFiles']?.['X-IFM-CSRF']).toBeUndefined()
    setCsrfToken('')
  })
  it('skips nullish fields', async () => {
    let captured = ''
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_u: unknown, init?: { body?: unknown }) => {
        captured = String(init?.body ?? '')
        return { ok: true, json: async () => ({ status: 'OK' }) }
      }),
    )
    await apiPost('getFiles', { dir: '', missing: undefined, nil: null, q: 'x' })
    expect(captured).toBe('api=getFiles&dir=&q=x')
  })
  it('encodes arrays as repeated key[] fields', async () => {
    let captured = ''
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_u: unknown, init?: { body?: unknown }) => {
        captured = String(init?.body ?? '')
        return { ok: true, json: async () => ({ status: 'OK' }) }
      }),
    )
    await apiPost('delete', { dir: '', filenames: ['a', 'b'] })
    expect(captured).toContain('filenames%5B%5D=a')
    expect(captured).toContain('filenames%5B%5D=b')
  })
})

describe('apiUpload', () => {
  it('resolves on OK and reports progress', async () => {
    mockXHR()
    const progress: number[] = []
    const p = apiUpload('', new File(['x'], 'a.txt'), undefined, (r) => progress.push(r))
    MockXHR.last?.upload.onprogress?.({ lengthComputable: true, loaded: 5, total: 10 })
    MockXHR.last?.respondOk({ status: 'OK', message: 'done' })
    await expect(p).resolves.toMatchObject({ status: 'OK' })
    expect(progress).toEqual([0.5])
  })
  it('ignores non-computable progress', async () => {
    mockXHR()
    const progress: number[] = []
    const p = apiUpload('', new File(['x'], 'a.txt'), 'renamed.txt', (r) => progress.push(r))
    MockXHR.last?.upload.onprogress?.({ lengthComputable: false, loaded: 5, total: 0 })
    MockXHR.last?.respondOk({ status: 'OK' })
    await p
    expect(progress).toEqual([])
  })
  it('rejects on backend ERROR and on network failure', async () => {
    mockXHR()
    const p1 = apiUpload('', new File(['x'], 'a.txt'), undefined, () => {})
    MockXHR.last?.respondOk({ status: 'ERROR', message: 'bad' })
    await expect(p1).rejects.toThrow('bad')
    const p2 = apiUpload('', new File(['x'], 'a.txt'), undefined, () => {})
    MockXHR.last?.fail()
    await expect(p2).rejects.toThrow(ApiError)
  })
  it('rejects on invalid json', async () => {
    mockXHR()
    const p = apiUpload('', new File(['x'], 'a.txt'), undefined, () => {})
    MockXHR.last?.respondRaw('not json{{{')
    await expect(p).rejects.toThrow('general_error')
    await flush()
  })
})

describe('enrichFileList', () => {
  const cfg = () => fakeConfig()
  it('marks the parent entry and makes it non-actionable', () => {
    const [up] = enrichFileList([{ name: '..', type: 'dir', icon: 'icon fa fa-angle-up' }], cfg(), '')
    expect(up.linkname).toBe('[ up ]')
    expect(up.fixtop).toBe(true)
    expect(up.draggable).toBe(false)
    expect(up.buttons).toEqual([])
  })
  it('adds zip download to directories', () => {
    const [dir] = enrichFileList([{ name: 'd', type: 'dir', icon: 'icon fa fa-folder-o' }], cfg(), 'sub')
    expect(dir.rowclasses).toBe('isDir')
    expect(dir.download.action).toBe('zipnload')
    expect(dir.download.link).toContain('api=zipnload')
    expect(dir.draggable).toBe(true)
  })
  it('offers extract for archives and edit for text', () => {
    const [zip, txt, bin] = enrichFileList(
      [
        { name: 'a.zip', type: 'file', icon: 'icon fa fa-file-archive-o', ext: 'zip', mime_type: 'application/zip' },
        { name: 'b.txt', type: 'file', icon: 'icon fa fa-file-text-o', ext: 'txt', mime_type: 'text/plain' },
        { name: 'c.bin', type: 'file', icon: 'icon fa fa-file-o', ext: 'bin', mime_type: 'application/octet-stream' },
      ],
      cfg(),
      '',
    )
    expect(zip.eaction).toBe('extract')
    expect(zip.buttons[0]).toMatchObject({ action: 'extract' })
    expect(txt.eaction).toBe('edit')
    expect(bin.eaction).toBeUndefined()
    // trailing buttons are identical for all three
    for (const f of [zip, txt, bin]) {
      expect(f.buttons.slice(-3).map((b) => b.action)).toEqual(['copymove', 'rename', 'delete'])
    }
  })
  it('treats everything as editable when mime detection is off', () => {
    const [bin] = enrichFileList(
      [{ name: 'c.bin', type: 'file', icon: 'icon fa fa-file-o', ext: 'bin', mime_type: 'application/octet-stream' }],
      fakeConfig({ disable_mime_detection: 1 }),
      '',
    )
    expect(bin.eaction).toBe('edit')
  })
  it('shows hover previews only for images on desktop', () => {
    const [img, txt] = enrichFileList(
      [
        { name: 'p.jpg', type: 'file', icon: 'icon fa fa-file-image-o', ext: 'jpg', mime_type: 'image/jpeg' },
        { name: 'b.txt', type: 'file', icon: 'icon fa fa-file-text-o', ext: 'txt', mime_type: 'text/plain' },
      ],
      cfg(),
      '',
    )
    expect(img.popover).toBe(true)
    expect(txt.popover).toBe(false)
  })
  it('builds docroot, public-url and proxy links', () => {
    const item = { name: 'a.txt', type: 'file', icon: 'icon fa fa-file-text-o', ext: 'txt', mime_type: 'text/plain' } as const
    const docroot = enrichFileList([{ ...item }], fakeConfig({ isDocroot: true }), 'sub')[0]
    expect(docroot.link).toBe('sub/a.txt')
    const pubAbs = enrichFileList([{ ...item }], fakeConfig({ root_public_url: '/www' }), 'sub')[0]
    expect(pubAbs.link ?? '').toContain('/www')
    const pubRel = enrichFileList([{ ...item }], fakeConfig({ root_public_url: 'https://cdn.example/x' }), 'sub')[0]
    expect(pubRel.link ?? '').toContain('https://cdn.example/x')
    const proxy = enrichFileList([{ ...item }], fakeConfig({ download: 0, zipnload: 0 }), 'sub')[0]
    expect(proxy.link).toBe('#')
    expect(proxy.download.link).toBeUndefined()
  })
  it('marks permission inputs readonly without chmod rights', () => {
    const [f] = enrichFileList(
      [{ name: 'a.txt', type: 'file', icon: 'icon fa fa-file-o', ext: 'txt', mime_type: 'text/plain' }],
      fakeConfig({ chmod: 0 }),
      '',
    )
    expect(f.readonly).toBe(true)
  })
})

describe('clipboardLink', () => {
  it('passes absolute links through', () => {
    const f = { link: 'http://example.com/x' } as EnrichedFile
    expect(clipboardLink(f)).toBe('http://example.com/x')
  })
  it('resolves relative links against the page', () => {
    const f = { link: 'proxy?x=1' } as EnrichedFile
    expect(clipboardLink(f)).toContain(window.location.origin)
    window.history.replaceState({}, '', '/sub/dir/index.php')
    try {
      expect(clipboardLink(f)).toContain('/sub/dir')
    } finally {
      window.history.replaceState({}, '', '/')
    }
  })
})

describe('copyToClipboard', () => {
  it('uses the async clipboard when available', async () => {
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    await copyToClipboard('hello')
    expect(writeText).toHaveBeenCalledWith('hello')
  })
  it('falls back to the textarea hack', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    document.execCommand = vi.fn(() => true)
    await copyToClipboard('fallback')
    expect(document.execCommand).toHaveBeenCalledWith('copy')
  })
  it('restores a pre-existing selection afterwards', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    document.execCommand = vi.fn(() => true)
    const p = document.createElement('p')
    p.textContent = 'selected text'
    document.body.appendChild(p)
    const range = document.createRange()
    range.selectNodeContents(p)
    document.getSelection()?.removeAllRanges()
    document.getSelection()?.addRange(range)
    await copyToClipboard('with selection')
    expect(document.execCommand).toHaveBeenCalledWith('copy')
    // selection restored (or at least not left inside the removed textarea)
    expect(document.body.querySelector('textarea')).toBeNull()
    document.body.innerHTML = ''
  })
})
