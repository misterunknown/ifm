/**
 * Central IFM state: backend config, i18n, directory listing, tasks, toasts.
 *
 * Mirrors the mutable fields of the legacy IFM object (currentDir, fileCache,
 * search, datatable state) with Vue reactivity instead of jQuery/DOM state.
 */

import { computed, reactive } from 'vue';
import { IfmApi, resolveApiBase } from '../api/client.js';
import { enrichItems } from '../api/fileLinks.js';
import enFallback from '../i18n/en.json';

export const IS_MOBILE = typeof window !== 'undefined' && typeof window.orientation !== 'undefined';

export function createStore(apiBase) {
    const api = new IfmApi(apiBase || resolveApiBase());

    const state = reactive({
        config: null,
        configError: '',
        i18n: { ...enFallback },
        authed: null, // null = unknown, true / false
        authError: '',
        currentDir: '',
        files: [], // enriched rows for the table
        selected: [], // selected file names (multi-select for copy/move/delete)
        highlighted: -1, // keyboard highlight index
        tasks: [], // { id, name, type, progress }
        toasts: [], // { id, message, kind }
        modal: null, // { name, props } — single visible dialog
        search: { lastSearch: '', data: null },
        loadingFiles: false,
    });

    const t = (key) => state.i18n[key] ?? enFallback[key] ?? key;

    const isMobile = () => IS_MOBILE;

    // -- notifications (legacy showMessage: e -> danger, s -> success, else info)
    let toastSeq = 0;
    function notify(message, kind = 'info') {
        const mapped = kind === 'e' ? 'danger' : kind === 's' ? 'success' : 'info';
        const id = `toast-${Date.now()}-${toastSeq++}`;
        state.toasts.push({ id, message, kind: mapped });
        setTimeout(() => {
            const i = state.toasts.findIndex((x) => x.id === id);
            if (i >= 0) state.toasts.splice(i, 1);
        }, 3000);
    }

    function notifyError(message) {
        notify(message, 'e');
    }

    // -- background tasks (legacy task_add / task_done / task_update)
    function taskAdd({ id, name, type }) {
        state.tasks.unshift({ id, name, type: type || 'info', progress: 100 });
    }

    function taskDone(id) {
        const i = state.tasks.findIndex((x) => x.id === id);
        if (i >= 0) state.tasks.splice(i, 1);
    }

    function taskUpdate(id, progress) {
        const task = state.tasks.find((x) => x.id === id);
        if (task) task.progress = progress;
    }

    const hasPendingTasks = computed(() => state.tasks.length > 0);

    // -- file listing -----------------------------------------------------------
    async function refreshFiles() {
        state.loadingFiles = true;
        const taskId = `refresh-${Date.now()}`;
        taskAdd({ id: taskId, name: t('refresh') });
        try {
            const data = await api.getFiles(state.currentDir);
            if (data && data.status === 'ERROR') {
                notifyError(data.message);
                return;
            }
            if (!Array.isArray(data)) {
                notifyError(t('invalid_data'));
                return;
            }
            state.files = enrichItems(data, {
                config: state.config,
                currentDir: state.currentDir,
                apiBase: api.apiBase,
                isMobile: isMobile(),
            });
            state.selected = [];
            state.highlighted = -1;
        } catch (e) {
            notifyError(t('general_error'));
        } finally {
            taskDone(taskId);
            state.loadingFiles = false;
        }
    }

    async function changeDirectory(newdir, options = {}) {
        const { absolute = false, pushState = true } = options;
        const target = absolute ? newdir : joinPath(state.currentDir, newdir);
        try {
            const data = await api.getRealpath(target);
            state.currentDir = data.realpath;
            await refreshFiles();
            if (pushState) {
                history.pushState({ dir: state.currentDir }, state.currentDir, '#' + encodeURIComponent(state.currentDir));
            }
        } catch {
            notifyError(t('general_error'));
        }
    }

    // -- modal -------------------------------------------------------------------
    function openModal(name, props = {}) {
        state.modal = { name, props };
    }

    function closeModal() {
        state.modal = null;
    }

    return {
        api,
        state,
        // Rows currently rendered by FileTable (sorted/filtered/paged view
        // order). Published by FileTable; consumed by keyboard navigation.
        visibleRows: [],
        t,
        isMobile,
        notify,
        notifyError,
        taskAdd,
        taskDone,
        taskUpdate,
        hasPendingTasks,
        refreshFiles,
        changeDirectory,
        openModal,
        closeModal,
    };
}

/** Minimal path join for relative navigation (legacy changeDirectory combine). */
export function joinPath(base, next) {
    if (!base) return next;
    if (!next) return base;
    return `${base.replace(/\/+$/g, '')}/${next.replace(/^\/*/g, '')}`;
}

export const APP_VERSION = (() => {
    try {
        if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) return 'dev';
    } catch {
        /* ignore */
    }
    return '__IFM_VERSION__';
})();
