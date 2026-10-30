// ANTREAN FOTO LOKAL (18 Okt 2026, tahap 2 investigasi gagal upload 17 Okt, disetujui user: RPC atomik, semua layar
// dokumentasi panel). Foto/video yang tetap gagal terkirim setelah percobaan ulang otomatis (r2Client) karena SINYAL
// disimpan di IndexedDB HP (file yang SUDAH dikompres) lalu dikirim ulang otomatis: saat sinyal kembali, tiap 30 detik
// selama antrean ada isinya, dan saat aplikasi dibuka. Tetap ada walau aplikasi ditutup / HP dimatikan.
// Pola sama lib/antreanSimpan.ts (antrean progres, localStorage) - localStorage tidak bisa menampung file.
//
// Menempel foto ke data SELALU lewat RPC tambah_foto_dokumentasi (satu perintah UPDATE di server, URL dobel diabaikan),
// baik dari antrean MAUPUN simpan normal (tempelFotoDokumentasi) - layar yang masih memegang daftar foto lama tidak
// lagi menulis ulang seluruh array foto, jadi foto yang ditempel antrean / HP lain tidak tertimpa.
// Penolakan server (bukan sinyal) TIDAK diantrekan - perilaku lama (pesan + file tetap di layar).
import { supabase } from './supabase'
import { withRetry, klasifikasiErrorSimpan } from './koneksi'
import { uploadToR2 } from './r2Client'
import { laporError } from './laporError'

export type TujuanFoto =
  | { jenis: 'kolom'; id: number; kunci: 'nameplate_photos' | 'yellowmark_photos' | 'qs_photos' | 'warehouse_photos' | 'pasang_komponen_photos' | string }
  | { jenis: 'qc'; id: number; kunci: string }
  | { jenis: 'komponen'; id: number; kunci: string; tahap?: string | null; keArsip?: boolean }
  | { jenis: 'proyek_luar' | 'proyek_luar_entri' | 'mom_fat_poin'; id: number }   // proyek_luar_entri: multi-hari 25 Okt 2026
  // Inventaris & Maintenance (30 Okt 2026). inv_selesai: foto "Kerjakan" jadwal - tempel = RPC inv_selesai_jadwal dgn kunci
  // uuid yang sama utk semua foto (foto pertama yang sampai MENANDAI selesai, berikutnya ditempel ke penyelesaian itu).
  // inv_media: foto laporan kerusakan / foto barang baru dari operator yang tertunda (RPC inv_tambah_media). aktor = {pekerja_id, divisi} operator.
  | { jenis: 'inv_selesai'; id: number; kunci: string; catatan: string | null; aktor: { pekerja_id: number; divisi: string } }
  | { jenis: 'inv_media'; id: number; tujuanInv: 'laporan' | 'laporan_update' | 'barang'; peran: 'sebelum' | 'update' | 'foto'; aktor: { pekerja_id: number; divisi: string } }

export type ItemAntreanFoto = {
  id: string
  dibuat: string
  operator: string
  label: string            // utk operator, mis. "QC Pemeriksaan Fisik - PANEL A"
  tujuan: TujuanFoto
  key: string              // key objek R2 (dibuat sekali, dipakai ulang tiap percobaan)
  blob: Blob
  contentType: string
  foto: Record<string, any> // objek foto yang ditempel (tanpa url), mis. {mime,name,uploaded_by,uploaded_at}
  url?: string             // terisi kalau file SUDAH masuk R2 tapi belum tertempel -> tidak diunggah ulang
  percobaan: number
  ditolakServer: number
  alasan?: string
}

const NAMA_DB = 'vista_pekerja_antrean_foto'
const STORE = 'foto'
export const JEDA_KIRIM_ULANG_FOTO_MS = 30000
const MAKS_DITOLAK_SERVER = 5 // ditolak server berulang (bukan sinyal) -> dibuang + dilaporkan, supaya tidak menyumbat

