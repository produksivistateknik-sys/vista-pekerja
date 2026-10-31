// INVENTARIS & MAINTENANCE - MENU OPERATOR HP (T3, 30 Okt 2026). Pengganti scan QR /mesin (halaman lama tetap ada sampai
// T4). Acuan tampilan: pratinjau "maintenance-mesin.html" yang disepakati user - navigasi Inventaris/Laporan/Maintenance/
// Riwayat (bar tab di alur biasa di bawah tombol Kembali, hanya di halaman daftar - revisi 30 Okt; dulu nav bawah kedua), kartu ringkasan (jumlah, bar proporsi kondisi, tombol filter Perlu
// perhatian/Baik/Belum dinilai), "Perlu perhatian" di atas lalu kotak 2 kolom, detail barang (ubah kondisi sendiri, datasheet,
// jadwal, Lapor kerusakan), Maintenance "Kerjakan" -> wajib foto/video sebelum Selesai aktif. Hanya barang lokasi divisi
// sendiri. Data & aksi: lib/inventarisOperator.ts; aturan tampilan: lib/inventarisAturan.ts (identik dgn admin).
// Realtime + pemulih (fokus/visibility/polling) lewat pasangPemulihRealtime (identik dgn vista-teknik).
// UKURAN px EKSPLISIT & color-scheme light (alasan sama KendalaOperator: index.css sisa template Vite).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { pasangPemulihRealtime } from '../lib/pemulihRealtime'
import { bacaAntreanFoto, dengarJumlahAntreanFoto } from '../lib/antreanFoto'
import { KONDISI, infoKondisi, STATUS_JADWAL, STATUS_LAPORAN, labelFrekuensi, fmtTanggal, fmtWaktu, teksSisaHari, laporanAktif, isVideo, isPdf,
  type Barang, type Jadwal, type Laporan, type Media, type UpdateLaporan } from '../lib/inventarisAturan'
import { muatInventarisDivisi, muatDariAdmin, DARI_ADMIN_HARI, type DariAdmin, setKondisiOperator, kirimLaporan, selesaikanJadwal, tambahBarangOperator, simpanLaporanOperator, RIWAYAT_HARI, buatKunci, type DataDivisi, type HasilKirim } from '../lib/inventarisOperator'
import { DIVISI_CONFIG } from '../lib/panelTypes'
import { MediaPickerSheet } from './ui/MediaPickerSheet'
import { ThumbMedia } from './ui/ThumbMedia'
import { FotoZoomViewerPekerja, type FotoViewerPekerja } from './FotoZoomViewerPekerja'

const db: any = supabase
type Tab = 'inventaris' | 'laporan' | 'maintenance' | 'riwayat'
const TABS: [Tab, string][] = [['inventaris', 'Inventaris'], ['laporan', 'Laporan'], ['maintenance', 'Maintenance'], ['riwayat', 'Riwayat']]
const PILIHAN_OPERATOR = ['baik', 'tidak_maksimal', 'perlu_maintenance']

