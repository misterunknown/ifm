<template>
  <li>
    <div class="ifm-tree-node" :class="{ selected: selected === node.path }" @click="toggle">
      <FaIcon :icon="expanded ? 'chevron-down' : 'chevron-right'" class="me-1" />
      <FaIcon icon="folder" class="icon me-1" />
      {{ node.text }}
      <FaIcon v-if="node.loading" icon="spinner" spin class="ms-1" />
    </div>
    <ul v-if="expanded && node.children">
      <FolderNodeView
        v-for="child in node.children"
        :key="child.path"
        :node="child"
        :selected="selected"
        @select="emit('select', $event)"
      />
    </ul>
  </li>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { loadChildren, type TreeNode } from '../tree'

const props = defineProps<{ node: TreeNode; selected: string; open?: boolean }>()
const emit = defineEmits<{ (e: 'select', path: string): void }>()

// The root level starts expanded, like the legacy treeview (levels: 1).
const expanded = ref(props.open === true)

async function toggle(): Promise<void> {
  emit('select', props.node.path)
  if (!expanded.value) {
    await loadChildren(props.node)
  }
  expanded.value = !expanded.value
}
</script>
