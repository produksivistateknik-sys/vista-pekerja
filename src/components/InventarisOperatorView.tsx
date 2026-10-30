// INVENTARIS & MAINTENANCE - MENU OPERATOR HP (T3, 30 Okt 2026). Pengganti scan QR /mesin (halaman lama tetap ada sampai
// T4). Acuan tampilan: pratinjau "maintenance-mesin.html" yang disepakati user - navigasi Inventaris/Laporan/Maintenance/
// Riwayat (menempel di atas bottom nav aplikasi), kartu ringkasan (jumlah, bar proporsi kondisi, tombol filter Perlu
// perhatian/Baik/Belum dinilai), "Perlu perhatian" di atas lalu kotak 2 kolom, detail barang (ubah kondisi sendiri, datasheet,
// jadwal, Lapor kerusakan), Maintenance "Kerjakan" -> wajib foto/video sebelum Selesai aktif. Hanya barang lokasi divisi
// sendiri. Data & aksi: lib/inventarisOperator.ts; aturan tampilan: lib/inventarisAturan.ts (identik dgn admin).
// Realtime + pemulih (fokus/visibility/polling) lewat pasangPemulihRealtime (identik dgn vista-teknik).
// UKURAN px EKSPLISIT & color-scheme light (alasan sama KendalaOperator: index.css sisa template Vite).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { pasangPemulihRealtime } from '../lib/pemulihRealtime'
import { bacaAntreanFoto, dengarJumlahAntreanFoto } from '../lib/antreanFoto'
import { KONDISI, infoKondisi, STATUS_JADWAL, STATUS_LAPORAN, labelFrekuensi, fmtTanggal, fmtWaktu, teksSisaHari, laporanAktif, isVideo, isPdf,
  type Barang, type Jadwal, type Laporan, type Media } from '../lib/inventarisAturan'
import { muatInventarisDivisi, setKondisiOperator, kirimLaporan, selesaikanJadwal, RIWAYAT_HARI, buatKunci, type DataDivisi, type HasilKirim } from '../lib/inventarisOperator'
import { MediaPickerSheet } from './ui/MediaPickerSheet'
import { ThumbMedia } from './ui/ThumbMedia'

const db: any = supabase
type Tab = 'inventaris' | 'laporan' | 'maintenance' | 'riwayat'
const TABS: [Tab, string, string][] = [['inventaris', 'Inventaris', 'box'], ['laporan', 'Laporan', 'alert-triangle'], ['maintenance', 'Maintenance', 'tool'], ['riwayat', 'Riwayat', 'history']]
const PILIHAN_OPERATOR = ['baik', 'tidak_maksimal', 'perlu_maintenance']