const CSS = `
.ivo{--card:#fff;--fg:#16202e;--mute:#5d6b7e;--line:#dfe4ec;--bg:#f3f5f8;--acc:#1d4ed8;--acc-bg:#e3ebff;
  color-scheme:light;color:var(--fg);text-align:left;font-size:14px;line-height:1.4;letter-spacing:0;padding:12px 16px calc(72px + env(safe-area-inset-bottom,0px));width:100%;box-sizing:border-box;overflow-x:hidden}
.ivo *{box-sizing:border-box;letter-spacing:inherit}
.ivo button,.ivo select,.ivo textarea,.ivo input{font-family:inherit}
.ivo .t{margin:0 0 10px;font-size:18px;font-weight:700;line-height:1.3}
.ivo .hero{background:linear-gradient(135deg,#1d4ed8 0%,#4f46e5 100%);color:#fff;border-radius:16px;padding:14px;display:flex;flex-direction:column;gap:12px}
.ivo .hl{display:flex;justify-content:space-between;align-items:flex-end;gap:8px}
.ivo .hn{font-size:34px;font-weight:700;line-height:1}
.ivo .hs{font-size:12px;opacity:.88;margin-top:3px}
.ivo .hb{font-size:11px;background:rgba(255,255,255,.18);border-radius:99px;padding:4px 10px;font-weight:600;white-space:nowrap}
.ivo .seg{display:flex;height:8px;border-radius:99px;overflow:hidden;background:rgba(255,255,255,.2);gap:2px}
.ivo .seg i{display:block;min-width:0}
.ivo .hst{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.ivo .hst button{color:#fff;background:rgba(255,255,255,.14);border:1.5px solid transparent;border-radius:10px;padding:7px 4px;display:flex;flex-direction:column;align-items:center;gap:1px;cursor:pointer}
.ivo .hst button b{font-size:17px}.ivo .hst button span{font-size:10.5px;opacity:.92}
.ivo .hst button[aria-pressed="true"]{background:rgba(255,255,255,.3);border-color:#fff}
.ivo .carib{display:flex;gap:8px;align-items:center;margin:10px 0 2px}
.ivo .carib .cari{margin:0;flex:1;min-width:0}
.ivo .carib .btn{height:38px;padding:0 14px;white-space:nowrap}
.ivo input.isi{width:100%;height:40px;font-size:14px;color:var(--fg);background:var(--bg);border:1px solid var(--line);border-radius:9px;padding:0 10px}
.ivo .cari{width:100%;margin:10px 0 2px;height:38px;border:1px solid var(--line);border-radius:10px;padding:0 12px;font-size:14px;background:var(--card);color:var(--fg)}
.ivo .sec{display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--mute);margin:14px 0 6px}
.ivo .sec em{font-style:normal;background:#e8ecf2;border-radius:99px;padding:1px 8px;font-size:11px}
.ivo .g2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ivo .tile{text-align:left;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:10px;display:flex;flex-direction:column;gap:3px;cursor:pointer;min-width:0;color:var(--fg)}
.ivo .tile b{font-size:13px;font-weight:600;overflow-wrap:anywhere;line-height:1.25}
.ivo .tile small{font-size:11px;color:var(--mute);font-family:ui-monospace,Menlo,monospace}
.ivo .ib{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:10px;flex:none;font-size:18px}
.ivo .acard{width:100%;text-align:left;background:var(--card);border:1px solid var(--line);border-left-width:4px;border-radius:14px;padding:10px;display:flex;align-items:center;gap:10px;cursor:pointer;margin-bottom:8px;color:var(--fg)}
.ivo .acard .tx{display:flex;flex-direction:column;min-width:0;flex:1}
.ivo .acard .tx b{font-size:14px;overflow-wrap:anywhere}
.ivo .acard .tx small{font-size:11.5px;color:var(--mute);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ivo .bdg{font-size:10.5px;font-weight:700;border-radius:99px;padding:3px 8px;white-space:nowrap;flex:none}
.ivo .item{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:11px 12px;display:flex;flex-direction:column;gap:6px;margin-bottom:8px}
.ivo .item .r{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}
.ivo .item .it{font-weight:600;overflow-wrap:anywhere}
.ivo .mute{color:var(--mute);font-size:12px}
.ivo .mono{font-family:ui-monospace,Menlo,monospace;font-size:12px}
.ivo .btn{border:1px solid var(--line);background:var(--card);color:var(--fg);border-radius:10px;padding:9px 14px;font-size:13.5px;font-weight:600;cursor:pointer}
.ivo .btn.pri{background:var(--acc);border-color:var(--acc);color:#fff}
.ivo .btn:disabled{opacity:.45;cursor:not-allowed}
.ivo .full{width:100%;padding:12px}
.ivo .ko{display:block;width:100%;text-align:left;font-size:13.5px;font-weight:600;border:2px solid transparent;border-radius:9px;padding:10px 12px;margin-bottom:6px;cursor:pointer}
.ivo .ko[aria-pressed="true"]{border-color:currentColor}
.ivo .ko[aria-pressed="true"]::before{content:"\\2713  "}
.ivo textarea{width:100%;font-size:14px;color:var(--fg);background:var(--bg);border:1px solid var(--line);border-radius:9px;padding:9px}
.ivo .chips{display:flex;gap:6px;flex-wrap:wrap}
.ivo .chips button{border:1px solid var(--line);background:var(--card);color:var(--fg);border-radius:99px;padding:6px 11px;font-size:12.5px;cursor:pointer}
.ivo .chips button[aria-pressed="true"]{background:var(--acc-bg);color:var(--acc);border-color:var(--acc)}
.ivo .dok{border:1.5px dashed var(--line);border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:8px;background:var(--bg)}
.ivo .dok.need{border-color:#dc2626}
.ivo .fl{display:flex;gap:6px;flex-wrap:wrap}
.ivo .fl span{background:var(--acc-bg);color:var(--acc);border-radius:6px;padding:2px 8px;font-size:12px;display:inline-flex;gap:6px;align-items:center}
.ivo .fl button{border:0;background:none;color:#dc2626;font-weight:700;cursor:pointer;padding:0}
.ivo .toast{background:#dcf5e5;color:#15803d;border-radius:10px;padding:10px 12px;font-weight:600;margin-bottom:10px}
.ivo .err{background:#fde0e0;color:#b91c1c;border-radius:10px;padding:10px 12px;font-weight:600;margin-bottom:10px}
.ivo .hint{color:#b91c1c;font-size:12.5px}
.ivo .thumbs{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.ivo .thumbs .n{font-size:12px;color:var(--mute)}
.ivo .thumbs button{padding:0;background:none;cursor:pointer;display:block;width:54px;height:54px;border-radius:8px;overflow:hidden;border:1px solid var(--line);position:relative}
.ivo .thumbs button span{position:absolute;inset:0;display:grid;place-items:center;font-size:11px;font-weight:700;color:#b91c1c;background:#fde0e0}
.ivo .lbl{font-weight:700;font-size:13px;margin-bottom:4px}
.ivo .empty{padding:20px;text-align:center;color:var(--mute);font-size:13px}
/* tab atas (30 Okt 2026, permintaan user): satu baris di bawah tombol Kembali, sama rata, bisa digeser bila sempit, HANYA di
   halaman daftar. SENGAJA TIDAK sticky (revisi 30 Okt): halaman menu digulir oleh div overflowY:auto di App.tsx (bukan window),
   sticky dgn top = tinggi header dulu mendorong bar 169px ke bawah & menimpa form (bug HP user). */
.ivo-tab{display:flex;overflow-x:auto;scrollbar-width:none;background:#f1f5f9;border-bottom:1px solid #e2e8f0;padding:0 12px;color-scheme:light}
.ivo-tab::-webkit-scrollbar{display:none}
.ivo-tab button{flex:1 0 86px;border:0;border-bottom:3px solid transparent;background:none;padding:11px 6px 8px;font-size:13px;font-weight:700;color:#64748b;display:flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap;cursor:pointer;font-family:inherit;letter-spacing:0}
.ivo-tab button[aria-selected="true"]{color:var(--aksen);border-bottom-color:var(--aksen)}
.ivo-tab .n{min-width:18px;height:18px;line-height:18px;border-radius:9px;background:#dc2626;color:#fff;font-size:10.5px;font-weight:800;padding:0 5px;text-align:center}
`

const bdg = (warna: string, latar: string, label: string) => <span className="bdg" style={{ color: warna, background: latar }}>{label}</span>
const bdgKondisi = (k: string) => { const i = infoKondisi(k); return bdg(i.warna, i.latar, i.label) }
const pesanGalat = (e: any) => e?.message || String(e)
const ikon = (nama: string) => { const n = nama.toLowerCase(); return n.includes('spray') ? 'spray' : n.startsWith('bak') ? 'bath' : n.includes('oven') ? 'flame' : n.includes('crane') ? 'crane' : (n.includes('gerinda') || n.includes('cutting')) ? 'circle-dashed' : n.includes('bor') ? 'tool' : n.includes('las') ? 'bolt' : n.includes('laptop') || n.includes('pc') || n.includes('komputer') ? 'device-laptop' : 'settings' }
const kelompok = (k: string) => k === 'baik' ? 'ok' : k === 'belum_dinilai' ? 'none' : 'att'
const teksHasil = (h: HasilKirim, aksi: string) => [
  h.terkirim ? `${aksi}${h.terkirim > 1 ? ` (${h.terkirim} foto/video terkirim)` : ''}.` : '',
  h.diantrekan ? `${h.diantrekan} foto/video menunggu sinyal - tersimpan di HP dan terkirim otomatis${!h.terkirim ? '; selesai/laporan tercatat begitu foto pertama sampai' : ''}.` : '',
  h.gagal.length ? `Gagal: ${h.gagal.join('; ')}` : '',
].filter(Boolean).join(' ')

