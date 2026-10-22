// Shared jsdom shims for the test suite. The app only uses these two
// browser APIs that jsdom does not implement.
if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = function (): void {}
}

const g = globalThis as unknown as { CSS?: { escape?: (s: string) => string } }
if (!g.CSS) {
  g.CSS = {
    escape: (s: string): string => s.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`),
  }
} else if (!g.CSS.escape) {
  g.CSS.escape = (s: string): string => s.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`)
}
