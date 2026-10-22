<template>
  <Modal :title="t('search')">
    <form @submit.prevent="run">
      <div class="modal-body">
        <div class="mb-2">
          <label for="dlg-search-pattern" class="form-label">{{ t('search') }}</label>
          <div class="input-group">
            <input
              id="dlg-search-pattern"
              v-model="pattern"
              type="search"
              class="form-control"
              autocomplete="off"
              autofocus
            />
            <button class="btn btn-primary" type="submit">
              <FaIcon icon="magnifying-glass" />
            </button>
          </div>
        </div>
        <div class="search-results-container">
          <table class="table">
            <tbody>
              <tr v-if="store.searchBusy">
                <td style="text-align: center"><FaIcon icon="spinner" spin /></td>
              </tr>
              <template v-else-if="store.searchResults.length > 0">
                <tr v-for="item in store.searchResults" :key="item.guid">
                  <td>
                    <a tabindex="0" class="searchitem" @click="jump(item)" @keyup.enter="jump(item)">
                      {{ item.linkname }} <span class="search-folder-path">({{ item.folder }})</span>
                    </a>
                  </td>
                </tr>
              </template>
              <tr v-else-if="searched">
                <td>No results found.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </form>
  </Modal>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Modal from '../Modal.vue'
import { pathCombine, type SearchResult } from '../../api'
import { changeDirectory, closeModal, searchItems, store } from '../../store'
import { t } from '../../i18n'

const pattern = ref(store.searchPattern)
const searched = ref(store.searchResults.length > 0)

function run(): void {
  if (!pattern.value || pattern.value.trim() === '') return
  searched.value = true
  void searchItems(pattern.value)
}

function jump(item: SearchResult): void {
  const target = pathCombine(store.searchBaseDir, item.folder)
  closeModal()
  void changeDirectory(target, { absolute: true })
}
</script>