// Media dibuka DI DALAM aplikasi lewat FotoZoomViewerPekerja (sama dgn Proyek Luar/QC: geser, zoom, putar, video diputar
// di tempat, tutup ✕ / ketuk area kosong / usap ke bawah / tombol Kembali; PDF = kartu berkas + "Buka File"). Dulu <a target=_blank>
// -> di PWA standalone keluar ke browser. State penampil di InventarisOperatorView (agar tombol Kembali menutupnya dulu).
type Lihat = (media: Media[], mulai: number, label: string) => void
const keViewer = (m: Media): FotoViewerPekerja => ({ url: m.url, thumb: m.thumb || undefined, mime: m.mime || undefined, uploaded_at: m.dibuat_pada, uploaded_by: m.oleh || undefined, name: isPdf(m) ? m.url.split('/').pop() : undefined })
function Thumbs({ media, label, lihat }: { media: Media[]; label: string; lihat: Lihat }) {
  if (!media.length) return null
  return <div className="thumbs">{media.map((m, i) => <button key={m.id} type="button" onClick={() => lihat(media, i, label)}>
    {isPdf(m) ? <span>PDF</span> : <ThumbMedia url={m.url} thumb={m.thumb} video={isVideo(m)} />}</button>)}<span className="n">{media.length} berkas</span></div>
}
function PilihFile({ files, setFiles, label }: { files: File[]; setFiles: (f: File[]) => void; label: string }) {
  return <>
    {files.length > 0 && <div className="fl">{files.map((f, i) => <span key={i}>{f.name}<button type="button" aria-label="Buang" onClick={() => setFiles(files.filter((_, j) => j !== i))}>✕</button></span>)}</div>}
    <MediaPickerSheet allowVideo onFiles={fl => setFiles([...files, ...Array.from(fl)])} triggerClassName="btn">{label}</MediaPickerSheet>
  </>
}

