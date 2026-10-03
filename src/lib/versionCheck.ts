import { useEffect, useState } from "react"

// Deteksi versi baru sudah ter-deploy tapi tab ini masih jalanin JS lama di memori (SPA gak
// pernah hot-swap kode yang lagi jalan) - diduplikasi kecil dari vista-teknik (repo terpisah,
// gak bisa share modul, pola yang sama dipakai file lintas-repo lain di project ini) - lihat
// komentar lengkap & insiden nyata (14 Agu 2026, tab gak reload ~40 jam) di
// vista-teknik/src/lib/versionCheck.ts. `__BUILD_ID__` di-inject sekali pas build
// (vite.config.ts), dibandingkan berkala ke /version.json (file statis, BUKAN lewat bundle JS,
// jadi selalu kebaca versi live server).
//
// App.tsx (operator) DIPAKAI SEPANJANG SHIFT di device yang wajar dibiarkan terbuka lama
// (tablet/HP lantai produksi) - jauh lebih rawan basi drpd app admin yang login ulang tiap
// sesi, jadi perlindungan ini lebih penting di sini drpd kelihatannya.
declare const __BUILD_ID__: string

const CHECK_INTERVAL_MS = 10 * 60 * 1000 // 10 menit - cukup sering buat nemuin versi baru tanpa bebani server

// FIX LOOP (3 Okt 2026, laporan operator: banner versi baru muncul lagi terus tiap Muat Ulang).
// Service worker network-first jatuh ke index.html LAMA dari cache kalau ambil index dari jaringan
// gagal (sinyal putus-nyambung) -> JS lama jalan -> version.json (baru) beda -> banner lagi.
// muatUlangBersih: hapus SEMUA cache aplikasi + minta SW update, baru buka ulang dgn penanda
// unik. SW SENGAJA tidak di-unregister (itu memutus langganan push notification operator).
const KUNCI_RELOAD = 'vista_pekerja_reload_bersih_at'
export async function muatUlangBersih() {
  try { sessionStorage.setItem(KUNCI_RELOAD, String(Date.now())) } catch { /* private mode */ }
  try { if ('caches' in window) { const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))) } } catch (e) { console.error('[muatUlangBersih] hapus cache gagal:', e) }
  try { if ('serviceWorker' in navigator) { const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(r => r.update().catch(() => {}))) } } catch { /* abaikan */ }
  const u = new URL(window.location.href); u.searchParams.set('_v', String(Date.now()))
  window.location.replace(u.toString())
}
// Pengaman loop: kalau versi MASIH beda dalam 3 menit setelah muatUlangBersih, banner tidak
// ditampilkan lagi di sesi ini (operator tetap bisa kerja; dicek ulang di sesi berikutnya).
const baruSajaMuatUlangBersih = () => { try { const t = Number(sessionStorage.getItem(KUNCI_RELOAD) || 0); return t > 0 && Date.now() - t < 3 * 60 * 1000 } catch { return false } }

export function useVersionCheck(): boolean {
  const [hasUpdate, setHasUpdate] = useState(false)

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        const res = await fetch("/version.json", { cache: "no-store" })
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && data?.buildId && data.buildId !== __BUILD_ID__) {
          if (baruSajaMuatUlangBersih()) { console.warn('[versionCheck] versi masih beda setelah muat ulang bersih - banner ditahan sesi ini', data.buildId, __BUILD_ID__); return }
          setHasUpdate(true)
        }
      } catch {
        // Gagal cek (offline/network error) - diamkan, coba lagi interval berikutnya.
      }
    }
    check()
    const iv = setInterval(check, CHECK_INTERVAL_MS)
    // Cek juga begitu tab balik aktif (kemungkinan besar user habis idle lama - momen paling
    // relevan buat ketauan tab-nya basi, gak perlu nunggu interval berikutnya).
    const onVisible = () => { if (document.visibilityState === "visible") check() }
    document.addEventListener("visibilitychange", onVisible)
    return () => { cancelled = true; clearInterval(iv); document.removeEventListener("visibilitychange", onVisible) }
  }, [])

  return hasUpdate
}
