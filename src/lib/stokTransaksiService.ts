// STOK KOMPONEN - sisi operator (2 Okt 2026, form "Gunakan Stok Komponen"). Duplikat kecil dari
// vista-teknik src/services/stokTransaksiService.ts (repo terpisah, gak ada shared package - pola
// sama dgn produksiStokService.ts). SATU-SATUNYA jalan mengubah stok = RPC catat_transaksi_stok
// (sama persis dgn form Admin & Produksi Stok): kunci baris stok, cek stok TERBARU di dalam kunci,
// update + catat transaksi dalam 1 transaksi DB. Keluar > stok saat dieksekusi ditolak server
// ("Stok tidak cukup! Stok tersedia: N") - batas di form cuma kenyamanan, bukan pengaman.
// Lihat vista-teknik supabase/migrations/20261002010000_komponen_stok_transaksi.sql.
import { supabase as supabaseTyped } from './supabase'
const supabase: any = supabaseTyped

export const stokTransaksiService = {
  // Item yang bisa dipakai (stok > 0), urut nama.
  async ambilStokTersedia() {
    let semua: any[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from('komponen_stok').select('id,nama,kode,stok').gt('stok', 0).order('nama').range(from, from + 999)
      if (error) throw error
      semua = semua.concat(data || [])
      if (!data || data.length < 1000) break
    }
    return semua
  },
  // Parameter SAMA PERSIS dgn catatKeluar di vista-teknik (sumber 'manual', referensi = proyek).
  // Error dilempar apa adanya (punya .code) supaya alertGagalSimpan bisa bedakan server vs koneksi.
  async catatKeluar(p: { komponenId: number; jumlah: number; proyek: string; panel: string | null; keterangan: string | null; createdBy: string; tanggal: string }) {
    const { data, error } = await supabase.rpc('catat_transaksi_stok', {
      p_komponen_id: p.komponenId, p_tipe: 'keluar', p_jumlah: p.jumlah, p_sumber: 'manual',
      p_keterangan: p.keterangan, p_referensi: p.proyek, p_created_by: p.createdBy,
      p_tanggal: p.tanggal, p_panel: p.panel,
    })
    if (error) throw error
    return Array.isArray(data) ? data[0] : data
  },
}
