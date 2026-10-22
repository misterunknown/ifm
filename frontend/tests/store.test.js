// @vitest-environment jsdom
/**
 * Tests for src/store/index.js — notifications, tasks, listing refresh,
 * navigation, modal slot, and path helpers. Oracle: showMessage, task_add /
 * task_done / task_update, refreshFileTable, changeDirectory in src/ifm.js.
 */
import { describe, expect, it, vi } from 'vitest';

import en from '../src/i18n/en.json';

import { APP_VERSION, IS_MOBILE, createStore, joinPath } from '../src/store/index.js';

function backend(over = {}) {
    const calls = [];
    vi.stubGlobal('fetch', async (url, opts) => {
        const params = new URLSearchParams(opts.body);
        calls.push([params.get('api'), params]);
        if (over[params.get('api')]) return { text: async () => JSON.stringify(await over[params.get('api')](params)) };
        return { text: async () => JSON.stringify({ status: 'OK' }) };
    });
    return calls;
}

describe('t and notify', () => {
    it('falls back through backend strings, English, and the key itself', () => {
        backend();
        const store = createStore('https://h/index.php');
        store.state.i18n = { refresh: 'Aktualisieren' };
        expect(store.t('refresh')).toBe('Aktualisieren');
        expect(store.t('login')).toBe(en.login);
        expect(store.t('no_such_key_xyz')).toBe('no_such_key_xyz');
    });

    it('maps legacy message kinds', () => {
        backend();
        const store = createStore('https://h/index.php');
        store.notify('a', 'e');
        store.notify('b', 's');
        store.notify('c');
        expect(store.state.toasts.map((t) => t.kind)).toEqual(['danger', 'success', 'info']);
    });
});

describe('tasks', () => {
    it('prepends, updates, and removes tasks', () => {
        backend();
        const store = createStore('https://h/index.php');
        expect(store.hasPendingTasks.value).toBe(false);
        store.taskAdd({ id: 't1', name: 'one' });
        store.taskAdd({ id: 't2', name: 'two', type: 'warning' });
        expect(store.state.tasks.map((t) => t.id)).toEqual(['t2', 't1']);
        expect(store.state.tasks[1].type).toBe('info');
        expect(store.hasPendingTasks.value).toBe(true);
        store.taskUpdate('t1', 42);
        expect(store.state.tasks.find((t) => t.id === 't1').progress).toBe(42);
        store.taskUpdate('missing', 1); // unknown ids are ignored
        store.taskDone('t2');
        store.taskDone('missing');
        expect(store.state.tasks.map((t) => t.id)).toEqual(['t1']);
    });
});

describe('modal slot', () => {
    it('opens and closes the single dialog', () => {
        backend();
        const store = createStore('https://h/index.php');
        expect(store.state.modal).toBeNull();
        store.openModal('rename', { filename: 'a' });
        expect(store.state.modal).toEqual({ name: 'rename', props: { filename: 'a' } });
        store.closeModal();
        expect(store.state.modal).toBeNull();
    });
});

describe('refreshFiles', () => {
    it('enriches backend rows and resets selection', async () => {
        backend({
            getFiles: async () => [{ name: 'a.txt', type: 'file', icon: 'i', ext: 'txt', mime_type: 'text/plain' }],
        });
        const store = createStore('https://h/index.php');
        store.state.config = { edit: 1 };
        store.api.setCsrfToken('tok');
        store.state.selected = ['stale'];
        await store.refreshFiles();
        expect(store.state.files.map((f) => f.name)).toEqual(['a.txt']);
        expect(store.state.files[0].guid).toMatch(/^[0-9A-F]{20}$/);
        expect(store.state.selected).toEqual([]);
        expect(store.state.loadingFiles).toBe(false);
    });

    it('reports backend errors, malformed data, and transport failures', async () => {
        backend({ getFiles: async () => ({ status: 'ERROR', message: 'denied' }) });
        const denied = createStore('https://h/index.php');
        denied.state.config = {};
        await denied.refreshFiles();
        expect(denied.state.toasts.at(-1).message).toBe('denied');

        backend({ getFiles: async () => ({ status: 'OK' }) });
        const malformed = createStore('https://h/index.php');
        malformed.state.config = {};
        await malformed.refreshFiles();
        expect(malformed.state.toasts.at(-1).message).toBe(en.invalid_data);

        backend({ getFiles: async () => ({ status: 'OK', data: [] }) });
        const nodata = createStore('https://h/index.php');
        nodata.state.config = {};
        await nodata.refreshFiles();
        expect(nodata.state.toasts.at(-1).message).toBe(en.invalid_data);
    });
});

describe('changeDirectory', () => {
    it('resolves real paths relatively and pushes history', async () => {
        const calls = backend({ getRealpath: async (p) => ({ realpath: `resolved/${p.get('dir')}` }) });
        const store = createStore('https://h/index.php');
        store.state.config = {};
        store.state.currentDir = 'sub';
        const pushState = vi.spyOn(history, 'pushState').mockImplementation(() => {});
        try {
            await store.changeDirectory('docs');
            expect(store.state.currentDir).toBe('resolved/sub/docs');
            expect(pushState).toHaveBeenCalledWith({ dir: 'resolved/sub/docs' }, 'resolved/sub/docs', expect.any(String));
            expect(calls.find(([api]) => api === 'getFiles')).toBeTruthy();
        } finally {
            pushState.mockRestore();
        }
    });

    it('supports absolute navigation without history and reports failures', async () => {
        backend({
            getRealpath: async () => {
                throw new Error('down');
            },
        });
        const store = createStore('https://h/index.php');
        store.state.config = {};
        const pushState = vi.spyOn(history, 'pushState').mockImplementation(() => {});
        try {
            await store.changeDirectory('x', { absolute: true, pushState: false });
            expect(store.state.currentDir).toBe('');
            expect(pushState).not.toHaveBeenCalled();
            expect(store.state.toasts.at(-1).message).toBe(en.general_error);
        } finally {
            pushState.mockRestore();
        }
    });
});

describe('joinPath', () => {
    it('joins relative navigation segments', () => {
        expect(joinPath('', 'sub')).toBe('sub');
        expect(joinPath('a/', '/b')).toBe('a/b');
        expect(joinPath('a', '')).toBe('a');
    });
});

describe('environment', () => {
    it('detects desktop Node as non-mobile and reports dev version', () => {
        expect(IS_MOBILE).toBe(false);
        expect(APP_VERSION).toBe('dev');
    });
});