export function InventarisOperatorView({ user, registerBackHandler }: { user: any; registerBackHandler?: (fn: (() => boolean) | null) => void }) {
  const [data, setData] = useState<DataDivisi | null>(null)
  const [galat, setGalat] = useState('')
  const [tab, setTab] = useState<Tab>('inventaris')
  const [barangId, setBarangId] = useState<number | null>(null)
  const [kerjaId, setKerjaId] = useState<number | null>(null)
  const [lapBarang, setLapBarang] = useState<number | null>(null)
  const [fil, setFil] = useState<'all' | 'att' | 'ok' | 'none'>('all')
  const [q, setQ] = useState('')
  const [pesan, setPesan] = useState('')
  const [tertunda, setTertunda] = useState<Set<number>>(new Set())   // jadwal yang "Selesai"-nya masih di antrean HP
  const aksen: string = DIVISI_CONFIG[user.divisi]?.color || '#1d4ed8'   // warna divisi = warna header aplikasi
  const [formLapor, setFormLapor] = useState(false)   // sub-halaman form Lapor kerusakan
  const [formTambah, setFormTambah] = useState(false) // sub-halaman form Tambah barang (tab Inventaris)
  const [lapId, setLapId] = useState<number | null>(null)   // sub-halaman detail laporan kerusakan
  // koreksi admin (dikembalikan/ditolak) - kartu "Dari admin"; yang sudah ditutup operator disimpan per HP (localStorage)
  const [dariAdmin, setDariAdmin] = useState<DariAdmin[]>([])
  const kunciTutup = 'vp_inv_dari_admin_tutup_' + user.divisi
  const [tertutup, setTertutup] = useState<number[]>(() => { try { return JSON.parse(localStorage.getItem(kunciTutup) || '[]') } catch { return [] } })
  const tutupDariAdmin = (id: number) => { const v = [...tertutup, id].slice(-300); setTertutup(v); try { localStorage.setItem(kunciTutup, JSON.stringify(v)) } catch { /* storage penuh/diblokir: hanya sesi ini */ } }
  const [penampil, setPenampil] = useState<{ fotos: FotoViewerPekerja[]; mulai: number; label: string } | null>(null)
  const lihat: Lihat = (media, mulai, label) => setPenampil({ fotos: media.map(keViewer), mulai, label: `${label} · ${media.length} berkas` })
  // pindah halaman/sub-halaman -> area gulir kembali ke atas (yang menggulir = div overflowY:auto di App, bukan window)
  const atasRef = useRef<HTMLDivElement>(null)
  const sudahMuncul = useRef(false)
  useEffect(() => {
    if (!sudahMuncul.current) { sudahMuncul.current = true; return }
    for (let el = atasRef.current?.parentElement; el; el = el.parentElement) {
      const oy = getComputedStyle(el).overflowY
      if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight) { el.scrollTop = 0; break }
    }
    window.scrollTo?.(0, 0)
  }, [tab, barangId, kerjaId, formLapor, formTambah, lapId])

  const muat = useCallback(async () => {
    try { const [d, a] = await Promise.all([muatInventarisDivisi(db, user.divisi), muatDariAdmin(db, user.divisi)]); setData(d); setDariAdmin(a); setGalat('') }
    catch (e: any) { console.error('[InventarisOperatorView] gagal memuat:', e); setGalat('Gagal memuat inventaris: ' + pesanGalat(e)) }
  }, [user.divisi])
  useEffect(() => { const t = setTimeout(muat, 0); return () => clearTimeout(t) }, [muat])
  useEffect(() => pasangPemulihRealtime(db, {
    nama: 'inventaris-operator-' + Math.random().toString(36).slice(2), label: 'Inventaris operator', jedaMs: 800, muat,
    tabel: ['inv_barang', 'inv_jadwal', 'inv_jadwal_selesai', 'inv_laporan', 'inv_laporan_update', 'inv_media', 'inv_notifikasi'],
  }), [muat])
  // antrean HP: tandai jadwal yang penyelesaiannya belum sampai server
  useEffect(() => dengarJumlahAntreanFoto(() => {
    bacaAntreanFoto().then(items => setTertunda(new Set(items.filter(i => i.tujuan.jenis === 'inv_selesai').map(i => i.tujuan.id))))
    muat()
  }), [muat])
  useEffect(() => {
    if (!registerBackHandler) return
    registerBackHandler(() => { if (penampil) { setPenampil(null); return true } if (formTambah) { setFormTambah(false); return true } if (lapId) { setLapId(null); return true } if (formLapor) { setFormLapor(false); setLapBarang(null); return true } if (kerjaId) { setKerjaId(null); return true } if (barangId) { setBarangId(null); return true } return false })
    return () => registerBackHandler(null)
  }, [registerBackHandler, kerjaId, barangId, formLapor, formTambah, penampil, lapId])
  useEffect(() => { if (!pesan) return; const t = setTimeout(() => setPesan(''), 6000); return () => clearTimeout(t) }, [pesan])

  const idx = useMemo(() => {
    if (!data) return null
    const media = new Map<string, Media[]>(); for (const m of data.media) { const k = m.tujuan + ':' + m.ref_id; media.set(k, [...(media.get(k) || []), m]) }
    return { barang: new Map(data.barang.map(b => [b.id, b])), media, lokasi: new Map(data.lokasi.map(l => [l.kode, l.nama])) }
  }, [data])
  const mediaDari = (tujuan: string, ref: number, peran?: string) => (idx?.media.get(tujuan + ':' + ref) || []).filter(m => !peran || m.peran === peran)
  const gantiTab = (t: Tab) => { setTab(t); setBarangId(null); setKerjaId(null); setFormLapor(false); setFormTambah(false); setLapId(null); setLapBarang(null); setQ('') }

  // badge tab: laporan aktif divisi & jadwal Terlambat+Segera (data yang sudah dimuat; tidak tampil bila 0)
  const badge: Record<Tab, number> = { inventaris: 0, riwayat: 0,
    laporan: data?.laporan.filter(laporanAktif).length || 0,
    maintenance: data?.jadwal.filter(j => j.status_jadwal === 'terlambat' || j.status_jadwal === 'segera').length || 0 }
  const diDaftar = !barangId && !kerjaId && !formLapor && !formTambah && !lapId   // bar tab hanya di halaman daftar; sub-halaman cukup tombol Kembali aplikasi
  const judul = tab === 'inventaris' ? (formTambah ? 'Tambah barang' : barangId ? 'Detail barang' : 'Inventaris divisi saya') : tab === 'laporan' ? (formLapor ? 'Lapor kerusakan' : lapId ? 'Detail laporan' : 'Laporan kerusakan aktif') : tab === 'maintenance' ? 'Maintenance' : 'Riwayat'
  let isi: any
  if (!data || !idx) isi = galat ? <div className="err">{galat} <button className="btn" onClick={muat}>Coba lagi</button></div> : <div className="empty">Memuat…</div>
  else if (!data.lokasi.length) isi = <div className="empty">Divisi ini belum punya lokasi inventaris.</div>
  else if (tab === 'inventaris' && formTambah) isi = <FormTambahBarang lokasi={data.lokasi} user={user}
    onSelesai={async (m: string, id: number) => { setFormTambah(false); setPesan(m); await muat(); setBarangId(id) }} />
  else if (tab === 'inventaris') isi = barangId && idx.barang.get(barangId) ? detailBarang(idx.barang.get(barangId)!) : daftarBarang()
  else if (tab === 'laporan') isi = formLapor
    ? <FormLaporan barang={data.barang} awal={lapBarang} user={user} onSelesai={async (m: string) => { setFormLapor(false); setLapBarang(null); setPesan(m); await muat() }} />
    : lapId && data.laporan.find(l => l.id === lapId) ? detailLaporan(data.laporan.find(l => l.id === lapId)!) : tabLaporan()
  else if (tab === 'maintenance') isi = kerjaId && data.jadwal.find(j => j.id === kerjaId) ? kerjakan(data.jadwal.find(j => j.id === kerjaId)!) : daftarJadwal()
  else isi = tabRiwayat()

  return <>
    <style>{CSS}</style>
    <div ref={atasRef} />
    {diDaftar && <div className="ivo-tab" role="tablist" style={{ ['--aksen' as any]: aksen }}>
      {TABS.map(([t, l]) => <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => gantiTab(t)}>
        {l}{badge[t] > 0 && <span className="n">{badge[t]}</span>}</button>)}
    </div>}
    <div className="ivo">
      <h2 className="t">{judul}</h2>
      {pesan && <div className="toast" role="status">{pesan}</div>}
      {data && galat && <div className="err">{galat}</div>}
      {isi}
    </div>
    {penampil && <FotoZoomViewerPekerja fotos={penampil.fotos} startIndex={penampil.mulai} label={penampil.label} onClose={() => setPenampil(null)} />}
  </>

  // ── bagian = fungsi render biasa (dipanggil, BUKAN <Komponen/>): komponen di dalam komponen dibuat ulang tiap render
  //    -> isian form di bawahnya hilang tiap muat ulang realtime/polling. State form ada di Form* tingkat atas.
  function daftarBarang() {
    const bs = data!.barang
    const g = { att: bs.filter(b => kelompok(b.kondisi) === 'att'), ok: bs.filter(b => kelompok(b.kondisi) === 'ok'), none: bs.filter(b => kelompok(b.kondisi) === 'none') }
    const cocok = (b: Barang) => !q || (b.nama + ' ' + (b.nomor_inventaris || '')).toLowerCase().includes(q.toLowerCase())
    const namaLok = data!.lokasi.map(l => l.nama).join(', ')
    const sec = (judulSec: string, arr: Barang[], kel: 'att' | 'ok' | 'none') => {
      const a = arr.filter(cocok)
      if (!a.length || (fil !== 'all' && fil !== kel)) return null
      return <div key={kel}><div className="sec"><span>{judulSec}</span><em>{a.length}</em></div>
        {kel === 'att' ? a.map(b => { const i = infoKondisi(b.kondisi)
          return <button key={b.id} type="button" className="acard" style={{ borderLeftColor: i.warna }} onClick={() => setBarangId(b.id)}>
            <span className="ib" style={{ background: i.latar, color: i.warna }}><i className={'ti ti-' + ikon(b.nama)} /></span>
            <span className="tx"><b>{b.nama}</b><small>{b.detail_kondisi || i.label}</small></span>{bdg(i.warna, i.latar, i.label)}</button> })
          : <div className="g2">{a.map(b => <button key={b.id} type="button" className="tile" onClick={() => setBarangId(b.id)}>
            <span className="ib" style={{ background: kel === 'ok' ? '#dcf5e5' : '#eef1f5', color: kel === 'ok' ? '#15803d' : '#64748b', marginBottom: 4 }}><i className={'ti ti-' + ikon(b.nama)} /></span>
            <b>{b.nama}</b><small>{b.nomor_inventaris || 'tanpa nomor'}</small></button>)}</div>}</div>
    }
    const tot = bs.length || 1
    const koreksi = dariAdmin.filter(n => !tertutup.includes(n.id))
    return <>
      {koreksi.length > 0 && <div className="item" style={{ borderColor: '#f59e0b', background: '#fffbeb' }}>
        <div className="lbl">Dari admin ({koreksi.length}) · {DARI_ADMIN_HARI} hari terakhir</div>
        {koreksi.map(n => <div key={n.id} className="r" style={{ borderTop: '1px solid #fde68a', paddingTop: 6 }}>
          <div><b>{n.keputusan === 'ditolak' ? 'Ditolak' : 'Dikembalikan'}:</b> {n.teks}
            <div className="mute">{n.diputuskan_oleh} · {fmtWaktu(n.diputuskan_pada)}{n.catatan_keputusan ? ' · "' + n.catatan_keputusan + '"' : ''}{n.oleh ? ' · tindakan ' + n.oleh : ''}</div></div>
          <button className="btn" type="button" style={{ padding: '4px 10px' }} onClick={() => tutupDariAdmin(n.id)} aria-label="Tutup">✕</button></div>)}
      </div>}
      <div className="hero">
        <div className="hl"><div><div className="hn">{bs.length}</div><div className="hs">barang di {namaLok}</div></div><div className="hb">Inventaris saya</div></div>
        <div className="seg" aria-hidden="true"><i style={{ flex: g.ok.length / tot, background: '#4ade80' }} /><i style={{ flex: g.att.length / tot, background: '#fbbf24' }} /><i style={{ flex: g.none.length / tot, background: 'rgba(255,255,255,.55)' }} /></div>
        <div className="hst">{([['att', 'Perlu perhatian', g.att.length], ['ok', 'Baik', g.ok.length], ['none', 'Belum dinilai', g.none.length]] as const).map(([k, l, n]) =>
          <button key={k} type="button" aria-pressed={fil === k} onClick={() => setFil(fil === k ? 'all' : k)}><b>{n}</b><span>{l}</span></button>)}</div>
      </div>
      <div className="carib"><input className="cari" type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="Cari barang atau nomor…" />
        <button className="btn pri" type="button" onClick={() => setFormTambah(true)}>+ Tambah</button></div>
      {sec('Perlu perhatian', g.att, 'att')}{sec('Berfungsi baik', g.ok, 'ok')}{sec('Belum dinilai', g.none, 'none')}
      {!bs.filter(cocok).length && <div className="empty">Tidak ada barang yang cocok.</div>}
    </>
  }

  function detailBarang(b: Barang) {
    const lapAktif = data!.laporan.filter(l => l.barang_id === b.id && laporanAktif(l))
    const jadwal = data!.jadwal.filter(j => j.barang_id === b.id)
    const ds = mediaDari('barang', b.id, 'datasheet'), foto = mediaDari('barang', b.id, 'foto')
    return <>
      <div className="item">
        <div className="r"><div><div className="it" style={{ fontSize: 16 }}>{b.nama}</div><div className="mono mute">{b.nomor_inventaris || 'tanpa nomor'}{b.kode_lama ? ' · ' + b.kode_lama : ''}</div></div>{bdgKondisi(b.kondisi)}</div>
        <div className="mute">{idx!.lokasi.get(b.lokasi_kode) || b.lokasi_kode}{b.pengguna ? ' · ' + b.pengguna : ''}{b.merk_spesifikasi ? ' · ' + b.merk_spesifikasi : ''}</div>
        {ds.length ? <Thumbs media={ds} label="Datasheet" lihat={lihat} /> : <div className="mute">Datasheet belum diunggah</div>}
        {b.nomor_seri && <div className="mute">Nomor seri {b.nomor_seri}</div>}
        {foto.length > 0 && <Thumbs media={foto} label={`Foto ${b.nama}`} lihat={lihat} />}
      </div>
      <div className="item">
        <div className="lbl">Kondisi barang saat ini</div>
        {lapAktif.length ? <div className="mute">Ada laporan kerusakan yang masih aktif ({lapAktif.map(l => l.judul).join(', ')}), jadi kondisi tercatat Rusak. Tutup laporannya (tab Laporan) setelah perbaikan selesai, sambil memilih kondisi barang.</div>
          : <FormKondisi b={b} user={user} onSelesai={async (m: string) => { setPesan(m); await muat() }} />}
        <div className="mute">Terakhir diubah {b.diperbarui_pada ? fmtTanggal(b.diperbarui_pada) : '-'}{b.pelapor ? ' oleh ' + b.pelapor : ''}</div>
      </div>
      {jadwal.length > 0 && <><div className="sec"><span>Jadwal barang ini</span><em>{jadwal.length}</em></div>{jadwal.map(j => <Fragment key={j.id}>{kartuJadwal(j)}</Fragment>)}</>}
      <div className="chips" style={{ marginTop: 6 }}><button type="button" onClick={() => { setLapBarang(b.id); setTab('laporan'); setBarangId(null); setFormLapor(true) }}>Lapor kerusakan</button></div>
    </>
  }

  function kartuJadwal(j: Jadwal) {
    const b = idx!.barang.get(j.barang_id)
    const st = STATUS_JADWAL[j.status_jadwal]
    const nunggu = tertunda.has(j.id)
    return <div className="item" style={j.status_jadwal === 'terlambat' && !j.selesai_hari_ini ? { borderColor: '#dc2626' } : undefined}>
      <div className="r"><div className="it">{j.jenis}</div>{j.selesai_hari_ini ? bdg('#15803d', '#dcf5e5', 'Selesai') : nunggu ? bdg('#1d4ed8', '#e3ebff', 'Menunggu sinyal') : bdg(st.warna, st.latar, st.label)}</div>
      <div className="mute">{b?.nama} · <span className="mono">{b?.nomor_inventaris || ''}</span> · {labelFrekuensi(j.frekuensi)}{j.teknisi ? ' · ' + j.teknisi : ''}</div>
      <div className="mute">Jatuh tempo {fmtTanggal(j.jatuh_tempo) || '-'}{j.jatuh_tempo ? ` (${teksSisaHari(j.jatuh_tempo)})` : ''}</div>
      {!j.selesai_hari_ini && !nunggu && <button className="btn pri" type="button" onClick={() => { setTab('maintenance'); setBarangId(null); setKerjaId(j.id) }}>Kerjakan</button>}
    </div>
  }

  function daftarJadwal() {
    const urut = [...data!.jadwal].sort((a, z) => {
      const p = (j: Jadwal) => j.selesai_hari_ini ? 3 : j.status_jadwal === 'terlambat' ? 0 : j.status_jadwal === 'segera' ? 1 : 2
      return p(a) - p(z) || (a.jatuh_tempo || '9').localeCompare(z.jatuh_tempo || '9')
    })
    if (!urut.length) return <div className="empty">Belum ada jadwal maintenance untuk divisi ini.</div>
    return <>{urut.map(j => <Fragment key={j.id}>{kartuJadwal(j)}</Fragment>)}</>
  }

  function kerjakan(j: Jadwal) {
    return <>
      <FormKerjakan j={j} b={idx!.barang.get(j.barang_id)} user={user} onSelesai={async (m: string) => { setKerjaId(null); setPesan(m); await muat() }} />
    </>
  }

  // (30 Okt 2026) hanya laporan AKTIF (open/in_progress); yang sudah ditutup ada di Riwayat. Ketuk kartu -> detail (update/tutup).
  function tabLaporan() {
    const lap = data!.laporan.filter(laporanAktif).sort((a, z) => z.dibuat_pada.localeCompare(a.dibuat_pada))
    return <>
      <button className="btn pri full" type="button" onClick={() => { setLapBarang(null); setFormLapor(true) }}>+ Lapor kerusakan</button>
      <div className="sec"><span>Laporan aktif divisi</span><em>{lap.length}</em></div>
      {!lap.length && <div className="empty">Tidak ada laporan kerusakan aktif. Laporan yang sudah ditutup ada di Riwayat.</div>}
      {lap.map(l => { const st = STATUS_LAPORAN[l.status], b = idx!.barang.get(l.barang_id), n = data!.update.filter(u => u.laporan_id === l.id).length
        return <button key={l.id} type="button" className="acard" style={{ borderLeftColor: st.warna }} onClick={() => setLapId(l.id)}>
          <span className="tx"><b>{l.judul}</b><small>{b?.nama} · {fmtTanggal(l.dibuat_pada)} · {l.pelapor}{n ? ` · ${n} update` : ''}</small></span>{bdg(st.warna, st.latar, st.label)}</button> })}
    </>
  }

  function detailLaporan(l: Laporan) {
    const b = idx!.barang.get(l.barang_id)
    const upd = data!.update.filter(u => u.laporan_id === l.id)
    const lainAktif = data!.laporan.some(x => x.id !== l.id && x.barang_id === l.barang_id && laporanAktif(x))
    return <>
      {kartuLaporan(l, upd)}
      {laporanAktif(l) ? <FormLaporanOperator key={l.id} l={l} lainAktif={lainAktif} user={user}
          onSelesai={async (m: string, tutup: boolean) => { if (tutup) setLapId(null); setPesan(m); await muat() }} />
        : <div className="mute">Laporan ini sudah ditutup{l.ditutup_oleh ? ' oleh ' + l.ditutup_oleh : ''}. Membuka kembali hanya lewat admin.</div>}
      {b && <div className="mute">Barang: {b.nama} {b.nomor_inventaris ? '· ' + b.nomor_inventaris : ''} · kondisi {infoKondisi(b.kondisi).label}</div>}
    </>
  }

  function kartuLaporan(l: Laporan, upd: UpdateLaporan[]) {
    const st = STATUS_LAPORAN[l.status], b = idx!.barang.get(l.barang_id)
    return <div className="item">
      <div className="r"><div className="it">{l.judul}</div>{bdg(st.warna, st.latar, st.label)}</div>
      <div className="mute">{b?.nama} · {fmtTanggal(l.dibuat_pada)} · {l.pelapor}</div>
      {l.masalah && l.masalah !== l.judul && <div className="mute" style={{ whiteSpace: 'pre-wrap' }}>{l.masalah}</div>}
      <Thumbs media={[...mediaDari('laporan', l.id, 'sebelum'), ...mediaDari('laporan', l.id, 'lama')]} label="Sebelum" lihat={lihat} />
      {upd.map(u => <Fragment key={u.id}><div className="mute">↳ {fmtWaktu(u.waktu)} {u.oleh}{u.status_ke ? ` · ${STATUS_LAPORAN[u.status_ke as Laporan['status']]?.label || u.status_ke}` : ''}{u.catatan ? ': ' + u.catatan : ''}</div>
        <Thumbs media={mediaDari('laporan_update', u.id)} label={`Update ${u.oleh}`} lihat={lihat} /></Fragment>)}
      {l.status === 'closed' && <><div className="mute">Sesudah perbaikan{l.perbaikan ? ': ' + l.perbaikan : ''}</div><Thumbs media={mediaDari('laporan', l.id, 'sesudah')} label="Sesudah" lihat={lihat} /></>}
    </div>
  }

  function tabRiwayat() {
    const ev = [
      ...data!.selesai.map(s => ({ k: 's' + s.id, tgl: s.tanggal, jenis: 'Rutin', judul: data!.jadwal.find(j => j.id === s.jadwal_id)?.jenis || 'Maintenance rutin',
        ket: `${idx!.barang.get(s.barang_id)?.nama || ''} · oleh ${s.oleh}${s.tanpa_dokumentasi ? ' · tanpa dokumentasi' : ''}`, media: mediaDari('jadwal_selesai', s.id) })),
      ...data!.laporan.map(l => ({ k: 'l' + l.id, tgl: l.dibuat_pada.slice(0, 10), jenis: 'Kerusakan', judul: l.judul,
        ket: `${idx!.barang.get(l.barang_id)?.nama || ''} · ${STATUS_LAPORAN[l.status].label}`,
        media: [...mediaDari('laporan', l.id, 'sebelum'), ...mediaDari('laporan', l.id, 'lama'), ...mediaDari('laporan', l.id, 'sesudah')] })),
    ].sort((a, z) => z.tgl.localeCompare(a.tgl))
    return <>
      <div className="mute" style={{ marginBottom: 8 }}>Maintenance {RIWAYAT_HARI} hari terakhir & semua laporan divisi.</div>
      {!ev.length && <div className="empty">Belum ada riwayat.</div>}
      {ev.map(e => <div key={e.k} className="item"><div className="r"><div className="it">{e.judul}</div>{e.jenis === 'Rutin' ? bdg('#64748b', '#eef1f5', 'Rutin') : bdg('#6d28d9', '#ece3ff', 'Kerusakan')}</div>
        <div className="mute">{fmtTanggal(e.tgl)} · {e.ket}</div><Thumbs media={e.media} label={`${e.judul} ${fmtTanggal(e.tgl)}`} lihat={lihat} /></div>)}
    </>
  }
}

