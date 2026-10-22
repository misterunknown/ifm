<template>
  <div class="ifm-modal-backdrop" @mousedown.self="requestClose">
    <div class="ifm-modal" :class="[{ large: large }, cls]">
      <div v-if="title" class="ifm-modal-header">
        <h5>{{ title }}</h5>
        <button type="button" class="btn-close" :aria-label="t('close')" @click="requestClose"></button>
      </div>
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { tryCloseModal } from '../store'
import { t } from '../i18n'

defineProps<{ large?: boolean; title?: string; cls?: string }>()

function requestClose(): void {
  tryCloseModal()
}
</script>
