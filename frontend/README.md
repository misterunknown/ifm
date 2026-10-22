# IFM frontend (Vue 3 + Vite)

A rewrite of the IFM web UI with Vue 3 + Vite. The PHP backend is unchanged:
this app speaks the exact same `?api=` contract as the legacy jQuery frontend
(`src/ifm.js`), so every backend feature flag, auth mode, and CSRF rule keeps
working, and the PHP test suite (`make test`) is unaffected.

## Layout

```
frontend/
  index.html            dev-only shell (production shell comes from PHP)
  vite.config.js        single-file build + dev proxy to the PHP backend
  package.json
  src/
    main.js             createApp(App).mount('#app')
    App.vue             boot (getConfig -> getI18N -> checkAuth -> app), shell
    api/
      client.js         IfmApi: form-encoded POSTs, session cookies, X-IFM-CSRF
      helpers.js        pure ports (pathCombine, hrefEncode, dates, MIME gate…)
      fileLinks.js      row enrichment + href matrix (port of rebuildFileTable)
    store/
      index.js          reactive state (config, i18n, files, tasks, toasts…)
      ops.js            file operations (port of the IFM.* methods)
      keybindings.js    shortcuts, highlight nav, history, unload guard
    components/         one Vue component per legacy template/dialog
    assets/main.css     port of src/style.css for Bootstrap 5
    i18n/en.json        boot fallback (byte-identical copy of src/i18n/en.json;
                        replaced by the backend getI18N response after load)
  tests/                vitest suites for the pure ports (helpers, fileLinks)
```

Legacy mapping: `ifm.js` init/boot -> `App.vue` + `store`; `showModal` templates
-> `components/*Modal.vue` + `Modal.vue`; DataTables -> `FileTable.vue`
(sorting/filter/paging); BootstrapMenu -> `ContextMenu.vue`;
bootstrap-notify -> `Toasts.vue`; bootstrap-treeview -> `FolderTree.vue`;
ACE editor -> `FileEditorModal.vue` (ace-builds); footer/task templates ->
`TasksFooter.vue`; navbar/app/filetable/login templates -> `Navbar.vue`,
`FileTable.vue`, `LoginModal.vue`.

## Development

```bash
make frontend-install   # or: cd frontend && npm install
```

Run a PHP backend (any IFM dist or the test server), then start Vite:

```bash
# single-file dist as backend, API + UI same-origin through the proxy:
php -S 127.0.0.1:8080 dist/vue.ifm.php
VITE_IFM_BACKEND=http://127.0.0.1:8080 npm run dev   # Serves :5173, /__ifm_api -> backend
```

`VITE_IFM_API` overrides the API base URL (default: same-origin, like the
legacy `window.location.href` base). `VITE_IFM_BACKEND` sets the dev-proxy
target (default `http://127.0.0.1:8080`).

> On hosts where the default npm mirror is unreachable (e.g. this repo's CI
> sandbox), pass the public registry explicitly:
> `npm install --registry=https://registry.npmjs.org/`.

## Production build

```bash
make frontend-build   # or: cd frontend && npm run build  -> frontend/dist/
make build-vue        # frontend build + php compiler.php --vue
```

`compiler.php --vue` embeds `frontend/dist/ifm-vue.js` / `ifm-vue.css` into
the single-file dist, producing `dist/vue.ifm.php`, `dist/vue.ifm.min.php`
(gzip), and `dist/vue.libifm.php`. The bundle is fully self-contained
(dependencies bundled, fonts/images as data URIs), matching the "bundled"
flavour — there is no `--cdn --vue` combination. The Vue dists ship
alongside the legacy ones; `make build` / `make test` never touch Node and
their output is byte-identical to before.

Deploy `dist/vue.ifm.php` like `ifm.php` (drop into a PHP-enabled vhost), or
run it directly:

```bash
php -S 8080 dist/vue.ifm.php
```

## Tests

```bash
make frontend-test    # or: cd frontend && npm test   (vitest, 36 tests)
```

Expectations are derived from the legacy implementation in `src/ifm.js` /
`src/main.php` (request shapes, href matrix, MIME gate, archive formats,
sort order, dialog defaults), not from the new code.

## Deliberate differences from the legacy UI

All API-visible behavior is identical (verified: same JSON for an 18-call
matrix against both dists). Purely presentational/structural deltas:

* Bootstrap 5 + hand-rolled modal/menu/toast/tree components replace the
  jQuery plugins (Bootstrap 4 JS, DataTables, BootstrapMenu,
  bootstrap-notify, bootstrap-treeview). Markup/classes are Bootstrap 5.
* One dialog slot instead of stacked duplicate-`id` modals; global shortcuts
  pause while a dialog is open so background keys cannot discard dialog
  state (e.g. editor content).
* The upload-overwrite confirm replaces the upload dialog instead of
  stacking a second `#ifmmodal` on top (same visible outcome).
* Copy/Move buttons stay disabled until a destination is selected (the
  legacy dialog threw and did nothing on click without a selection).
* Ctrl/Cmd-click multi-select (legacy: Ctrl only); typing detection uses
  `closest('input, textarea, select')` (the legacy ancestor walk only ever
  checked the event target).
* The editor ships 30 ACE modes selected by extension; upstream's
  `src/includes/ace/` is empty, so the legacy syntax selector never
  appeared. Editor options render as a toggle panel instead of a jQuery
  popover; Ctrl-Shift-F toggles a fullscreen class instead of reparenting
  the editor node.
* Table sort/filter/page persist in `localStorage` under `ifm-vue-filetable`
  (legacy DataTables stateSave).
* `misc.savequestion.html` is unreferenced by `src/ifm.js` and was not
  ported. `getClipboardLink` / `getFolderTree` are likewise defined but
  never called by the legacy UI; the backend endpoints remain.
