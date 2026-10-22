// KENDALA - TAMPILAN OPERATOR (23 Okt 2026, acuan artifact "Kendala Operator Cepat", keputusan user):
//  - kartu hijau (tanggal, "Kendala", angka belum selesai, tombol "+ Catat kendala"), chip filter proyek (geser),
//    daftar terbaru di atas dikelompokkan "Hari ini" lalu per tanggal; kartu bergaris warna (oranye belum / hijau selesai),
//    avatar huruf proyek, "Proyek › Panel", teks, status, jam, pencatat. Operator TIDAK punya tombol selesai; Hapus hanya
//    kendala milik sendiri di hari yang sama (konfirmasi di kartu).
//  - isian = bottom sheet: proyek (chip geser), panel PILIHAN GANDA ("Umum" tidak bisa digabung; "Pilih semua panel"),
//    jenis siap pakai OPSIONAL (JENIS_KENDALA), keterangan WAJIB. N panel = N baris dlm SATU RPC (catat_kendala_banyak).
//    Pilihan proyek/panel terakhir diingat per pengguna (localStorage, aman bila gagal).
// Catatan tata letak: view vista-pekerja dipasang TANPA padding pembungkus - padding (16px) diatur di sini (dulu tidak ada ->
// teks menempel ke tepi layar). Aplikasi operator belum punya mode gelap. Data & aturan: lib/kendalaProduksi.ts.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import {
  muatProyekAktif, muatKendala, hapusKendala, catatKendalaBanyak, susunTeksKendala, JENIS_KENDALA,
  bolehUbahSendiri, labelDivisi, fmtTanggalPanjang, fmtPendekDariWaktu, jamWib, tanggalHariIniWib, type Kendala, type ProyekAktif,
} from '../lib/kendalaProduksi'