// ── IndexedDB ──
let dbJanji: Promise<IDBDatabase> | null = null
function bukaDb(): Promise<IDBDatabase> {
  if (dbJanji) return dbJanji
  dbJanji = new Promise((ok, gagal) => {
    try {
      const r = indexedDB.open(NAMA_DB, 1)
      r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE, { keyPath: 'id' }) }
      r.onsuccess = () => ok(r.result)
      r.onerror = () => { dbJanji = null; gagal(r.error) }
    } catch (e) { dbJanji = null; gagal(e) }
  })
  return dbJanji
}
async function transaksi<T>(mode: IDBTransactionMode, kerja: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await bukaDb()
  return new Promise((ok, gagal) => {
    const tx = db.transaction(STORE, mode)
    let hasil: T | undefined
    const req = kerja(tx.objectStore(STORE))
    if (req) req.onsuccess = () => { hasil = req.result }
    tx.oncomplete = () => ok(hasil)
    tx.onerror = () => gagal(tx.error)
    tx.onabort = () => gagal(tx.error)
  })
}
export async function bacaAntreanFoto(): Promise<ItemAntreanFoto[]> {
  try { return ((await transaksi<ItemAntreanFoto[]>('readonly', s => s.getAll())) || []).sort((a, b) => a.dibuat.localeCompare(b.dibuat)) }
  catch (e) { console.error('[antreanFoto] gagal membaca antrean:', e); return [] }
}
const tulisItem = (item: ItemAntreanFoto) => transaksi('readwrite', s => { s.put(item) })
const hapusItem = (id: string) => transaksi('readwrite', s => { s.delete(id) })

// ── jumlah (badge) ──
let pendengar: ((n: number) => void)[] = []
let jumlahTerakhir = 0
async function umumkanJumlah() { jumlahTerakhir = (await bacaAntreanFoto()).length; pendengar.forEach(fn => fn(jumlahTerakhir)) }
export function dengarJumlahAntreanFoto(fn: (n: number) => void): () => void {
  pendengar.push(fn); fn(jumlahTerakhir); umumkanJumlah()
  return () => { pendengar = pendengar.filter(f => f !== fn) }
}

// ── tempel foto ke data (dipakai simpan normal & antrean) ──
const objekFoto = (url: string, foto: Record<string, any>) => ({ url, ...foto })
export async function tempelFotoDokumentasi(tujuan: TujuanFoto, fotos: Record<string, any>[]): Promise<{ error: any; ditemukan: boolean; tabel?: string }> {
  if (!fotos.length) return { error: null, ditemukan: true }
  if (tujuan.jenis === 'inv_selesai' || tujuan.jenis === 'inv_media') return tempelInventaris(tujuan, fotos)
  const t: any = tujuan
  const { data, error } = await withRetry(() => supabase.rpc('tambah_foto_dokumentasi' as any, {
    p_tujuan: t.jenis, p_id: t.id, p_kunci: t.kunci ?? null, p_foto: fotos,
    p_tahap: t.jenis === 'komponen' ? (t.tahap ?? null) : null, p_ke_arsip: t.jenis === 'komponen' ? !!t.keArsip : false,
  }) as any) as any
  if (error) return { error, ditemukan: true }
  return { error: null, ditemukan: data?.ditemukan !== false, tabel: data?.tabel }
}

