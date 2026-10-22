import { afterEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { loadChildren, type TreeNode } from '../src/tree'
import { store } from '../src/store'
import { mockFetch, resetStore } from './helpers'

function node(path: string): TreeNode {
  return reactive({ text: path || '/ [root]', path, children: null, loading: false })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('loadChildren', () => {
  it('loads the root without a dir and maps dataAttr', async () => {
    resetStore()
    const seen: Array<Record<string, unknown>> = []
    mockFetch((api, body) => {
      expect(api).toBe('getFolders')
      seen.push(Object.fromEntries(body.entries()))
      return [{ text: 'sub', dataAttr: { path: '/root/sub' } }]
    })
    const root = node('')
    await loadChildren(root)
    expect(seen[0]).not.toHaveProperty('dir')
    expect(root.children).toHaveLength(1)
    expect(root.children?.[0]).toMatchObject({ text: 'sub', path: '/root/sub' })
  })
  it('passes dir for subfolders and maps dataAttributes', async () => {
    resetStore()
    const seen: string[] = []
    mockFetch((_api, body) => {
      seen.push(body.get('dir') ?? '')
      return [{ text: 'deep', dataAttributes: { path: '/root/sub/deep' } }]
    })
    const sub = node('/root/sub')
    await loadChildren(sub)
    expect(seen).toEqual(['/root/sub'])
    expect(sub.children?.[0].path).toBe('/root/sub/deep')
  })
  it('loads only once and toasts on error', async () => {
    resetStore()
    let calls = 0
    mockFetch(() => {
      calls++
      return { status: 'ERROR', message: 'boom' }
    })
    const sub = node('/x')
    await loadChildren(sub)
    await loadChildren(sub)
    expect(calls).toBe(1)
    expect(sub.children).toEqual([])
    expect(store.toasts.some((t) => t.kind === 'danger')).toBe(true)
  })
  it('tolerates nodes without path attributes', async () => {
    resetStore()
    mockFetch(() => [{ text: 'bare' }])
    const root = node('')
    await loadChildren(root)
    expect(root.children?.[0]).toMatchObject({ text: 'bare', path: '' })
  })
  it('ignores concurrent loads of the same node', async () => {
    resetStore()
    let calls = 0
    mockFetch(() => {
      calls++
      return []
    })
    const sub = node('/x')
    await Promise.all([loadChildren(sub), loadChildren(sub)])
    expect(calls).toBe(1)
  })
})
