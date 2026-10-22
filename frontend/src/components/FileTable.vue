<!-- File listing table. Port of src/templates/app.html (thead) +
  filetable.html (rows) + the DataTables setup in IFM.rebuildFileTable.

  DataTables is replaced with a Vue-native table:
  - default order is the backend order (dirs then files, natural sort) with
    ".." pinned on top (legacy orderFixed);
  - filename/size/date/owner/group headers sort on click;
  - the filter box searches across rendered row text (legacy search box);
  - paging follows config.paging/pageLength; sort+filter+page persist in
    localStorage (legacy stateSave).
-->
<template>
    <div class="container">
        <div class="row mb-2">
            <div class="col-md-4 ms-auto">
                <input
                    v-model="filterText"
                    class="form-control form-control-sm"
                    type="search"
                    :placeholder="store.t('filter')"
                    :aria-label="store.t('filter')"
                >
            </div>
        </div>
        <table id="filetable" class="table">
            <thead>
                <tr>
                    <th class="th-filename" :class="thClass('name')" @click="toggleSort('name')">
                        {{ store.t('filename') }}<span class="sort-arrow">{{ arrow('name') }}</span>
                    </th>
                    <th v-if="config.download" class="th-download"></th>
                    <th
                        v-if="config.showlastmodified"
                        class="th-lastmod"
                        :class="thClass('lastmodified')"
                        @click="toggleSort('lastmodified')"
                    >
                        {{ store.t('last_modified') }}<span class="sort-arrow">{{ arrow('lastmodified') }}</span>
                    </th>
                    <th
                        v-if="config.showfilesize"
                        class="th-size"
                        :class="thClass('size')"
                        @click="toggleSort('size')"
                    >
                        {{ store.t('size') }}<span class="sort-arrow">{{ arrow('size') }}</span>
                    </th>
                    <th v-if="config.showpermissions" class="th-permissions d-none d-md-table-cell">
                        {{ store.t('permissions') }}
                    </th>
                    <th
                        v-if="config.showowner"
                        class="th-owner d-none d-lg-table-cell"
                        :class="thClass('owner')"
                        @click="toggleSort('owner')"
                    >
                        {{ store.t('owner') }}<span class="sort-arrow">{{ arrow('owner') }}</span>
                    </th>
                    <th
                        v-if="config.showgroup"
                        class="th-group d-none d-xl-table-cell"
                        :class="thClass('group')"
                        @click="toggleSort('group')"
                    >
                        {{ store.t('group') }}<span class="sort-arrow">{{ arrow('group') }}</span>
                    </th>
                    <th class="th-buttons buttons"></th>
                </tr>
            </thead>
            <tbody>
                <tr
                    v-for="(item, idx) in pageRows"
                    :key="item.guid"
                    class="clickable-row"
                    :class="[{ isDir: item.type === 'dir' }, rowStateClass(item, idx)]"
                    :draggable="!!item.dragdrop && !!config.copymove"
                    :data-id="item.guid"
                    :data-filename="item.name"
                    :data-eaction="item.eaction"
                    @click="onRowClick($event, item)"
                    @contextmenu.prevent="onRowContext($event, item)"
                    @dragstart="onDragStart($event, item)"
                    @dragover="onDragOver($event, item)"
                    @dragenter="onDragEnter($event, item)"
                    @dragleave="onDragLeave($event, item)"
                    @drop="onDrop($event, item)"
                >
                    <td>
                        <a
                            :id="item.guid"
                            :href="item.link"
                            tabindex="0"
                            class="ifmitem"
                            :data-type="item.type"
                            @click="onItemClick($event, item)"
                            @mouseenter="onHover($event, item)"
                            @mouseleave="hidePreview"
                        ><span :class="item.icon"></span> {{ item.linkname }}</a>
                    </td>
                    <td v-if="config.download">
                        <a :href="item.download.link"><span :class="item.download.icon" title="download"></span></a>
                    </td>
                    <td v-if="config.showlastmodified" :data-order="item.lastmodified">{{ item.lastmodified_hr }}</td>
                    <td v-if="config.showfilesize" :data-order="item.size_raw">{{ item.size }}</td>
                    <td v-if="config.showpermissions" class="td-permissions d-none d-md-table-cell">
                        <input
                            type="text"
                            size="11"
                            name="newpermissions"
                            class="form-control"
                            :class="item.filepermmode"
                            :value="item.fileperms"
                            :data-filename="item.name"
                            :readonly="item.readonly !== undefined"
                            @keydown.enter="onPermEnter($event, item)"
                        >
                    </td>
                    <td v-if="config.showowner" class="d-none d-lg-table-cell">{{ item.owner }}</td>
                    <td v-if="config.showgroup" class="d-none d-xl-table-cell">{{ item.group }}</td>
                    <td>
                        <a
                            v-for="b in item.button"
                            :key="b.action"
                            tabindex="0"
                            :name="`do-${b.action}`"
                            :data-id="item.guid"
                            @click.stop="onAction(b.action, item)"
                        ><span :class="b.icon" :title="b.title"></span></a>
                    </td>
                </tr>
            </tbody>
        </table>
        <nav v-if="pageCount > 1" class="d-flex justify-content-center gap-2 mb-3" aria-label="pagination">
            <button class="btn btn-sm btn-secondary" :disabled="page === 0" @click="page--">&laquo;</button>
            <button class="btn btn-sm btn-secondary" :disabled="page >= pageCount - 1" @click="page++">&raquo;</button>
        </nav>
        <ContextMenu
            v-if="menu.visible"
            :x="menu.x"
            :y="menu.y"
            :clicked="menu.clicked"
            :selected="menu.selected"
            @action="onMenuAction"
            @close="menu.visible = false"
        />
        <div v-if="preview" class="ifm-img-preview" :style="{ left: preview.x + 'px', top: preview.y + 'px' }">
            <img :src="preview.src" alt="">
        </div>
    </div>