// Simpan normal: tempel foto yang SUDAH masuk R2. Gagal karena sinyal -> masuk antrean dgn url (tidak diunggah ulang).
// Ditolak server -> `error` dikembalikan (pemanggil menampilkan pesan & membiarkan file di layar, perilaku lama).
// (19 Okt 2026) dikirim per POTONGAN 20 foto: insiden BAGAS 19 Okt 09.30 - 57 foto Proyek Luar 14 terunggah tapi
// RPC menolak semuanya (maks 20 per panggilan). Potongan 20 berlaku utk RPC lama (maks 20) MAUPUN baru (maks 80).
// Potongan yang gagal karena SINYAL -> foto potongan itu & sesudahnya masuk antrean (url sudah ada, tidak diunggah ulang);
// ditolak SERVER -> berhenti, `error` + yang sudah tertempel dikembalikan.
// Inventaris: media {url,mime,thumb} ke RPC inv_* (lihat TujuanFoto). Galat server dikembalikan apa adanya (antrean membuang
// setelah MAKS_DITOLAK_SERVER), galat koneksi -> diantrekan ulang oleh pemanggil.
/* eslint-disable @typescript-eslint/no-explicit-any -- payload RPC inv_* tanpa tipe hasil generate */
async function tempelInventaris(t: Extract<TujuanFoto, { jenis: 'inv_selesai' | 'inv_media' }>, fotos: Record<string, any>[]): Promise<{ error: any; ditemukan: boolean }> {
  const media = fotos.map(f => ({ url: f.url, mime: f.mime || null, thumb: f.thumb || null }))
  const rpc = (nama: string, arg: Record<string, any>) => withRetry(() => supabase.rpc(nama as any, arg as any) as any) as Promise<any>
  if (t.jenis === 'inv_media') {
    const { data, error } = await rpc('inv_tambah_media', { p_tujuan: t.tujuanInv, p_ref_id: t.id, p_peran: t.peran, p_media: media, p_aktor: t.aktor })
    return error ? { error, ditemukan: true } : { error: null, ditemukan: data?.ditemukan !== false }
  }
  const { data, error } = await rpc('inv_selesai_jadwal', { p_jadwal_id: t.id, p_catatan: t.catatan, p_media: media, p_kunci: t.kunci, p_aktor: t.aktor })
  if (error) return { error, ditemukan: true }
  if (data?.dobel && data?.selesai?.id) {   // penyelesaian sudah tercatat (kunci sama) -> foto ini ditempel ke sana
    const r = await rpc('inv_tambah_media', { p_tujuan: 'jadwal_selesai', p_ref_id: data.selesai.id, p_peran: 'selesai', p_media: media, p_aktor: t.aktor })
    if (r.error) return { error: r.error, ditemukan: true }
  }
  return { error: null, ditemukan: true }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export const MAKS_FOTO_PER_PANGGILAN = 20
export async function tempelAtauAntrekan(tujuan: TujuanFoto, fotos: { foto: Record<string, any>; file: Blob; key?: string }[], info: { label: string; operator: string }):
  Promise<{ tertempel: Record<string, any>[]; diantrekan: Record<string, any>[]; error: any; ditemukan: boolean; gagal: Record<string, any>[] }> {
  const tertempel: Record<string, any>[] = [], diantrekan: Record<string, any>[] = []
  for (let i = 0; i < fotos.length; i += MAKS_FOTO_PER_PANGGILAN) {
    const potong = fotos.slice(i, i + MAKS_FOTO_PER_PANGGILAN)
    const objs = potong.map(f => f.foto)
    const t = await tempelFotoDokumentasi(tujuan, objs)
    if (!t.error) {
      if (!t.ditemukan) return { tertempel, diantrekan, error: null, ditemukan: false, gagal: [] }
      tertempel.push(...objs)
      continue
    }
    if (klasifikasiErrorSimpan(t.error).jenis !== 'koneksi') return { tertempel, diantrekan, error: t.error, ditemukan: true, gagal: fotos.slice(i).map(f => f.foto) }
    // sinyal putus: sisa (potongan ini + sesudahnya) diantrekan
    for (const f of fotos.slice(i)) {
      const { url, ...sisa } = f.foto
      const ok = await antrekanFoto({ ...info, tujuan, key: f.key || String(url), blob: f.file, contentType: f.file.type || 'application/octet-stream', foto: sisa, url, alasan: String(t.error?.message || t.error) })
      if (!ok) return { tertempel, diantrekan, error: t.error, ditemukan: true, gagal: fotos.slice(i).filter(x => !diantrekan.includes(x.foto)).map(x => x.foto) }
      diantrekan.push(f.foto)
    }
    break
  }
  return { tertempel, diantrekan, error: null, ditemukan: true, gagal: [] }
}

// ── masukkan ke antrean ──
const buatId = () => { try { return crypto.randomUUID() } catch { return 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12) } }
let sudahMintaPersist = false
export async function antrekanFoto(item: Omit<ItemAntreanFoto, 'id' | 'dibuat' | 'percobaan' | 'ditolakServer'>): Promise<boolean> {
  try {
    if (!sudahMintaPersist) { sudahMintaPersist = true; try { await (navigator as any).storage?.persist?.() } catch { /* opsional */ } }
    await tulisItem({ ...item, id: buatId(), dibuat: new Date().toISOString(), percobaan: 0, ditolakServer: 0 })
    umumkanJumlah()
    return true
  } catch (e) {
    console.error('[antreanFoto] gagal menyimpan foto ke antrean HP:', e)
    return false
  }
}

