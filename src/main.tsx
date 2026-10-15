import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { pasangPencatatErrorGlobal } from './lib/laporError'

// (16 Okt 2026) pencatat error terpusat -> log_error_app (window error termasuk crash React, unhandledrejection)
pasangPencatatErrorGlobal()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('Service worker registration failed:', err)
    })
  })
}
