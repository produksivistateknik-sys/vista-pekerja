import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { pasangPencatatErrorGlobal } from './lib/laporError'
import AnimasiMasuk from './components/AnimasiMasuk.tsx'
import { perluAnimasiMasuk } from './lib/animasiMasukSesi'

// (16 Okt 2026) pencatat error terpusat -> log_error_app (window error termasuk crash React, unhandledrejection)
pasangPencatatErrorGlobal()

// (14 Nov 2026, logo JRENG Tahap 5) animasi masuk + layar koneksi di ATAS aplikasi, sekali per sesi tab.
const tampilAnimasiMasuk = perluAnimasiMasuk()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    {tampilAnimasiMasuk && <AnimasiMasuk />}
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('Service worker registration failed:', err)
    })
  })
}
