import { createApp } from 'vue'
import { library } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import 'bootstrap/dist/css/bootstrap.min.css'
import './app.css'
import { registerIcons } from './icons'
import App from './App.vue'

registerIcons(library)

createApp(App).component('FaIcon', FontAwesomeIcon).mount('#app')
