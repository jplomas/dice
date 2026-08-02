import { createApp } from 'vue';
import App from './App.vue';
import './app.css';
import { startAppUpdateWatcher } from '@/composables/useAppUpdate.js';

// The offline artefact has no origin to check against and no service worker
// to update. It must never open a connection.
if (!__OFFLINE_BUILD__) {
  startAppUpdateWatcher();
}

createApp(App).mount('#app');
