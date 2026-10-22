import { createApp } from 'vue';
import App from './App.vue';
import { createStore } from './store/index.js';

import 'bootstrap/dist/css/bootstrap.min.css';
import 'font-awesome/css/font-awesome.min.css';
import './assets/main.css';

const store = createStore();
const app = createApp(App);
app.provide('store', store);
app.mount('#app');
