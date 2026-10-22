import { describe, expect, it } from 'vitest'
import { library } from '@fortawesome/fontawesome-svg-core'
import { faFile } from '@fortawesome/free-solid-svg-icons'
import { faIcon, registerIcons } from '../src/icons'

// Every icon class the PHP backend can send (IFM::getTypeIcon plus the
// hardcoded UI icons from the legacy templates).
const BACKEND_ICONS = [
  'icon fa fa-angle-up',
  'icon fa fa-folder-o',
  'icon fa fa-file-audio-o',
  'icon fa fa-file-image-o',
  'icon fa fa-file-video-o',
  'icon fa fa-file-code-o',
  'icon fa fa-file-word-o',
  'icon fa fa-file-text-o',
  'icon fa fa-file-excel-o',
  'icon fa fa-file-powerpoint-o',
  'icon fa fa-file-pdf-o',
  'icon fa fa-file-archive-o',
  'icon fa fa-file-o',
  'icon fa fa-fw fa-cloud-download',
  'icon fa fa-fw fa-download',
  'icon fa fa-fw fa-pencil',
  'icon fa fa-fw fa-files-o',
  'icon fa fa-fw fa-terminal',
  'icon fa fa-fw fa-trash',
  'icon fa fa-fw fa-file-archive-o',
]

const UI_ICONS = [
  'fa-refresh',
  'fa-search',
  'fa-upload',
  'fa-cloud-upload',
  'fa-external-link',
  'fa-sign-out',
  'fa-plus-square',
  'fa-minus-square-o',
  'fa-spinner',
  'fa-github',
  'fa-user-circle',
  'fa-key',
  'fa-brands fa-github',
]

describe('faIcon', () => {
  it('maps every backend icon to a real definition', () => {
    for (const cls of [...BACKEND_ICONS, ...UI_ICONS]) {
      const def = faIcon(cls)
      expect(def.iconName, cls).toBeTruthy()
      // fa-file-o intentionally maps to the generic file icon
      if (cls !== 'icon fa fa-file-o') expect(def, cls).not.toBe(faFile)
    }
    expect(faIcon('icon fa fa-file-o')).toBe(faFile)
  })
  it('falls back to the file icon for unknown classes', () => {
    expect(faIcon('icon fa fa-nope')).toBe(faFile)
    expect(faIcon('')).toBe(faFile)
  })
  it('registers all definitions without throwing', () => {
    expect(() => registerIcons(library)).not.toThrow()
  })
})
