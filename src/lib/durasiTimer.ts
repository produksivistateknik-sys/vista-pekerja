// DURASI TIMER (7 Nov 2026, kasus INCOMING BUSBAR panel 524: tombol timer HP langsung "10j 36m" saat baru mulai) - SATU
// aturan cakupan durasi. Dulu tombol = jumlah sesi selesai "milik kartu" (timerMilikKartu: termasuk sesi bertanggal hari kerja
// KEMARIN yang selesai 00.00-06.59 tanggal kalender kartu) + sesi berjalan, sehingga shift malam ikut terhitung lagi.
// Cakupan:
// - menitSesiBerjalan: sesi yang SEDANG berjalan, dihitung dari mulai paling awal (sama dgn pil "berjalan sejak" admin).
// - menitHariKerja: sesi bertanggal hari kerja itu (kolom tanggal) + sesi berjalan bila hari itu = hari kerja sekarang,
//   rentang waktu DIGABUNG (sama dgn chip "hari ini" admin, menitGabungan vista-teknik). Tidak pernah menjumlah antar operator
//   yang bekerja bersamaan.
// timerMilikKartu TETAP dipakai utk syarat "timer pernah dimulai" (insiden BAGAS 584 WM.2) - bukan utk durasi.
// Murni (tanpa import/query) supaya bisa disalin identik ke vista-teknik.
export type SesiTimer = { tanggal?: string | null; mulai?: string | null; selesai?: string | null }

// Mulai paling awal di antara sesi yang masih berjalan; null bila tidak ada.
export function mulaiSesiBerjalan(sesi: SesiTimer[]): string | null {
  let awal: string | null = null
  for (const t of sesi || []) {
    if (t.selesai || !t.mulai || !Number.isFinite(Date.parse(t.mulai))) continue
    if (awal === null || Date.parse(t.mulai) < Date.parse(awal)) awal = t.mulai
  }
  return awal
}

export function menitSesiBerjalan(sesi: SesiTimer[], sekarangMs = Date.now()): number {
  const awal = mulaiSesiBerjalan(sesi)
  return awal ? Math.max(0, (sekarangMs - Date.parse(awal)) / 60000) : 0
}

// Panjang gabungan rentang [mulai, selesai|sekarang] dalam menit.
export function menitRentangGabungan(sesi: SesiTimer[], sekarangMs = Date.now()): number {
  const r = (sesi || []).map((t) => [t.mulai ? Date.parse(t.mulai) : NaN, t.selesai ? Date.parse(t.selesai) : sekarangMs] as [number, number])
    .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && b > a).sort((x, y) => x[0] - y[0])
  let total = 0, ca = 0, cb = 0, ada = false
  for (const [a, b] of r) {
    if (!ada || a > cb) { if (ada) total += cb - ca; ca = a; cb = b; ada = true } else cb = Math.max(cb, b)
  }
  if (ada) total += cb - ca
  return total / 60000
}

export function menitHariKerja(sesi: SesiTimer[], hariKerja: string, hariKerjaSekarang: string, sekarangMs = Date.now()): number {
  return menitRentangGabungan((sesi || []).filter((t) => t.selesai ? t.tanggal === hariKerja : (t.tanggal === hariKerja || hariKerja === hariKerjaSekarang)), sekarangMs)
}
