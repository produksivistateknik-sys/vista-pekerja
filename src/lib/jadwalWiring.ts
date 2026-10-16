// Bersihkan komponen WIRING CONTROL/POWER yang sudah 100% dari raw_schedule HARI INI & ke depan (16 Okt 2026: dipindah
// APA ADANYA dari OperatorView.lockSingleKomponen supaya bisa dipakai juga oleh antrean simpan (lib/antreanSimpan.ts) saat
// Kunci Progress yang tertunda akhirnya terkirim). Best-effort: tidak melempar.
// BUG FIX (5 Agu 2026): dua masalah dalam 1 root cause yang sama -
// (a) tanggal yang SUDAH LEWAT dulu ikut dibersihkan juga, padahal proses lain gak pernah
//     nge-prune riwayat lamanya sama sekali - itu sebabnya Rencana Harian kehilangan jejak
//     WIRING yang udah selesai. Sekarang tanggal < TODAY dibiarkan utuh, gak disentuh.
// (b) token __wiring_{n}org_{bobot} (badge bobot, nempel di array komponen yang sama
//     dengan kode asli) gak ikut dihapus begitu SEMUA kode asli di entry itu udah selesai -
//     entry jadi "isinya cuma token doang", gak pernah kehitung kosong (length>0), jadi
//     nyangkut selamanya di raw_schedule dan bikin baris Raw Schedule kelihatan kosong pas
//     dirender (token gak bisa di-resolve ke nama/qty komponen asli). Sekarang token ikut
//     dibersihkan begitu gak ada lagi kode asli yang nemenin di entry itu.
import { supabase } from './supabase'
import { withRetry } from './koneksi'

export async function bersihkanJadwalWiringSelesai(panelId: number, proses: string, kode: string, today: string): Promise<void> {
  try {
    const { data: rawRows } = await withRetry(() => supabase.from('raw_schedule').select('id,schedule').eq('panel_id', panelId).eq('proses', proses))
    for (const row of (rawRows as any[]) || []) {
      let berubah = false
      const newSchedule: any = {}
      for (const [tglKey, entries] of Object.entries(row.schedule || {}) as [string, any[]][]) {
        if (tglKey < today) { newSchedule[tglKey] = entries; continue }
        const newEntries = entries.map((entry: any) => {
          const filteredKomp = (entry.komponen || []).filter((k: string) => k !== kode)
          const sisaKodeAsli = filteredKomp.filter((k: string) => !k.startsWith('__wiring_'))
          const finalKomp = sisaKodeAsli.length > 0 ? filteredKomp : sisaKodeAsli
          if (finalKomp.length !== (entry.komponen || []).length) berubah = true
          return { ...entry, komponen: finalKomp }
        }).filter((entry: any) => (entry.komponen || []).length > 0)
        if (newEntries.length > 0) newSchedule[tglKey] = newEntries
      }
      if (berubah) {
        await withRetry(() => supabase.from('raw_schedule').update({ schedule: newSchedule }).eq('id', row.id))
      }
    }
  } catch { /* best-effort, progress utama sudah aman */ }
}
