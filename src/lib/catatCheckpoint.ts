// CATAT CHECKPOINT (16 Okt 2026, investigasi gagal simpan SISWOYO 16 Okt 10.43) - SATU-SATUNYA jalur insert
// progress_checkpoint_log dari aplikasi operator.
// Masalah lama: insert dibungkus withRetry, dan batas waktu withRetry TIDAK membatalkan permintaan sebelumnya. Di sinyal
// putus-sambung, percobaan 1/2/3 bisa sama-sama sampai ke server -> baris dobel (kasus nyata: 3 baris STEL FS.13 panel 544
// dalam 60 ms). Sekarang tiap baris membawa kunci_simpan (uuid) yang dibuat SEKALI sebelum retry; kolom itu unik di DB, jadi
// percobaan ulang yang bentrok (23505) = baris SUDAH masuk -> dianggap sukses.
// Aman sebelum migration dijalankan: kalau kolom kunci_simpan belum ada, dikirim ulang tanpa kolom itu (perilaku lama).
// Perilaku error ke pemanggil SAMA dgn sebelumnya: mengembalikan {error} dari server, dan melempar kalau retry habis.
import { supabase } from './supabase'
import { withRetry } from './koneksi'

const buatKunci = () => {
  try { return crypto.randomUUID() } catch { return 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 14) }
}
const sebutKunci = (e: any) => /kunci_simpan/.test(String(e?.message || '') + String(e?.details || '') + String(e?.hint || ''))

export async function catatCheckpoint(entri: Record<string, any> | Record<string, any>[]): Promise<{ error: any }> {
  const baris = (Array.isArray(entri) ? entri : [entri]).map(e => ({ ...e, kunci_simpan: e.kunci_simpan ?? buatKunci() }))
  const kirim = (rows: any[]) => withRetry(() => supabase.from('progress_checkpoint_log').insert(rows)) as Promise<{ error: any }>
  let { error } = await kirim(baris)
  if (error && error.code === '23505' && sebutKunci(error)) return { error: null } // percobaan sebelumnya sudah masuk
  if (error && (error.code === 'PGRST204' || error.code === '42703') && sebutKunci(error)) {
    ({ error } = await kirim(baris.map(({ kunci_simpan, ...r }) => r)))
  }
  return { error }
}
