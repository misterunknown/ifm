/**
 * Global keyboard navigation, history handling, and unload guard.
 * Port of IFM.handleKeystrokes, highlightItem, historyPopstateHandler,
 * and onbeforeunloadHandler (src/ifm.js).
 *
 * Two deliberate hardenings (same visible behavior otherwise):
 * - Typing is detected with closest('input, textarea, select') instead of
 *   only the event target (the legacy ancestor walk never climbs).
 * - Global shortcuts pause while a dialog is open. The legacy frontend
 *   stacks a second modal in that case; this app has a single dialog slot,
 *   so firing table shortcuts behind a dialog could discard dialog state.
 */

import { editFile } from '../store/ops.js';

export function installGlobalHandlers(store) {
    function visibleRows() {
        return store.visibleRows || [];
    }

    function focusRow(idx) {
        const rows = visibleRows();
        const row = rows[idx];
        if (!row) return;
        store.state.highlighted = idx;
        const el = document.getElementById(row.guid);
        if (el) {
            el.focus({ preventScroll: true });
            el.scrollIntoView({ block: 'nearest' });
        }
    }

    function highlight(direction) {
        const rows = visibleRows();
        if (!rows.length) return;
        const idx = store.state.highlighted;
        if (idx < 0 || idx >= rows.length) {
            const active = document.activeElement;
            if (active && active.classList && active.classList.contains('ifmitem')) {
                const found = rows.findIndex((r) => r.guid === active.id);
                focusRow(found >= 0 ? found : 0);
            } else {
                focusRow(0);
            }
            return;
        }
        const next = direction === 'next' ? idx + 1 : idx - 1;
        if (next >= 0 && next < rows.length) focusRow(next);
    }

    function highlightedItem() {
        const rows = visibleRows();
        const idx = store.state.highlighted;
        return idx >= 0 && idx < rows.length ? rows[idx] : false;
    }

    function selectedItems() {
        return store.state.selected
            .map((name) => store.state.files.find((x) => x.name === name))
            .filter(Boolean);
    }

    function onKey(e) {
        const target = e.target;
        if (target && target.closest && target.closest('input, textarea, select')) return;
        if (target && target.isContentEditable) return;
        // Dialogs own the keyboard while open (see note above).
        if (store.state.modal) return;
        if (!store.state.config || !store.state.authed) return;
        const config = store.state.config;

        switch (e.key) {
            case '/':
                if (config.search) {
                    e.preventDefault();
                    store.openModal('search');
                }
                break;
            case 'g':
                e.preventDefault();
                document.getElementById('currentDir')?.focus();
                return;
            case 'r':
                if (config.showrefresh) {
                    e.preventDefault();
                    store.refreshFiles();
                }
                break;
            case 'u':
                if (config.upload) {
                    e.preventDefault();
                    store.openModal('upload');
                }
                return;
            case 'o':
                if (config.remoteupload) {
                    e.preventDefault();
                    store.openModal('remoteupload');
                }
                return;
            case 'a':
                if (config.ajaxrequest) {
                    e.preventDefault();
                    store.openModal('ajaxrequest');
                }
                return;
            case 'F':
                if (config.createfile) {
                    e.preventDefault();
                    store.openModal('file');
                }
                return;
            case 'D':
                if (config.createdir) {
                    e.preventDefault();
                    store.openModal('createdir');
                }
                return;
            case 'h':
            case 'ArrowLeft':
            case 'Backspace':
                e.preventDefault();
                store.changeDirectory('..');
                return;
            case 'j':
            case 'ArrowDown':
                e.preventDefault();
                highlight('next');
                return;
            case 'k':
            case 'ArrowUp':
                e.preventDefault();
                highlight('prev');
                return;
        }

        const item = highlightedItem();
        const selected = selectedItems();

        switch (e.key) {
            case 'Delete':
                if (config.delete) {
                    if (selected.length > 0) {
                        e.preventDefault();
                        store.openModal('delete', { items: selected });
                    } else if (item && item.name !== '..') {
                        store.openModal('delete', { items: item });
                    }
                }
                return;
            case 'c':
            case 'm':
                if (config.copymove) {
                    if (selected.length > 0) {
                        e.preventDefault();
                        store.openModal('copymove', { items: selected });
                    } else if (item && item.name !== '..') {
                        store.openModal('copymove', { items: item });
                    }
                }
                return;
        }

        if (item) {
            switch (e.key) {
                case 'l':
                case 'ArrowRight':
                    e.preventDefault();
                    if (item.type === 'dir') store.changeDirectory(item.name);
                    return;
                case 'Escape': {
                    const rows = visibleRows();
                    const row = rows[store.state.highlighted];
                    if (row && document.activeElement && document.activeElement.id === row.guid) {
                        e.preventDefault();
                        store.state.highlighted = -1;
                    }
                    return;
                }
                case ' ':
                case 'Enter': {
                    const rows = visibleRows();
                    const row = rows[store.state.highlighted];
                    if (row && document.activeElement && document.activeElement.id === row.guid) {
                        if (e.key === 'Enter' && row.type === 'dir') {
                            e.preventDefault();
                            e.stopPropagation();
                            store.changeDirectory(item.name);
                        } else if (e.key === ' ' && item.name !== '..') {
                            e.preventDefault();
                            e.stopPropagation();
                            const i = store.state.selected.indexOf(item.name);
                            if (i >= 0) store.state.selected.splice(i, 1);
                            else store.state.selected.push(item.name);
                        }
                    }
                    return;
                }
                case 'e':
                    if (config.edit && item.eaction === 'edit') {
                        e.preventDefault();
                        editFile(store, item.name);
                    } else if (config.extract && item.eaction === 'extract') {
                        e.preventDefault();
                        store.openModal('extract', { filename: item.name });
                    }
                    return;
                case 'n':
                    e.preventDefault();
                    if (config.rename) {
                        store.openModal('rename', { filename: item.name });
                    }
                    return;
            }
        }
    }

    function onPop(e) {
        store.changeDirectory(e.state && e.state.dir ? e.state.dir : '', { pushState: false, absolute: true });
    }

    function onBeforeUnload(e) {
        if (document.getElementById('waitqueue')) {
            e.preventDefault();
            e.returnValue = store.t('remaining_tasks');
            return store.t('remaining_tasks');
        }
    }

    document.addEventListener('keydown', onKey);
    window.addEventListener('popstate', onPop);
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
        document.removeEventListener('keydown', onKey);
        window.removeEventListener('popstate', onPop);
        window.removeEventListener('beforeunload', onBeforeUnload);
    };
}
