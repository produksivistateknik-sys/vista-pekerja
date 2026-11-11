// SHIFT LOGIN DISIMPAN KE TIMER (12 Nov 2026, tahap D, keputusan user) - SATU sumber utk semua insert fcs_timer_kerja
// (OperatorView.startTimer, KomponenPasangView). Shift = pilihan operator di gerbang "Pilih shift kerja Anda hari ini";
// admin (vista-teknik lib/shiftSesi langkah 1) membacanya sehingga Aktivitas Panel tidak perlu menebak. Tanpa aturan jam.
// Aman terhadap urutan rilis: bila kolom shift BELUM ada di server (SQL tahap D belum dijalankan / cache skema PostgREST
// belum dimuat ulang) insert diulang SEKALI tanpa shift - mulai timer tidak pernah gagal karena kolom ini. Versi lama
// aplikasi yang insert tanpa shift tetap jalan (kolom nullable tanpa default).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect } from 'react'
import { hariKerjaWib } from './tanggalWib'

// TANGGAL SESI SHIFT (12 Nov 2026, keputusan user opsi A): localStorage sesi {tanggal, shift, shiftSet} memakai HARI
// KERJA WIB (00.00-06.59 = hari sebelumnya) - aturan yang SAMA dgn pembanding bacaShiftSesi. Ditetapkan saat operator
// memilih shift; TIDAK distempel ulang otomatis saat hari berganti (dulu efek OperatorView menulis ulang tanggal baru
// + shift lama -> shift kemarin ikut tersimpan di timer hari ini).
export const tanggalSesiKerja = (): string => hariKerjaWib()

// Cek tiap menit: bila hari kerja berganti saat sesi shift aktif -> onGanti (gerbang "Pilih shift" ditampilkan lagi).
export function useGantiHariKerja(aktif: boolean, tanggalSesi: string, onGanti: () => void) {
  useEffect(() => {
    if (!aktif) return
    const cek = () => { if (tanggalSesiKerja() !== tanggalSesi) onGanti() }
    cek()
    const id = setInterval(cek, 60000)
    return () => clearInterval(id)
  }, [aktif, tanggalSesi, onGanti])
}

export type ShiftSesi = '1' | '2'

// Kunci localStorage sesi kerja (gerbang "Pilih shift") - format SAMA dgn App.tsx & OperatorView.tsx (wsKey).
export const kunciSesiKerja = (user: any): string =>
  user ? `vista_pekerja_ws_${user.divisi}_${user.sub_bagian || ''}_${user.id || user.username || user.nama || ''}` : ''

// Shift sesi yang BERLAKU saat ini, dibaca dari localStorage SAAT timer dimulai (tinjauan bug-detector 12 Nov):
// - bukan state React: "Ganti Shift" di Tugas Saya hanya mengubah state OperatorView + localStorage, state App basi;
// - hanya bila sesi sudah memilih shift (shiftSet) DAN tanggal sesi = hari kerja sekarang (aplikasi dibiarkan terbuka
//   sejak kemarin -> shift kemarin TIDAK dikirim). Tidak pasti -> null (admin memakai Simpan Progress / sesi lain).
export function bacaShiftSesi(wsKey: string, hariKerja: string = hariKerjaWib()): ShiftSesi | null {
  if (!wsKey) return null
  try {
    const saved = JSON.parse(localStorage.getItem(wsKey) || '{}')
    return saved?.shiftSet && saved?.tanggal === hariKerja ? shiftSah(saved.shift) : null
  } catch { return null }
}

// Hanya '1'/'2' yang dikirim; selain itu (belum pilih shift / divisi tanpa gerbang shift) -> tidak dikirim (NULL di DB).
export const shiftSah = (s: any): ShiftSesi | null => (s === '1' || s === 1 ? '1' : s === '2' || s === 2 ? '2' : null)

// Galat "kolom shift tidak dikenal" (PostgREST PGRST204 schema cache / Postgres 42703 undefined_column).
export function galatKolomShift(error: any): boolean {
  if (!error) return false
  const teks = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`.toLowerCase()
  return (error.code === 'PGRST204' || error.code === '42703') && teks.includes('shift')
}

// Sekali server menjawab "kolom shift tidak ada", sisa sesi aplikasi langsung insert tanpa shift (hemat 1 round-trip
// di dalam withTimeout). Direset saat aplikasi dimuat ulang (setelah SQL tahap D dijalankan).
let kolomShiftTidakAda = false

// Insert satu baris timer (+ .select().single()) dgn shift bila sah; jatuh balik tanpa shift bila kolom belum ada.
export async function insertTimerKerja(supabase: any, baris: Record<string, any>, shift: any): Promise<{ data: any; error: any }> {
  const s = kolomShiftTidakAda ? null : shiftSah(shift)
  if (!s) return await supabase.from('fcs_timer_kerja').insert(baris).select().single()
  const hasil = await supabase.from('fcs_timer_kerja').insert({ ...baris, shift: s }).select().single()
  if (hasil.error && galatKolomShift(hasil.error)) {
    kolomShiftTidakAda = true
    console.warn('[timer] kolom shift belum ada di server - timer dimulai tanpa shift:', hasil.error.message)
    return await supabase.from('fcs_timer_kerja').insert(baris).select().single()
  }
  return hasil
}
