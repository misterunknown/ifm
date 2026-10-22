# IFM frontend (Vue 3 + Vite)

Single-page frontend for the [IFM file manager](../README.md). It talks to the
unchanged PHP backend (`src/main.php`) through the same JSON API the legacy
jQuery client used, and compiles to a deterministic pair of artifacts that
`compiler.php` inlines into the single-file `ifm.php` distribution:

* `dist/ifm-frontend.js` — the whole app (Vue, ACE editor, icons) as one IIFE bundle
* `dist/ifm-frontend.css` — Bootstrap 5 plus app styles, fonts inlined as base64

## Stack

* [Vue 3](https://vuejs.org/) (Composition API, `<script setup>` + TypeScript)
* [Vite](https://vite.dev/) (dev server + production build)
* [ACE](https://ace.c9.io/) via `ace-builds` (file editor, modes bundled statically)
* [Bootstrap 5](https://getbootstrap.com/) CSS
* [Font Awesome](https://fontawesome.com/) SVG icons (`@fortawesome/vue-fontawesome`)

No jQuery, no Mustache, no DataTables. The PHP backend is the source of truth
for configuration (`api=getConfig`), translations (`api=getI18N`) and the
FA4-style file-type icon names (`src/icons.ts` maps them to FA SVG icons).

## Requirements

* Node.js `^20.19.0 || >=22.12.0` and `npm` (see `engines` in `package.json`)

## Development

```bash
cd frontend
npm ci
npm run dev        # Vite dev server on http://127.0.0.1:5173
```

The dev server needs a PHP backend to talk to. Start one, e.g.:

```bash
IFM_ROOT_DIR=/tmp php -S 127.0.0.1:8080 -t /path/to/served/root
```

then open the app with the backend URL override:

```
http://127.0.0.1:5173/?api-dev=http://127.0.0.1:8080/index.php
```

(`api-dev` replaces the default API base, which is the current page URL.
Note: cross-origin dev cannot carry the PHP session cookie, so use it with
authentication disabled; for authenticated setups build the artifact
(`npm run build`, then serve `dist/` + the PHP backend same-origin).)

Useful scripts:

| command            | description                              |
| ------------------ | ---------------------------------------- |
| `npm run dev`      | start the Vite dev server                |
| `npm run build`    | typecheck (`vue-tsc`) + production build |
| `npm run build-only` | production build without typecheck     |
| `npm run typecheck`| `vue-tsc --noEmit` only                  |
| `npm test`         | run the unit suite (`vitest run`)        |
| `npm run coverage` | suite + coverage report, fails under 80% |

## Testing

Unit tests live in `tests/` (`vitest` + `jsdom` + `@vue/test-utils`).
`npm run coverage` enforces the thresholds configured in
`vitest.config.ts` (80% statements / branches / functions / lines);
CI runs the same command.

## Build contract

`vite.config.ts` pins the output so the PHP compiler stays dumb:

* fixed file names (`ifm-frontend.js` / `ifm-frontend.css`, no content hashes),
* `format: 'iife'` — the bundle is inlined into a plain `<script>` tag, where
  ESM `import`/`export` would be a syntax error,
* `assetsInlineLimit` high enough to inline fonts, so the CSS is
  self-contained and works offline,
* no code splitting / no dynamic imports.

`compiler.php` refuses to compile when `dist/` is missing — run
`make frontend` (or `npm ci && npm run build` here) first.

## Layout

```
src/
  main.ts            app entry, mounts on #app (printed by IFM::getApplication)
  api.ts             backend client (POST actions, XHR upload, CSRF) + path/date helpers
  store.ts           central reactive state + every backend action
  i18n.ts            backend getI18N with bundled English fallback (../src/i18n/en.json)
  icons.ts           backend FA4 class names -> Font Awesome SVG definitions
  ace.ts             ACE setup + filename -> mode mapping (modes bundled statically)
  keyboard.ts        global shortcuts (same bindings as the legacy client)
  tree.ts            folder-tree data (api=getFolders)
  App.vue            boot flow (config -> i18n -> auth), drag&drop overlay, shortcuts
  components/
    Toolbar.vue      navbar (path input, feature-flagged action buttons, logout)
    FileTable.vue    sortable/filterable/paged table, selection, dnd-move, previews
    ContextMenu.vue  right-click menu (same actions/visibility rules as before)
    FolderTree.vue / FolderNodeView.vue   lazy destination picker
    EditorModal.vue  ACE editor + options, dirty guard, Ctrl-Shift-F fullscreen
    PreviewModal.vue image/audio/video preview via the proxy API
    Modal.vue / ModalHost.vue / Toasts.vue / TaskBar.vue / LoginForm.vue
    dialogs/         one SFC per dialog (createDir, delete, rename, copyMove,
                     extract, upload, overwrite, remoteUpload, ajax, search,
                     createArchive)
```

## Backend API used

`getConfig`, `getI18N`, `checkAuth` (login/logout), `getRealpath`, `getFiles`,
`getFolders`, `getContent`, `saveFile`, `createDir`, `delete`, `rename`,
`download`/`proxy`/`zipnload` (plain links), `extract`, `upload`
(multipart), `copyMove`, `changePermissions`, `remoteUpload`, `searchItems`,
`createArchive`. Mutating POSTs send the `X-IFM-CSRF` header from `getConfig`,
exactly like the legacy client.

The `getTemplates` endpoint is kept for backward compatibility but no longer
used — dialogs are Vue components now.
