// Shared ACE editor typings (ace-builds ships no types of its own).
export interface AceSession {
  getValue(): string
  setValue(v: string): void
  setMode(m: string): void
  getMode(): { $id: string }
  setOption(k: string, v: unknown): void
  getOption(k: string): unknown
  setUseSoftTabs(v: boolean): void
  setTabSize(n: number): void
  setUseWrapMode(v: boolean): void
}

export interface AceEditor {
  $blockScrolling: unknown
  getSession(): AceSession
  getValue(): string
  setTheme(t: string): void
  setShowInvisibles(v: boolean): void
  getOption(k: string): unknown
  setOption(k: string, v: unknown): void
  focus(): void
  resize(): void
  destroy(): void
  on(event: string, cb: () => void): void
  commands: { addCommand(c: { name: string; bindKey: string; exec: (e: AceEditor) => void }): void }
  container: HTMLElement
}

export interface AceStatic {
  edit(el: string | HTMLElement, options?: Record<string, unknown>): AceEditor
}

export type Ace = AceStatic
