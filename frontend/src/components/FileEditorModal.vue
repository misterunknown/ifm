<!-- File editor dialog. Port of src/templates/modal.file.html +
  modal.file_editoroptions.html + IFM.showFileDialog.

  Differences from the legacy editor (documented, same user-visible effect):
  - ACE modes ship in the bundle (the legacy acedir is empty upstream, so its
    syntax selector never appeared). A curated static mode list is used.
  - The editor-options popover is a toggle panel (Bootstrap 5 has no
    jQuery popover dependency).
  - Ctrl-Shift-F toggles a fullscreen CSS class instead of reparenting the
    editor node; same keybinding, same effect.
-->
<template>
    <Modal :large="true" :dismissible="!dirty" @close="store.closeModal()">
        <form id="formFile" @submit.prevent>
            <div class="modal-body">
                <fieldset>
                    <div class="form-group mb-3">
                        <label for="filename">{{ store.t('filename') }}:</label>
                        <input
                            v-model="filename"
                            type="text"
                            class="form-control"
                            :class="{ 'is-invalid': nameTaken }"
                            name="filename"
                            id="filename"
                            @keydown.enter.prevent
                        >
                        <div class="invalid-feedback" id="filenameError">
                            {{ nameTaken ? store.t('name_already_exists') : '' }}
                        </div>
                    </div>
                    <div class="form-group mb-3" id="content" name="content" ref="editorEl"></div>
                    <button type="button" class="btn btn-secondary" id="editoroptions" @click="showOptions = !showOptions">
                        {{ store.t('editor_options') }}
                    </button>
                    <div v-if="showOptions" class="card card-body mt-2">
                        <h6 class="card-title">{{ store.t('options') }}</h6>
                        <div class="form-group">
                            <div class="form-check form-switch">
                                <input
                                    id="editor-wordwrap"
                                    v-model="opts.wordwrap"
                                    class="form-check-input"
                                    type="checkbox"
                                >
                                <label class="form-check-label" for="editor-wordwrap">{{ store.t('word_wrap') }}</label>
                            </div>
                            <div class="form-check form-switch">
                                <input
                                    id="editor-invisible-chars"
                                    v-model="opts.invisibles"
                                    class="form-check-input"
                                    type="checkbox"
                                >
                                <label class="form-check-label" for="editor-invisible-chars">{{
                                    store.t('invisible_chars')
                                }}</label>
                            </div>
                            <div class="form-check form-switch">
                                <input
                                    id="editor-softtabs"
                                    v-model="opts.softtabs"
                                    class="form-check-input"
                                    type="checkbox"
                                >
                                <label class="form-check-label" for="editor-softtabs">{{ store.t('soft_tabs') }}</label>
                            </div>
                        </div>
                        <div class="input-group mb-2">
                            <span class="input-group-text" id="editor-tabsize-label">{{ store.t('tab_size') }}</span>
                            <input
                                v-model.number="opts.tabsize"
                                class="form-control"
                                type="number"
                                min="1"
                                max="9"
                                id="editor-tabsize"
                                :title="store.t('tab_size')"
                                aria-describedby="editor-tabsize-label"
                            >
                        </div>
                        <select v-model="mode" class="form-select" id="editor-syntax">
                            <option v-for="m in modes" :key="m" :value="`ace/mode/${m}`">{{ m }}</option>
                        </select>
                    </div>
                </fieldset>
            </div>
            <div class="modal-footer">
                <button type="button" id="buttonSaveNotClose" class="btn btn-success" @click="save(false)">
                    {{ store.t('save') }}
                </button>
                <button type="button" id="buttonClose" class="btn btn-danger" @click="closeByButton">
                    {{ store.t('close') }}
                </button>
            </div>
        </form>
    </Modal>
</template>

