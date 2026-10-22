/**
 * File operations ported from src/ifm.js (saveFile, editFile, createDir,
 * deleteFiles, renameFile, copyMove, extractFile, uploadFile,
 * changePermissions, remoteUpload, createArchive).
 *
 * Each function mirrors the legacy task names, i18n messages, and
 * refresh-on-success behavior. `store` is the object returned by
 * createStore(); toasts/tasks/i18n go through it.
 */

import { detectArchiveFormat, generateGuid } from '../api/helpers.js';

function ok(data) {
    return data && data.status === 'OK';
}

export async function editFile(store, filename) {
    try {
        const data = await store.api.getContent(store.state.currentDir, filename);
        if (ok(data) && data.data.content != null) {
            store.openModal('file', { filename: data.data.filename, content: data.data.content });
        } else if (ok(data) && data.data.content == null) {
            store.notifyError(store.t('file_load_error'));
        } else {
            store.notifyError(data.message);
        }
    } catch {
        store.notifyError(store.t('file_display_error'));
    }
}

export async function saveFile(store, filename, content) {
    try {
        const data = await store.api.saveFile(store.state.currentDir, filename, content);
        if (ok(data)) {
            store.notify(store.t('file_save_success'), 's');
            await store.refreshFiles();
        } else {
            store.notifyError(data.message);
        }
    } catch {
        store.notifyError(store.t('general_error'));
    }
}

export async function createDir(store, dirname) {
    try {
        const data = await store.api.createDir(store.state.currentDir, dirname);
        if (ok(data)) {
            store.notify(store.t('folder_create_success'), 's');
            await store.refreshFiles();
        } else {
            store.notifyError(data.message);
        }
    } catch {
        store.notifyError(store.t('general_error'));
    }
}

export async function deleteFiles(store, items) {
    const list = Array.isArray(items) ? items : [items];
    try {
        const data = await store.api.deleteFiles(
            store.state.currentDir,
            list.map((e) => e.name),
        );
        if (ok(data)) {
            store.notify(store.t('file_delete_success'), 's');
            await store.refreshFiles();
        } else {
            store.notifyError(store.t('file_delete_error'));
        }
    } catch {
        store.notifyError(store.t('general_error'));
    }
}

export async function renameFile(store, filename, newname) {
    try {
        const data = await store.api.renameFile(store.state.currentDir, filename, newname);
        if (ok(data)) {
            store.notify(store.t('file_rename_success'), 's');
            await store.refreshFiles();
        } else {
            store.notifyError(data.message);
        }
    } catch {
        store.notifyError(store.t('general_error'));
    }
}

export async function copyMove(store, sources, destination, action) {
    const list = Array.isArray(sources) ? sources : [sources];
    const id = generateGuid();
    store.taskAdd({
        id,
        name: `${store.t(action)} ${list.length > 1 ? list.length : list[0].name} ${store.t('file_copy_to')} ${destination}`,
    });
    try {
        const data = await store.api.copyMove(
            store.state.currentDir,
            action,
            list.map((e) => e.name),
            destination,
        );
        if (ok(data)) {
            store.notify(data.message, 's');
        } else {
            store.notifyError(data.message);
        }
        await store.refreshFiles();
    } catch {
        store.notifyError(store.t('general_error'));
    } finally {
        store.taskDone(id);
    }
}

export async function extractFile(store, filename, destination) {
    const id = generateGuid();
    store.taskAdd({ id, name: `extract ${filename}` });
    try {
        const data = await store.api.extractFile(store.state.currentDir, filename, destination);
        if (ok(data)) {
            store.notify(data.message, 's');
            await store.refreshFiles();
        } else {
            store.notifyError(data.message);
        }
    } catch {
        store.notifyError(store.t('general_error'));
    } finally {
        store.taskDone(id);
    }
}

export async function uploadOne(store, file, newfilename) {
    const id = generateGuid();
    store.taskAdd({ id, name: `Upload ${file.name}` });
    try {
        const data = await store.api.uploadFile(file, store.state.currentDir, newfilename, (progress) =>
            store.taskUpdate(id, progress),
        );
        if (ok(data)) {
            store.notify(store.t('file_upload_success'), 's');
            if (data.cd === store.state.currentDir) await store.refreshFiles();
        } else {
            store.notifyError(data.message);
        }
    } catch {
        store.notifyError(store.t('general_error'));
    } finally {
        store.taskDone(id);
    }
}

export async function changePermissions(store, filename, newperms) {
    try {
        const data = await store.api.changePermissions(store.state.currentDir, filename, newperms);
        if (ok(data)) {
            store.notify(store.t('permission_change_success'), 's');
            await store.refreshFiles();
        } else {
            store.notifyError(data.message);
        }
    } catch {
        store.notifyError(store.t('general_error'));
    }
}

export async function remoteUpload(store, url, filename, method) {
    const id = generateGuid();
    store.taskAdd({ id, name: `${store.t('upload_remote')} ${filename}` });
    try {
        const data = await store.api.remoteUpload(store.state.currentDir, url, filename, method);
        if (ok(data)) {
            store.notify(store.t('file_upload_success'), 's');
            await store.refreshFiles();
        } else {
            store.notifyError(data.message);
        }
    } catch {
        store.notifyError(store.t('general_error'));
    } finally {
        store.taskDone(id);
    }
}

export async function createArchive(store, items, archivename) {
    const format = detectArchiveFormat(archivename);
    if (!format) {
        store.notifyError(store.t('invalid_archive_format'));
        return false;
    }
    const list = Array.isArray(items) ? items : [items];
    const id = generateGuid();
    store.taskAdd({ id, name: `${store.t('create_archive')} ${archivename}` });
    try {
        const data = await store.api.createArchive(
            store.state.currentDir,
            archivename,
            format,
            list.map((e) => e.name),
        );
        if (ok(data)) {
            store.notify(data.message, 's');
            await store.refreshFiles();
        } else {
            store.notifyError(data.message);
        }
    } catch {
        store.notifyError(store.t('general_error'));
    } finally {
        store.taskDone(id);
    }
    // The legacy dialog never closes on save (createArchive returns
    // undefined); callers keep the modal open and return false likewise.
    return false;
}

/** Names among `candidates` that already exist in the current listing. */
export function findExisting(store, candidates) {
    const current = new Set(store.state.files.map((x) => x.name));
    return candidates.filter((name) => current.has(name));
}

export function copyToClipboard(str) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(str).catch(() => legacyCopy(str));
    }
    legacyCopy(str);
    return Promise.resolve();
}

// Fallback copied from the legacy copyToClipboard implementation.
function legacyCopy(str) {
    const el = document.createElement('textarea');
    el.value = str;
    el.setAttribute('readonly', '');
    el.style.position = 'absolute';
    el.style.left = '-9999px';
    document.body.appendChild(el);
    const selected = document.getSelection().rangeCount > 0 ? document.getSelection().getRangeAt(0) : false;
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    if (selected) {
        document.getSelection().removeAllRanges();
        document.getSelection().addRange(selected);
    }
}
