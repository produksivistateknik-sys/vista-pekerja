import { useEffect, useState } from "react";
import { getLocalDateStr, TODAY } from "./dateHelpers";

const DATE_CHECK_INTERVAL_MS = 60 * 1000; // 1 menit - murah (cuma Date lokal, gak ada network), aman dicek sering

// Deteksi tanggal sudah berganti (BUG FIX 5 Sep 2026) - TODAY (dateHelpers.ts) dihitung SEKALI
// pas modul JS dimuat, gak pernah di-refresh sendiri. Tablet/HP operator yang dibiarkan terbuka
// lewat tengah malam (device kios pabrik, jarang di-refresh) bisa "nyangkut" di tanggal kemarin -
// checkpoint riwayat progress (NameplateView/KomponenProgressView/KomponenPasangView) kesimpan
// salah tanggal, cache localStorage per-hari (OperatorView) gak ke-invalidate. SENGAJA cuma
// DETEKSI + banner (bukan auto-reload diam-diam) - reload paksa bisa motong input yang lagi
// diisi operator, keputusan reload ada di tangan operator sendiri.
export function useDateRollover(): boolean {
  const [rolled, setRolled] = useState(false);
  useEffect(() => {
    const check = () => { if (getLocalDateStr() !== TODAY) setRolled(true); };
    check();
    const iv = setInterval(check, DATE_CHECK_INTERVAL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onVisible); };
  }, []);
  return rolled;
}