const CSS = `
.kdo{--bg:#eef3ef;--card:#fff;--fg:#14211a;--mute:#6f7d74;--line:#e2e9e4;--g1:#2fb463;--g2:#12823f;--accent:#16a34a;--warn:#c2680a;--warn-bg:#fff0d6;
  --ok:#17803f;--ok-bg:#dcf5e5;--bad:#c0392b;--chip:#f1f5f2;--chip-on:#e3f6ea;--shadow:0 6px 18px rgba(20,60,35,.08);
  color:var(--fg);text-align:left;font-size:15px;line-height:1.45;padding:12px 16px calc(28px + env(safe-area-inset-bottom,0px));width:100%;overflow-x:hidden}
.kdo *{box-sizing:border-box}
.kdo button{font-family:inherit}
.kdo-hero{background:linear-gradient(135deg,var(--g1),var(--g2));color:#fff;border-radius:22px;padding:18px;box-shadow:var(--shadow)}
.kdo-hero .t{font-size:12.5px;font-weight:600;opacity:.85}
.kdo-hero h1{margin:2px 0 12px;font-size:24px;font-weight:800;letter-spacing:-.02em;color:#fff}
.kdo-hero .row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.kdo-hero .cnt{flex:1;min-width:110px}
.kdo-hero .cnt b{display:block;font-size:30px;line-height:1;font-weight:800}
.kdo-hero .cnt span{font-size:13px;opacity:.85}
.kdo-add{height:50px;padding:0 20px;border:0;border-radius:16px;background:#fff;color:var(--g2);font-weight:800;font-size:15.5px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.15);display:inline-flex;align-items:center;gap:8px}
.kdo-fl{display:flex;gap:8px;overflow-x:auto;padding:16px 0 4px;margin:0 -16px;padding-inline:16px;scrollbar-width:none}
.kdo-fl::-webkit-scrollbar{display:none}
.kdo-fc{flex:none;height:36px;padding:0 15px;border-radius:18px;border:1.5px solid var(--line);background:var(--card);color:var(--fg);font-weight:600;font-size:13.5px;cursor:pointer;white-space:nowrap}
.kdo-fc[aria-pressed="true"]{background:var(--accent);color:#fff;border-color:var(--accent)}
.kdo-h2{font-size:12.5px;font-weight:700;color:var(--mute);text-transform:uppercase;letter-spacing:.06em;margin:18px 2px 10px}
.kdo-cd{display:flex;gap:12px;background:var(--card);border-radius:18px;padding:14px 14px 14px 17px;margin-bottom:10px;box-shadow:var(--shadow);position:relative;overflow:hidden}
.kdo-cd::before{content:"";position:absolute;left:0;top:0;bottom:0;width:5px;background:var(--warn)}
.kdo-cd.done::before{background:var(--ok)}
.kdo-av{flex:none;width:42px;height:42px;border-radius:13px;display:grid;place-items:center;color:#fff;font-weight:800;font-size:17px}
.kdo-bd{flex:1;min-width:0}
.kdo-pp{font-size:12.5px;color:var(--mute);font-weight:600;overflow-wrap:anywhere}
.kdo-pp b{color:var(--fg);font-weight:700}
.kdo-tx{font-weight:600;margin-top:2px;overflow-wrap:anywhere;white-space:pre-wrap}
.kdo-cd.done .kdo-tx{color:var(--mute);font-weight:500;text-decoration:line-through;text-decoration-color:#b9c4bd}
.kdo-ft{display:flex;align-items:center;gap:6px 8px;flex-wrap:wrap;margin-top:8px;font-size:12.5px;color:var(--mute)}
.kdo-pill{display:inline-flex;align-items:center;height:22px;padding:0 9px;border-radius:11px;font-size:12px;font-weight:700;white-space:nowrap}
.kdo-pill.w{background:var(--warn-bg);color:var(--warn)}.kdo-pill.o{background:var(--ok-bg);color:var(--ok)}
.kdo-okt{color:var(--ok);font-weight:600}
.kdo-ac{display:flex;gap:16px;margin-top:8px;align-items:center;flex-wrap:wrap}
.kdo-ac button{border:0;background:none;padding:4px 0;font-weight:700;font-size:13px;color:var(--mute);cursor:pointer}
.kdo-ac .bad{color:var(--bad)}
.kdo-empty{text-align:center;color:var(--mute);padding:30px 10px}
.kdo-more{display:block;margin:6px auto 0;border:1.5px solid var(--line);background:var(--card);border-radius:14px;height:40px;padding:0 18px;font-weight:700;color:var(--fg);cursor:pointer}
.kdo-err{color:var(--bad);font-size:13px;margin:10px 0}
.kdo-ov{position:fixed;inset:0;background:rgba(10,20,14,.5);display:flex;align-items:flex-end;justify-content:center;z-index:1000}
.kdo-sh{background:var(--card);width:100%;max-width:560px;border-radius:26px 26px 0 0;padding:10px 18px calc(18px + env(safe-area-inset-bottom,0px));max-height:92vh;overflow-y:auto;overflow-x:hidden;color:var(--fg);text-align:left}
.kdo-gr{width:42px;height:5px;border-radius:3px;background:var(--line);margin:0 auto 12px}
.kdo-sh h3{font-size:20px;font-weight:800;margin:0 0 6px}
.kdo-lb{font-size:12px;font-weight:700;color:var(--mute);text-transform:uppercase;letter-spacing:.05em;margin:14px 2px 8px}
.kdo-ch{display:flex;flex-wrap:wrap;gap:8px}
.kdo-ch.sc{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;margin-inline:-18px;padding-inline:18px}
.kdo-ch.sc::-webkit-scrollbar{display:none}
.kdo-c{flex:none;min-height:42px;max-width:100%;padding:6px 14px;border-radius:14px;border:1.5px solid var(--line);background:var(--chip);color:var(--fg);font-weight:600;font-size:14px;cursor:pointer;text-align:left;overflow-wrap:anywhere}
.kdo-ch.sc .kdo-c{white-space:nowrap;max-width:none}
.kdo-c[aria-pressed="true"]{background:var(--chip-on);border-color:var(--accent);color:var(--ok)}
.kdo-c.semua{border-style:dashed}
.kdo-sh textarea{width:100%;min-height:72px;resize:none;border:1.5px solid var(--line);border-radius:14px;background:var(--chip);color:var(--fg);padding:12px;font:inherit;font-size:15px}
.kdo-sh textarea:focus{outline:2px solid var(--accent);outline-offset:-1px}
.kdo-go{width:100%;height:56px;border:0;border-radius:16px;background:linear-gradient(135deg,var(--g1),var(--g2));color:#fff;font-weight:800;font-size:16.5px;cursor:pointer;margin-top:16px}
.kdo-go:disabled{opacity:.35;cursor:default}
.kdo-au{text-align:center;color:var(--mute);font-size:12.5px;margin-top:10px}
.kdo-au b{color:var(--fg);font-weight:600}
.kdo-tt{position:fixed;left:50%;bottom:calc(84px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);background:#14211a;color:#fff;padding:12px 18px;border-radius:14px;font-weight:700;font-size:14px;z-index:1100;max-width:calc(100% - 32px);text-align:center}
`
const WARNA = ['#2f7dd1', '#e08a1e', '#8a5cd6', '#d6467a', '#1c9c8c', '#c9563a']
const BATAS_TAMPIL = 60
type Pilihan = number | 'umum'
type Sheet = { proyek: string; panel: Pilihan[]; jenis: string; ket: string }