</template>

<script setup>
import { computed, inject, reactive, ref, watch } from 'vue';
import ContextMenu from './ContextMenu.vue';
import { natcasecmp } from '../api/helpers.js';
import { buildAbsoluteLink, previewSrc } from '../api/fileLinks.js';
import { changePermissions, copyMove, copyToClipboard, editFile } from '../store/ops.js';

const store = inject('store');
const config = computed(() => store.state.config);

// -- sorting / filtering / paging (DataTables replacement) --------------------
const sort = ref({ key: null, dir: 1 });
const filterText = ref('');
const page = ref(0);

try {
    const saved = JSON.parse(localStorage.getItem('ifm-vue-filetable') || 'null');
    if (saved) {
        if (saved.sort) sort.value = saved.sort;
        if (typeof saved.filterText === 'string') filterText.value = saved.filterText;
    }
} catch {
    /* corrupted state: start fresh */
}

watch([sort, filterText, page], () => {
    try {
        localStorage.setItem('ifm-vue-filetable', JSON.stringify({ sort: sort.value, filterText: filterText.value }));
    } catch {
        /* storage unavailable */
    }
});

watch(
    () => store.state.files,
    () => {
        page.value = 0;
    },
);

function toggleSort(key) {
    if (sort.value.key === key) {
        sort.value = { key, dir: -sort.value.dir };
    } else {
        sort.value = { key, dir: 1 };
    }
    page.value = 0;
}

function thClass(key) {
    if (sort.value.key !== key) return 'sortable';
    return sort.value.dir > 0 ? 'sortable sorted-asc' : 'sortable sorted-desc';
}

function arrow(key) {
    if (sort.value.key !== key) return '';
    return sort.value.dir > 0 ? '▲' : '▼';
}

