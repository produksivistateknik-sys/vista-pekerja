// SHIFT LOGIN DISIMPAN KE TIMER (12 Nov 2026, tahap D, keputusan user) - SATU sumber utk semua insert fcs_timer_kerja
// (OperatorView.startTimer, KomponenPasangView). Shift = pilihan operator di gerbang "Pilih shift kerja Anda hari ini";
// admin (vista-teknik lib/shiftSesi langkah 1) membacanya sehingga Aktivitas Panel tidak perlu menebak. Tanpa aturan jam.
// Aman terhadap urutan rilis: bila kolom shift BELUM ada di server (SQL tahap D belum dijalankan / cache skema PostgREST
// belum dimuat ulang) insert diulang SEKALI tanpa shift - mulai timer tidak pernah gagal karena kolom ini. Versi lama
// aplikasi yang insert tanpa shift tetap jalan (kolom nullable tanpa default).
/* eslint-disable @typescript-eslint/no-explicit-any */

export type ShiftSesi = '1' | '2'

// Hanya '1'/'2' yang dikirim; selain itu (belum pilih shift / divisi tanpa gerbang shift) -> tidak dikirim (NULL di DB).
export const shiftSah = (s: any): ShiftSesi | null => (s === '1' || s === 1 ? '1' : s === '2' || s === 2 ? '2' : null)

// Galat "kolom shift tidak dikenal" (PostgREST PGRST204 schema cache / Postgres 42703 undefined_column).
export function galatKolomShift(error: any): boolean {
  if (!error) return false
  const teks = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`.toLowerCase()
  return (error.code === 'PGRST204' || error.code === '42703') && teks.includes('shift')
}

// Insert satu baris timer (+ .select().single()) dgn shift bila sah; jatuh balik tanpa shift bila kolom belum ada.
export async function insertTimerKerja(supabase: any, baris: Record<string, any>, shift: any): Promise<{ data: any; error: any }> {
  const s = shiftSah(shift)
  if (!s) return await supabase.from('fcs_timer_kerja').insert(baris).select().single()
  const hasil = await supabase.from('fcs_timer_kerja').insert({ ...baris, shift: s }).select().single()
  if (hasil.error && galatKolomShift(hasil.error)) {
    console.warn('[timer] kolom shift belum ada di server - timer dimulai tanpa shift:', hasil.error.message)
    return await supabase.from('fcs_timer_kerja').insert(baris).select().single()
  }
  return hasil
}
