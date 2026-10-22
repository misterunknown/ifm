import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FolderTree from '../src/components/FolderTree.vue'
import { flush, loadFiles, mockFetch, mountWithStubs, resetStore } from './helpers'

beforeEach(() => {
  loadFiles()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  resetStore()
})

describe('FolderTree', () => {
  it('expands, selects and collapses nodes', async () => {
    mockFetch((api, body) => {
      if (api === 'getFolders' && body.get('dir') === '/sub') return [{ text: 'deep', dataAttr: { path: '/sub/deep' } }]
      if (api === 'getFolders') return [{ text: 'sub', dataAttr: { path: '/sub' } }]
      return { status: 'OK' }
    })
    const wrapper = mountWithStubs(FolderTree, { props: { selected: '' } })
    await flush()
    await wrapper.vm.$nextTick()
    const root = wrapper.findAll('.ifm-tree-node')[0]
    expect(root?.text()).toContain('/ [root]')
    // children of the pre-expanded root are visible
    expect(wrapper.text()).toContain('sub')
    const sub = wrapper.findAll('.ifm-tree-node').find((n) => n.text().includes('sub'))
    await sub?.trigger('click')
    await flush()
    expect(wrapper.emitted('update:selected')?.[0]).toEqual(['/sub'])
    expect(wrapper.text()).toContain('deep')
    // clicking again collapses without another request
    await sub?.trigger('click')
    expect(wrapper.text()).not.toContain('deep')
  })
})
