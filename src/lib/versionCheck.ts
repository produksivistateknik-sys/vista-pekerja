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

export function useVersionCheck(): boolean {
  const [hasUpdate, setHasUpdate] = useState(false)

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        const res = await fetch("/version.json", { cache: "no-store" })
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && data?.buildId && data.buildId !== __BUILD_ID__) setHasUpdate(true)
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
