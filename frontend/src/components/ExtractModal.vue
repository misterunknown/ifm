<!-- Extract-archive dialog. Port of modal.extractfile.html +
  showExtractFileDialog: current dir, suggested subdir, or custom location. -->
<template>
    <Modal @close="store.closeModal()">
        <form id="formExtractFile" @submit.prevent="submit">
            <div class="modal-body">
                <fieldset>
                    <div class="form-group">
                        <label>{{ store.t('extract_filename') }} {{ filename }}:</label>
                        <div class="input-group ifm-extract-option">
                            <span class="input-group-text">
                                <input v-model="location" type="radio" name="extractTargetLocation" value="./">
                            </span>
                            <input
                                class="form-control ifm-extract-location-input"
                                type="text"
                                data-radio-value="./"
                                placeholder="Current directory"
                                readonly
                                @click="location = './'"
                            >
                        </div>
                        <div class="input-group ifm-extract-option">
                            <span class="input-group-text">
                                <input v-model="location" type="radio" name="extractTargetLocation" :value="`./${suggestion}`">
                            </span>
                            <input
                                class="form-control ifm-extract-location-input"
                                type="text"
                                :data-radio-value="`./${suggestion}`"
                                :placeholder="suggestion"
                                readonly
                                @click="location = `./${suggestion}`"
                            >
                        </div>
                        <div class="input-group ifm-extract-option">
                            <span class="input-group-text">
                                <input v-model="location" type="radio" name="extractTargetLocation" value="custom">
                            </span>
                            <input
                                v-model="custom"
                                id="extractCustomLocation"
                                type="text"
                                class="form-control"
                                placeholder="Custom location"
                                @focus="location = 'custom'"
                                @keydown.enter.prevent="submit"
                            >
                        </div>
                    </div>
                </fieldset>
            </div>
            <div class="modal-footer">
                <button type="submit" class="btn btn-primary" id="buttonExtract">{{ store.t('extract') }}</button>
                <button type="button" class="btn btn-danger" id="buttonCancel" @click="store.closeModal()">
                    {{ store.t('cancel') }}
                </button>
            </div>
        </form>
    </Modal>
</template>

<script setup>
import { inject, ref } from 'vue';
import Modal from './Modal.vue';
import { suggestExtractDir } from '../api/helpers.js';
import { extractFile } from '../store/ops.js';

const store = inject('store');
const props = defineProps({
    filename: { type: String, required: true },
});

const suggestion = suggestExtractDir(props.filename);
const location = ref('./');
const custom = ref('');

async function submit() {
    await extractFile(store, props.filename, location.value === 'custom' ? custom.value : location.value);
    store.closeModal();
}
</script>
