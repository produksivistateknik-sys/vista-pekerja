// PENGINGAT WIRING (6 Nov 2026) - operator Wiring Control & Wiring Power diingatkan menyiapkan permintaan komponen ke gudang
// saat groundplate/box control/pintu masuk painting (panel stainless: FINISHING 100%). Kejadiannya dibuat server (pg_cron
// wiring_pengingat_pindai, migration 20261106030000 di vista-teknik), aplikasi ini hanya membaca view wiring_pengingat_v dan
// mencatat tanda baca per orang. Satu kartu = satu panel + jenis + hari, tidak pernah dirangkum antar-panel.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { bacaSemuaHalaman } from './bacaSemua'
import { aktorOperator } from './inventarisOperator'

export type Pengingat = { id: number; panel_id: number; kode_komponen: string; jenis: 'masuk_painting' | 'selesai_finishing'; label: string
  nama_panel: string; proyek: string | null; penanda: string | null; dibuat_pada: string }
export type KartuPengingat = { kunci: string; ids: number[]; idTerbaru: number; waktu: string; pesan: string; belumDibaca: boolean }

export const penerimaPengingat = (user: any) => !!user && ['wiring_ctrl', 'wiring_pwr'].includes(user.divisi) && Number(user.id) > 0

const URUTAN_LABEL = ['Groundplate', 'Box control', 'Pintu']
const urutLabel = (a: string, b: string) => (URUTAN_LABEL.indexOf(a) + 1 || 99) - (URUTAN_LABEL.indexOf(b) + 1 || 99)
const gabungLabel = (l: string[]) => l.length < 2 ? l.join('') : `${l.slice(0, -1).join(', ')} dan ${l[l.length - 1]}`
const hariWib = (v: string) => new Date(v).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })

export function pesanPengingat(label: string[], p: Pick<Pengingat, 'jenis' | 'nama_panel' | 'proyek' | 'penanda'>): string {
  const nama = p.nama_panel.trim() + (p.penanda ? ` (${p.penanda})` : '')
  const proyek = p.proyek?.trim() ? ` (proyek ${p.proyek.trim()})` : ''
  const tahap = p.jenis === 'selesai_finishing' ? 'sudah selesai finishing' : 'sudah masuk painting'
  return `${gabungLabel(label)} panel ${nama}${proyek} ${tahap}. Siapkan permintaan komponen ke gudang.`
}

// Baris dikelompokkan per panel+jenis+hari WIB, terbaru di atas. Belum dibaca bila ada satu saja id yang belum dibaca orang ini.
export function susunKartu(baris: Pengingat[], dibaca: Set<number>): KartuPengingat[] {
  const kelompok = new Map<string, Pengingat[]>()
  for (const b of baris) {
    const k = `${b.panel_id}|${b.jenis}|${hariWib(b.dibuat_pada)}`
    kelompok.set(k, [...(kelompok.get(k) || []), b])
  }
  return [...kelompok].map(([kunci, bs]) => {
    const ids = bs.map(b => b.id), terbaru = bs.reduce((a, b) => (b.id > a.id ? b : a))
    return { kunci, ids, idTerbaru: terbaru.id, waktu: terbaru.dibuat_pada, belumDibaca: ids.some(i => !dibaca.has(i)),
      pesan: pesanPengingat([...new Set(bs.map(b => b.label))].sort(urutLabel), terbaru) }
  }).sort((a, b) => b.idTerbaru - a.idTerbaru)
}

export async function muatPengingat(db: any, pekerjaId: number): Promise<{ baris: Pengingat[]; dibaca: Set<number> }> {
  const [baris, tanda] = await Promise.all([
    bacaSemuaHalaman((a, z) => db.from('wiring_pengingat_v').select('*').order('id').range(a, z)),
    bacaSemuaHalaman((a, z) => db.from('wiring_pengingat_dibaca').select('pengingat_id').eq('pekerja_id', pekerjaId).order('pengingat_id').range(a, z)),
  ])
  return { baris, dibaca: new Set(tanda.map((t: any) => t.pengingat_id)) }
}

export async function tandaiPengingat(db: any, user: any, ids: number[]): Promise<void> {
  const { error } = await db.rpc('wiring_pengingat_tandai', { p_ids: ids, p_aktor: aktorOperator(user) })
  if (error) throw error
}
