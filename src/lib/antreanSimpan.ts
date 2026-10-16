// ANTREAN SIMPAN LOKAL (16 Okt 2026, investigasi gagal simpan SISWOYO 16 Okt 10.43, disetujui user)
// Ketik qty / Kunci Progress yang gagal KARENA KONEKSI dulu cuma tinggal di memori halaman: aplikasi ditutup / HP mati
// sebelum terkirim = progres hilang. Sekarang perubahan itu disimpan di localStorage HP dan dikirim ulang otomatis
// (saat sinyal kembali, tiap 20 detik selama antrean ada isinya, dan saat aplikasi dibuka).
// Aturan pengiriman ulang (per komponen+proses):
//  1. baca checklist TERBARU dari server;
//  2. BENTROK kalau ada kolom yang mau diubah ternyata nilainya di server sudah BUKAN nilai lama & BUKAN nilai baru
//     (diubah orang/HP lain sesudahnya) -> TIDAK ditimpa, item dibuang & operator diberi tahu;
//  3. kirim patch yang sama persis dgn simpan normal (mergePanelChecklistDalam lama->baru), lalu catatan simpanan
//     (catatCheckpoint, kunci_simpan sama -> tidak dobel walau terkirim ulang), CCP (upsert), dan langkah lanjutan
//     simpan normal: tutup timer kalau 100%, bersihkan jadwal WIRING kalau 100%.
// Penolakan server (ada kode error) TIDAK masuk antrean - itu bukan masalah sinyal (perilaku lama tetap).
import { supabase } from './supabase'
import { withRetry, klasifikasiErrorSimpan } from './koneksi'
import { buatPatchKomponen, mergePanelChecklistDalam } from './checklistHelpers'
import { catatCheckpoint } from './catatCheckpoint'
import { upsertComponentProcessProgress } from './componentProcessProgress'
import { tutupTimerKomponenSelesai } from './tutupTimerKomponen'
import { bersihkanJadwalWiringSelesai } from './jadwalWiring'
import { getLocalDateStr } from './dateHelpers'

const KUNCI_LS = 'vista_pekerja_antrean_simpan_v1'
export const JEDA_KIRIM_ULANG_MS = 20000

export type ItemAntrean = {
  id: string
  dibuat: string
  operator: string
  jenis: 'Ketik qty' | 'Kunci Progress'
  panelId: number
  panelNama?: string
  kode: string
  proses: string
  lama: any               // entri checklist komponen SEBELUM diubah (dasar patch & cek bentrok)
  baru: any               // entri checklist komponen SESUDAH diubah
  checkpoint: Record<string, any>[]   // baris progress_checkpoint_log (kunci_simpan sudah terisi)
  ccp: any | null         // argumen upsertComponentProcessProgress
  pct: number
  tutupTimer: boolean     // pct >= 100 -> tutup timer komponen (semua operator)
  bersihkanWiring: boolean
}

const kunciItem = (i: { panelId: number; kode: string; proses: string }) => `${i.panelId}|${i.kode}|${i.proses}`
const buatKunci = () => { try { return crypto.randomUUID() } catch { return 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 14) } }

// ── penyimpanan + pemberitahuan perubahan (untuk banner) ──
let pendengar: ((n: number) => void)[] = []
export function bacaAntrean(): ItemAntrean[] {
  try { const v = JSON.parse(localStorage.getItem(KUNCI_LS) || '[]'); return Array.isArray(v) ? v : [] } catch { return [] }
}
function tulisAntrean(items: ItemAntrean[]) {
  try { if (items.length) localStorage.setItem(KUNCI_LS, JSON.stringify(items)); else localStorage.removeItem(KUNCI_LS) } catch (e) { console.error('[antreanSimpan] gagal menulis localStorage:', e) }
  pendengar.forEach(fn => fn(items.length))
}
export function dengarJumlahAntrean(fn: (n: number) => void): () => void {
  pendengar.push(fn); fn(bacaAntrean().length)
  return () => { pendengar = pendengar.filter(f => f !== fn) }
}

// Gagal karena koneksi? (penolakan server -> false, jangan diantrekan)
export const gagalKarenaKoneksi = (err: any) => klasifikasiErrorSimpan(err).jenis === 'koneksi'

