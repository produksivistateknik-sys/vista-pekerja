// Label durasi timer kerja - SATU sumber (2 Okt 2026). Dulu rumus ini ditulis ulang inline di 4
// tempat OperatorView (timer WO: toolbar POTONG, tahap BUSBAR, kartu mobile, chip operator
// desktop) - sekarang semua + timer sesi Produksi Stok (ProduksiStokView) pakai fungsi ini, jadi
// tampilannya identik. Rumus SAMA PERSIS dgn versi inline lama (dipindah, bukan diubah):
// < 1 menit -> "42d", < 1 jam -> "13m", selebihnya -> "1j 13m".
// Catatan: KomponenPasangView punya varian sendiri (pembulatan menit beda) - sengaja belum
// disatukan di sini supaya keluarannya gak berubah.
export function labelDurasiTimer(totalMenit: number): string {
  const jam = Math.floor(totalMenit / 60)
  const menit = Math.round(totalMenit % 60)
  const detik = Math.max(0, Math.round(totalMenit * 60))
  return jam > 0 ? `${jam}j ${menit}m` : totalMenit >= 1 ? `${menit}m` : `${detik}d`
}