function compareRows(a, b) {
    const key = sort.value.key;
    let diff = 0;
    if (key === 'name') diff = natcasecmp(a.name, b.name);
    else if (key === 'size') diff = (a.size_raw || 0) - (b.size_raw || 0);
    else if (key === 'lastmodified') diff = (a.lastmodified || 0) - (b.lastmodified || 0);
    else if (key === 'owner' || key === 'group') {
        const av = a[key] || '';
        const bv = b[key] || '';
        diff = av < bv ? -1 : av > bv ? 1 : 0;
    }
    return diff * sort.value.dir;
}

const filteredRows = computed(() => {
    let rows = [...store.state.files];
    // ".." stays pinned on top regardless of sort/filter (legacy orderFixed).
    const up = rows.filter((r) => r.name === '..');
    let rest = rows.filter((r) => r.name !== '..');
    if (sort.value.key) rest = rest.sort(compareRows);
    const q = filterText.value.trim().toLowerCase();
    if (q) {
        const hay = (r) => [r.name, r.size, r.fileperms, r.owner, r.group, r.lastmodified_hr].filter(Boolean).join(' ').toLowerCase();
        return [...up.filter((r) => hay(r).includes(q)), ...rest.filter((r) => hay(r).includes(q))];
    }
    return [...up, ...rest];
});

const pageLength = computed(() => store.state.config.pageLength || 50);
const pageCount = computed(() =>
    store.state.config.paging ? Math.max(1, Math.ceil(filteredRows.value.length / pageLength.value)) : 1,
);
const pageRows = computed(() => {
    if (!store.state.config.paging) return filteredRows.value;
    const start = Math.min(page.value, pageCount.value - 1) * pageLength.value;
    return filteredRows.value.slice(start, start + pageLength.value);
});

// Published for keyboard navigation (consumed by keybindings.js).
watch(
    pageRows,
    (rows) => {
        store.visibleRows = rows;
    },
    { immediate: true },
);

// -- row state ------------------------------------------------------------------
function rowStateClass(item, idx) {
    const classes = [];
    if (store.state.selected.includes(item.name)) classes.push('selectedItem');
    if (store.state.highlighted === idx) classes.push('highlightedItem');
    return classes;
}

// -- clicks (legacy tbody click listener) ----------------------------------------
function onRowClick(e, item) {
    if (e.target.tagName === 'TD' && item.name !== '..' && (e.ctrlKey || e.metaKey)) {
        const i = store.state.selected.indexOf(item.name);
        if (i >= 0) store.state.selected.splice(i, 1);
        else store.state.selected.push(item.name);
    }
}

function onItemClick(e, item) {
    if (item.type === 'dir') {
        e.preventDefault();
        e.stopPropagation();
        store.changeDirectory(item.name);
    } else if (item.link === '#') {
        e.preventDefault();
    }
}

function onAction(action, item) {
    if (action === 'rename') store.openModal('rename', { filename: item.name });
    else if (action === 'extract') store.openModal('extract', { filename: item.name });
    else if (action === 'edit') editFile(store, item.name);
    else if (action === 'delete') store.openModal('delete', { items: item });
    else if (action === 'copymove') store.openModal('copymove', { items: item });
}

function onPermEnter(e, item) {
    changePermissions(store, item.name, e.target.value);
}

// -- context menu ------------------------------------------------------------------
const menu = reactive({ visible: false, x: 0, y: 0, clicked: null, selected: [] });

const menuEnabled = computed(() => {
    const c = store.state.config;
    return c.contextmenu && (c.edit || c.extract || c.rename || c.copymove || c.download || c.delete);
});

function selectedItems() {
    return store.state.selected
        .map((name) => store.state.files.find((x) => x.name === name))
        .filter(Boolean);
}

function onRowContext(e, item) {
    if (!menuEnabled.value) return;
    menu.clicked = item;
    menu.selected = selectedItems();
    menu.x = Math.min(e.clientX, window.innerWidth - 240);
    menu.y = Math.min(e.clientY, window.innerHeight - 200);
    menu.visible = true;
}