// ── form (komponen tingkat atas: isian tidak hilang saat data dimuat ulang realtime/polling) ──
// Tambah barang (30 Okt 2026): lokasi = lokasi divisi (terkunci di server); >1 lokasi -> pilih. Nama wajib. Kondisi 3 pilihan
// operator (bukan Rusak - rusak lewat Lapor kerusakan). kunci tetap sampai berhasil: ketuk ulang setelah galat = barang yang sama.
function FormTambahBarang({ lokasi, user, onSelesai }: { lokasi: { kode: string; nama: string }[]; user: any; onSelesai: (pesan: string, id: number) => Promise<void> }) {
  const [f, setF] = useState({ nama: '', merk_spesifikasi: '', nomor_seri: '', kondisi: 'baik', detail_kondisi: '' })
  const [lok, setLok] = useState(lokasi.length === 1 ? lokasi[0].kode : '')
  const [files, setFiles] = useState<File[]>([])
  const [kunci] = useState(() => buatKunci())
  const [sibuk, setSibuk] = useState('')
  const [galat, setGalat] = useState('')
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  const kirim = async () => {
    if (!f.nama.trim()) { setGalat('Nama barang wajib diisi.'); return }
    if (!lok) { setGalat('Pilih lokasi barang.'); return }
    setSibuk('Menyimpan…'); setGalat('')
    try {
      const h = await tambahBarangOperator(supabase, user, { ...f, nama: f.nama.trim(), lokasi_kode: lok }, files, kunci, (s, t) => setSibuk(`Mengirim foto ${s}/${t}…`))
      await onSelesai(`${h.barang.nama} tersimpan${h.barang.nomor_inventaris ? ' dengan nomor ' + h.barang.nomor_inventaris : ''}. Admin akan memeriksa datanya.`
        + (files.length ? ' ' + teksHasil(h, 'Foto/video terkirim') : ''), h.barang.id)
    } catch (e: any) { setGalat(pesanGalat(e) + ' - barang BELUM tersimpan, coba lagi.') } finally { setSibuk('') }
  }
  return <div className="item" style={{ gap: 9 }}>
    <div className="lbl">Lokasi</div>
    {lokasi.length === 1 ? <div className="mute">{lokasi[0].nama} (lokasi divisi Anda) · nomor inventaris dibuat otomatis</div>
      : <div className="chips">{lokasi.map(l => <button key={l.kode} type="button" aria-pressed={lok === l.kode} onClick={() => setLok(l.kode)}>{l.nama}</button>)}</div>}
    <div className="lbl" style={{ marginTop: 4 }}>Nama barang *</div>
    <input className="isi" type="text" value={f.nama} onChange={set('nama')} placeholder="Contoh: Bor tangan Makita" />
    <div className="lbl" style={{ marginTop: 4 }}>Merk / spesifikasi</div>
    <input className="isi" type="text" value={f.merk_spesifikasi} onChange={set('merk_spesifikasi')} placeholder="Opsional" />
    <div className="lbl" style={{ marginTop: 4 }}>Nomor seri</div>
    <input className="isi" type="text" value={f.nomor_seri} onChange={set('nomor_seri')} placeholder="Opsional" />
    <div className="lbl" style={{ marginTop: 4 }}>Kondisi</div>
    <div>{PILIHAN_OPERATOR.map(k => { const i = KONDISI.find(x => x.kode === k)!
      return <button key={k} type="button" className="ko" aria-pressed={f.kondisi === k} style={{ color: i.warna, background: i.latar }} onClick={() => setF({ ...f, kondisi: k })}>{i.label}</button> })}</div>
    <textarea rows={2} value={f.detail_kondisi} onChange={set('detail_kondisi')} placeholder="Detail kondisi (opsional)" />
    <PilihFile files={files} setFiles={setFiles} label="+ Foto barang (opsional)" />
    {galat && <div className="hint">{galat}</div>}
    <button className="btn pri full" type="button" disabled={!!sibuk} onClick={kirim}>{sibuk || 'Simpan barang'}</button>
  </div>
}