// Tambah ke antrean. Komponen+proses yang sama digabung: "lama" tetap yang PERTAMA (nilai server terakhir yang diketahui),
// "baru" diganti yang terakhir, catatan simpanan dikumpulkan, CCP/langkah lanjutan ikut yang terakhir.
export function tambahAntrean(item: Omit<ItemAntrean, 'id' | 'dibuat' | 'checkpoint'> & { checkpoint?: Record<string, any>[] }): boolean {
  let cp: Record<string, any>[] = (item.checkpoint || []).map(c => ({ ...c, kunci_simpan: c.kunci_simpan ?? buatKunci() }))
  const items = bacaAntrean()
  const idx = items.findIndex(x => kunciItem(x) === kunciItem(item))
  if (idx >= 0) {
    const ada = items[idx]
    // tekan ulang saat masih offline -> catatan simpanan yang sama (persen+tanggal) tidak ditambah lagi
    const sudah = new Set(ada.checkpoint.map(c => `${Number(c.checkpoint)}|${c.tanggal}`))
    cp = cp.filter(c => !sudah.has(`${Number(c.checkpoint)}|${c.tanggal}`))
    items[idx] = { ...ada, ...item, lama: ada.lama, checkpoint: [...ada.checkpoint, ...cp],
      tutupTimer: ada.tutupTimer || item.tutupTimer, bersihkanWiring: ada.bersihkanWiring || item.bersihkanWiring, dibuat: ada.dibuat, id: ada.id }
  } else {
    items.push({ ...item, checkpoint: cp, id: buatKunci(), dibuat: new Date().toISOString() })
  }
  tulisAntrean(items)
  return true
}

// Nilai sekarang di server cocok dgn nilai lama atau nilai baru untuk SEMUA kolom yang diubah?
export function cekBentrok(lama: any, baru: any, server: any): string[] {
  const patch = buatPatchKomponen(lama, baru)
  const sama = (a: any, b: any) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
  const bentrok: string[] = []
  for (const [f, v] of Object.entries(patch)) {
    const isObj = v !== null && typeof v === 'object' && !Array.isArray(v) &&
      lama?.[f] !== null && typeof lama?.[f] === 'object' && !Array.isArray(lama?.[f])
    if (isObj) {
      for (const k of Object.keys(v as any)) {
        const s = server?.[f]?.[k]
        if (!sama(s, lama?.[f]?.[k]) && !sama(s, baru?.[f]?.[k])) bentrok.push(`${f}.${k}`)
      }
    } else {
      const s = server?.[f]
      if (!sama(s, lama?.[f]) && !sama(s, baru?.[f])) bentrok.push(f)
    }
  }
  return bentrok
}

export type HasilKirim = { terkirim: ItemAntrean[]; bentrok: { item: ItemAntrean; kolom: string[] }[]; masihTertunda: number }

