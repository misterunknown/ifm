<!-- Generic dialog shell replacing the legacy showModal/hideModal pair.
  - large: modal-lg sizing (legacy { large: true })
  - dismissible: false renders a static backdrop without Esc/backdrop close
    (legacy login dialog: { backdrop: 'static', keyboard: false })
  - autofocuses [autofocus], else the first input/button (legacy shown handler)
-->
<template>
    <teleport to="body">
        <div
            ref="root"
            id="ifmmodal"
            class="modal d-block"
            tabindex="-1"
            role="dialog"
            @mousedown.self="onBackdrop"
            @keydown.esc="onEsc"
        >
            <div class="modal-dialog" :class="{ 'modal-lg': large }" role="document">
                <div class="modal-content">
                    <slot />
                </div>
            </div>
        </div>
        <div class="modal-backdrop show"></div>
    </teleport>
</template>

<script setup>
import { onMounted, ref } from 'vue';

const props = defineProps({
    large: { type: Boolean, default: false },
    dismissible: { type: Boolean, default: true },
});
const emit = defineEmits(['close']);
const root = ref(null);

function onBackdrop() {
    if (props.dismissible) emit('close');
}

function onEsc() {
    if (props.dismissible) emit('close');
}

onMounted(() => {
    const el = root.value;
    if (!el) return;
    let target = el.querySelector('[autofocus]');
    if (!target) {
        target = el.querySelector('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]), button');
    }
    if (target) target.focus();
});
</script>
