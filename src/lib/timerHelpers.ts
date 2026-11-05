// Label durasi timer kerja - SATU sumber (2 Okt 2026). Dulu rumus ini ditulis ulang inline di 4
// tempat OperatorView (timer WO: toolbar POTONG, tahap BUSBAR, kartu mobile, chip operator
// desktop) - sekarang semua + timer sesi Produksi Stok (ProduksiStokView) pakai fungsi ini, jadi
// tampilannya identik. Rumus SAMA PERSIS dgn versi inline lama (dipindah, bukan diubah):
// < 1 menit -> "42d", < 1 jam -> "13m 42d" (6 Nov 2026, detik terus jalan seperti Proses Aktif), selebihnya -> "1j 13m".
// Catatan: KomponenPasangView punya varian sendiri (pembulatan menit beda) - sengaja belum
// disatukan di sini supaya keluarannya gak berubah.
export function labelDurasiTimer(totalMenit: number): string {
  const total = Math.max(0, Math.floor(totalMenit * 60))
  const jam = Math.floor(total / 3600), menit = Math.floor((total % 3600) / 60), detik = total % 60
  return jam > 0 ? `${jam}j ${menit}m` : menit > 0 ? `${menit}m ${detik}d` : `${detik}d`
}
