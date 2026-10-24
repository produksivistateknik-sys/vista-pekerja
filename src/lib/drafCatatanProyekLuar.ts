// DRAF CATATAN PROYEK LUAR (24 Okt 2026, pantau harian - keputusan user). Catatan TERSIMPAN OTOMATIS saat operator berhenti
// mengetik (tanpa tombol "Simpan laporan"). Supaya sinyal lemah di lapangan tidak menghilangkan tulisan:
//  1. tiap ketikan langsung disimpan di HP (localStorage) sebagai draf: {teks, dasar} - `dasar` = catatan server yang menjadi
//     titik awal tulisan ini;
//  2. draf dikirim lewat RPC dgn p_dasar/p_cek_dasar - kalau catatan di server sudah diubah orang lain (admin / HP lain)
//     sesudah `dasar`, server menolak (BENTROK, PT409) dan TIDAK ada yang ditimpa diam-diam;
//  3. gagal karena koneksi -> draf tetap di HP, dikirim ulang saat sinyal kembali / aplikasi dibuka lagi / tombol
//     "Kirim sekarang" (berbasis event, BUKAN poller berkala);
//  4. kirim ulang aman: isi yang sama -> server tidak mengubah apa pun (tidak dobel, log digabung dalam 15 menit).
// Penolakan server lain (proyek sudah Selesai / bukan penulis) -> draf dibuang, operator diberi tahu.
// MULTI-HARI (25 Okt 2026): kunci draf 'e<id>' = ENTRI hari (RPC ubah_catatan_entri_proyek_luar). Kunci angka saja = draf
// versi 24 Okt (laporan proyek_luar) yang mungkin masih tertinggal di HP -> tetap dikirim lewat RPC lama
// ubah_catatan_proyek_luar (trigger cermin menyalinnya ke entri legacy), jadi tidak ada tulisan yang hilang saat update.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from './supabase'
import { klasifikasiErrorSimpan } from './koneksi'
import { bentrokCatatanPL } from './proyekLuarPantau'

const KUNCI_LS = 'vista_pekerja_draf_catatan_pl_v1'
export const EVENT_DRAF_CATATAN_PL = 'draf-catatan-pl'

export type DrafCatatan = { teks: string; dasar: string | null; waktu: string; pekerjaId: number; oleh: string; bentrok?: boolean }
export const kunciEntri = (id: number) => 'e' + id
export const idDariKunci = (k: string) => Number(String(k).replace(/^e/, ''))

export function bacaSemuaDraf(): Record<string, DrafCatatan> {
  try { const v = JSON.parse(localStorage.getItem(KUNCI_LS) || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {} } catch { return {} }
}
function tulisSemua(m: Record<string, DrafCatatan>) {
  try { if (Object.keys(m).length) localStorage.setItem(KUNCI_LS, JSON.stringify(m)); else localStorage.removeItem(KUNCI_LS) }
  catch (e) { console.error('[draf catatan Proyek Luar] gagal menulis localStorage:', e) }
  try { window.dispatchEvent(new Event(EVENT_DRAF_CATATAN_PL)) } catch { /* tanpa window (uji) */ }
}
export const bacaDraf = (kunci: string): DrafCatatan | null => bacaSemuaDraf()[kunci] || null
export function simpanDraf(kunci: string, d: Omit<DrafCatatan, 'waktu'>) { const m = bacaSemuaDraf(); m[kunci] = { ...d, waktu: new Date().toISOString() }; tulisSemua(m) }
export function hapusDraf(kunci: string, hanyaBilaTeks?: string) {
  const m = bacaSemuaDraf(), d = m[kunci]
  if (!d || (hanyaBilaTeks !== undefined && d.teks !== hanyaBilaTeks)) return   // operator sudah mengetik lagi -> draf baru dipertahankan
  delete m[kunci]; tulisSemua(m)
}

// Sama dgn server: nullif(btrim(x), '') - btrim hanya membuang SPASI di awal/akhir.
export const normCatatan = (s: string | null | undefined): string | null => { const t = String(s ?? '').replace(/^ +/, '').replace(/ +$/, ''); return t === '' ? null : t }

export type HasilKirimCatatan =
  | { status: 'ok'; data: any }
  | { status: 'koneksi' | 'bentrok' | 'ditolak'; error: any }
export async function kirimCatatan(kunci: string, d: { teks: string; dasar: string | null; pekerjaId: number; oleh: string }): Promise<HasilKirimCatatan> {
  const entri = String(kunci).startsWith('e'), id = idDariKunci(kunci)
  const umum = { p_catatan: d.teks, p_oleh: d.oleh, p_pekerja_id: d.pekerjaId, p_admin: false, p_dasar: d.dasar, p_cek_dasar: true }
  try {
    const { data, error } = entri
      ? await supabase.rpc('ubah_catatan_entri_proyek_luar' as any, { p_entri_id: id, ...umum } as any)
      : await supabase.rpc('ubah_catatan_proyek_luar' as any, { p_id: id, ...umum } as any)
    if (!error) return { status: 'ok', data }
    if (bentrokCatatanPL(error)) return { status: 'bentrok', error }
    return { status: klasifikasiErrorSimpan(error).jenis === 'koneksi' ? 'koneksi' : 'ditolak', error }
  } catch (e) { return { status: 'koneksi', error: e } }
}

// Kirim semua draf yang tertunda (dipanggil saat sinyal kembali / aplikasi dibuka / layar Proyek Luar dibuka).
// `kecuali` = kunci draf yang kotak catatannya sedang terbuka - kotak itu mengirim sendiri (dasar-nya selalu terbaru).
let sedangKirim = false
export async function kirimSemuaDraf(kecuali?: string | null): Promise<{ terkirim: string[]; bentrok: string[]; ditolak: { kunci: string; error: any }[] }> {
  const hasil = { terkirim: [] as string[], bentrok: [] as string[], ditolak: [] as { kunci: string; error: any }[] }
  if (sedangKirim) return hasil
  sedangKirim = true
  try {
    for (const [k, d] of Object.entries(bacaSemuaDraf())) {
      if (!idDariKunci(k) || d.bentrok || k === kecuali) continue                       // bentrok menunggu keputusan operator
      const r = await kirimCatatan(k, d)
      if (r.status === 'ok') { hapusDraf(k, d.teks); hasil.terkirim.push(k) }
      else if (r.status === 'bentrok') { const m = bacaSemuaDraf(); if (m[k]) { m[k] = { ...m[k], bentrok: true }; tulisSemua(m) } hasil.bentrok.push(k) }
      else if (r.status === 'ditolak') { console.error('[draf catatan Proyek Luar] ditolak server:', k, r.error); hapusDraf(k); hasil.ditolak.push({ kunci: k, error: r.error }) }
      else break                                           // masih tanpa sinyal -> berhenti, coba lagi nanti
    }
  } finally { sedangKirim = false }
  return hasil
}
