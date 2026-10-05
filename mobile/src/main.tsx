import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { sanitizeLocalStorage } from './lib/cache.ts'
import { initOta } from './lib/ota.ts'
// Run automatic storage sanitization on app boot to purge corrupted entries
sanitizeLocalStorage();
// Check for OTA bundle updates in the background
initOta();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
