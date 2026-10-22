<template>
  <div class="ifm-toasts" :class="{ 'with-tasks': store.tasks.length > 0 }">
    <div
      v-for="toast in store.toasts"
      :key="toast.id"
      class="alert mb-0"
      :class="toastClass(toast.kind)"
      role="alert"
    >
      {{ toast.message }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { store, type Toast } from '../store'

function toastClass(kind: Toast['kind']): string {
  if (kind === 'success') return 'alert-success'
  if (kind === 'danger') return 'alert-danger'
  return 'alert-info'
}
</script>