<script setup>
import { computed, inject, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import Modal from './Modal.vue';
import { saveFile } from '../store/ops.js';

import ace from 'ace-builds/src-noconflict/ace';
import 'ace-builds/src-noconflict/mode-c_cpp';
import 'ace-builds/src-noconflict/mode-css';
import 'ace-builds/src-noconflict/mode-diff';
import 'ace-builds/src-noconflict/mode-dockerfile';
import 'ace-builds/src-noconflict/mode-golang';
import 'ace-builds/src-noconflict/mode-html';
import 'ace-builds/src-noconflict/mode-ini';
import 'ace-builds/src-noconflict/mode-java';
import 'ace-builds/src-noconflict/mode-javascript';
import 'ace-builds/src-noconflict/mode-json';
import 'ace-builds/src-noconflict/mode-kotlin';
import 'ace-builds/src-noconflict/mode-less';
import 'ace-builds/src-noconflict/mode-lua';
import 'ace-builds/src-noconflict/mode-markdown';
import 'ace-builds/src-noconflict/mode-perl';
import 'ace-builds/src-noconflict/mode-php';
import 'ace-builds/src-noconflict/mode-python';
import 'ace-builds/src-noconflict/mode-r';
import 'ace-builds/src-noconflict/mode-ruby';
import 'ace-builds/src-noconflict/mode-rust';
import 'ace-builds/src-noconflict/mode-sass';
import 'ace-builds/src-noconflict/mode-scss';
import 'ace-builds/src-noconflict/mode-sh';
import 'ace-builds/src-noconflict/mode-sql';
import 'ace-builds/src-noconflict/mode-svg';
import 'ace-builds/src-noconflict/mode-swift';
import 'ace-builds/src-noconflict/mode-text';
import 'ace-builds/src-noconflict/mode-typescript';
import 'ace-builds/src-noconflict/mode-xml';
import 'ace-builds/src-noconflict/mode-yaml';

const store = inject('store');
const props = defineProps({
    filename: { type: String, default: undefined },
    content: { type: String, default: '' },
});

const isNewFile = props.filename === undefined;
const originalFilename = props.filename ?? 'newfile.txt';
const filename = ref(originalFilename);
const editorEl = ref(null);
const showOptions = ref(false);
const dirty = ref(false);
let editor = null;

const nameTaken = computed(() => {
    const value = filename.value;
    return (
        (isNewFile || value !== originalFilename) && store.state.files.some((x) => x.name === value)
    );
});

const modes = [
    'c_cpp', 'css', 'diff', 'dockerfile', 'golang', 'html', 'ini', 'java', 'javascript', 'json',
    'kotlin', 'less', 'lua', 'markdown', 'perl', 'php', 'python', 'r', 'ruby', 'rust',
    'sass', 'scss', 'sh', 'sql', 'svg', 'swift', 'text', 'typescript', 'xml', 'yaml',
];

const EXT_TO_MODE = {
    c: 'c_cpp', h: 'c_cpp', cpp: 'c_cpp', java: 'java', js: 'javascript', mjs: 'javascript',
    ts: 'typescript', json: 'json', html: 'html', htm: 'html', css: 'css', scss: 'scss',
    sass: 'sass', less: 'less', xml: 'xml', svg: 'svg', md: 'markdown', py: 'python',
    php: 'php', sh: 'sh', sql: 'sql', yaml: 'yaml', yml: 'yaml', rb: 'ruby', go: 'golang',
    rs: 'rust', pl: 'perl', lua: 'lua', r: 'r', swift: 'swift', kt: 'kotlin', kts: 'kotlin',
    ini: 'ini', conf: 'ini', dockerfile: 'dockerfile', diff: 'diff', patch: 'diff',
};

function modeForPath(name) {
    const base = name.split('/').pop().toLowerCase();
    if (base === 'dockerfile') return 'ace/mode/dockerfile';
    const ext = base.includes('.') ? base.substr(base.lastIndexOf('.') + 1) : '';
    return `ace/mode/${EXT_TO_MODE[ext] || 'text'}`;
}

const mode = ref(modeForPath(originalFilename));
const opts = reactive({ wordwrap: false, invisibles: false, softtabs: true, tabsize: 4 });

watch(
    () => opts.wordwrap,
    (v) => editor?.getSession().setOption('wrap', v ? true : 'off'),
);
watch(
    () => opts.invisibles,
    (v) => editor?.setOption('showInvisibles', v),
);
watch(
    () => opts.softtabs,
    (v) => editor?.getSession().setOption('useSoftTabs', v),
);
watch(
    () => opts.tabsize,
    (v) => editor?.getSession().setOption('tabSize', v),
);
watch(mode, (v) => editor?.getSession().setMode(v));

onMounted(() => {
    editor = ace.edit(editorEl.value);
    editor.$blockScrolling = 'Infinity';
    editor.getSession().setValue(props.content);
    editor.getSession().setMode(mode.value);
    editor.focus();
    editor.on('change', () => {
        dirty.value = true;
    });
    editor.commands.addCommand({
        name: 'toggleFullscreen',
        bindKey: 'Ctrl-Shift-F',
        exec(ed) {
            ed.container.classList.toggle('editor-fullscreen');
            ed.resize();
            ed.focus();
        },
    });
});

onBeforeUnmount(() => {
    if (editor) {
        editor.destroy();
        editor = null;
    }
});

async function save(close) {
    if (nameTaken.value) return;
    await saveFile(store, filename.value, editor.getValue());
    dirty.value = false;
    if (close) store.closeModal();
}

function closeByButton() {
    // Legacy sets isModalClosedByButton so the dirty guard lets Close through.
    dirty.value = false;
    store.closeModal();
}
</script>

<style scoped>
.editor-fullscreen {
    position: fixed !important;
    top: 0;
    left: 0;
    z-index: 10000;
    width: 100% !important;
    height: 100% !important;
}
</style>
