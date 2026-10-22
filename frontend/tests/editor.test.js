// @vitest-environment jsdom
/**
 * Tests for the file editor dialog with the real ACE engine.
 * Oracle: showFileDialog in src/ifm.js + modal.file.html.
 */
import { describe, expect, it } from 'vitest';
import ace from 'ace-builds/src-noconflict/ace';

import FileEditorModal from '../src/components/FileEditorModal.vue';
import { flush, mountDialog, testStore } from './support.js';

function editorOf(wrapper) {
    return ace.edit(wrapper.find('#content').element);
}

describe('FileEditorModal', () => {
    it('edits existing files with the mode guessed from the extension', async () => {
        const store = testStore();
        store.state.files = [{ name: 'app.py' }];
        const wrapper = mountDialog(FileEditorModal, store, { filename: 'app.py', content: 'print(1)' });
        const editor = editorOf(wrapper);
        expect(editor.getValue()).toBe('print(1)');
        expect(editor.getSession().getMode().$id).toBe('ace/mode/python');
        expect(wrapper.find('#filename').element.value).toBe('app.py');
    });

    it('creates new files with defaults and detects taken names', async () => {
        const store = testStore();
        store.state.files = [{ name: 'taken.txt' }];
        const wrapper = mountDialog(FileEditorModal, store, {});
        expect(wrapper.find('#filename').element.value).toBe('newfile.txt');
        expect(editorOf(wrapper).getSession().getMode().$id).toBe('ace/mode/text');
        await wrapper.find('#filename').setValue('taken.txt');
        expect(wrapper.find('#filename').classes()).toContain('is-invalid');
        // renaming back to a free name clears the error
        await wrapper.find('#filename').setValue('free.txt');
        expect(wrapper.find('#filename').classes()).not.toContain('is-invalid');
    });

    it('saves without closing and closes on Close', async () => {
        const store = testStore();
        store.state.modal = { name: 'file', props: {} };
        const wrapper = mountDialog(FileEditorModal, store, { filename: 'a.txt', content: 'v1' });
        editorOf(wrapper).getSession().setValue('v2');
        await wrapper.find('#buttonSaveNotClose').trigger('click');
        await flush();
        const call = store.fetchCalls.find(([api]) => api === 'saveFile');
        expect(call[1].get('filename')).toBe('a.txt');
        expect(call[1].get('content')).toBe('v2');
        expect(store.state.modal).not.toBeNull();
        await wrapper.find('#buttonClose').trigger('click');
        expect(store.state.modal).toBeNull();
    });

    it('blocks saving under a taken name', async () => {
        const store = testStore();
        store.state.files = [{ name: 'taken.txt' }];
        const wrapper = mountDialog(FileEditorModal, store, {});
        await wrapper.find('#filename').setValue('taken.txt');
        editorOf(wrapper).getSession().setValue('x');
        await wrapper.find('#buttonSaveNotClose').trigger('click');
        await flush();
        expect(store.fetchCalls.some(([api]) => api === 'saveFile')).toBe(false);
    });

    it('wires editor options to the ACE session', async () => {
        const store = testStore();
        const wrapper = mountDialog(FileEditorModal, store, { filename: 'a.txt', content: '' });
        const editor = editorOf(wrapper);
        await wrapper.find('#editoroptions').trigger('click');
        await wrapper.find('#editor-wordwrap').setChecked();
        expect(editor.getSession().getOption('wrap')).not.toBe('off');
        await wrapper.find('#editor-tabsize').setValue(2);
        expect(editor.getSession().getOption('tabSize')).toBe(2);
        await wrapper.find('#editor-syntax').setValue('ace/mode/python');
        expect(editor.getSession().getMode().$id).toBe('ace/mode/python');
    });

    it('toggles fullscreen with the Ctrl-Shift-F command', async () => {
        const store = testStore();
        const wrapper = mountDialog(FileEditorModal, store, { filename: 'a.txt', content: '' });
        const editor = editorOf(wrapper);
        expect(editor.container.classList.contains('editor-fullscreen')).toBe(false);
        editor.execCommand('toggleFullscreen');
        expect(editor.container.classList.contains('editor-fullscreen')).toBe(true);
        editor.execCommand('toggleFullscreen');
        expect(editor.container.classList.contains('editor-fullscreen')).toBe(false);
    });
});
