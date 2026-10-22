/**
 * Tests for src/store/ops.js — every file operation in its success, backend
 * ERROR, and transport-failure shapes. Oracle: the legacy IFM.* methods in
 * src/ifm.js (task names, i18n keys, refresh-on-success).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    changePermissions,
    copyMove,
    copyToClipboard,
    createArchive,
    createDir,
    deleteFiles,
    editFile,
    extractFile,
    findExisting,
    remoteUpload,
    renameFile,
    saveFile,
    uploadOne,
} from '../src/store/ops.js';

function makeStore(api = {}) {
    const calls = {
        notify: [],
        notifyError: [],
        taskAdd: [],
        taskDone: [],
        taskUpdate: [],
        openModal: [],
        closeModal: 0,
        refreshFiles: 0,
    };
    return {
        calls,
        api,
        state: { currentDir: 'sub', files: [{ name: 'a.txt' }], config: { confirmoverwrite: 1 } },
        t: (k) => k,
        notify: (m, k) => calls.notify.push([m, k]),
        notifyError: (m) => calls.notifyError.push(m),
        taskAdd: (t) => calls.taskAdd.push(t),
        taskDone: (id) => calls.taskDone.push(id),
        taskUpdate: (id, p) => calls.taskUpdate.push([id, p]),
        openModal: (n, p) => calls.openModal.push([n, p]),
        closeModal: () => calls.closeModal++,
        refreshFiles: async () => {
            calls.refreshFiles++;
        },
    };
}

describe('editFile', () => {
    it('opens the editor with backend content', async () => {
        const store = makeStore({ getContent: vi.fn().mockResolvedValue({ status: 'OK', data: { filename: 'a.txt', content: 'x' } }) });
        await editFile(store, 'a.txt');
        expect(store.api.getContent).toHaveBeenCalledWith('sub', 'a.txt');
        expect(store.calls.openModal).toEqual([['file', { filename: 'a.txt', content: 'x' }]]);
    });
    it('reports empty content and backend errors distinctly', async () => {
        const empty = makeStore({ getContent: vi.fn().mockResolvedValue({ status: 'OK', data: { filename: 'a.txt', content: null } }) });
        await editFile(empty, 'a.txt');
        expect(empty.calls.notifyError).toEqual(['file_load_error']);

        const err = makeStore({ getContent: vi.fn().mockResolvedValue({ status: 'ERROR', message: 'nope' }) });
        await editFile(err, 'a.txt');
        expect(err.calls.notifyError).toEqual(['nope']);
    });
    it('reports transport failures as display errors', async () => {
        const store = makeStore({ getContent: vi.fn().mockRejectedValue(new Error('down')) });
        await editFile(store, 'a.txt');
        expect(store.calls.notifyError).toEqual(['file_display_error']);
    });
});

describe('saveFile', () => {
    it('notifies and refreshes on OK', async () => {
        const store = makeStore({ saveFile: vi.fn().mockResolvedValue({ status: 'OK' }) });
        await saveFile(store, 'a.txt', 'content');
        expect(store.api.saveFile).toHaveBeenCalledWith('sub', 'a.txt', 'content');
        expect(store.calls.notify).toEqual([['file_save_success', 's']]);
        expect(store.calls.refreshFiles).toBe(1);
    });
    it('surfaces backend messages and transport failures', async () => {
        const err = makeStore({ saveFile: vi.fn().mockResolvedValue({ status: 'ERROR', message: 'denied' }) });
        await saveFile(err, 'a.txt', 'c');
        expect(err.calls.notifyError).toEqual(['denied']);
        expect(err.calls.refreshFiles).toBe(0);

        const down = makeStore({ saveFile: vi.fn().mockRejectedValue(new Error('x')) });
        await saveFile(down, 'a.txt', 'c');
        expect(down.calls.notifyError).toEqual(['general_error']);
    });
});

describe('createDir', () => {
    it('notifies and refreshes on OK, else surfaces the message', async () => {
        const store = makeStore({ createDir: vi.fn().mockResolvedValue({ status: 'OK' }) });
        await createDir(store, 'new');
        expect(store.api.createDir).toHaveBeenCalledWith('sub', 'new');
        expect(store.calls.notify).toEqual([['folder_create_success', 's']]);

        const down = makeStore({ createDir: vi.fn().mockRejectedValue(new Error('x')) });
        await createDir(down, 'new');
        expect(down.calls.notifyError).toEqual(['general_error']);
    });
});

describe('deleteFiles', () => {
    it('sends names and reports success', async () => {
        const store = makeStore({ deleteFiles: vi.fn().mockResolvedValue({ status: 'OK' }) });
        await deleteFiles(store, [{ name: 'a' }, { name: 'b' }]);
        expect(store.api.deleteFiles).toHaveBeenCalledWith('sub', ['a', 'b']);
        expect(store.calls.notify).toEqual([['file_delete_success', 's']]);
        expect(store.calls.refreshFiles).toBe(1);
    });
    it('wraps single items and uses the delete error key', async () => {
        const store = makeStore({ deleteFiles: vi.fn().mockResolvedValue({ status: 'ERROR', message: 'busy' }) });
        await deleteFiles(store, { name: 'a' });
        expect(store.api.deleteFiles).toHaveBeenCalledWith('sub', ['a']);
        expect(store.calls.notifyError).toEqual(['file_delete_error']);
    });
});

describe('renameFile', () => {
    it('renames and refreshes on OK', async () => {
        const store = makeStore({ renameFile: vi.fn().mockResolvedValue({ status: 'OK' }) });
        await renameFile(store, 'a', 'b');
        expect(store.api.renameFile).toHaveBeenCalledWith('sub', 'a', 'b');
        expect(store.calls.notify).toEqual([['file_rename_success', 's']]);
    });
    it('surfaces backend and transport failures', async () => {
        const err = makeStore({ renameFile: vi.fn().mockResolvedValue({ status: 'ERROR', message: 'taken' }) });
        await renameFile(err, 'a', 'b');
        expect(err.calls.notifyError).toEqual(['taken']);

        const down = makeStore({ renameFile: vi.fn().mockRejectedValue(new Error('x')) });
        await renameFile(down, 'a', 'b');
        expect(down.calls.notifyError).toEqual(['general_error']);
    });
});

describe('copyMove', () => {
    it('tracks the task with the legacy name and refreshes', async () => {
        const store = makeStore({ copyMove: vi.fn().mockResolvedValue({ status: 'OK', message: 'moved' }) });
        await copyMove(store, [{ name: 'a' }, { name: 'b' }], 'dest', 'move');
        expect(store.api.copyMove).toHaveBeenCalledWith('sub', 'move', ['a', 'b'], 'dest');
        expect(store.calls.taskAdd).toHaveLength(1);
        expect(store.calls.taskAdd[0].name).toBe('move 2 file_copy_to dest');
        expect(store.calls.notify).toEqual([['moved', 's']]);
        expect(store.calls.refreshFiles).toBe(1);
        expect(store.calls.taskDone).toEqual([store.calls.taskAdd[0].id]);
    });
    it('names single sources by filename and always clears the task', async () => {
        const store = makeStore({ copyMove: vi.fn().mockRejectedValue(new Error('x')) });
        await copyMove(store, { name: 'solo' }, 'dest', 'copy');
        expect(store.calls.taskAdd[0].name).toBe('copy solo file_copy_to dest');
        expect(store.calls.notifyError).toEqual(['general_error']);
        expect(store.calls.taskDone).toHaveLength(1);
    });
});

describe('extractFile', () => {
    it('tracks extract tasks and surfaces backend messages', async () => {
        const store = makeStore({ extractFile: vi.fn().mockResolvedValue({ status: 'OK', message: 'done' }) });
        await extractFile(store, 'a.zip', './out');
        expect(store.api.extractFile).toHaveBeenCalledWith('sub', 'a.zip', './out');
        expect(store.calls.taskAdd[0].name).toBe('extract a.zip');
        expect(store.calls.notify).toEqual([['done', 's']]);
        expect(store.calls.taskDone).toHaveLength(1);

        const err = makeStore({ extractFile: vi.fn().mockResolvedValue({ status: 'ERROR', message: 'bad' }) });
        await extractFile(err, 'a.zip', './out');
        expect(err.calls.notifyError).toEqual(['bad']);
    });
});

describe('uploadOne', () => {
    it('uploads with progress and refreshes when still in the same dir', async () => {
        let onProgress;
        const store = makeStore({
            uploadFile: vi.fn().mockImplementation((file, dir, name, cb) => {
                onProgress = cb;
                return Promise.resolve({ status: 'OK', cd: 'sub' });
            }),
        });
        const file = { name: 'up.bin' };
        await uploadOne(store, file, 'renamed.bin');
        expect(store.api.uploadFile).toHaveBeenCalledWith(file, 'sub', 'renamed.bin', expect.any(Function));
        expect(store.calls.taskAdd[0].name).toBe('Upload up.bin');
        onProgress(50);
        expect(store.calls.taskUpdate).toEqual([[store.calls.taskAdd[0].id, 50]]);
        expect(store.calls.notify).toEqual([['file_upload_success', 's']]);
        expect(store.calls.refreshFiles).toBe(1);
        expect(store.calls.taskDone).toHaveLength(1);
    });
    it('skips refresh after navigating away and reports failures', async () => {
        const moved = makeStore({ uploadFile: vi.fn().mockResolvedValue({ status: 'OK', cd: 'elsewhere' }) });
        await uploadOne(moved, { name: 'f' });
        expect(moved.calls.refreshFiles).toBe(0);

        const err = makeStore({ uploadFile: vi.fn().mockResolvedValue({ status: 'ERROR', message: 'too big' }) });
        await uploadOne(err, { name: 'f' });
        expect(err.calls.notifyError).toEqual(['too big']);

        const down = makeStore({ uploadFile: vi.fn().mockRejectedValue(new Error('x')) });
        await uploadOne(down, { name: 'f' });
        expect(down.calls.notifyError).toEqual(['general_error']);
        expect(down.calls.taskDone).toHaveLength(1);
    });
});

describe('changePermissions', () => {
    it('notifies and refreshes on OK', async () => {
        const store = makeStore({ changePermissions: vi.fn().mockResolvedValue({ status: 'OK' }) });
        await changePermissions(store, 'a', '644');
        expect(store.api.changePermissions).toHaveBeenCalledWith('sub', 'a', '644');
        expect(store.calls.notify).toEqual([['permission_change_success', 's']]);
        expect(store.calls.refreshFiles).toBe(1);
    });
    it('surfaces backend and transport failures', async () => {
        const err = makeStore({ changePermissions: vi.fn().mockResolvedValue({ status: 'ERROR', message: 'no' }) });
        await changePermissions(err, 'a', '644');
        expect(err.calls.notifyError).toEqual(['no']);

        const down = makeStore({ changePermissions: vi.fn().mockRejectedValue(new Error('x')) });
        await changePermissions(down, 'a', '644');
        expect(down.calls.notifyError).toEqual(['general_error']);
    });
});

describe('remoteUpload', () => {
    it('tracks the remote upload task', async () => {
        const store = makeStore({ remoteUpload: vi.fn().mockResolvedValue({ status: 'OK' }) });
        await remoteUpload(store, 'https://x/y.zip', 'y.zip', 'curl');
        expect(store.api.remoteUpload).toHaveBeenCalledWith('sub', 'https://x/y.zip', 'y.zip', 'curl');
        expect(store.calls.taskAdd[0].name).toBe('upload_remote y.zip');
        expect(store.calls.notify).toEqual([['file_upload_success', 's']]);
        expect(store.calls.taskDone).toHaveLength(1);
    });
    it('reports backend and transport failures', async () => {
        const err = makeStore({ remoteUpload: vi.fn().mockResolvedValue({ status: 'ERROR', message: 'ssrf' }) });
        await remoteUpload(err, 'u', 'f', 'curl');
        expect(err.calls.notifyError).toEqual(['ssrf']);

        const down = makeStore({ remoteUpload: vi.fn().mockRejectedValue(new Error('x')) });
        await remoteUpload(down, 'u', 'f', 'curl');
        expect(down.calls.notifyError).toEqual(['general_error']);
    });
});

describe('createArchive', () => {
    it('rejects invalid formats without calling the backend', async () => {
        const store = makeStore({ createArchive: vi.fn() });
        expect(await createArchive(store, [{ name: 'a' }], 'a.rar')).toBe(false);
        expect(store.api.createArchive).not.toHaveBeenCalled();
        expect(store.calls.notifyError).toEqual(['invalid_archive_format']);
    });
    it('sends the detected format and keeps the dialog open', async () => {
        const store = makeStore({ createArchive: vi.fn().mockResolvedValue({ status: 'OK', message: 'archived' }) });
        expect(await createArchive(store, { name: 'a' }, 'A.TAR.GZ')).toBe(false);
        expect(store.api.createArchive).toHaveBeenCalledWith('sub', 'A.TAR.GZ', 'tar.gz', ['a']);
        expect(store.calls.taskAdd[0].name).toBe('create_archive A.TAR.GZ');
        expect(store.calls.notify).toEqual([['archived', 's']]);
    });
});

describe('findExisting', () => {
    it('returns only names present in the listing', () => {
        const store = makeStore();
        expect(findExisting(store, ['a.txt', 'missing.txt'])).toEqual(['a.txt']);
        expect(findExisting(store, [])).toEqual([]);
    });
});

describe('copyToClipboard', () => {
    beforeEach(() => {
        vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    });
    it('uses the async clipboard API when available', async () => {
        await copyToClipboard('https://h/f');
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://h/f');
    });
});
