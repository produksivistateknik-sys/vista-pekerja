// PRODUKSI STOK - sisi operator (2 Okt 2026). Duplikat kecil dari pola vista-teknik
// src/services/produksiStokService.ts (repo terpisah, gak ada shared package - sama seperti
// dateHelpers.ts). Angka tersedia/baik per tahap DIBACA dari view v_produksi_stok_tahap (fungsi SQL
// produksi_stok_kondisi) - SATU rumus dgn validasi server, gak dihitung ulang di HP. Simpan progress
// lewat RPC simpan_progress_produksi_stok (increment atomik, baris batch dikunci, validasi qty/foto
// di server). TERPISAH TOTAL dari WO: gak baca/tulis panels/raw_schedule/renhar/fcs_timer_kerja.
// Lihat vista-teknik supabase/migrations/20261002030000_produksi_stok.sql.
import { supabase as supabaseTyped } from './supabase'
const supabase: any = supabaseTyped

async function ambilSemua(build: (from: number, to: number) => any) {
  let semua: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999)
    if (error) throw error
    semua = semua.concat(data || [])
    if (!data || data.length < 1000) break
  }
  return semua
}

export const produksiStokService = {
  async ambilAktif() {
    const batch = await ambilSemua((a, b) => supabase.from('produksi_stok_batch').select('*').eq('status', 'aktif').order('created_at', { ascending: true }).range(a, b))
    const ids = batch.map((x: any) => x.id)
    const tahap = ids.length ? await ambilSemua((a, b) => supabase.from('v_produksi_stok_tahap').select('*').in('batch_id', ids).order('urutan').range(a, b)) : []
    const kids = [...new Set(batch.map((x: any) => x.komponen_id))]
    const komponen = kids.length ? await ambilSemua((a, b) => supabase.from('komponen_stok').select('id,nama,kode,jenis,dimensi').in('id', kids).range(a, b)) : []
    return { batch, tahap, komponen }
  },
  async ambilRiwayatSaya(operatorId: number | null, operatorNama: string) {
    let q = supabase.from('produksi_stok_log').select('*').order('created_at', { ascending: false }).limit(100)
    q = operatorId ? q.eq('operator_id', operatorId) : q.eq('operator_nama', operatorNama)
    const { data: log, error } = await q
    if (error) throw error
    const bids = [...new Set((log || []).map((l: any) => l.batch_id))]
    const batch = bids.length ? await ambilSemua((a, b) => supabase.from('produksi_stok_batch').select('id,komponen_id,target_qty,status').in('id', bids).range(a, b)) : []
    const kids = [...new Set(batch.map((x: any) => x.komponen_id))]
    const komponen = kids.length ? await ambilSemua((a, b) => supabase.from('komponen_stok').select('id,nama,kode').in('id', kids).range(a, b)) : []
    return { log: log || [], batch, komponen }
  },
  // Sesi berjalan (2 Okt 2026, migration 20261002050000): Mulai/Stop ditulis ke produksi_stok_sesi
  // supaya Admin bisa lihat siapa yang sedang mengerjakan (panel + toast di vista-teknik). Jam mulai
  // = jam server. Mulai dobel (tap 2x / HP lain) mengembalikan sesi yang sama, tidak reset.
  async ambilSesiTerbukaSaya(operatorNama: string) {
    return await ambilSemua((a, b) => supabase.from('produksi_stok_sesi').select('*')
      .eq('operator_nama', operatorNama).is('selesai_at', null).order('mulai_at').range(a, b))
  },
  async mulaiSesi(p: { batchId: number; tahap: string; operatorId: number | null; operatorNama: string; subBagian: string | null }) {
    const { data, error } = await supabase.rpc('mulai_sesi_produksi_stok', {
      p_batch_id: p.batchId, p_tahap: p.tahap, p_operator_id: p.operatorId, p_operator_nama: p.operatorNama, p_sub_bagian: p.subBagian,
    })
    if (error) throw error
    return data
  },
  async stopSesi(sesiId: number, oleh: string) {
    const { data, error } = await supabase.rpc('stop_sesi_produksi_stok', { p_sesi_id: sesiId, p_cara: 'stop', p_oleh: oleh })
    if (error) throw error
    return data
  },
  async simpanProgress(p: {
    batchId: number; tahap: string; qty: number; qtyReject: number; fotoUrls: string[]
    operatorId: number | null; operatorNama: string; catatan: string | null; mulaiAt: string | null
  }) {
    const { data, error } = await supabase.rpc('simpan_progress_produksi_stok', {
      p_batch_id: p.batchId, p_tahap: p.tahap, p_qty: p.qty, p_qty_reject: p.qtyReject, p_foto_urls: p.fotoUrls,
      p_operator_id: p.operatorId, p_operator_nama: p.operatorNama, p_catatan: p.catatan, p_mulai_at: p.mulaiAt,
    })
    if (error) throw error
    return data
  },
}