// Update / ubah status / tutup laporan kerusakan oleh operator (30 Okt 2026). Tutup = foto/video sesudah WAJIB + kondisi barang
// setelah perbaikan (default Berfungsi baik; server menerapkannya hanya bila tidak ada laporan aktif lain). Butuh sinyal.
function FormLaporanOperator({ l, lainAktif, user, onSelesai }: { l: Laporan; lainAktif: boolean; user: any; onSelesai: (pesan: string, tutup: boolean) => Promise<void> }) {
  const [status, setStatus] = useState<Laporan['status']>(l.status)
  const [catatan, setCatatan] = useState('')
  const [perbaikan, setPerbaikan] = useState('')
  const [kondisi, setKondisi] = useState('baik')
  const [files, setFiles] = useState<File[]>([])
  const [sibuk, setSibuk] = useState('')
  const [galat, setGalat] = useState('')
  const tutup = status === 'closed'
  const kirim = async () => {
    if (tutup && !files.length) { setGalat('Tambahkan minimal satu foto/video sesudah perbaikan.'); return }
    if (!tutup && status === l.status && !catatan.trim() && !files.length) { setGalat('Tulis catatan atau tambahkan foto dulu.'); return }
    setSibuk('Menyimpan…'); setGalat('')
    try {
      await simpanLaporanOperator(supabase, user, l, { status, catatan, perbaikan, kondisi, files }, (s, t) => setSibuk(`Mengirim foto ${s}/${t}…`))
      setCatatan(''); setPerbaikan(''); setFiles([])
      await onSelesai(tutup ? `Laporan ditutup.${lainAktif ? ' Barang masih Rusak karena ada laporan aktif lain.' : ' Kondisi barang: ' + infoKondisi(kondisi).label + '.'}`
        : status !== l.status ? `Status laporan: ${STATUS_LAPORAN[status].label}.` : 'Update tersimpan.', tutup)
    } catch (e: any) { setGalat(pesanGalat(e) + ' - belum tersimpan, coba lagi.') } finally { setSibuk('') }
  }
  return <div className="item" style={{ gap: 9 }}>
    <div className="lbl">Status</div>
    <div className="chips">{(['open', 'in_progress', 'closed'] as const).map(k => <button key={k} type="button" aria-pressed={status === k}
      onClick={() => { setStatus(k); setGalat('') }}>{k === 'closed' ? 'Selesai - tutup laporan' : STATUS_LAPORAN[k].label}</button>)}</div>
    <textarea rows={2} value={catatan} onChange={e => setCatatan(e.target.value)} placeholder={tutup ? 'Catatan (opsional)' : 'Update: apa yang sudah dikerjakan?'} />
    {tutup && <>
      <input className="isi" type="text" value={perbaikan} onChange={e => setPerbaikan(e.target.value)} placeholder="Perbaikan yang dilakukan (opsional)" />
      <div className="lbl" style={{ marginTop: 4 }}>Kondisi barang setelah perbaikan</div>
      <div>{PILIHAN_OPERATOR.map(k => { const i = KONDISI.find(x => x.kode === k)!
        return <button key={k} type="button" className="ko" aria-pressed={kondisi === k} style={{ color: i.warna, background: i.latar }} onClick={() => setKondisi(k)}>{i.label}</button> })}</div>
      {lainAktif && <div className="hint">Masih ada laporan aktif lain untuk barang ini - kondisi tetap Rusak sampai semuanya ditutup.</div>}
    </>}
    <PilihFile files={files} setFiles={f => { setFiles(f); setGalat('') }} label={tutup ? '+ Foto/video sesudah perbaikan (wajib)' : '+ Foto/video (opsional)'} />
    {galat && <div className="hint">{galat}</div>}
    <button className="btn pri full" type="button" disabled={!!sibuk} onClick={kirim}>{sibuk || (tutup ? 'Tutup laporan' : 'Simpan')}</button>
  </div>
}

