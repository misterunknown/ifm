<!-- Presentational lazy folder tree replacing bootstrap-treeview.
  Expansion/loading state lives in the parent (meta keyed by path).
  Backend-escaped labels render with v-html, matching the legacy treeview
  which inserted the pre-escaped text as HTML. -->
<template>
    <ul>
        <li v-for="node in nodes" :key="node.dataAttr.path">
            <span @click="$emit('toggle', node)">
                <span
                    v-if="node.lazyLoad"
                    :class="(meta[node.dataAttr.path]?.expanded ? 'icon fa fa-minus-square-o' : 'icon fa fa-plus-square')"
                ></span>
                <span v-else class="icon fa fa-folder-o"></span>
            </span>
            <span
                class="node-label"
                :class="{ 'node-selected': node.dataAttr.path === selectedPath }"
                :data-path="node.dataAttr.path"
                @click="$emit('select', node.dataAttr.path)"
            ><span v-html="node.text"></span></span>
            <span v-if="meta[node.dataAttr.path]?.loading" class="icon fa fa-spinner fa-spin"></span>
            <FolderTree
                v-if="meta[node.dataAttr.path]?.expanded && meta[node.dataAttr.path]?.children"
                :nodes="meta[node.dataAttr.path].children"
                :meta="meta"
                :selected-path="selectedPath"
                @select="$emit('select', $event)"
                @toggle="$emit('toggle', $event)"
            />
        </li>
    </ul>
</template>

<script setup>
defineProps({
    nodes: { type: Array, required: true },
    meta: { type: Object, required: true },
    selectedPath: { type: String, default: '' },
});
defineEmits(['select', 'toggle']);
</script>
