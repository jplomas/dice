import { createApp } from 'vue';
import App from './App.vue';
import './app.css';
import { startAppUpdateWatcher } from '@/composables/useAppUpdate.js';

startAppUpdateWatcher();
createApp(App).mount('#app');