function FormKondisi({ b, user, onSelesai }: { b: Barang; user: any; onSelesai: (pesan: string) => Promise<void> }) {
  const [pilih, setPilih] = useState(PILIHAN_OPERATOR.includes(b.kondisi) ? b.kondisi : '')
  const [detail, setDetail] = useState(b.detail_kondisi || '')
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState('')
  const simpan = async () => {
    if (!pilih) { setGalat('Pilih kondisinya dulu.'); return }
    setSibuk(true); setGalat('')
    try { await setKondisiOperator(supabase, user, b, pilih, detail); await onSelesai(`Kondisi tersimpan: ${infoKondisi(pilih).label}. Admin bisa melihatnya langsung.`) }
    catch (e: any) { setGalat(pesanGalat(e)) } finally { setSibuk(false) }
  }
  return <>
    <div className="mute" style={{ margin: '0 0 8px' }}>Anda yang paling tahu kondisinya. Pilih yang sesuai; admin hanya membantu membenarkan bila ada salah.</div>
    {PILIHAN_OPERATOR.map(k => { const i = KONDISI.find(x => x.kode === k)!
      return <button key={k} type="button" className="ko" aria-pressed={pilih === k} style={{ color: i.warna, background: i.latar }} onClick={() => setPilih(k)}>{i.label}</button> })}
    <textarea rows={2} value={detail} onChange={e => setDetail(e.target.value)} placeholder="Detail kondisi (opsional), misalnya: selang bocor, perlu ganti" />
    {galat && <div className="hint">{galat}</div>}
    <button className="btn pri full" type="button" disabled={sibuk} onClick={simpan} style={{ marginTop: 8 }}>{sibuk ? 'Menyimpan…' : 'Simpan kondisi'}</button>
    <div className="mute" style={{ marginTop: 6 }}>Rusak? Pakai tombol "Lapor kerusakan" di bawah.</div>
  </>
}

