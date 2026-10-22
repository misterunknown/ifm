<template>
  <div class="ifm-login-wrap">
    <form class="form-signin card" @submit.prevent="submit">
      <div class="card-body">
        <h3 class="text-center w-100 mb-3">IFM {{ t('login') }}</h3>
        <div class="form-label-group">
          <FaIcon icon="circle-user" class="input-icon" />
          <input
            id="inputLogin"
            v-model="username"
            type="text"
            class="form-control"
            :placeholder="t('username')"
            required
            autofocus
          />
          <label for="inputLogin">{{ t('username') }}</label>
        </div>
        <div class="form-label-group">
          <FaIcon icon="key" class="input-icon" />
          <input
            id="inputPassword"
            v-model="password"
            type="password"
            class="form-control"
            :placeholder="t('password')"
            required
          />
          <label for="inputPassword">{{ t('password') }}</label>
        </div>
        <div v-if="store.loginError" class="alert alert-danger" role="alert">{{ store.loginError }}</div>
        <button class="btn btn-lg btn-primary w-100" type="submit" :disabled="store.loginBusy">
          <FaIcon v-if="store.loginBusy" icon="spinner" spin />
          {{ t('login') }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { login, store } from '../store'
import { t } from '../i18n'

const username = ref('')
const password = ref('')

function submit(): void {
  void login(username.value, password.value)
}
</script>
