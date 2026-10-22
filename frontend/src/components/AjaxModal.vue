<!-- AJAX probe dialog. Port of modal.ajaxrequest.html + showAjaxRequestDialog:
  GET/POST with optional data, response text and a status badge. The dialog
  stays open across requests like the legacy one. -->
<template>
    <Modal @close="store.closeModal()">
        <form id="formAjaxRequest" @submit.prevent="request">
            <div class="modal-body">
                <fieldset>
                    <div class="form-group mb-3">
                        <label for="ajaxurl">URL</label>
                    <input
                        v-model="ajaxurl"
                        class="form-control"
                        type="url"
                        id="ajaxurl"
                        name="ajaxurl"
                        placeholder="https://..."
                        autocomplete="off"
                        autofocus
                        required
                        @keydown.enter.prevent
                    >
                </div>
                <div class="form-group mb-3">
                    <legend>{{ store.t('method') }}</legend>
                    <div class="form-check form-check-inline">
                        <input
                            v-model="httpMethod"
                            class="form-check-input"
                            type="radio"
                            id="radioget"
                            name="arMethod"
                            value="GET"
                        >
                        <label class="form-check-label" for="radioget">GET</label>
                    </div>
                    <div class="form-check form-check-inline">
                        <input
                            v-model="httpMethod"
                            class="form-check-input"
                            type="radio"
                            id="radiopost"
                            name="arMethod"
                            value="POST"
                        >
                        <label class="form-check-label" for="radiopost">POST</label>
                    </div>
                </div>
                <div v-if="httpMethod === 'POST'" class="form-group mb-3" id="ajaxDataContainer">
                    <label for="ajaxdata">{{ store.t('data') }}</label>
                    <textarea v-model="ajaxdata" class="form-control" id="ajaxdata" name="ajaxdata" rows="4"></textarea>
                </div>
                <button type="button" class="btn btn-success" id="buttonRequest" @click="request">
                    {{ store.t('request') }}
                </button>
                <div class="form-group mt-3">
                    <label for="ajaxresponse"
                        >{{ store.t('response') }}
                        <span
                            v-if="statusCode !== null"
                            id="ajaxStatusCode"
                            class="badge"
                            :class="statusOk ? 'bg-success' : 'bg-danger'"
                            >{{ statusCode }}</span
                        ></label
                    >
                    <textarea
                        v-model="response"
                        class="form-control"
                        id="ajaxresponse"
                        name="ajaxresponse"
                        rows="6"
                        readonly
                    ></textarea>
                </div>
                </fieldset>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-danger" id="buttonClose" @click="store.closeModal()">
                    {{ store.t('cancel') }}
                </button>
            </div>
        </form>
    </Modal>
</template>

<script setup>
import { inject, ref } from 'vue';
import Modal from './Modal.vue';

const store = inject('store');
const ajaxurl = ref('');
const httpMethod = ref('POST');
const ajaxdata = ref('');
const response = ref('');
const statusCode = ref(null);
const statusOk = ref(false);

async function request() {
    const data = httpMethod.value === 'POST' ? ajaxdata.value.replace(/\n/g, '&') : '';
    try {
        const res = await store.api.probeUrl(ajaxurl.value, data, httpMethod.value);
        response.value = res.text;
        statusCode.value = res.status;
        statusOk.value = res.status >= 200 && res.status < 300;
    } catch (e) {
        response.value = '';
        statusCode.value = 0;
        statusOk.value = false;
        store.notifyError(e.message);
    }
}
</script>
