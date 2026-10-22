<!-- Login dialog. Port of src/templates/login.html + the initCheckAuth flow:
  static backdrop (no dismiss), POST checkAuth with inputLogin/inputPassword,
  error shown in the alert box. Emits `logged-in` on success. -->
<template>
    <Modal :large="true" :dismissible="false">
        <div class="modal-header">
            <h3 class="modal-title text-center w-100">IFM {{ store.t('login') }}</h3>
        </div>
        <div class="modal-body">
            <form id="loginForm" class="form-signin" method="post" @submit.prevent="submit">
                <div class="form-label-group">
                    <span class="fa fa-user-circle fa-fw input-icon"></span>
                    <input
                        v-model="username"
                        type="text"
                        name="inputLogin"
                        id="inputLogin"
                        class="form-control"
                        :placeholder="store.t('username')"
                        required
                        autofocus
                    >
                    <label for="inputLogin">{{ store.t('username') }}</label>
                </div>
                <div class="form-label-group">
                    <span class="fa fa-key fa-fw input-icon"></span>
                    <input
                        v-model="password"
                        type="password"
                        name="inputPassword"
                        id="inputPassword"
                        class="form-control"
                        :placeholder="store.t('password')"
                        required
                    >
                    <label for="inputPassword">{{ store.t('password') }}</label>
                </div>
                <div class="alert alert-danger" :class="{ 'd-none': !error }" role="alert">{{ error }}</div>
                <button id="buttonLogin" class="btn btn-lg btn-primary w-100" type="submit">
                    {{ store.t('login') }}
                </button>
            </form>
        </div>
    </Modal>
</template>

<script setup>
import { inject, ref } from 'vue';
import Modal from './Modal.vue';

const store = inject('store');
const emit = defineEmits(['logged-in']);

const username = ref('');
const password = ref('');
const error = ref('');

async function submit() {
    error.value = '';
    try {
        const data = await store.api.login(username.value, password.value);
        if (data.status !== 'ERROR') {
            emit('logged-in');
        } else {
            error.value = data.message;
        }
    } catch {
        error.value = 'Authentication failed';
    }
}
</script>
