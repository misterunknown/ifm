<!-- Search dialog. Port of modal.search.html + modal.searchresults.html +
  showSearchDialog: pattern input, spinner while searching, result rows that
  navigate into the containing folder. The last pattern and results persist
  in the store across openings (legacy self.search). -->
<template>
    <Modal @close="store.closeModal()">
        <form id="searchForm" @submit.prevent="search">
            <div class="modal-body">
                <fieldset>
                    <div class="form-group mb-3">
                        <label for="searchPattern">{{ store.t('search') }}</label>
                    <div class="input-group">
                        <input
                            v-model="pattern"
                            type="search"
                            class="form-control"
                            id="searchPattern"
                            name="pattern"
                            autocomplete="off"
                            autofocus
                        >
                        <button class="btn btn-primary" type="button" id="buttonSearch" @click="search">
                            <span class="fa fa-search"></span>
                        </button>
                    </div>
                </div>
                <div class="search-results-container">
                    <table id="searchResults" class="table">
                        <tbody>
                            <tr v-if="searching">
                                <td style="text-align: center"><span class="icon fa fa-spinner fa-spin"></span></td>
                            </tr>
                            <template v-else-if="rows">
                                <tr v-for="item in rows" :key="item.name" :class="item.rowclasses">
                                    <td>
                                        <a
                                            tabindex="0"
                                            class="searchitem"
                                            :data-type="item.type"
                                            :data-folder="item.folder"
                                            @click="gotoItem(item)"
                                            @keydown.enter.prevent="gotoItem(item)"
                                        >
                                            <span :class="item.icon"></span> {{ item.linkname }}
                                            <span class="search-folder-path">({{ item.folder }})</span>
                                        </a>
                                    </td>
                                </tr>
                                <tr v-if="!rows.length">
                                    <td>No results found.</td>
                                </tr>
                            </template>
                        </tbody>
                    </table>
                    </div>
                </fieldset>
            </div>
        </form>
    </Modal>
</template>

<script setup>
import { inject, ref } from 'vue';
import Modal from './Modal.vue';
import { splitSearchName } from '../api/helpers.js';
import { joinPath } from '../store/index.js';

const store = inject('store');
const pattern = ref(store.state.search.lastSearch);
const searching = ref(false);
const rows = ref(
    store.state.search.data
        ? store.state.search.data.map((item) => ({ ...item, ...splitSearchName(item.name) }))
        : null,
);

async function search() {
    if (!pattern.value || pattern.value.trim() === '') return;
    searching.value = true;
    store.state.search.lastSearch = pattern.value;
    try {
        const data = await store.api.searchItems(store.state.currentDir, pattern.value);
        if (data.status === 'ERROR') {
            store.closeModal();
            store.notifyError(data.message);
            return;
        }
        data.forEach((e) => Object.assign(e, splitSearchName(e.name)));
        store.state.search.data = data;
        store.state.search.data.currentDir = store.state.currentDir;
        rows.value = data;
    } finally {
        searching.value = false;
    }
}

function gotoItem(item) {
    // Legacy navigates to currentDir-at-search-time + result folder, absolute.
    store.changeDirectory(joinPath(store.state.search.data.currentDir, item.folder), { absolute: true });
    store.closeModal();
}
</script>
