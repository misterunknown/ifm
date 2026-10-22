// ACE editor setup. Modes are bundled statically (the list below covers the
// editable extensions the backend reports) so the single-file build works
// offline; the backend `ace_includes` config is no longer needed.
import ace from 'ace-builds/src-noconflict/ace'
import 'ace-builds/src-noconflict/theme-chrome'
import 'ace-builds/src-noconflict/mode-text'
import 'ace-builds/src-noconflict/mode-javascript'
import 'ace-builds/src-noconflict/mode-typescript'
import 'ace-builds/src-noconflict/mode-json'
import 'ace-builds/src-noconflict/mode-html'
import 'ace-builds/src-noconflict/mode-css'
import 'ace-builds/src-noconflict/mode-less'
import 'ace-builds/src-noconflict/mode-sass'
import 'ace-builds/src-noconflict/mode-scss'
import 'ace-builds/src-noconflict/mode-php'
import 'ace-builds/src-noconflict/mode-python'
import 'ace-builds/src-noconflict/mode-java'
import 'ace-builds/src-noconflict/mode-c_cpp'
import 'ace-builds/src-noconflict/mode-sh'
import 'ace-builds/src-noconflict/mode-sql'
import 'ace-builds/src-noconflict/mode-xml'
import 'ace-builds/src-noconflict/mode-yaml'
import 'ace-builds/src-noconflict/mode-markdown'
import 'ace-builds/src-noconflict/mode-ini'
import 'ace-builds/src-noconflict/mode-perl'
import 'ace-builds/src-noconflict/mode-ruby'
import 'ace-builds/src-noconflict/mode-golang'
import 'ace-builds/src-noconflict/mode-rust'
import 'ace-builds/src-noconflict/mode-dockerfile'
import 'ace-builds/src-noconflict/mode-makefile'

export type { Ace } from './ace-types'
export { ace }

// extension -> ace mode, mirroring the editable types in IFM::MIME_MAP.
const EXT_MODE: Array<[string[], string]> = [
  [['js', 'mjs', 'cjs'], 'ace/mode/javascript'],
  [['ts', 'tsx', 'mts', 'cts'], 'ace/mode/typescript'],
  [['json', 'jsonc'], 'ace/mode/json'],
  [['html', 'htm'], 'ace/mode/html'],
  [['css'], 'ace/mode/css'],
  [['less'], 'ace/mode/less'],
  [['sass'], 'ace/mode/sass'],
  [['scss'], 'ace/mode/scss'],
  [['php', 'phtml'], 'ace/mode/php'],
  [['py'], 'ace/mode/python'],
  [['java'], 'ace/mode/java'],
  [['c', 'h', 'cpp', 'hpp', 'cc', 'ino'], 'ace/mode/c_cpp'],
  [['sh', 'bash', 'zsh', 'conf', 'ini', 'cfg', 'log', 'txt'], 'ace/mode/sh'],
  [['sql'], 'ace/mode/sql'],
  [['xml', 'svg', 'plist'], 'ace/mode/xml'],
  [['yaml', 'yml'], 'ace/mode/yaml'],
  [['md', 'markdown'], 'ace/mode/markdown'],
  [['pl', 'pm'], 'ace/mode/perl'],
  [['rb'], 'ace/mode/ruby'],
  [['go'], 'ace/mode/golang'],
  [['rs'], 'ace/mode/rust'],
  [['dockerfile'], 'ace/mode/dockerfile'],
  [['makefile', 'mk'], 'ace/mode/makefile'],
]

const DEFAULT_MODE = 'ace/mode/text'

export function modeForFilename(filename: string): string {
  const base = filename.substring(filename.lastIndexOf('/') + 1)
  const lower = base.toLowerCase()
  if (lower === 'dockerfile') return 'ace/mode/dockerfile'
  if (lower === 'makefile') return 'ace/mode/makefile'
  const dot = lower.lastIndexOf('.')
  const ext = dot > 0 ? lower.substring(dot + 1) : ''
  for (const [exts, mode] of EXT_MODE) {
    if (exts.includes(ext)) return mode
  }
  return DEFAULT_MODE
}

export function availableModes(): string[] {
  const modes = new Set<string>([DEFAULT_MODE])
  for (const [, mode] of EXT_MODE) modes.add(mode)
  return [...modes].sort()
}

export function modeLabel(mode: string): string {
  return mode.replace('ace/mode/', '')
}
