<!-- Toast stack replacing bootstrap-notify (legacy showMessage).
  kind: danger (error) / success / info. Auto-dismiss handled by the store. -->
<template>
    <div id="ifm-toasts" aria-live="polite">
        <div
            v-for="toast in store.state.toasts"
            :key="toast.id"
            :class="['alert', `alert-${toast.kind}`, 'mb-0']"
            role="alert"
        >
            {{ toast.message }}
        </div>
    </div>
</template>

<script setup>
import { inject } from 'vue';

const store = inject('store');
</script>
