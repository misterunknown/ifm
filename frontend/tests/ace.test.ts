import { describe, expect, it } from 'vitest'
import { availableModes, modeForFilename, modeLabel } from '../src/ace'

describe('modeForFilename', () => {
  it.each([
    ['app.js', 'ace/mode/javascript'],
    ['app.mjs', 'ace/mode/javascript'],
    ['app.ts', 'ace/mode/typescript'],
    ['data.json', 'ace/mode/json'],
    ['index.html', 'ace/mode/html'],
    ['style.css', 'ace/mode/css'],
    ['style.less', 'ace/mode/less'],
    ['style.sass', 'ace/mode/sass'],
    ['style.scss', 'ace/mode/scss'],
    ['index.php', 'ace/mode/php'],
    ['run.py', 'ace/mode/python'],
    ['Main.java', 'ace/mode/java'],
    ['main.c', 'ace/mode/c_cpp'],
    ['main.hpp', 'ace/mode/c_cpp'],
    ['run.sh', 'ace/mode/sh'],
    ['notes.txt', 'ace/mode/sh'],
    ['dump.sql', 'ace/mode/sql'],
    ['feed.xml', 'ace/mode/xml'],
    ['icon.svg', 'ace/mode/xml'],
    ['conf.yaml', 'ace/mode/yaml'],
    ['conf.yml', 'ace/mode/yaml'],
    ['readme.md', 'ace/mode/markdown'],
    ['script.pl', 'ace/mode/perl'],
    ['app.rb', 'ace/mode/ruby'],
    ['main.go', 'ace/mode/golang'],
    ['main.rs', 'ace/mode/rust'],
    ['Makefile', 'ace/mode/makefile'],
    ['makefile', 'ace/mode/makefile'],
    ['Dockerfile', 'ace/mode/dockerfile'],
    ['dockerfile', 'ace/mode/dockerfile'],
  ])('maps %s', (filename, mode) => {
    expect(modeForFilename(filename)).toBe(mode)
  })
  it('is case-insensitive and falls back to text', () => {
    expect(modeForFilename('APP.JS')).toBe('ace/mode/javascript')
    expect(modeForFilename('blob.unknownext')).toBe('ace/mode/text')
    expect(modeForFilename('noextension')).toBe('ace/mode/text')
    expect(modeForFilename('.hidden')).toBe('ace/mode/text')
  })
})

describe('availableModes', () => {
  it('returns a sorted unique list including text', () => {
    const modes = availableModes()
    expect(new Set(modes).size).toBe(modes.length)
    expect([...modes].sort()).toEqual(modes)
    expect(modes).toContain('ace/mode/text')
    expect(modes).toContain('ace/mode/javascript')
  })
})

describe('modeLabel', () => {
  it('strips the ace prefix', () => {
    expect(modeLabel('ace/mode/python')).toBe('python')
  })
})