export function KendalaOperator({ db, user, registerBackHandler }: { db: any; user: any; registerBackHandler?: (fn: (() => boolean) | null) => void }) {
  const nama = String(user?.nama || user?.name || '').trim()
  const divisi = String(user?.divisi || '')
  const kunciTerakhir = 'vista_kendala_terakhir_' + nama
  const [proyekAktif, setProyekAktif] = useState<ProyekAktif[]>([])
  const [daftar, setDaftar] = useState<Kendala[]>([])
  const [memuat, setMemuat] = useState(true)
  const [galat, setGalat] = useState<string | null>(null)
  const [filt, setFilt] = useState('')
  const [batas, setBatas] = useState(BATAS_TAMPIL)
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [hapusId, setHapusId] = useState<number | null>(null)
  const [sibuk, setSibuk] = useState(false)
  const [pesan, setPesan] = useState('')
  const [hariIni, setHariIni] = useState(tanggalHariIniWib())

  const muat = useCallback(async () => {
    try {
      const pa = await muatProyekAktif(db)
      const k = await muatKendala(db, { proyek: pa.map(p => p.proyek) })
      setProyekAktif(pa); setDaftar(k); setGalat(null); setHariIni(tanggalHariIniWib())
    } catch (e: any) { console.error('[Kendala] gagal memuat:', e); setGalat('Gagal memuat kendala: ' + (e?.message || e)) }
    finally { setMemuat(false) }
  }, [db])
  useEffect(() => { muat() }, [muat])
  const tunda = useRef<any>(null)
  useEffect(() => {
    const ch = db.channel('kendala-operator-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kendala_produksi' }, () => { clearTimeout(tunda.current); tunda.current = setTimeout(muat, 600) })
      .subscribe()
    return () => { clearTimeout(tunda.current); db.removeChannel(ch) }
  }, [db, muat])
  useEffect(() => {
    if (!registerBackHandler) return
    registerBackHandler(() => { if (sheet) { setSheet(null); return true } return false })
    return () => registerBackHandler(null)
  }, [registerBackHandler, sheet])
  useEffect(() => { if (!pesan) return; const t = setTimeout(() => setPesan(''), 2200); return () => clearTimeout(t) }, [pesan])

  const warna = (proyek: string) => { const i = proyekAktif.findIndex(p => p.proyek === proyek); return WARNA[(i < 0 ? proyek.length : i) % WARNA.length] }
  const nOpen = daftar.filter(k => !k.teratasi_pada).length
  const rows = useMemo(() => daftar.filter(k => !filt || k.proyek === filt)
    .sort((a, b) => (b.dicatat_pada || '').localeCompare(a.dicatat_pada || '') || b.id - a.id), [daftar, filt])

  // ---- isian ----
  const bukaSheet = () => {
    let terakhir: { proyek?: string; panel?: Pilihan[] } = {}
    try { terakhir = JSON.parse(localStorage.getItem(kunciTerakhir) || '{}') || {} } catch { /* abaikan */ }
    const pa = proyekAktif.find(p => p.proyek === (filt || terakhir.proyek)) || proyekAktif.find(p => p.proyek === terakhir.proyek) || proyekAktif[0]
    if (!pa) return
    const sah = (terakhir.proyek === pa.proyek ? terakhir.panel || [] : []).filter(x => x === 'umum' || pa.panels.some(p => p.id === x))
    setSheet({ proyek: pa.proyek, panel: sah, jenis: '', ket: '' })
  }
  const panelSheet = proyekAktif.find(p => p.proyek === sheet?.proyek)?.panels || []
  const togelPanel = (x: Pilihan) => setSheet(s => {
    if (!s) return s
    const ada = s.panel.includes(x)
    if (x === 'umum') return { ...s, panel: ada ? [] : ['umum'] }                // Umum tidak bisa digabung
    const tanpaUmum = s.panel.filter(p => p !== 'umum')
    return { ...s, panel: ada ? tanpaUmum.filter(p => p !== x) : [...tanpaUmum, x] }
  })
  const pilihSemua = () => setSheet(s => {
    if (!s) return s
    const semua = panelSheet.map(p => p.id as Pilihan)
    const sudah = semua.length > 0 && semua.every(id => s.panel.includes(id)) && !s.panel.includes('umum')
    return { ...s, panel: sudah ? [] : semua }
  })
  const siap = !!sheet && sheet.ket.trim().length > 0 && sheet.panel.length > 0
  const nPanel = sheet ? (sheet.panel.includes('umum') ? 1 : sheet.panel.length) : 0
  const simpan = async () => {
    if (!sheet || !siap || sibuk) return
    if (!nama) { alert('Nama pengguna tidak terbaca - masuk ulang dulu.'); return }
    const panelIds = sheet.panel.includes('umum') ? [] : (sheet.panel as number[])
    setSibuk(true)
    try {
      const hasil = await catatKendalaBanyak(db, { proyek: sheet.proyek, panelIds, teks: susunTeksKendala(sheet.jenis, sheet.ket), oleh: nama, divisi })
      try { localStorage.setItem(kunciTerakhir, JSON.stringify({ proyek: sheet.proyek, panel: sheet.panel })) } catch { /* abaikan */ }
      setSheet(null)
      setPesan(hasil.length > 1 ? `Kendala tercatat di ${hasil.length} panel` : 'Kendala tercatat')
      await muat()
    } catch (e: any) {
      console.error('[Kendala] gagal mencatat:', e)
      alert('Gagal mencatat kendala:\n' + (e?.message || e) + '\n\nTidak ada yang tersimpan - coba lagi.')
    } finally { setSibuk(false) }
  }
  const hapus = async (k: Kendala) => {
    setSibuk(true)
    try { await hapusKendala(db, k.id, nama); setHapusId(null); setPesan('Kendala dihapus'); await muat() }
    catch (e: any) { console.error('[Kendala] gagal menghapus:', e); alert('Gagal menghapus kendala:\n' + (e?.message || e)) }
    finally { setSibuk(false) }
  }

  // ---- daftar ----
  const tampil = rows.slice(0, batas)
  const kartu: ReactElement[] = []
  let tglAkhir = ''
  for (const k of tampil) {
    if (k.tanggal !== tglAkhir) { tglAkhir = k.tanggal; kartu.push(<div key={'t' + k.tanggal} className="kdo-h2">{k.tanggal === hariIni ? 'Hari ini' : fmtTanggalPanjang(k.tanggal)}</div>) }
    const done = !!k.teratasi_pada
    const milik = bolehUbahSendiri(k, nama, hariIni)
    kartu.push(
      <div key={k.id} className={'kdo-cd' + (done ? ' done' : '')}>
        <div className="kdo-av" style={{ background: warna(k.proyek) }} aria-hidden="true">{(k.proyek.trim()[0] || '?').toUpperCase()}</div>
        <div className="kdo-bd">
          <div className="kdo-pp"><b>{k.proyek}</b> › {k.panel_nama || 'Umum'}</div>
          <div className="kdo-tx">{k.teks}</div>
          <div className="kdo-ft">
            {done
              ? <><span className="kdo-pill o">✓ Selesai</span><span className="kdo-okt">{fmtPendekDariWaktu(k.teratasi_pada!)}, {jamWib(k.teratasi_pada!)} oleh {k.teratasi_oleh}</span></>
              : <span className="kdo-pill w">Belum selesai</span>}
            <span>{jamWib(k.dicatat_pada)} · {k.pencatat} ({labelDivisi(k.divisi)})</span>
          </div>
          {milik && (hapusId === k.id ? (
            <div className="kdo-ac"><span style={{ fontSize: 13, color: 'var(--bad)' }}>Hapus kendala ini?</span>
              <button className="bad" disabled={sibuk} onClick={() => hapus(k)}>Ya, hapus</button>
              <button onClick={() => setHapusId(null)}>Batal</button>
            </div>
          ) : <div className="kdo-ac"><button className="bad" onClick={() => setHapusId(k.id)}>Hapus</button></div>)}
        </div>
      </div>
    )
  }

  return (
    <div className="kdo">
      <style>{CSS}</style>
      <div className="kdo-hero">
        <div className="t">{fmtTanggalPanjang(hariIni)}</div>
        <h1>Kendala</h1>
        <div className="row">
          <div className="cnt"><b>{memuat ? '…' : nOpen}</b><span>belum selesai</span></div>
          <button className="kdo-add" disabled={memuat || proyekAktif.length === 0} onClick={bukaSheet}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M10 4v12M4 10h12" /></svg>Catat kendala
          </button>
        </div>
      </div>
      <div className="kdo-fl" role="group" aria-label="Filter proyek">
        <button className="kdo-fc" aria-pressed={filt === ''} onClick={() => { setFilt(''); setBatas(BATAS_TAMPIL) }}>Semua</button>
        {proyekAktif.map(p => <button key={p.proyek} className="kdo-fc" aria-pressed={filt === p.proyek} onClick={() => { setFilt(p.proyek); setBatas(BATAS_TAMPIL) }}>{p.proyek}</button>)}
      </div>
      {galat && <div className="kdo-err">{galat} <button className="kdo-fc" onClick={() => { setMemuat(true); muat() }}>Coba lagi</button></div>}
      {memuat ? <div className="kdo-empty">Memuat…</div> : rows.length === 0 ? <div className="kdo-empty">Belum ada kendala.</div> : kartu}
      {rows.length > batas && <button className="kdo-more" onClick={() => setBatas(b => b + BATAS_TAMPIL)}>Tampilkan lebih banyak ({rows.length - batas} lagi)</button>}

      {sheet && (
        <div className="kdo-ov" onClick={e => { if (e.target === e.currentTarget && !sibuk) setSheet(null) }}>
          <div className="kdo-sh" role="dialog" aria-label="Catat kendala">
            <div className="kdo-gr" />
            <h3>Catat kendala</h3>
            <div className="kdo-lb">Proyek</div>
            <div className="kdo-ch sc">
              {proyekAktif.map(p => <button key={p.proyek} className="kdo-c" aria-pressed={sheet.proyek === p.proyek} onClick={() => setSheet({ ...sheet, proyek: p.proyek, panel: [] })}>{p.proyek}</button>)}
            </div>
            <div className="kdo-lb">Panel · boleh lebih dari satu</div>
            <div className="kdo-ch">
              <button className="kdo-c" aria-pressed={sheet.panel.includes('umum')} onClick={() => togelPanel('umum')}>{sheet.panel.includes('umum') ? '✓ ' : ''}Umum</button>
              {panelSheet.map(p => <button key={p.id} className="kdo-c" aria-pressed={sheet.panel.includes(p.id)} onClick={() => togelPanel(p.id)}>{sheet.panel.includes(p.id) ? '✓ ' : ''}{p.nama}</button>)}
              {panelSheet.length >= 2 && <button className="kdo-c semua" onClick={pilihSemua}>Pilih semua panel</button>}
            </div>
            <div className="kdo-lb">Kendalanya apa?</div>
            <div className="kdo-ch">
              {JENIS_KENDALA.map(j => <button key={j} className="kdo-c" aria-pressed={sheet.jenis === j} onClick={() => setSheet({ ...sheet, jenis: sheet.jenis === j ? '' : j })}>{j}</button>)}
            </div>
            <div className="kdo-lb">Keterangan <span style={{ color: 'var(--bad)' }}>· wajib diisi</span></div>
            <textarea rows={2} value={sheet.ket} onChange={e => setSheet({ ...sheet, ket: e.target.value })} placeholder="Tulis apa yang kurang atau ditunggu. Mis. MCB 2P 16A, 4 pcs" aria-label="Keterangan kendala" />
            <button className="kdo-go" disabled={!siap || sibuk} onClick={simpan}>{sibuk ? 'Menyimpan…' : nPanel > 1 ? `Catat kendala di ${nPanel} panel` : 'Catat kendala'}</button>
            <div className="kdo-au">Tercatat otomatis: <b>{fmtTanggalPanjang(hariIni)}</b> · {nama || '-'}</div>
          </div>
        </div>
      )}
      {pesan && <div className="kdo-tt" role="status">{pesan}</div>}
    </div>
  )
}
