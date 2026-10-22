// Icon mapping: the backend still sends Font Awesome 4 class names
// (see IFM::getTypeIcon in src/main.php). This module maps those tokens to
// current Font Awesome SVG definitions rendered by <FaIcon>.
import type { Library, IconDefinition } from '@fortawesome/fontawesome-svg-core'
import {
  faAngleUp,
  faArrowsRotate,
  faArrowUpRightFromSquare,
  faBoxArchive,
  faCheck,
  faChevronDown,
  faChevronRight,
  faCircleUser,
  faCloudArrowDown,
  faCloudArrowUp,
  faCopy,
  faDownload,
  faExpand,
  faFile,
  faFileArchive,
  faFileAudio,
  faFileCirclePlus,
  faFileCode,
  faFileExcel,
  faFileImage,
  faFileLines,
  faFilePdf,
  faFilePowerpoint,
  faFileVideo,
  faFileWord,
  faFileZipper,
  faFolder,
  faFolderPlus,
  faKey,
  faLink,
  faMagnifyingGlass,
  faMinus,
  faPencil,
  faPlus,
  faRightFromBracket,
  faSpinner,
  faSquareMinus,
  faSquarePlus,
  faTerminal,
  faTrash,
  faUpload,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { faGithub } from '@fortawesome/free-brands-svg-icons'

const MAP: Record<string, IconDefinition> = {
  // file type icons from the backend
  'fa-angle-up': faAngleUp,
  'fa-folder-o': faFolder,
  'fa-folder': faFolder,
  'fa-file-audio-o': faFileAudio,
  'fa-file-image-o': faFileImage,
  'fa-file-video-o': faFileVideo,
  'fa-file-code-o': faFileCode,
  'fa-file-word-o': faFileWord,
  'fa-file-text-o': faFileLines,
  'fa-file-excel-o': faFileExcel,
  'fa-file-powerpoint-o': faFilePowerpoint,
  'fa-file-pdf-o': faFilePdf,
  'fa-file-archive-o': faFileZipper,
  'fa-file-o': faFile,
  // toolbar / buttons / menus
  'fa-refresh': faArrowsRotate,
  'fa-search': faMagnifyingGlass,
  'fa-upload': faUpload,
  'fa-cloud-upload': faCloudArrowUp,
  'fa-cloud-download': faCloudArrowDown,
  'fa-download': faDownload,
  'fa-pencil': faPencil,
  'fa-files-o': faCopy,
  'fa-terminal': faTerminal,
  'fa-trash': faTrash,
  'fa-external-link': faArrowUpRightFromSquare,
  'fa-sign-out': faRightFromBracket,
  'fa-plus-square': faSquarePlus,
  'fa-minus-square-o': faSquareMinus,
  'fa-spinner': faSpinner,
  'fa-github': faGithub,
  'fa-user-circle': faCircleUser,
  'fa-key': faKey,
  'fa-plus': faPlus,
  'fa-minus': faMinus,
  'fa-file': faFile,
  'fa-link': faLink,
  'fa-archive': faFileArchive,
  'fa-box-archive': faBoxArchive,
  'fa-close': faXmark,
  'fa-times': faXmark,
  'fa-check': faCheck,
  'fa-chevron-right': faChevronRight,
  'fa-chevron-down': faChevronDown,
  'fa-expand': faExpand,
  'fa-file-new': faFileCirclePlus,
  'fa-folder-new': faFolderPlus,
}

export function faIcon(classNames: string): IconDefinition {
  const tokens = classNames.split(/\s+/)
  for (const token of tokens) {
    if (token === 'fa' || token === 'icon' || token === 'fa-fw' || token === 'fa-2x') continue
    if (token.startsWith('fa-') && MAP[token]) return MAP[token]
  }
  return faFile
}

export function registerIcons(library: Library): void {
  library.add(...Object.values(MAP))
}