const CSS = `
.ivo{--card:#fff;--fg:#16202e;--mute:#5d6b7e;--line:#dfe4ec;--bg:#f3f5f8;--acc:#1d4ed8;--acc-bg:#e3ebff;
  color-scheme:light;color:var(--fg);text-align:left;font-size:14px;line-height:1.4;letter-spacing:0;padding:12px 16px 24px;width:100%;overflow-x:hidden}
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
.ivo .back{border:0;background:none;color:var(--acc);padding:2px 0 8px;font-weight:600;font-size:13.5px;cursor:pointer}
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
.ivo .thumbs{display:flex;gap:6px;flex-wrap:wrap}
.ivo .thumbs a{display:block;width:54px;height:54px;border-radius:8px;overflow:hidden;border:1px solid var(--line);position:relative}
.ivo .thumbs a span{position:absolute;inset:0;display:grid;place-items:center;font-size:11px;font-weight:700;color:#b91c1c;background:#fde0e0}
.ivo .lbl{font-weight:700;font-size:13px;margin-bottom:4px}
.ivo .empty{padding:20px;text-align:center;color:var(--mute);font-size:13px}
.ivo-nav{position:sticky;bottom:calc(58px + env(safe-area-inset-bottom,0px));z-index:90;display:flex;background:#fff;border-top:1px solid #e5e9f0;box-shadow:0 -3px 10px #0000000d;margin-top:8px}
.ivo-nav button{flex:1;border:0;background:none;padding:9px 2px 8px;font-size:11px;font-weight:700;color:#94a3b8;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;font-family:inherit}
.ivo-nav button i{font-size:18px}
.ivo-nav button[aria-selected="true"]{color:#1d4ed8;box-shadow:inset 0 2px 0 #1d4ed8}
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

function Thumbs({ media }: { media: Media[] }) {
  if (!media.length) return null
  return <div className="thumbs">{media.map(m => <a key={m.id} href={m.url} target="_blank" rel="noreferrer">
    {isPdf(m) ? <span>PDF</span> : <ThumbMedia url={m.url} thumb={m.thumb} video={isVideo(m)} />}</a>)}</div>
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

  const muat = useCallback(async () => {
    try { setData(await muatInventarisDivisi(db, user.divisi)); setGalat('') }
    catch (e: any) { console.error('[InventarisOperatorView] gagal memuat:', e); setGalat('Gagal memuat inventaris: ' + pesanGalat(e)) }
  }, [user.divisi])
  useEffect(() => { const t = setTimeout(muat, 0); return () => clearTimeout(t) }, [muat])
  useEffect(() => pasangPemulihRealtime(db, {
    nama: 'inventaris-operator-' + Math.random().toString(36).slice(2), label: 'Inventaris operator', jedaMs: 800, muat,
    tabel: ['inv_barang', 'inv_jadwal', 'inv_jadwal_selesai', 'inv_laporan', 'inv_laporan_update', 'inv_media'],
  }), [muat])
  // antrean HP: tandai jadwal yang penyelesaiannya belum sampai server
  useEffect(() => dengarJumlahAntreanFoto(() => {
    bacaAntreanFoto().then(items => setTertunda(new Set(items.filter(i => i.tujuan.jenis === 'inv_selesai').map(i => i.tujuan.id))))
    muat()
  }), [muat])
  useEffect(() => {
    if (!registerBackHandler) return
    registerBackHandler(() => { if (kerjaId) { setKerjaId(null); return true } if (barangId) { setBarangId(null); return true } return false })
    return () => registerBackHandler(null)
  }, [registerBackHandler, kerjaId, barangId])
  useEffect(() => { if (!pesan) return; const t = setTimeout(() => setPesan(''), 6000); return () => clearTimeout(t) }, [pesan])

  const idx = useMemo(() => {
    if (!data) return null
    const media = new Map<string, Media[]>(); for (const m of data.media) { const k = m.tujuan + ':' + m.ref_id; media.set(k, [...(media.get(k) || []), m]) }
    return { barang: new Map(data.barang.map(b => [b.id, b])), media, lokasi: new Map(data.lokasi.map(l => [l.kode, l.nama])) }
  }, [data])
  const mediaDari = (tujuan: string, ref: number, peran?: string) => (idx?.media.get(tujuan + ':' + ref) || []).filter(m => !peran || m.peran === peran)
  const gantiTab = (t: Tab) => { setTab(t); setBarangId(null); setKerjaId(null); setQ(''); window.scrollTo?.(0, 0) }

  const judul = tab === 'inventaris' ? (barangId ? 'Detail barang' : 'Inventaris divisi saya') : tab === 'laporan' ? 'Laporan kerusakan' : tab === 'maintenance' ? 'Maintenance' : 'Riwayat'
  let isi: any
  if (!data || !idx) isi = galat ? <div className="err">{galat} <button className="btn" onClick={muat}>Coba lagi</button></div> : <div className="empty">Memuat…</div>
  else if (!data.lokasi.length) isi = <div className="empty">Divisi ini belum punya lokasi inventaris.</div>
  else if (tab === 'inventaris') isi = barangId && idx.barang.get(barangId) ? detailBarang(idx.barang.get(barangId)!) : daftarBarang()
  else if (tab === 'laporan') isi = tabLaporan()
  else if (tab === 'maintenance') isi = kerjaId && data.jadwal.find(j => j.id === kerjaId) ? kerjakan(data.jadwal.find(j => j.id === kerjaId)!) : daftarJadwal()
  else isi = tabRiwayat()

  return <>
    <style>{CSS}</style>
    <div className="ivo">
      <h2 className="t">{judul}</h2>
      {pesan && <div className="toast" role="status">{pesan}</div>}
      {data && galat && <div className="err">{galat}</div>}
      {isi}
    </div>
    <nav className="ivo-nav" role="tablist">{TABS.map(([t, l, i]) => <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => gantiTab(t)}><i className={'ti ti-' + i} />{l}</button>)}</nav>
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
    return <>
      <div className="hero">
        <div className="hl"><div><div className="hn">{bs.length}</div><div className="hs">barang di {namaLok}</div></div><div className="hb">Inventaris saya</div></div>
        <div className="seg" aria-hidden="true"><i style={{ flex: g.ok.length / tot, background: '#4ade80' }} /><i style={{ flex: g.att.length / tot, background: '#fbbf24' }} /><i style={{ flex: g.none.length / tot, background: 'rgba(255,255,255,.55)' }} /></div>
        <div className="hst">{([['att', 'Perlu perhatian', g.att.length], ['ok', 'Baik', g.ok.length], ['none', 'Belum dinilai', g.none.length]] as const).map(([k, l, n]) =>
          <button key={k} type="button" aria-pressed={fil === k} onClick={() => setFil(fil === k ? 'all' : k)}><b>{n}</b><span>{l}</span></button>)}</div>
      </div>
      <input className="cari" type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="Cari barang atau nomor…" />
      {sec('Perlu perhatian', g.att, 'att')}{sec('Berfungsi baik', g.ok, 'ok')}{sec('Belum dinilai', g.none, 'none')}
      {!bs.filter(cocok).length && <div className="empty">Tidak ada barang yang cocok.</div>}
    </>
  }

  function detailBarang(b: Barang) {
    const lapAktif = data!.laporan.filter(l => l.barang_id === b.id && laporanAktif(l))
    const jadwal = data!.jadwal.filter(j => j.barang_id === b.id)
    const ds = mediaDari('barang', b.id, 'datasheet')
    return <>
      <button className="back" type="button" onClick={() => setBarangId(null)}>← Daftar inventaris</button>
      <div className="item">
        <div className="r"><div><div className="it" style={{ fontSize: 16 }}>{b.nama}</div><div className="mono mute">{b.nomor_inventaris || 'tanpa nomor'}{b.kode_lama ? ' · ' + b.kode_lama : ''}</div></div>{bdgKondisi(b.kondisi)}</div>
        <div className="mute">{idx!.lokasi.get(b.lokasi_kode) || b.lokasi_kode}{b.pengguna ? ' · ' + b.pengguna : ''}{b.merk_spesifikasi ? ' · ' + b.merk_spesifikasi : ''}</div>
        <div className="mute">{ds.length ? ds.map(m => <a key={m.id} href={m.url} target="_blank" rel="noreferrer" style={{ marginRight: 10 }}>Datasheet PDF</a>) : 'Datasheet belum diunggah'}</div>
      </div>
      <div className="item">
        <div className="lbl">Kondisi barang saat ini</div>
        {lapAktif.length ? <div className="mute">Ada laporan kerusakan yang masih aktif ({lapAktif.map(l => l.judul).join(', ')}), jadi kondisi tercatat Rusak. Admin menutup laporan setelah perbaikan selesai.</div>
          : <FormKondisi b={b} user={user} onSelesai={async (m: string) => { setPesan(m); await muat() }} />}
        <div className="mute">Terakhir diubah {b.diperbarui_pada ? fmtTanggal(b.diperbarui_pada) : '-'}{b.pelapor ? ' oleh ' + b.pelapor : ''}</div>
      </div>
      {jadwal.length > 0 && <><div className="sec"><span>Jadwal barang ini</span><em>{jadwal.length}</em></div>{jadwal.map(j => <Fragment key={j.id}>{kartuJadwal(j)}</Fragment>)}</>}
      <div className="chips" style={{ marginTop: 6 }}><button type="button" onClick={() => { setLapBarang(b.id); gantiTab('laporan') }}>Lapor kerusakan</button></div>
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
      <button className="back" type="button" onClick={() => setKerjaId(null)}>← Daftar tugas</button>
      <FormKerjakan j={j} b={idx!.barang.get(j.barang_id)} user={user} onSelesai={async (m: string) => { setKerjaId(null); setPesan(m); await muat() }} />
    </>
  }

  function tabLaporan() {
    const lap = [...data!.laporan].sort((a, z) => Number(laporanAktif(z)) - Number(laporanAktif(a)) || z.dibuat_pada.localeCompare(a.dibuat_pada))
    return <>
      <FormLaporan barang={data!.barang} awal={lapBarang} user={user} onSelesai={async (m: string) => { setLapBarang(null); setPesan(m); await muat() }} />
      <div className="sec"><span>Laporan divisi</span><em>{lap.length}</em></div>
      {!lap.length && <div className="empty">Belum ada laporan.</div>}
      {lap.map(l => <Fragment key={l.id}>{kartuLaporan(l)}</Fragment>)}
    </>
  }

  function kartuLaporan(l: Laporan) {
    const st = STATUS_LAPORAN[l.status], b = idx!.barang.get(l.barang_id)
    const upd = data!.update.filter(u => u.laporan_id === l.id)
    return <div className="item">
      <div className="r"><div className="it">{l.judul}</div>{bdg(st.warna, st.latar, st.label)}</div>
      <div className="mute">{b?.nama} · {fmtTanggal(l.dibuat_pada)} · {l.pelapor}</div>
      {l.masalah && l.masalah !== l.judul && <div className="mute" style={{ whiteSpace: 'pre-wrap' }}>{l.masalah}</div>}
      <Thumbs media={[...mediaDari('laporan', l.id, 'sebelum'), ...mediaDari('laporan', l.id, 'lama')]} />
      {upd.map(u => <div key={u.id} className="mute">↳ {fmtWaktu(u.waktu)} {u.oleh}{u.status_ke ? ` · ${STATUS_LAPORAN[u.status_ke as Laporan['status']]?.label || u.status_ke}` : ''}{u.catatan ? ': ' + u.catatan : ''}</div>)}
      {l.status === 'closed' && <><div className="mute">Sesudah perbaikan{l.perbaikan ? ': ' + l.perbaikan : ''}</div><Thumbs media={mediaDari('laporan', l.id, 'sesudah')} /></>}
    </div>
  }

  function tabRiwayat() {
    const ev = [
      ...data!.selesai.map(s => ({ k: 's' + s.id, tgl: s.tanggal, jenis: 'Rutin', judul: data!.jadwal.find(j => j.id === s.jadwal_id)?.jenis || 'Maintenance rutin',
        ket: `${idx!.barang.get(s.barang_id)?.nama || ''} · oleh ${s.oleh}${s.tanpa_dokumentasi ? ' · tanpa dokumentasi' : ''}`, media: mediaDari('jadwal_selesai', s.id) })),
      ...data!.laporan.map(l => ({ k: 'l' + l.id, tgl: l.dibuat_pada.slice(0, 10), jenis: 'Kerusakan', judul: l.judul,
        ket: `${idx!.barang.get(l.barang_id)?.nama || ''} · ${STATUS_LAPORAN[l.status].label}`, media: [] as Media[] })),
    ].sort((a, z) => z.tgl.localeCompare(a.tgl))
    return <>
      <div className="mute" style={{ marginBottom: 8 }}>Maintenance {RIWAYAT_HARI} hari terakhir & semua laporan divisi.</div>
      {!ev.length && <div className="empty">Belum ada riwayat.</div>}
      {ev.map(e => <div key={e.k} className="item"><div className="r"><div className="it">{e.judul}</div>{e.jenis === 'Rutin' ? bdg('#64748b', '#eef1f5', 'Rutin') : bdg('#6d28d9', '#ece3ff', 'Kerusakan')}</div>
        <div className="mute">{fmtTanggal(e.tgl)} · {e.ket}</div><Thumbs media={e.media} /></div>)}
    </>
  }
}

// ── form (komponen tingkat atas: isian tidak hilang saat data dimuat ulang realtime/polling) ──
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
