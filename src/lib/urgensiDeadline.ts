import { daysUntil } from "./dateHelpers";

// ─────────────────────────────────────────────────────────────────────────────
// TANDA MENDESAK BERDASARKAN DEADLINE (29 Sep 2026) - SATU sumber logika buat kartu grid PANEL
// ("+ Pilih Komponen") & grid KOMPONEN ("+ Pilih Panel") di OperatorView. Murni dari tanggal
// Target WO (work_orders.target) - TIDAK terkait & TIDAK mengubah field Prioritas (Tinggi/Sedang/
// Rendah). Dihitung di client, tanpa perubahan skema.
//
// Selisih hari pakai daysUntil() (dateHelpers) - bandingin TANGGAL KALENDER lokal (hari ini vs
// Target). SENGAJA bukan rumus getUrgensi()/getUrgensiPanel() lama (Target UTC-midnight vs jam
// SEKARANG) - rumus itu meleset 1 hari antara 00:00-07:00 WIB di hari Target (keluar "H-1"
// padahal "HARI INI"). Dua fungsi lama itu dibiarin apa adanya (dipakai sorting/label lain).
// ─────────────────────────────────────────────────────────────────────────────

// Ambang "mendesak": Target dalam N hari ke depan (plus hari ini & sudah lewat). Ubah di sini saja.
export const MENDESAK_THRESHOLD_DAYS = 3;

// Warna SAMA PERSIS tema banner "Status Deadline WO" (WoUrgentBanner.tsx): merah = Terlambat,
// amber = Mendesak - biar tanda di kartu konsisten sama banner yang sudah dikenal operator.
const WARNA_TERLAMBAT = { warna: "#dc2626", bg: "#fef2f2", border: "#fecaca" };
const WARNA_MENDESAK = { warna: "#d97706", bg: "#fffbeb", border: "#fde68a" };

export type UrgensiDeadline = {
  level: "terlambat" | "hari_ini" | "mendesak";
  label: string;       // teks badge: TERLAMBAT / HARI INI / H-1..H-N
  judul: string;       // tooltip, wording banner: "Terlambat ..." / "Mendesak ..."
  hari: number;        // selisih hari ke Target (negatif = lewat)
  target: string;
  warna: string; bg: string; border: string;
};

// null = di luar ambang / gak ada Target -> kartu normal, tanpa tanda apapun.
export function getUrgencyBadge(target?: string | null): UrgensiDeadline | null {
  if (!target) return null;
  const hari = daysUntil(target);
  if (!Number.isFinite(hari)) return null;
  if (hari < 0) return { level: "terlambat", label: "TERLAMBAT", judul: `Terlambat ${Math.abs(hari)} hari · Target ${target}`, hari, target, ...WARNA_TERLAMBAT };
  if (hari === 0) return { level: "hari_ini", label: "HARI INI", judul: `Mendesak · Target hari ini (${target})`, hari, target, ...WARNA_TERLAMBAT };
  if (hari <= MENDESAK_THRESHOLD_DAYS) return { level: "mendesak", label: `H-${hari}`, judul: `H-${hari} Mendesak · Target ${target}`, hari, target, ...WARNA_MENDESAK };
  return null;
}

// Target TERDEKAT di antara banyak panel (kartu komponen = gabungan beberapa panel). Tanggal
// format YYYY-MM-DD -> urut string = urut tanggal; yang paling awal = paling mendesak.
export function targetTerdekat(targets: (string | null | undefined)[]): string | null {
  const valid = targets.filter((t): t is string => !!t).sort();
  return valid.length > 0 ? valid[0] : null;
}

// Urutan kartu dalam 1 grup tab: kartu mendesak yang MASIH BISA dikerjakan naik ke paling atas
// (Target terdekat duluan). Sisanya - termasuk kartu mendesak tapi Done/Not Yet/terkunci - tetap
// urutan asli (sort stabil lewat index), gak ikut naik.
export function urutkanKartuMendesak<T>(kartu: T[], info: (k: T) => { urgensi: UrgensiDeadline | null; bisaNaik: boolean }): T[] {
  return kartu
    .map((k, i) => {
      const x = info(k);
      return { k, i, naik: !!x.urgensi && x.bisaNaik, hari: x.urgensi?.hari ?? 0 };
    })
    .sort((a, b) => {
      if (a.naik !== b.naik) return a.naik ? -1 : 1;
      if (a.naik && a.hari !== b.hari) return a.hari - b.hari;
      return a.i - b.i;
    })
    .map((x) => x.k);
}
