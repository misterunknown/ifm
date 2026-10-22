<template>
  <div class="ifm-tree">
    <ul>
      <FolderNodeView :node="root" :selected="selected" :open="true" @select="emit('update:selected', $event)" />
    </ul>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive } from 'vue'
import { loadChildren, type TreeNode } from '../tree'
import FolderNodeView from './FolderNodeView.vue'

defineProps<{ selected: string }>()
const emit = defineEmits<{ (e: 'update:selected', path: string): void }>()

const root = reactive<TreeNode>({ text: '/ [root]', path: '', children: null, loading: false })

onMounted(() => {
  void loadChildren(root)
})
</script>