function FormKerjakan({ j, b, user, onSelesai }: { j: Jadwal; b?: Barang; user: any; onSelesai: (pesan: string) => Promise<void> }) {
  const [files, setFiles] = useState<File[]>([])
  const [catatan, setCatatan] = useState('')
  const [sibuk, setSibuk] = useState('')
  const [galat, setGalat] = useState('')
  const ok = files.length > 0
  const selesai = async () => {
    setSibuk('Menyiapkan…'); setGalat('')
    try {
      const h = await selesaikanJadwal(user, j, catatan, files, (s, t) => setSibuk(`Mengirim ${s}/${t}…`))
      if (!h.terkirim && !h.diantrekan) { setGalat(h.gagal.join('; ') || 'Tidak ada foto yang terkirim.'); return }
      await onSelesai(teksHasil(h, 'Tugas selesai. Nama Anda, waktu, dan dokumentasi tercatat'))
    } catch (e: any) { setGalat(pesanGalat(e)) } finally { setSibuk('') }
  }
  return <>
    <div className="item"><div className="it">{j.jenis}</div><div className="mute">{b?.nama} · <span className="mono">{b?.nomor_inventaris || ''}</span></div>
      <div className="mute">Jatuh tempo {fmtTanggal(j.jatuh_tempo) || '-'}{j.catatan ? ' · ' + j.catatan : ''}</div></div>
    <div className={'dok' + (ok ? '' : ' need')}>
      <div className="lbl">Dokumentasi (wajib)</div>
      <div className="mute">Ambil foto atau video pekerjaan sebelum menandai selesai.</div>
      <PilihFile files={files} setFiles={setFiles} label="+ Foto/video" />
    </div>
    <textarea rows={2} value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="Catatan (opsional)" style={{ marginTop: 8 }} />
    {galat && <div className="hint">{galat}</div>}
    <button className="btn pri full" type="button" style={{ marginTop: 8 }} disabled={!ok || !!sibuk} onClick={selesai}>{sibuk || 'Tandai selesai'}</button>
    {!ok && <div className="hint" style={{ marginTop: 4 }}>Tambahkan minimal satu foto atau video dulu.</div>}
  </>
}

function FormLaporan({ barang, awal, user, onSelesai }: { barang: Barang[]; awal: number | null; user: any; onSelesai: (pesan: string) => Promise<void> }) {
  const [pilih, setPilih] = useState<number | null>(awal)
  const [masalah, setMasalah] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [kunci, setKunci] = useState(() => buatKunci())
  const [sibuk, setSibuk] = useState('')
  const [galat, setGalat] = useState('')
  const [cari, setCari] = useState('')
  const b = barang.find(x => x.id === pilih)
  const kirim = async () => {
    if (!b) { setGalat('Pilih barangnya dulu.'); return }
    if (!masalah.trim()) { setGalat('Tuliskan masalahnya.'); return }
    setSibuk('Mengirim…'); setGalat('')
    try {
      const h = await kirimLaporan(supabase, user, b, masalah.trim(), files, kunci, (s, t) => setSibuk(`Mengirim foto ${s}/${t}…`))
      setMasalah(''); setFiles([]); setKunci(buatKunci()); setPilih(null)
      await onSelesai(`Laporan terkirim ke admin (status Open, kondisi ${b.nama} menjadi Rusak).` + (files.length ? ' ' + teksHasil(h, 'Foto/video terkirim') : ''))
    } catch (e: any) { setGalat(pesanGalat(e) + ' - laporan BELUM terkirim, coba lagi.') } finally { setSibuk('') }
  }
  const daftar = barang.filter(x => !cari || (x.nama + ' ' + (x.nomor_inventaris || '')).toLowerCase().includes(cari.toLowerCase()))
  return <div className="item" style={{ gap: 9 }}>
    <div className="lbl">Barang</div>
    {b ? <div className="r"><div><b>{b.nama}</b> <span className="mono mute">{b.nomor_inventaris || ''}</span></div><button className="btn" type="button" onClick={() => setPilih(null)}>Ganti</button></div>
      : <><input className="cari" style={{ margin: 0 }} type="text" value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari barang…" />
        <div className="chips" style={{ maxHeight: 180, overflowY: 'auto' }}>{daftar.map(x => <button key={x.id} type="button" aria-pressed={false} onClick={() => setPilih(x.id)}>{x.nama}</button>)}</div></>}
    <div className="lbl" style={{ marginTop: 4 }}>Apa masalahnya?</div>
    <textarea rows={3} value={masalah} onChange={e => setMasalah(e.target.value)} placeholder="Contoh: bak mampet, air tidak mengalir" />
    <PilihFile files={files} setFiles={setFiles} label="+ Foto/video (disarankan)" />
    {galat && <div className="hint">{galat}</div>}
    <button className="btn pri full" type="button" disabled={!!sibuk} onClick={kirim}>{sibuk || 'Kirim laporan'}</button>
  </div>
}
