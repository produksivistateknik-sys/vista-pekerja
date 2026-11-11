// SHIFT LOGIN DISIMPAN KE TIMER (12 Nov 2026, tahap D, keputusan user) - SATU sumber utk semua insert fcs_timer_kerja
// (OperatorView.startTimer, KomponenPasangView). Shift = pilihan operator di gerbang "Pilih shift kerja Anda hari ini";
// admin (vista-teknik lib/shiftSesi langkah 1) membacanya sehingga Aktivitas Panel tidak perlu menebak. Tanpa aturan jam.
// Aman terhadap urutan rilis: bila kolom shift BELUM ada di server (SQL tahap D belum dijalankan / cache skema PostgREST
// belum dimuat ulang) insert diulang SEKALI tanpa shift - mulai timer tidak pernah gagal karena kolom ini. Versi lama
// aplikasi yang insert tanpa shift tetap jalan (kolom nullable tanpa default).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react'
import { hariKerjaWib } from './tanggalWib'

// TANGGAL SESI SHIFT (12 Nov 2026, keputusan user opsi A): localStorage sesi {tanggal, shift, shiftSet} memakai HARI
// KERJA WIB (00.00-06.59 = hari sebelumnya) - aturan yang SAMA dgn pembanding bacaShiftSesi. Ditetapkan saat operator
// memilih shift; TIDAK distempel ulang otomatis saat hari berganti (dulu efek OperatorView menulis ulang tanggal baru
// + shift lama -> shift kemarin ikut tersimpan di timer hari ini).
export const tanggalSesiKerja = (): string => hariKerjaWib()

// "11 Nov" dari "YYYY-MM-DD" (label hari kerja di gerbang/banner/chip - keputusan user 12 Nov butir 3).
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
export const labelHariKerja = (tgl: string): string => {
  const [, m, d] = (tgl || '').split('-').map(Number)
  return m && d ? `${d} ${BULAN[m - 1]}` : tgl
}

// Simpan pilihan shift sesi (gerbang awal App, setup OperatorView, banner pilih ulang) + kabari App & Tugas Saya di tab
// yang sama (event "storage" bawaan hanya untuk tab lain).
export const EVENT_SESI_SHIFT = 'vp-sesi-shift'
export function simpanSesiShift(wsKey: string, shift: string) {
  try { localStorage.setItem(wsKey, JSON.stringify({ tanggal: tanggalSesiKerja(), shift, shiftSet: true })) } catch { /* mode privat: tetap jalan */ }
  try { window.dispatchEvent(new Event(EVENT_SESI_SHIFT)) } catch { /* lingkungan tanpa window */ }
}

// PERLU PILIH ULANG (keputusan user 12 Nov butir 1-2): sesi PERNAH memilih shift tapi hari kerjanya sudah berganti
// (aplikasi dibiarkan terbuka melewati 07.00). Yang ditahan HANYA pembuatan timer baru (banner di atas konten, bukan
// gerbang layar penuh) - timer berjalan & Simpan Progress tidak tertahan, konten tidak di-unmount.
// localStorage tidak terbaca / belum pernah memilih -> false (tidak menahan; gerbang awal yang menangani).
export function perluPilihUlangShift(wsKey: string, hariKerja: string = tanggalSesiKerja()): boolean {
  if (!wsKey) return false
  try {
    const saved = JSON.parse(localStorage.getItem(wsKey) || '{}')
    return saved?.shiftSet === true && !!saved?.tanggal && saved.tanggal !== hariKerja
  } catch { return false }
}

// Dicek ulang tiap menit, saat aplikasi kembali ke layar/fokus, dan saat pilihan shift berubah (tab ini / tab lain).
export function usePerluPilihShift(wsKey: string, aktif: boolean): boolean {
  const [perlu, setPerlu] = useState(() => perluPilihUlangShift(wsKey))
  useEffect(() => {
    if (!aktif) return
    const cek = () => setPerlu(perluPilihUlangShift(wsKey))
    cek()
    const id = setInterval(cek, 60000)
    const saatTampil = () => { if (document.visibilityState === 'visible') cek() }
    document.addEventListener('visibilitychange', saatTampil)
    window.addEventListener('focus', cek)
    window.addEventListener('storage', cek)
    window.addEventListener(EVENT_SESI_SHIFT, cek)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', saatTampil)
      window.removeEventListener('focus', cek)
      window.removeEventListener('storage', cek)
      window.removeEventListener(EVENT_SESI_SHIFT, cek)
    }
  }, [wsKey, aktif])
  return aktif && perlu
}

export const PESAN_PILIH_ULANG = 'Hari kerja baru dimulai (07.00). Pilih shift untuk hari ini.'

// Penahan mulai timer baru: true = DITAHAN (peringatan muncul paling banyak sekali per 5 dtk - startTimer dipanggil
// berulang dalam loop tim/bulk).
let terakhirPeringatan = 0
export function tahanTimerBaru(wsKey: string): boolean {
  if (!perluPilihUlangShift(wsKey)) return false
  const kini = Date.now()
  if (kini - terakhirPeringatan > 5000) {
    terakhirPeringatan = kini
    try { window.alert(`${PESAN_PILIH_ULANG} Pilih shift di bagian atas layar, lalu mulai timer lagi.`) } catch { /* tanpa window */ }
  }
  return true
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
