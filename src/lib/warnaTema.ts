// WARNA TEMA OPERATOR (6 Nov 2026) - satu sumber warna dasar, nilainya dari Beranda (BerandaOperator.tsx). Nilai SENGAJA hex, bukan
// var(--...): kode memakai pola warna+"18" utk transparansi (Primitives Badge, tombol terpilih) yang rusak bila nilainya CSS var.
// Yang di sini: aksi utama, pilihan terpilih, aksen, tautan. Warna divisi (DIVISI_CONFIG) hanya utk ikon/identitas. Warna status,
// ubin menu, proses, jenis panel, WP, pil kerusakan, dan pColor punya sumber sendiri dan TIDAK digantikan token ini.
// Tema gelap belum ada: bila dibuat, tambahkan pasangan WARNA_GELAP dengan kunci yang sama lalu pilih di varTema.
export const WARNA = {
  aksen: '#1f6fe5',       // tombol utama, garis pilihan terpilih (putih di atasnya 4,70)
  aksenGelap: '#1b5fd2',  // akhir gradasi, hover
  aksenAwal: '#3a8df0',   // awal gradasi header (putih di atasnya 3,36: hanya teks besar)
  aksenTeks: '#1b57c0',   // teks biru di atas latar abu/lembut (#1f6fe5 di latar abu hanya 4,37)
  aksenLembut: '#dbeafe', // latar chip
  tinta: '#12306b',
  redup: '#5a6a89',
  garis: '#e3eaf6',
  latar: '#f1f5f9',
  bahaya: '#dc2626',      // sama dgn status terlambat
} as const

export const GRADASI_AKSEN = `linear-gradient(135deg,${WARNA.aksen},${WARNA.aksenGelap})`
export const FOKUS_AKSEN = 'rgba(31,111,229,.12)'

const kebab = (s: string) => s.replace(/[A-Z]/g, h => '-' + h.toLowerCase())
// Variabel CSS utk teks gaya di dalam <style>, dipasang di globalCss.
export const varTema = `:root{${Object.entries(WARNA).map(([k, v]) => `--vt-${kebab(k)}:${v}`).join(';')}}`
