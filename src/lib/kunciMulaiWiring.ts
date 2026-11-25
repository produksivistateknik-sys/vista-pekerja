// KUNCI MULAI WIRING (25 Nov 2026, Tahap 4.2, keputusan user) - komponen WIRING CONTROL/POWER yang sudah TUNTAS & tersimpan
// tidak bisa dimulai lagi dari HP (insiden 598 FS.4 FIRMAN/AINUL 24 Nov: timer dimulai pada komponen yang sudah 100%).
// - Dicek ke SERVER saat Mulai ditekan (data HP bisa basi) + antrean simpan offline yang belum terkirim (simpan 100% tertunda).
// - Ukuran tuntas = komponenTuntasTersimpan (lib/panelHelpers, sama dgn penyembunyi kartu): qty naik / buka kembali admin
//   (koreksi_progres_admin) otomatis membuka lagi. Operator TIDAK punya jalur "tetap mulai"; admin membuka kembali.
// - Server tidak terjangkau -> ditolak dgn pesan koneksi (mulai timer memang wajib menulis ke server).
// - Proses lain (RENDAM/PAINTING/BUSBAR/PASANG KOMPONEN/POTONG/...) TIDAK diperiksa - perilaku sama persis.
import { supabase } from './supabase'
import { withRetry } from './koneksi'
import { bacaAntrean } from './antreanSimpan'
import { komponenTuntasTersimpan } from './panelHelpers'

export const PROSES_KUNCI_MULAI = ['WIRING CONTROL', 'WIRING POWER']
export const PESAN_KOMPONEN_SELESAI = 'Komponen sudah selesai. Hubungi admin bila perlu dibuka kembali.'

export type HasilCekMulai = 'boleh' | 'tuntas' | 'gagal'

// Satu pemeriksaan per komponen+proses+tanggal dalam 3 dtk: Mulai tim memanggil startTimer per operator (forEach paralel).
const cache = new Map<string, { t: number; p: Promise<HasilCekMulai> }>()

async function periksa(panelId: number, kode: string, proses: string, tanggal: string): Promise<HasilCekMulai> {
  try {
    const { data, error } = await withRetry(() => supabase.from('panels').select('checklist').eq('id', panelId).single())
    if (error) { console.error(`[kunciMulaiWiring] cek status ${proses} ${kode} panel ${panelId} gagal:`, error); return 'gagal' }
    const cl = (data as { checklist?: Record<string, unknown> } | null)?.checklist?.[kode]
    return komponenTuntasTersimpan(cl, proses, tanggal) ? 'tuntas' : 'boleh'
  } catch (e) {
    console.error(`[kunciMulaiWiring] cek status ${proses} ${kode} panel ${panelId} gagal (retry habis):`, e)
    return 'gagal'
  }
}

export async function cekMulaiWiring(panelId: number, kode: string, proses: string, tanggal: string): Promise<HasilCekMulai> {
  if (!PROSES_KUNCI_MULAI.includes(proses)) return 'boleh'
  // simpan 100% yang masih tertunda di HP ini (offline) -> sudah selesai walau server belum tahu
  if (bacaAntrean().some(x => Number(x.panelId) === Number(panelId) && x.kode === kode && x.proses === proses && Number(x.pct) >= 100)) return 'tuntas'
  const k = `${panelId}|${kode}|${proses}|${tanggal}`
  const ada = cache.get(k)
  if (ada && Date.now() - ada.t < 3000) return ada.p
  const p = periksa(panelId, kode, proses, tanggal)
  cache.set(k, { t: Date.now(), p })
  // hasil 'gagal' (koneksi) TIDAK disimpan: tekan Mulai lagi = periksa ulang (tinjauan bug-detector M2)
  p.then(h => { if (h === 'gagal' && cache.get(k)?.p === p) cache.delete(k) })
  return p
}

// Pesan paling banyak sekali per panel+komponen per 5 dtk (Mulai tim/massal memanggil berulang).
const terakhirPesan = new Map<string, number>()
export function pesanMulaiDitolak(panelId: number, kode: string, proses: string, hasil: HasilCekMulai) {
  const k = `${panelId}|${kode}|${proses}|${hasil}`
  if (Date.now() - (terakhirPesan.get(k) || 0) < 5000) return
  terakhirPesan.set(k, Date.now())
  try {
    window.alert(hasil === 'tuntas'
      ? `${proses} ${kode}\n${PESAN_KOMPONEN_SELESAI}`
      : `Tidak bisa memeriksa status ${proses} ${kode} karena koneksi bermasalah. Timer belum dimulai - coba tekan Mulai lagi.`)
  } catch { /* tanpa window */ }
  terakhirPesan.set(k, Date.now())
}