let sedangKirim = false
// Kirim semua item berurutan. Berhenti di kegagalan koneksi pertama (item tetap di antrean, dicoba lagi nanti).
export async function kirimAntrean(): Promise<HasilKirim> {
  const hasil: HasilKirim = { terkirim: [], bentrok: [], masihTertunda: bacaAntrean().length }
  if (sedangKirim || hasil.masihTertunda === 0) return hasil
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return hasil
  sedangKirim = true
  try {
    for (const item of bacaAntrean()) {
      try {
        const { data, error } = await withRetry(() => supabase.from('panels').select('checklist').eq('id', item.panelId).single())
        if (error) {
          if (gagalKarenaKoneksi(error)) break
          // panel tidak ada lagi / ditolak server -> tidak bisa dikirim, buang & laporkan sebagai bentrok
          hapusItem(item.id); hasil.bentrok.push({ item, kolom: ['panel tidak bisa dibaca: ' + (error.message || error.code)] }); continue
        }
        const server = (data as any)?.checklist?.[item.kode]
        const kolom = cekBentrok(item.lama, item.baru, server)
        if (kolom.length) { hapusItem(item.id); hasil.bentrok.push({ item, kolom }); continue }
        const { error: mErr } = await withRetry(() => mergePanelChecklistDalam(item.panelId, { [item.kode]: { lama: item.lama, baru: item.baru } }))
        if (mErr) {
          if (gagalKarenaKoneksi(mErr)) break
          hapusItem(item.id); hasil.bentrok.push({ item, kolom: ['ditolak server: ' + (mErr.message || mErr.code)] }); continue
        }
        // checklist SUDAH tersimpan -> sisanya best-effort (sama seperti simpan normal), item dibuang dari antrean
        hapusItem(item.id); hasil.terkirim.push(item)
        if (item.checkpoint.length) {
          try {
            // catatan simpanan yang SAMA (proses+persen+tanggal) sudah masuk sejak item dibuat (operator sempat simpan langsung)
            // -> jangan dicatat lagi. Pengecekan gagal = tetap kirim (kunci_simpan mencegah dobel dari antrean itu sendiri).
            const { data: sudah, error: sErr } = await supabase.from('progress_checkpoint_log').select('checkpoint,tanggal')
              .eq('panel_id', item.panelId).eq('kode_komponen', item.kode).eq('proses', item.proses).gte('ts', new Date(Date.parse(item.dibuat) - 60000).toISOString())
            if (sErr) console.error('[antreanSimpan] cek catatan simpanan yang sudah ada gagal:', sErr)
            const ada = new Set(((sudah as any[]) || []).map(r => `${Number(r.checkpoint)}|${r.tanggal}`))
            const kirimCp = item.checkpoint.filter(c => !ada.has(`${Number(c.checkpoint)}|${c.tanggal}`))
            if (kirimCp.length) { const { error: cpErr } = await catatCheckpoint(kirimCp); if (cpErr) console.error('[antreanSimpan] insert progress_checkpoint_log gagal:', cpErr) }
          } catch (e) { console.error('[antreanSimpan] insert progress_checkpoint_log gagal (retry habis):', e) }
        }
        if (item.ccp) {
          try { const { error: ccpErr } = await upsertComponentProcessProgress({ ...item.ccp, operatorAt: item.ccp.operatorAt || item.dibuat }); if (ccpErr) console.error('[antreanSimpan] dual-write component_process_progress gagal:', ccpErr) }
          catch (e) { console.error('[antreanSimpan] dual-write component_process_progress gagal (retry habis):', e) }
        }
        if (item.tutupTimer) await tutupTimerKomponenSelesai(item.panelId, item.kode, item.proses, null)
        if (item.bersihkanWiring) await bersihkanJadwalWiringSelesai(item.panelId, item.proses, item.kode, getLocalDateStr())
      } catch (e) {
        if (gagalKarenaKoneksi(e)) break
        console.error('[antreanSimpan] gagal mengirim item (dicoba lagi nanti):', e)
        break
      }
    }
  } finally {
    sedangKirim = false
    hasil.masihTertunda = bacaAntrean().length
  }
  return hasil
}

function hapusItem(id: string) { tulisAntrean(bacaAntrean().filter(x => x.id !== id)) }

// ── pengirim otomatis (dipasang SEKALI di App setelah login) ──
// Hasil tiap pengiriman disiarkan lewat event window 'antrean-simpan-hasil' (OperatorView memuat ulang panel yang terkirim).
export const EVENT_HASIL_ANTREAN = 'antrean-simpan-hasil'
export async function kirimAntreanDanUmumkan(): Promise<HasilKirim> {
  const hasil = await kirimAntrean()
  if (hasil.terkirim.length || hasil.bentrok.length) {
    try { window.dispatchEvent(new CustomEvent(EVENT_HASIL_ANTREAN, { detail: hasil })) } catch { /* abaikan */ }
  }
  if (hasil.bentrok.length) {
    alert('Simpanan tertunda TIDAK dikirim karena datanya sudah berubah di server sejak gagal tersimpan:\n\n' +
      hasil.bentrok.map(b => `- ${b.item.jenis} ${b.item.proses} ${b.item.kode}${b.item.panelNama ? ' (' + b.item.panelNama + ')' : ''}`).join('\n') +
      '\n\nPeriksa angkanya di layar dan isi ulang kalau masih perlu.')
  }
  return hasil
}
let terpasang = false
export function mulaiPengirimOtomatis(): () => void {
  if (terpasang) return () => {}
  terpasang = true
  const coba = () => { if (bacaAntrean().length) kirimAntreanDanUmumkan().catch(e => console.error('[antreanSimpan] kirim gagal:', e)) }
  window.addEventListener('online', coba)
  const iv = setInterval(coba, JEDA_KIRIM_ULANG_MS)
  setTimeout(coba, 1500)
  return () => { window.removeEventListener('online', coba); clearInterval(iv); terpasang = false }
}
