// INVENTARIS & MAINTENANCE - DATA & AKSI OPERATOR HP (T3, 30 Okt 2026). Pasangan tab admin vista-teknik
// (InventarisMaintenanceTab + lib/inventaris.ts). Aturan & tampilan bersama: lib/inventarisAturan.ts (identik 2 repo).
// Operator hanya melihat barang di lokasi yang tampil untuk divisinya (inv_lokasi.tampil_operator + divisi_operator) -
// server menolak aksi di luar itu juga (RPC inv_*, p_aktor {pekerja_id, divisi}). Foto/video lewat unggahBanyak dgn
// antrean HP (lib/antreanFoto, tujuan inv_selesai / inv_media): sinyal putus -> tersimpan di HP & terkirim otomatis.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { bacaSemuaHalaman, bacaSemuaPerPotongan } from './bacaSemua'
import { unggahBanyak, unggahMediaKeR2 } from './siapkanMedia'
import { tempelAtauAntrekan, type TujuanFoto } from './antreanFoto'
import type { Lokasi, Barang, Jadwal, Selesai, Laporan, UpdateLaporan, Media } from './inventarisAturan'

export type DataDivisi = { lokasi: Lokasi[]; barang: Barang[]; jadwal: Jadwal[]; selesai: Selesai[]; laporan: Laporan[]; update: UpdateLaporan[]; media: Media[] }
export type Aktor = { pekerja_id: number; divisi: string }

