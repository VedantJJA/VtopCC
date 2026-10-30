import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { initStorageEngine, sanitizeLocalStorage } from './lib/cache.ts'
import { initOta } from './lib/ota.ts'

async function bootstrap() {
  try {
    // 1. Initialize Native Two-Tier Storage Engine (loads Preferences into ultra-fast RAM)
    await initStorageEngine();
    // 2. Run automatic storage sanitization on app boot to purge any legacy corrupted entries
    sanitizeLocalStorage();
  } catch (err) {
    console.warn('[Main] Storage engine pre-hydration error:', err);
  }

  // 3. Check for OTA bundle updates and notify native runtime in the background
  initOta().catch((err) => console.warn('[Main] OTA init error:', err));

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}

bootstrap().catch((err) => {
  console.error('[Main] Fatal bootstrap error:', err);
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
});
