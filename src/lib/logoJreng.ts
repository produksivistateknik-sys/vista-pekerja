// LOGO JRENG (14 Nov 2026, keputusan user) - satu sumber path & teks alt logo JRENG lengkap di tampilan aplikasi operator.
// Berkas terpisah di public/brand/ (bukan data URI di bundle), identik dgn vista-teknik (dibuat di sana oleh
// scripts/brand/buat_aset_jreng.py). TIDAK untuk cetak: kop surat tetap logo Vista lama (kopSuratAsetUrl.ts).
export const LOGO_JRENG_HEADER = '/brand/logo-header-v2.png' // 123x124, transparan
export const ALT_LOGO_JRENG = 'JRENG by PT. Vista Inti Teknik'

// LOGO VISTA TEKNIK AWAL di halaman LOGIN saja (18 Nov 2026, keputusan user) - gambar sama dgn VISTA_LOGO_DATA_URI
// (logoAsset.ts), identik dgn vista-teknik public/brand/vista-teknik-awal-v1.png (2x, 128 warna). Berkas statis bernama
// ber-versi (bukan data URI 95 KB di bundle). Tampilan setelah masuk tetap JRENG.
export const LOGO_VISTA_AWAL = '/brand/vista-teknik-awal-v1.png' // 453x176, transparan, oranye
export const ALT_LOGO_VISTA_AWAL = 'Vista Teknik'