export function aktorOperator(user: any): Aktor {
  if (!user?.id) throw new Error('Nama login tidak terdaftar di data pekerja - login ulang dengan memilih nama dari daftar')
  return { pekerja_id: Number(user.id), divisi: String(user.divisi) }
}
// uuid anti-dobel; cadangan utk Chrome HP lama tanpa crypto.randomUUID (pola buatId di lib/antreanFoto)
export const buatKunci = (): string => { try { return crypto.randomUUID() } catch { const h = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join(''); return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20)}` } }
export const RIWAYAT_HARI = 120   // riwayat di HP: 120 hari terakhir (data tetap utuh di server, admin melihat semua)

export async function muatInventarisDivisi(db: any, divisi: string): Promise<DataDivisi> {
  const { data: lok, error: eLok } = await db.from('inv_lokasi').select('*').eq('tampil_operator', true).contains('divisi_operator', [divisi]).order('urut')
  if (eLok) throw eLok
  const lokasi: Lokasi[] = lok || []
  if (!lokasi.length) return { lokasi, barang: [], jadwal: [], selesai: [], laporan: [], update: [], media: [] }
  const barang: Barang[] = await bacaSemuaHalaman((a, z) => db.from('inv_barang').select('*').in('lokasi_kode', lokasi.map(l => l.kode)).eq('aktif', true).order('id').range(a, z))
  const ids = barang.map(b => b.id)
  if (!ids.length) return { lokasi, barang, jadwal: [], selesai: [], laporan: [], update: [], media: [] }
  const batas = new Date(Date.now() - RIWAYAT_HARI * 86400000).toISOString().slice(0, 10)
  const [jadwal, selesai, laporan] = await Promise.all([
    bacaSemuaPerPotongan(ids, (p, a, z) => db.from('inv_jadwal_v').select('*').in('barang_id', p).eq('aktif', true).order('id').range(a, z)),
    bacaSemuaPerPotongan(ids, (p, a, z) => db.from('inv_jadwal_selesai').select('*').in('barang_id', p).gte('tanggal', batas).order('id').range(a, z)),
    bacaSemuaPerPotongan(ids, (p, a, z) => db.from('inv_laporan').select('*').in('barang_id', p).order('id').range(a, z)),
  ])
  const update: UpdateLaporan[] = laporan.length ? await bacaSemuaPerPotongan(laporan.map((l: Laporan) => l.id), (p, a, z) => db.from('inv_laporan_update').select('*').in('laporan_id', p).order('id').range(a, z)) : []
  const ref: [string, number[]][] = [['barang', ids], ['laporan', laporan.map((l: Laporan) => l.id)], ['laporan_update', update.map(u => u.id)], ['jadwal_selesai', selesai.map((s: Selesai) => s.id)]]
  const media: Media[] = []
  for (const [tujuan, r] of ref) if (r.length) media.push(...await bacaSemuaPerPotongan(r, (p, a, z) => db.from('inv_media').select('*').eq('tujuan', tujuan).in('ref_id', p).is('dihapus_pada', null).order('id').range(a, z)))
  return { lokasi, barang, jadwal, selesai, laporan, update, media }
}

async function rpc(db: any, nama: string, arg: Record<string, any>): Promise<any> {
  const { data, error } = await db.rpc(nama, arg)
  if (error) { console.error(`[inventaris operator] ${nama} gagal:`, error); throw Object.assign(new Error(error.message || String(error)), { code: error.code }) }
  return data
}
export const setKondisiOperator = (db: any, user: any, b: Barang, kondisi: string, detail: string) =>
  rpc(db, 'inv_set_kondisi', { p_id: b.id, p_versi: b.versi, p_kondisi: kondisi, p_detail: detail, p_aktor: aktorOperator(user) })

export type HasilKirim = { terkirim: number; diantrekan: number; gagal: string[] }
const ringkasUnggah = (hasil: Awaited<ReturnType<typeof unggahBanyak>>, tempel?: { tertempel: any[]; diantrekan: any[]; gagal: any[]; error: any }): HasilKirim => ({
  terkirim: tempel?.tertempel.length || 0,
  diantrekan: hasil.filter(h => h.status === 'diantrekan').length + (tempel?.diantrekan.length || 0),
  gagal: [...hasil.filter(h => h.status === 'gagal').map(h => `${h.file.name}: ${(h as any).alasan}`), ...(tempel?.error ? [String(tempel.error?.message || tempel.error)] : [])],
})
const objekFoto = (m: { url: string; mime: string; name: string; thumb?: string }, oleh: string) => ({ url: m.url, mime: m.mime, name: m.name, ...(m.thumb ? { thumb: m.thumb } : {}), uploaded_by: oleh, uploaded_at: new Date().toISOString() })

// Lapor kerusakan: laporan dibuat dulu (butuh sinyal, kunci anti-dobel), lalu foto/video "sebelum" - yang gagal karena
// sinyal masuk antrean HP dan ditempel otomatis ke laporan ini.
export async function kirimLaporan(db: any, user: any, b: Barang, masalah: string, files: File[], kunci: string, onProgres?: (s: number, t: number) => void) {
  const aktor = aktorOperator(user)
  const res = await rpc(db, 'inv_buat_laporan', { p_barang_id: b.id, p_judul: null, p_masalah: masalah, p_media: null, p_kunci: kunci, p_aktor: aktor })
  const lapId: number = res.laporan.id
  if (!files.length) return { laporan: res.laporan, ...ringkasUnggah([]) }
  const tujuan: TujuanFoto = { jenis: 'inv_media', id: lapId, tujuanInv: 'laporan', peran: 'sebelum', aktor }
  const info = { label: `Laporan ${b.nama}`, operator: user.nama }
  const hasil = await unggahBanyak(files, `inventaris/${b.id}/laporan/${lapId}/sebelum`, { tujuan, ...info }, { onProgres })
  const ok = hasil.filter(h => h.status === 'ok') as any[]
  const t = ok.length ? await tempelAtauAntrekan(tujuan, ok.map(h => ({ foto: objekFoto(h.media, user.nama), file: h.file })), info) : undefined
  return { laporan: res.laporan, ...ringkasUnggah(hasil, t) }
}

// Tambah barang oleh operator (30 Okt 2026, RPC inv_tambah_barang_operator): lokasi dikunci server dari divisi login,
// nomor inventaris otomatis, barang langsung tampil (admin melihat label "Baru dari operator" sampai ditandai diperiksa).
// kunci = uuid form: kirim ulang setelah sinyal putus = barang yang sama (tidak dobel, nomor tidak terbuang).
// Foto opsional, pola kirimLaporan: barang tersimpan dulu, foto menyusul (sinyal putus -> antrean HP).
export type IsiBarangBaru = { nama: string; merk_spesifikasi: string; nomor_seri: string; kondisi: string; detail_kondisi: string; lokasi_kode?: string }
export async function tambahBarangOperator(db: any, user: any, isi: IsiBarangBaru, files: File[], kunci: string, onProgres?: (s: number, t: number) => void) {
  const aktor = aktorOperator(user)
  const barang: Barang & { dobel?: boolean } = await rpc(db, 'inv_tambah_barang_operator', { p_data: isi, p_kunci: kunci, p_aktor: aktor })
  if (!files.length) return { barang, ...ringkasUnggah([]) }
  const tujuan: TujuanFoto = { jenis: 'inv_media', id: barang.id, tujuanInv: 'barang', peran: 'foto', aktor }
  const info = { label: `Barang baru ${barang.nama}`, operator: user.nama }
  const hasil = await unggahBanyak(files, `inventaris/${barang.id}/foto`, { tujuan, ...info }, { onProgres })
  const ok = hasil.filter(h => h.status === 'ok') as any[]
  const t = ok.length ? await tempelAtauAntrekan(tujuan, ok.map(h => ({ foto: objekFoto(h.media, user.nama), file: h.file })), info) : undefined
  return { barang, ...ringkasUnggah(hasil, t) }
}

// Laporan kerusakan oleh operator (30 Okt 2026, migrasi 20261030050000): ubah status / tambah update / tutup.
// Foto diunggah ke R2 DULU lalu dikirim bersama perintahnya (keputusan user: butuh sinyal, tanpa antrean HP) - gagal =
// belum ada yang berubah di laporan; file yang sudah terunggah tidak diunggah ulang saat dicoba lagi (cache unggahMediaKeR2).
// Menutup: wajib >=1 foto/video sesudah + kondisi setelah perbaikan (server menerapkannya bila tak ada laporan aktif lain).
async function unggahLangsung(files: File[], prefix: string, onProgres?: (s: number, t: number) => void) {
  const hasil: { url: string; mime: string; thumb: string | null }[] = []
  for (const f of files) { const r = await unggahMediaKeR2(f, prefix); hasil.push({ url: r.url, mime: r.mime, thumb: r.thumb || null }); onProgres?.(hasil.length, files.length) }
  return hasil
}
export type IsiLaporanOperator = { status: Laporan['status']; catatan: string; perbaikan: string; kondisi: string; files: File[] }
export async function simpanLaporanOperator(db: any, user: any, l: Laporan, a: IsiLaporanOperator, onProgres?: (s: number, t: number) => void) {
  const aktor = aktorOperator(user), catatan = a.catatan.trim() || null
  const ubahStatus = (status: string, media: any[] | null, extra: Record<string, any> = {}) => rpc(db, 'inv_ubah_status_laporan', {
    p_laporan_id: l.id, p_status: status, p_catatan: catatan, p_perbaikan: a.perbaikan.trim() || null, p_teknisi: null, p_media_sesudah: media, p_aktor: aktor, ...extra })
  if (a.status === 'closed') {
    if (!a.files.length) throw new Error('Tambahkan minimal satu foto/video sesudah perbaikan.')
    const media = await unggahLangsung(a.files, `inventaris/${l.barang_id}/laporan/${l.id}/sesudah`, onProgres)
    return ubahStatus('closed', media, { p_kondisi_setelah: a.kondisi })
  }
  if (a.status === l.status && !catatan && !a.files.length) throw new Error('Tulis catatan atau tambahkan foto dulu.')
  const media = a.files.length ? await unggahLangsung(a.files, `inventaris/${l.barang_id}/laporan/${l.id}/update`, onProgres) : []
  if (a.status !== l.status) {
    await ubahStatus(a.status, null)
    if (media.length) await rpc(db, 'inv_tambah_update_laporan', { p_laporan_id: l.id, p_catatan: null, p_media: media, p_aktor: aktor })
    return
  }
  return rpc(db, 'inv_tambah_update_laporan', { p_laporan_id: l.id, p_catatan: catatan, p_media: media.length ? media : null, p_aktor: aktor })
}

// "Selesai" jadwal: wajib >=1 foto/video. Foto pertama yang sampai server menandai selesai (kunci sama), sisanya ditempel.
// Sinyal putus -> semua foto + penandaan selesai menunggu di antrean HP (dikirim otomatis).
export async function selesaikanJadwal(user: any, j: Jadwal, catatan: string, files: File[], onProgres?: (s: number, t: number) => void): Promise<HasilKirim> {
  if (!files.length) throw new Error('Tambahkan minimal satu foto atau video dulu.')
  const tujuan: TujuanFoto = { jenis: 'inv_selesai', id: j.id, kunci: buatKunci(), catatan: catatan.trim() || null, aktor: aktorOperator(user) }
  const info = { label: `Maintenance ${j.jenis}`, operator: user.nama }
  const hasil = await unggahBanyak(files, `inventaris/${j.barang_id}/jadwal/${j.id}`, { tujuan, ...info }, { onProgres })
  const ok = hasil.filter(h => h.status === 'ok') as any[]
  const t = ok.length ? await tempelAtauAntrekan(tujuan, ok.map(h => ({ foto: objekFoto(h.media, user.nama), file: h.file })), info) : undefined
  return ringkasUnggah(hasil, t)
}