// ── kirim ulang ──
export type HasilKirimFoto = { terkirim: ItemAntreanFoto[]; dibuang: { item: ItemAntreanFoto; alasan: string }[]; masihTertunda: number }
let sedangMengirim = false
export async function kirimAntreanFoto(): Promise<HasilKirimFoto> {
  const hasil: HasilKirimFoto = { terkirim: [], dibuang: [], masihTertunda: 0 }
  if (sedangMengirim) return { ...hasil, masihTertunda: jumlahTerakhir }
  sedangMengirim = true
  try {
    const items = await bacaAntreanFoto()
    for (const item of items) {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) { hasil.masihTertunda++; continue }
      try {
        let url = item.url
        if (!url) {
          url = await uploadToR2(item.blob, item.key, item.contentType, { batasWaktuIzinMs: 30_000, batasWaktuUnggahMs: Math.max(180_000, Math.ceil(item.blob.size / 1048576) * 15_000) })
          await tulisItem({ ...item, url, percobaan: item.percobaan + 1, alasan: undefined }) // jangan unggah ulang kalau tempel gagal
        }
        const t = await tempelFotoDokumentasi(item.tujuan, [objekFoto(url, item.foto)])
        if (t.error) throw t.error
        await hapusItem(item.id)
        if (!t.ditemukan) {
          hasil.dibuang.push({ item, alasan: 'data tujuan sudah dihapus' })
          laporError('upload', { message: `Antrean foto: tujuan tidak ada lagi (${item.label})` }, { url, tujuan: item.tujuan })
        } else hasil.terkirim.push(item)
      } catch (err: any) {
        const koneksi = err?.jenis === 'koneksi' || (err?.jenis !== 'server' && klasifikasiErrorSimpan(err).jenis === 'koneksi')
        const ditolak = koneksi ? item.ditolakServer : item.ditolakServer + 1
        if (ditolak >= MAKS_DITOLAK_SERVER) {
          await hapusItem(item.id)
          hasil.dibuang.push({ item, alasan: String(err?.message || err) })
          laporError('upload', { message: `Antrean foto dibuang setelah ${ditolak}x ditolak server (${item.label}): ${err?.message || err}` }, { url: item.url, tujuan: item.tujuan })
        } else {
          await tulisItem({ ...item, percobaan: item.percobaan + 1, ditolakServer: ditolak, alasan: String(err?.message || err) })
          hasil.masihTertunda++
        }
      }
    }
  } finally {
    sedangMengirim = false
    umumkanJumlah()
  }
  return hasil
}

// Hasil tiap pengiriman disiarkan lewat event window -> layar dokumentasi memuat ulang datanya.
export const EVENT_HASIL_ANTREAN_FOTO = 'antrean-foto-hasil'
export async function kirimAntreanFotoDanUmumkan(): Promise<HasilKirimFoto> {
  const hasil = await kirimAntreanFoto()
  if (hasil.terkirim.length || hasil.dibuang.length) {
    try { window.dispatchEvent(new CustomEvent(EVENT_HASIL_ANTREAN_FOTO, { detail: hasil })) } catch { /* abaikan */ }
  }
  if (hasil.dibuang.length) {
    alert('Foto tertunda TIDAK bisa ditempel:\n\n' + hasil.dibuang.map(d => `- ${d.item.label}: ${d.alasan}`).join('\n') +
      '\n\nFile foto sudah tercatat untuk admin (Kesehatan Data). Foto ulang kalau masih diperlukan.')
  }
  return hasil
}
let terpasang = false
export function mulaiPengirimFotoOtomatis(): () => void {
  if (terpasang) return () => {}
  terpasang = true
  const coba = () => { if (jumlahTerakhir > 0) kirimAntreanFotoDanUmumkan().catch(e => console.error('[antreanFoto] kirim gagal:', e)) }
  window.addEventListener('online', coba)
  const iv = setInterval(coba, JEDA_KIRIM_ULANG_FOTO_MS)
  umumkanJumlah().then(() => setTimeout(coba, 2500))
  return () => { window.removeEventListener('online', coba); clearInterval(iv); terpasang = false }
}
