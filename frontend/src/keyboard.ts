// Global keyboard shortcuts, ported from IFM.handleKeystrokes. Highlighting is
// tracked in the store; rows expose it via the .highlightedItem class.
import {
  changeDirectory,
  fileByGuid,
  getContent,
  openModal,
  refreshFiles,
  selectedFiles,
  store,
  toggleSelect,
  tryCloseModal,
} from './store'
import type { EnrichedFile } from './api'

function isFormElement(el: EventTarget | null): boolean {
  let node = el as HTMLElement | null
  while (node) {
    const tag = node.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || node.isContentEditable) return true
    if (node === document.body) break
    node = node.parentElement
  }
  return false
}

function highlightedFile(): EnrichedFile | undefined {
  if (!store.highlighted) return undefined
  return fileByGuid(store.highlighted)
}

function focusGuid(g: string): void {
  store.highlighted = g
  const anchor = document.querySelector(`#filetable tr[data-guid="${CSS.escape(g)}"] a.ifmitem`) as HTMLElement | null
  if (anchor) {
    anchor.focus({ preventScroll: true })
    anchor.scrollIntoView({ block: 'nearest' })
  }
}

export function highlightMove(direction: 'next' | 'prev'): void {
  const rows = [...document.querySelectorAll('#filetable tbody tr.clickable-row')] as HTMLElement[]
  if (rows.length === 0) return
  const idx = rows.findIndex((r) => r.dataset['guid'] === store.highlighted)
  if (idx === -1) {
    const first = rows[0].dataset['guid']
    if (first) focusGuid(first)
    return
  }
  const next = direction === 'next' ? rows[idx + 1] : rows[idx - 1]
  if (next?.dataset['guid']) focusGuid(next.dataset['guid'])
}

function deleteFlow(items: EnrichedFile[]): void {
  openModal('delete', { guids: items.map((f) => f.guid) })
}

function copyMoveFlow(items: EnrichedFile[]): void {
  openModal('copyMove', { guids: items.map((f) => f.guid) })
}

async function editOrExtract(item: EnrichedFile): Promise<void> {
  const cfg = store.config
  if (!cfg) return
  if (cfg.edit && item.eaction === 'edit') {
    const data = await getContent(item.name)
    if (data) openModal('editor', { filename: data.filename, content: data.content, isNew: false })
  } else if (cfg.extract && item.eaction === 'extract') {
    openModal('extract', { filename: item.name })
  }
}

export function installKeyboard(): void {
  document.onkeydown = (e: KeyboardEvent) => {
    // A modal owns the keyboard, except for Escape which closes it.
    if (store.modal.kind) {
      if (e.key === 'Escape') {
        e.preventDefault()
        tryCloseModal()
      }
      return
    }
    if (store.contextMenu) {
      if (e.key === 'Escape') store.contextMenu = null
      return
    }
    if (isFormElement(e.target)) return
    const cfg = store.config
    if (!cfg || !store.authenticated) return

    switch (e.key) {
      case '/':
        if (cfg.search) {
          e.preventDefault()
          openModal('search')
        }
        return
      case 'g':
        e.preventDefault()
        document.getElementById('currentDir')?.focus()
        return
      case 'r':
        if (cfg.showrefresh) {
          e.preventDefault()
          void refreshFiles()
        }
        return
      case 'u':
        if (cfg.upload) {
          e.preventDefault()
          openModal('upload')
        }
        return
      case 'o':
        if (cfg.remoteupload) {
          e.preventDefault()
          openModal('remoteUpload')
        }
        return
      case 'a':
        if (cfg.ajaxrequest) {
          e.preventDefault()
          openModal('ajax')
        }
        return
      case 'F':
        if (cfg.createfile) {
          e.preventDefault()
          openModal('editor', { filename: 'newfile.txt', content: '', isNew: true })
        }
        return
      case 'D':
        if (cfg.createdir) {
          e.preventDefault()
          openModal('createDir')
        }
        return
      case 'h':
      case 'ArrowLeft':
      case 'Backspace':
        e.preventDefault()
        void changeDirectory('..')
        return
      case 'j':
      case 'ArrowDown':
        e.preventDefault()
        highlightMove('next')
        return
      case 'k':
      case 'ArrowUp':
        e.preventDefault()
        highlightMove('prev')
        return
    }

    const item = highlightedFile()
    const selected = selectedFiles()

    switch (e.key) {
      case 'Delete':
        if (cfg.delete) {
          if (selected.length > 0) {
            e.preventDefault()
            deleteFlow(selected)
          } else if (item && item.name !== '..') {
            e.preventDefault()
            deleteFlow([item])
          }
        }
        return
      case 'c':
      case 'm':
        if (cfg.copymove) {
          if (selected.length > 0) {
            e.preventDefault()
            copyMoveFlow(selected)
          } else if (item && item.name !== '..') {
            e.preventDefault()
            copyMoveFlow([item])
          }
        }
        return
    }

    if (!item) return
    switch (e.key) {
      case 'l':
      case 'ArrowRight':
        if (item.type === 'dir') {
          e.preventDefault()
          void changeDirectory(item.name)
        }
        return
      case 'Escape': {
        const el = document.querySelector('.highlightedItem') as HTMLElement | null
        if (el && el.querySelector('a.ifmitem') === document.activeElement) {
          e.preventDefault()
          store.highlighted = ''
          ;(document.activeElement as HTMLElement).blur()
        }
        return
      }
      case ' ':
      case 'Enter': {
        const el = document.querySelector('.highlightedItem') as HTMLElement | null
        if (el && el.querySelector('a.ifmitem') === document.activeElement) {
          if (e.key === 'Enter' && el.classList.contains('isDir')) {
            e.preventDefault()
            e.stopPropagation()
            void changeDirectory(item.name)
          } else if (e.key === ' ' && item.name !== '..') {
            e.preventDefault()
            e.stopPropagation()
            toggleSelect(item.guid)
          }
        }
        return
      }
      case 'e':
        if ((cfg.edit && item.eaction === 'edit') || (cfg.extract && item.eaction === 'extract')) {
          e.preventDefault()
          void editOrExtract(item)
        }
        return
      case 'n':
        if (cfg.rename && item.name !== '..') {
          e.preventDefault()
          openModal('rename', { guid: item.guid })
        }
        return
    }
  }
}
