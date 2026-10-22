// Folder tree data for the copy/move destination picker (api=getFolders).
import { apiPost } from './api'
import { notifyError } from './store'

export interface TreeNode {
  text: string
  path: string
  children: TreeNode[] | null
  loading: boolean
}

interface BackendNode {
  text: string
  dataAttr?: { path: string }
  dataAttributes?: { path: string }
}

function toNode(raw: BackendNode): TreeNode {
  return {
    text: raw.text,
    path: raw.dataAttr?.path ?? raw.dataAttributes?.path ?? '',
    children: null,
    loading: false,
  }
}

export async function loadChildren(node: TreeNode): Promise<void> {
  if (node.children !== null || node.loading) return
  node.loading = true
  try {
    const data = await apiPost<BackendNode[]>('getFolders', node.path ? { dir: node.path } : {})
    node.children = (Array.isArray(data) ? data : []).map(toNode)
  } catch (e) {
    notifyError(e)
    node.children = []
  } finally {
    node.loading = false
  }
}