function onMenuAction(name) {
    const clicked = menu.clicked;
    const selected = menu.selected;
    menu.visible = false;
    if (name === 'edit') editFile(store, clicked.name);
    else if (name === 'extract') store.openModal('extract', { filename: clicked.name });
    else if (name === 'rename') store.openModal('rename', { filename: clicked.name });
    else if (name === 'copylink') copyLink(clicked);
    else if (name === 'copymove') store.openModal('copymove', { items: selected.length ? selected : clicked });
    else if (name === 'download') {
        if (selected.length) store.notify('At the moment it is not possible to download a set of files.');
        else window.location = clicked.download.link;
    } else if (name === 'createarchive') {
        store.openModal('createarchive', { items: selected.length ? selected : clicked });
    } else if (name === 'delete') {
        store.openModal('delete', { items: selected.length ? selected : clicked });
    }
}

function copyLink(clicked) {
    if (clicked.link.toLowerCase().substr(0, 4) === 'http') {
        copyToClipboard(clicked.link);
        return;
    }
    const parts = window.location.pathname.replace(/^\/*/g, '').split('/');
    parts.pop();
    const link =
        parts.length > 0 && parts[0] !== ''
            ? buildAbsoluteLink(clicked.link, { origin: window.location.origin, pathnameDir: parts.join('/') })
            : buildAbsoluteLink(clicked.link, { origin: window.location.origin, pathnameDir: '' });
    copyToClipboard(link);
}

// -- image hover preview (legacy popover drawCallback) ------------------------------
const preview = ref(null);

function onHover(e, item) {
    if (!item.popover) {
        preview.value = null;
        return;
    }
    preview.value = {
        src: previewSrc(item, {
            config: store.state.config,
            currentDir: store.state.currentDir,
            apiBase: store.api.apiBase,
        }),
        x: e.clientX + 12,
        y: e.clientY + 12,
    };
}

function hidePreview() {
    preview.value = null;
}

// -- row drag & drop to move (legacy document drop handler, config.copymove) ----------
function isFileEvent(e) {
    return Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') !== -1;
}

function dragPayload(item) {
    const selected = selectedItems();
    const data = selected.length ? selected : item;
    return JSON.stringify(data);
}

function onDragStart(e, item) {
    try {
        e.dataTransfer.setData('text/plain', dragPayload(item));
    } catch {
        /* clipboard unavailable */
    }
    const count = selectedItems().length;
    const dragImage = document.createElement('div');
    dragImage.style.display = 'inline';
    dragImage.style.padding = '10px';
    dragImage.innerHTML = `<span class="icon fa fa-folder-open-o"></span> ${store.t('move')} ${count || item.name}`;
    document.body.appendChild(dragImage);
    try {
        e.dataTransfer.setDragImage(dragImage, 0, 0);
    } catch {
        /* ignore */
    }
    setTimeout(() => dragImage.remove());
}

function onDragOver(e, item) {
    if (!isFileEvent(e) && item.type === 'dir') e.preventDefault();
}

function onDragEnter(e, item) {
    if (!isFileEvent(e) && e.target.tagName === 'TD' && item.type === 'dir') {
        e.target.parentElement.classList.add('highlightedItem');
    }
}

function onDragLeave(e, item) {
    if (!isFileEvent(e) && e.target.tagName === 'TD' && item.type === 'dir') {
        e.target.parentElement.classList.remove('highlightedItem');
    }
}

function onDrop(e, item) {
    if (isFileEvent(e) || e.target.tagName !== 'TD' || item.type !== 'dir') return;
    e.preventDefault();
    e.stopPropagation();
    document.querySelectorAll('#filetable .highlightedItem').forEach((el) => el.classList.remove('highlightedItem'));
    try {
        let source = JSON.parse(e.dataTransfer.getData('text'));
        if (!Array.isArray(source)) source = [source];
        if (source.find((x) => x.name === item.name)) {
            store.notify('Source and destination are equal.');
        } else {
            copyMove(store, source, item.name, 'move');
        }
    } catch {
        /* malformed payload */
    }
}
</script>
