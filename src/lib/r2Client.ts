// src/lib/r2Client.ts
// Helper upload/hapus foto ke Cloudflare R2 lewat Edge Function "r2-storage" - client TIDAK
// pernah pegang R2_SECRET_ACCESS_KEY, cuma dapat presigned URL bermasa-berlaku pendek lalu
// PUT langsung ke R2 (bukan lewat Edge Function, jadi gak ada limit ukuran file dari sana).
import { supabase } from './supabase'

// Batas waktu OPSIONAL (6 Okt 2026, dukungan video - salinan pola vista-teknik r2Client) - tanpa opsi,
// perilaku sama persis seperti dulu (pemanggil lama tidak terpengaruh). Upload video di sinyal lapangan
// bisa menggantung tanpa akhir (pola insiden BAK DEGREASING 5 Okt) -> dengan batas waktu jadi gagal
// yang jelas & bisa diulang.
// Percobaan ulang OPSIONAL (18 Okt 2026, investigasi gagal upload 17 Okt: 6 kegagalan jaringan, 2 operator
// langsung berhasil saat mengulang) - `ulang: true` mengulang izin+kirim sampai 4 kali (jeda 1, 3, 7 dtk)
// HANYA untuk gagal koneksi / server sementara (5xx, 408, 429). Ditolak server (4xx lain) tidak diulang.
// Tiap percobaan minta izin (presigned URL) baru - URL lama tidak dipakai ulang.
export type OpsiUploadR2 = { batasWaktuIzinMs?: number; batasWaktuUnggahMs?: number; ulang?: boolean }
export type LangkahUpload = 'izin' | 'kirim'
// Error upload yang membawa keterangan untuk pesan operator & log (Kesehatan Data). `message` tetap
// pesan teknis asli (dipakai log); pesan untuk operator dibuat di siapkanMedia.pesanGagalUpload.
export class GagalUploadR2 extends Error {
  langkah: LangkahUpload; jenis: 'koneksi' | 'server'; status?: number; percobaan = 1; asli: any
  constructor(pesan: string, langkah: LangkahUpload, jenis: 'koneksi' | 'server', asli?: any, status?: number) {
    super(pesan); this.name = 'GagalUploadR2'; this.langkah = langkah; this.jenis = jenis; this.asli = asli; this.status = status
  }
}
export const JEDA_ULANG_UPLOAD_MS = [1000, 3000, 7000]
const BATAS_TOTAL_ULANG_MS = 120_000 // berhenti mengulang kalau sudah >2 menit (sinyal jelas tidak ada)

const denganBatasWaktu = <T,>(p: Promise<T>, ms: number | undefined, pesan: string): Promise<T> =>
  !ms ? p : Promise.race([p, new Promise<T>((_, tolak) => setTimeout(() => tolak(new Error(pesan)), ms))])
const statusSementara = (s?: number) => s != null && (s >= 500 || s === 408 || s === 429)

async function sekaliUpload(file: Blob, key: string, contentType: string, opsi?: OpsiUploadR2): Promise<string> {
  let data: any, error: any
  try {
    ({ data, error } = await denganBatasWaktu(
      supabase.functions.invoke('r2-storage', { body: { action: 'presign-upload', key, contentType } }),
      opsi?.batasWaktuIzinMs, 'Waktu habis saat meminta izin upload (koneksi lambat)'))
  } catch (err: any) {
    throw new GagalUploadR2(String(err?.message || err), 'izin', 'koneksi', err)
  }
  if (error || !data?.uploadUrl || !data?.publicUrl) {
    // FunctionsFetchError/RelayError = request tidak sampai (koneksi); FunctionsHttpError = fungsi menjawab non-2xx
    const status: number | undefined = error?.context?.status
    const koneksi = !error || error?.name === 'FunctionsFetchError' || error?.name === 'FunctionsRelayError' || statusSementara(status)
    throw new GagalUploadR2(error?.message || 'Gagal mendapatkan signed URL R2', 'izin', koneksi ? 'koneksi' : 'server', error, status)
  }
  const pengendali = opsi?.batasWaktuUnggahMs ? new AbortController() : null
  const pewaktu = pengendali ? setTimeout(() => pengendali.abort(), opsi!.batasWaktuUnggahMs) : null
  let putRes: Response
  try {
    putRes = await fetch(data.uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file, signal: pengendali?.signal })
  } catch (err: any) {
    if (pengendali?.signal.aborted) throw new GagalUploadR2('Waktu habis saat mengunggah file (koneksi lambat)', 'kirim', 'koneksi', err)
    throw new GagalUploadR2(String(err?.message || err), 'kirim', 'koneksi', err)
  } finally {
    if (pewaktu) clearTimeout(pewaktu)
  }
  if (!putRes.ok) throw new GagalUploadR2(`Upload ke R2 gagal (status ${putRes.status})`, 'kirim', statusSementara(putRes.status) ? 'koneksi' : 'server', undefined, putRes.status)
  return data.publicUrl as string
}

export const uploadToR2 = async (file: Blob, key: string, contentType: string, opsi?: OpsiUploadR2): Promise<string> => {
  const mulai = Date.now()
  for (let i = 0; ; i++) {
    try {
      return await sekaliUpload(file, key, contentType, opsi)
    } catch (err: any) {
      const e = err instanceof GagalUploadR2 ? err : new GagalUploadR2(String(err?.message || err), 'kirim', 'koneksi', err)
      e.percobaan = i + 1
      const bolehUlang = !!opsi?.ulang && e.jenis === 'koneksi' && i < JEDA_ULANG_UPLOAD_MS.length && Date.now() - mulai < BATAS_TOTAL_ULANG_MS
      if (!bolehUlang) throw e
      await new Promise(r => setTimeout(r, JEDA_ULANG_UPLOAD_MS[i]))
    }
  }
}

export const deleteFromR2 = async (key: string): Promise<void> => {
  await supabase.functions.invoke('r2-storage', { body: { action: 'delete', key } })
}

// URL publik R2 diketahui client (bukan secret, cuma domain baca) - dipakai fotoHelpers.ts
// buat bedain foto lama (Supabase) vs foto baru (R2) pas hapus.
export const r2PublicBaseUrl = (): string | undefined => import.meta.env.VITE_R2_PUBLIC_BASE_URL as string | undefined

export const extractR2Key = (url: string): string | null => {
  const base = r2PublicBaseUrl()
  if (!base || !url.startsWith(base)) return null
  return decodeURIComponent(url.slice(base.length).replace(/^\/+/, ''))
}
