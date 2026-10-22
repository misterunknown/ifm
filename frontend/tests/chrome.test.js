// @vitest-environment jsdom
/**
 * Tests for the chrome components: Modal, Toasts, TasksFooter, Navbar.
 * Oracle: showModal/hideModal, showMessage, footer/task templates, and the
 * navbar section of src/templates/app.html.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';

import Modal from '../src/components/Modal.vue';
import Toasts from '../src/components/Toasts.vue';
import TasksFooter from '../src/components/TasksFooter.vue';
import Navbar from '../src/components/Navbar.vue';
import { flush, mountWithStore, testStore } from './support.js';

describe('Modal', () => {
    // Modal teleports to <body>, which wrapper.find() cannot see: interact
    // through document queries instead. Note #ifmmodal IS the .modal node.
    const dialog = () => document.getElementById('ifmmodal');
    let wrappers = [];
    afterEach(() => {
        wrappers.forEach((w) => w.unmount());
        wrappers = [];
        document.body.innerHTML = '';
    });

    it('renders the slot and focuses the autofocus element', () => {
        const store = testStore();
        wrappers.push(
            mountWithStore(
                { components: { Modal }, template: '<Modal><input id="a" autofocus><button id="b">x</button></Modal>' },
                store,
            ),
        );
        expect(document.activeElement.id).toBe('a');
        expect(document.getElementById('ifmmodal')).not.toBeNull();
    });

    it('falls back to the first input/button without autofocus', () => {
        const store = testStore();
        wrappers.push(
            mountWithStore(
                { components: { Modal }, template: '<Modal><button id="only">x</button></Modal>' },
                store,
            ),
        );
        expect(document.activeElement.id).toBe('only');
    });

    it('closes on Escape and backdrop click when dismissible', () => {
        const store = testStore();
        const wrapper = mountWithStore(Modal, store);
        wrappers.push(wrapper);
        dialog().dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(wrapper.emitted('close')).toHaveLength(1);
        dialog().dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true }));
        expect(wrapper.emitted('close')).toHaveLength(2);
    });

    it('ignores Escape and backdrop click when static', () => {
        const store = testStore();
        const wrapper = mountWithStore(Modal, store, { dismissible: false });
        wrappers.push(wrapper);
        dialog().dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        dialog().dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true }));
        expect(wrapper.emitted('close')).toBeUndefined();
    });

    it('sizes large dialogs like the legacy large option', () => {
        const store = testStore();
        const wrapper = mountWithStore(Modal, store, { large: true });
        wrappers.push(wrapper);
        expect(document.querySelector('#ifmmodal .modal-dialog').classList).toContain('modal-lg');
    });
});

describe('Toasts', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });
    it('maps legacy kinds and auto-dismisses', async () => {
        const store = testStore();
        const wrapper = mountWithStore(Toasts, store);
        store.notify('boom', 'e');
        store.notify('ok', 's');
        store.notify('info');
        await nextTick();
        const alerts = wrapper.findAll('.alert');
        expect(alerts).toHaveLength(3);
        expect(alerts[0].classes()).toContain('alert-danger');
        expect(alerts[1].classes()).toContain('alert-success');
        expect(alerts[2].classes()).toContain('alert-info');
        vi.advanceTimersByTime(3000);
        await nextTick();
        expect(wrapper.findAll('.alert')).toHaveLength(0);
    });
});

describe('TasksFooter', () => {
    it('appears with the first task and disappears with the last', async () => {
        const store = testStore();
        const wrapper = mountWithStore(TasksFooter, store, {}, { attachTo: document.body });
        expect(wrapper.find('footer').exists()).toBe(false);
        store.taskAdd({ id: 't1', name: 'doing things' });
        await flush();
        const footer = wrapper.find('footer');
        expect(footer.exists()).toBe(true);
        expect(footer.find('#wq-t1').exists()).toBe(true);
        expect(footer.find('[name="taskCount"]').text()).toBe('1');
        expect(footer.find('.progress-bar').attributes('style')).toContain('width: 100%');
        store.taskUpdate('t1', 25);
        await flush();
        expect(footer.find('.progress-bar').attributes('style')).toContain('width: 25%');
        store.taskDone('t1');
        await flush();
        expect(wrapper.find('footer').exists()).toBe(false);
    });

    it('expands the queue on showAll', async () => {
        const store = testStore();
        const wrapper = mountWithStore(TasksFooter, store, {}, { attachTo: document.body });
        store.taskAdd({ id: 't1', name: 'x' });
        await flush();
        expect(wrapper.find('#waitqueue').classes()).not.toContain('expanded');
        await wrapper.find('[name="showAll"]').trigger('click');
        expect(wrapper.find('#waitqueue').classes()).toContain('expanded');
    });
});

describe('Navbar', () => {
    it('gates every action button on its config flag', () => {
        const store = testStore({}, { upload: 0, remoteupload: 0, ajaxrequest: 0, auth: 0, createfile: 0, createdir: 0, search: 0, showrefresh: 0 });
        const wrapper = mountWithStore(Navbar, store);
        for (const id of ['#refresh', '#search', '#upload', '#createFile', '#createDir', '#buttonRemoteUpload', '#buttonAjaxRequest', '#buttonLogout']) {
            expect(wrapper.find(id).exists()).toBe(false);
        }
        const open = testStore({}, { auth: 1 });
        const full = mountWithStore(Navbar, open);
        for (const id of ['#refresh', '#search', '#upload', '#createFile', '#createDir', '#buttonRemoteUpload', '#buttonAjaxRequest']) {
            expect(full.find(id).exists()).toBe(true);
        }
        expect(full.find('#buttonLogout').attributes('href')).toBe('https://files.test/index.php?api=logout');
    });

    it('dispatches actions and navigates the path field absolutely', async () => {
        const store = testStore({
            getFiles: async () => [{ name: 'f.txt', type: 'file', icon: 'i', ext: 'txt', mime_type: 'text/plain' }],
            getRealpath: async () => ({ realpath: 'docs' }),
        });
        store.state.currentDir = 'old';
        const wrapper = mountWithStore(Navbar, store);
        expect(wrapper.find('#currentDir').element.value).toBe('old');
        await wrapper.find('#refresh').trigger('click');
        await flush();
        expect(store.fetchCalls.find(([api]) => api === 'getFiles')[1].get('dir')).toBe('old');
        expect(store.state.files.map((f) => f.name)).toEqual(['f.txt']);
        await wrapper.find('#search').trigger('click');
        expect(store.state.modal).toEqual({ name: 'search', props: {} });
        await wrapper.find('#currentDir').setValue('docs');
        await wrapper.find('form').trigger('submit');
        await flush();
        expect(store.state.currentDir).toBe('docs');
        expect(wrapper.find('#currentDir').element.value).toBe('docs');
    });

    it('is static (not fixed) in inline mode', () => {
        const store = testStore({}, { inline: true });
        const wrapper = mountWithStore(Navbar, store);
        expect(wrapper.find('nav').classes()).not.toContain('fixed-top');
    });
});
