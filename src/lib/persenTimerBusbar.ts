// PERSEN TIMER BUSBAR (6 Nov 2026, panel 524 OUTGOING) - satu jalur menulis snapshot persen TAHAP ke fcs_timer_kerja.progress.
// Dulu hanya tombol Simpan yang menulis, klik persen otomatis tidak, jadi ringkasan hari Rencana Harian tanpa persen.
// Diisi ke sesi TERBARU tiap operator (boleh sudah selesai: operator bisa Simpan setelah Selesai). Bukan pengganti
// checklist.busbarTahap yang tetap sumber progres terkini. Best-effort: tidak pernah melempar, simpanan utama sudah berhasil.
/* eslint-disable @typescript-eslint/no-explicit-any */
export async function catatPersenTimerBusbar(db: any, a: { panelId: number; kode: string; tahap: string; pct: number; ids: number[]; tanggal: string[]; asal: string }): Promise<void> {
  try {
    for (const wid of a.ids) {
      const { data: row, error: selErr } = await db.from('fcs_timer_kerja')
        .select('id').eq('panel_id', a.panelId).eq('kode_komponen', a.kode).eq('tahap', a.tahap)
        .in('tanggal', a.tanggal).eq('pekerja_id', wid)
        .order('mulai', { ascending: false }).limit(1).maybeSingle()
      if (selErr) { console.warn(`[${a.asal}] gagal cari baris fcs_timer_kerja utk progress (non-fatal)`, selErr); continue }
      if (!row) continue
      const { error: updErr } = await db.from('fcs_timer_kerja').update({ progress: a.pct }).eq('id', row.id)
      if (updErr) console.warn(`[${a.asal}] gagal update progress fcs_timer_kerja (non-fatal)`, updErr)
    }
  } catch (err) {
    console.warn(`[${a.asal}] gagal catat progress ke fcs_timer_kerja (non-fatal)`, err)
  }
}
