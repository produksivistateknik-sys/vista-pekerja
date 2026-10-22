// KENDALA - TAMPILAN OPERATOR, "Opsi A" artifact "Kendala Operator Alternatif" (23 Okt 2026, keputusan user - menggantikan
// versi kartu hijau besar): judul ringkas + "N belum selesai", segmen Semua/Belum/Selesai + pilihan proyek, daftar dalam SATU
// kartu (judul tanggal abu-abu tipis, satu baris per kendala bertitik status), tombol "+" melayang di atas bottom nav, isian =
// bottom sheet (proyek select, panel chip pilihan ganda, jenis opsional, keterangan wajib, tombol menempel di bawah).
//  - Operator TIDAK punya tombol selesai; Hapus hanya kendala milik sendiri di hari yang sama (ketuk baris -> Hapus -> Ya).
//  - N panel = N baris dlm SATU RPC (catat_kendala_banyak, migration 20261023050000) - semua tersimpan atau tidak.
// UKURAN px EKSPLISIT (bukan rem/em): src/index.css (sisa template Vite) memasang :root 16-18px, h1 36px + margin 20px,
// h2 20px, letter-spacing .18px & color-scheme "light dark" utk SELURUH aplikasi - komponen ini menetapkan ukuran, margin,
// letter-spacing & color-scheme sendiri supaya tidak ikut membesar / gelap. View vista-pekerja dipasang tanpa padding
// pembungkus -> padding 16px diatur di sini. Belum ada mode gelap di aplikasi operator. Data & aturan: lib/kendalaProduksi.ts.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import {
  muatProyekAktif, muatKendala, hapusKendala, catatKendalaBanyak, susunTeksKendala, JENIS_KENDALA,
  bolehUbahSendiri, labelDivisi, fmtTanggalPanjang, jamWib, tanggalHariIniWib, type Kendala, type ProyekAktif,
} from '../lib/kendalaProduksi'

const CSS = `
.kdo{--card:#fff;--fg:#17211b;--mute:#6f7c74;--line:#e3e9e5;--accent:#16a34a;--warn:#c2680a;--ok:#17803f;--bad:#c0392b;--chip:#f3f6f4;--chip-on:#e1f5e8;
  color-scheme:light;color:var(--fg);text-align:left;font-size:14px;line-height:1.4;letter-spacing:0;padding:12px 16px calc(96px + env(safe-area-inset-bottom,0px));width:100%;overflow-x:hidden}
.kdo *{box-sizing:border-box;letter-spacing:inherit}
.kdo button,.kdo select,.kdo textarea{font-family:inherit}
.kdo-hd{margin-bottom:10px}
.kdo-hd .t{margin:0;font-size:18px;font-weight:700;line-height:1.3;color:var(--fg)}
.kdo-hd small{display:block;color:var(--mute);font-size:12px;font-weight:500}
.kdo-bar{display:flex;gap:8px;margin-bottom:6px}
.kdo-seg{display:flex;flex:none;border:1px solid var(--line);border-radius:9px;overflow:hidden;background:var(--card)}
.kdo-seg button{height:34px;padding:0 11px;border:0;background:none;color:var(--mute);font-size:12.5px;font-weight:600;cursor:pointer}
.kdo-seg button[aria-pressed="true"]{background:var(--accent);color:#fff}
.kdo select{height:34px;min-width:0;flex:1;border:1px solid var(--line);border-radius:9px;background:var(--card);color:var(--fg);padding:0 8px;font-size:13px;font-weight:500}
.kdo-lst{background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden;margin-top:8px}
.kdo-dh{padding:6px 12px;background:var(--chip);font-size:11px;font-weight:700;color:var(--mute);letter-spacing:.05em;text-transform:uppercase;border-bottom:1px solid var(--line)}
.kdo-rw{display:flex;gap:10px;padding:10px 12px;border-bottom:1px solid var(--line)}
.kdo-rw:last-child{border-bottom:0}
.kdo-rw.milik{cursor:pointer}
.kdo-dot{flex:none;width:8px;height:8px;border-radius:50%;margin-top:6px;background:var(--warn)}
.kdo-rw.done .kdo-dot{background:var(--ok)}
.kdo-bd{min-width:0;flex:1}
.kdo-tx{font-size:14px;font-weight:600;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.kdo-rw.done .kdo-tx{color:var(--mute);font-weight:500;text-decoration:line-through;text-decoration-color:#c4cec8}
.kdo-pp{font-size:11.5px;font-weight:600;color:var(--mute);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
.kdo-mt{font-size:11.5px;color:var(--mute);margin-top:2px;overflow-wrap:anywhere}
.kdo-mt b{font-weight:700}.kdo-mt .w{color:var(--warn)}.kdo-mt .o{color:var(--ok)}
.kdo-ac{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-top:6px;font-size:12.5px}
.kdo-ac button{border:0;background:none;padding:2px 0;font-size:12.5px;font-weight:700;color:var(--mute);cursor:pointer}
.kdo-ac .bad{color:var(--bad)}
.kdo-empty{padding:22px;text-align:center;color:var(--mute);font-size:13px}
.kdo-more{display:block;width:100%;height:38px;border:0;border-top:1px solid var(--line);background:var(--card);color:var(--fg);font-size:12.5px;font-weight:600;cursor:pointer}
.kdo-err{color:var(--bad);font-size:12.5px;margin:8px 0}
.kdo-fab{position:fixed;right:16px;bottom:calc(72px + env(safe-area-inset-bottom,0px));width:52px;height:52px;border-radius:50%;border:0;background:var(--accent);color:#fff;box-shadow:0 6px 16px rgba(0,0,0,.25);display:grid;place-items:center;cursor:pointer;z-index:150}
.kdo-fab:disabled{opacity:.4}
.kdo-ov{position:fixed;inset:0;background:rgba(10,20,14,.45);display:flex;align-items:flex-end;justify-content:center;z-index:1000}
.kdo-sh{background:var(--card);width:100%;max-width:440px;border-radius:18px 18px 0 0;max-height:88vh;max-height:88dvh;display:flex;flex-direction:column;color:var(--fg);text-align:left;color-scheme:light;font-size:14px;line-height:1.4;letter-spacing:0}
.kdo-sh .top{display:flex;align-items:center;justify-content:space-between;padding:12px 16px 4px;flex:none}
.kdo-sh .top .t{margin:0;font-size:16px;font-weight:700}
.kdo-x{border:0;background:none;color:var(--mute);font-size:22px;line-height:1;cursor:pointer;padding:2px 6px}
.kdo-sh .body{overflow-y:auto;overflow-x:hidden;padding:0 16px 8px;flex:1;min-height:0}
.kdo-sh .foot{flex:none;padding:10px 16px calc(12px + env(safe-area-inset-bottom,0px));border-top:1px solid var(--line);background:var(--card)}
.kdo-lb{font-size:11px;font-weight:700;color:var(--mute);text-transform:uppercase;letter-spacing:.05em;margin:12px 0 6px}
.kdo-lb em{color:var(--bad);font-style:normal}
.kdo-sh select{width:100%;flex:none}
.kdo-ch{display:flex;flex-wrap:wrap;gap:6px}
.kdo-c{height:32px;padding:0 11px;border-radius:9px;border:1px solid var(--line);background:var(--chip);color:var(--fg);font-size:12.5px;font-weight:500;cursor:pointer;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kdo-c[aria-pressed="true"]{background:var(--chip-on);border-color:var(--accent);color:var(--ok);font-weight:700}
.kdo-c.dash{border-style:dashed;background:none}
.kdo-sh textarea{width:100%;min-height:56px;resize:none;border:1px solid var(--line);border-radius:10px;background:var(--chip);color:var(--fg);padding:9px 10px;font-size:14px;line-height:1.4}
.kdo-sh textarea:focus,.kdo select:focus{outline:2px solid var(--accent);outline-offset:-1px}
.kdo-go{width:100%;height:46px;border:0;border-radius:11px;background:var(--accent);color:#fff;font-size:15px;font-weight:700;cursor:pointer}
.kdo-go:disabled{opacity:.35;cursor:default}
.kdo-au{text-align:center;color:var(--mute);font-size:11.5px;margin-top:6px}
.kdo-au b{color:var(--fg);font-weight:600}
.kdo-tt{position:fixed;left:50%;bottom:calc(136px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);background:#17211b;color:#fff;padding:10px 16px;border-radius:10px;font-weight:600;font-size:13px;z-index:1100;max-width:calc(100% - 32px);text-align:center}
`
const BATAS_TAMPIL = 80
type Pilihan = number | 'umum'
type Tab = 'all' | 'open' | 'done'
type Sheet = { proyek: string; panel: Pilihan[]; jenis: string; ket: string }
const BL3 = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
// Nama panel tampil apa adanya (huruf kapital dari database), tanpa awalan "PANEL " yang berulang.
const tanpaPanel = (n: string | null | undefined) => (n || '').replace(/^panel\s+/i, '') || (n || '')
// "22 Okt, 20.22" dari waktu (WIB)
const tglJamPendek = (iso: string) => { const d = new Date(new Date(iso).getTime() + 7 * 3600e3); return `${d.getUTCDate()} ${BL3[d.getUTCMonth()]}, ${jamWib(iso)}` }

export function KendalaOperator({ db, user, registerBackHandler }: { db: any; user: any; registerBackHandler?: (fn: (() => boolean) | null) => void }) {
  const nama = String(user?.nama || user?.name || '').trim()
  const divisi = String(user?.divisi || '')
  const kunciTerakhir = 'vista_kendala_terakhir_' + nama
  const [proyekAktif, setProyekAktif] = useState<ProyekAktif[]>([])
  const [daftar, setDaftar] = useState<Kendala[]>([])
  const [memuat, setMemuat] = useState(true)
  const [galat, setGalat] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('all')
  const [fp, setFp] = useState('')
  const [batas, setBatas] = useState(BATAS_TAMPIL)
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [aksiId, setAksiId] = useState<number | null>(null)     // baris milik sendiri yang sedang menampilkan "Hapus"
  const [konfirmId, setKonfirmId] = useState<number | null>(null)
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

  const nOpen = daftar.filter(k => !k.teratasi_pada).length
  const rows = useMemo(() => daftar
    .filter(k => (!fp || k.proyek === fp) && (tab === 'all' || (tab === 'open' ? !k.teratasi_pada : !!k.teratasi_pada)))
    .sort((a, b) => (b.dicatat_pada || '').localeCompare(a.dicatat_pada || '') || b.id - a.id), [daftar, fp, tab])

  // ---- isian ----
  const bukaSheet = () => {
    let terakhir: { proyek?: string; panel?: Pilihan[] } = {}
    try { terakhir = JSON.parse(localStorage.getItem(kunciTerakhir) || '{}') || {} } catch { /* abaikan */ }
    const pa = proyekAktif.find(p => p.proyek === terakhir.proyek) || proyekAktif.find(p => p.proyek === fp) || proyekAktif[0]
    if (!pa) return
    const sah = (terakhir.proyek === pa.proyek ? terakhir.panel || [] : []).filter(x => x === 'umum' || pa.panels.some(p => p.id === x))
    setSheet({ proyek: pa.proyek, panel: sah.length ? sah : ['umum'], jenis: '', ket: '' })
  }
  const panelSheet = proyekAktif.find(p => p.proyek === sheet?.proyek)?.panels || []
  const togelPanel = (x: Pilihan) => setSheet(s => {
    if (!s) return s
    const ada = s.panel.includes(x)
    if (x === 'umum') return { ...s, panel: ada ? [] : ['umum'] }           // Umum tidak bisa digabung
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
    try { await hapusKendala(db, k.id, nama); setKonfirmId(null); setAksiId(null); setPesan('Kendala dihapus'); await muat() }
    catch (e: any) { console.error('[Kendala] gagal menghapus:', e); alert('Gagal menghapus kendala:\n' + (e?.message || e)) }
    finally { setSibuk(false) }
  }

  // ---- daftar ----
  const isi: ReactElement[] = []
  let tglAkhir = ''
  for (const k of rows.slice(0, batas)) {
    if (k.tanggal !== tglAkhir) { tglAkhir = k.tanggal; isi.push(<div key={'t' + k.tanggal} className="kdo-dh">{k.tanggal === hariIni ? 'Hari ini' : fmtTanggalPanjang(k.tanggal)}</div>) }
    const done = !!k.teratasi_pada
    const milik = bolehUbahSendiri(k, nama, hariIni)
    isi.push(
      <div key={k.id} className={'kdo-rw' + (done ? ' done' : '') + (milik ? ' milik' : '')}
        onClick={milik ? () => { if (aksiId !== k.id) { setAksiId(k.id); setKonfirmId(null) } } : undefined}>
        <span className="kdo-dot" aria-hidden="true" />
        <div className="kdo-bd">
          <div className="kdo-tx">{k.teks}</div>
          <div className="kdo-pp">{k.proyek} › {k.panel_id == null ? 'Umum' : tanpaPanel(k.panel_nama)}</div>
          <div className="kdo-mt">
            {done
              ? <><b className="o">Selesai</b> {tglJamPendek(k.teratasi_pada!)} · {k.teratasi_oleh}</>
              : <><b className="w">Belum selesai</b> · {jamWib(k.dicatat_pada)} · {k.pencatat} ({labelDivisi(k.divisi)})</>}
          </div>
          {milik && aksiId === k.id && (konfirmId === k.id ? (
            <div className="kdo-ac"><span style={{ color: 'var(--bad)' }}>Hapus kendala ini?</span>
              <button className="bad" disabled={sibuk} onClick={e => { e.stopPropagation(); hapus(k) }}>Ya, hapus</button>
              <button onClick={e => { e.stopPropagation(); setKonfirmId(null); setAksiId(null) }}>Batal</button>
            </div>
          ) : (
            <div className="kdo-ac">
              <button className="bad" onClick={e => { e.stopPropagation(); setKonfirmId(k.id) }}>Hapus</button>
              <button onClick={e => { e.stopPropagation(); setAksiId(null) }}>Tutup</button>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="kdo">
      <style>{CSS}</style>
      <div className="kdo-hd">
        <div className="t" role="heading" aria-level={1}>Kendala</div>
        <small>{memuat ? 'Memuat…' : `${nOpen} belum selesai`}</small>
      </div>
      <div className="kdo-bar">
        <div className="kdo-seg" role="group" aria-label="Status">
          {([['all', 'Semua'], ['open', 'Belum'], ['done', 'Selesai']] as [Tab, string][]).map(([t, l]) =>
            <button key={t} aria-pressed={tab === t} onClick={() => { setTab(t); setBatas(BATAS_TAMPIL) }}>{l}</button>)}
        </div>
        <select aria-label="Filter proyek" value={fp} onChange={e => { setFp(e.target.value); setBatas(BATAS_TAMPIL) }}>
          <option value="">Semua proyek</option>
          {proyekAktif.map(p => <option key={p.proyek} value={p.proyek}>{p.proyek}</option>)}
        </select>
      </div>
      {galat && <div className="kdo-err">{galat} <button className="kdo-more" style={{ width: 'auto', border: 0, display: 'inline' }} onClick={() => { setMemuat(true); muat() }}>Coba lagi</button></div>}
      <div className="kdo-lst">
        {memuat ? <div className="kdo-empty">Memuat…</div> : rows.length === 0 ? <div className="kdo-empty">Belum ada kendala.</div> : isi}
        {rows.length > batas && <button className="kdo-more" onClick={() => setBatas(b => b + BATAS_TAMPIL)}>Tampilkan lebih banyak ({rows.length - batas} lagi)</button>}
      </div>

      <button className="kdo-fab" aria-label="Catat kendala" disabled={memuat || proyekAktif.length === 0} onClick={bukaSheet}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
      </button>

      {sheet && (
        // Latar hanya menutup bila yang diketuk latarnya sendiri (target === currentTarget) - ketukan di dalam sheet tidak tertangkap.
        <div className="kdo-ov" onClick={e => { if (e.target === e.currentTarget && !sibuk) setSheet(null) }}>
          <div className="kdo-sh" role="dialog" aria-modal="true" aria-label="Catat kendala">
            <div className="top">
              <div className="t" role="heading" aria-level={2}>Catat kendala</div>
              <button className="kdo-x" aria-label="Tutup" disabled={sibuk} onClick={() => setSheet(null)}>×</button>
            </div>
            <div className="body">
              <div className="kdo-lb">Proyek</div>
              <select aria-label="Proyek" value={sheet.proyek} onChange={e => setSheet({ ...sheet, proyek: e.target.value, panel: ['umum'] })}>
                {proyekAktif.map(p => <option key={p.proyek} value={p.proyek}>{p.proyek}</option>)}
              </select>
              <div className="kdo-lb">Panel</div>
              <div className="kdo-ch">
                <button className="kdo-c" aria-pressed={sheet.panel.includes('umum')} onClick={() => togelPanel('umum')}>{sheet.panel.includes('umum') ? '✓ ' : ''}Umum</button>
                {panelSheet.map(p => <button key={p.id} className="kdo-c" aria-pressed={sheet.panel.includes(p.id)} onClick={() => togelPanel(p.id)}>{sheet.panel.includes(p.id) ? '✓ ' : ''}{tanpaPanel(p.nama)}</button>)}
                {panelSheet.length >= 2 && <button className="kdo-c dash" onClick={pilihSemua}>Pilih semua panel</button>}
              </div>
              <div className="kdo-lb">Jenis kendala (opsional)</div>
              <div className="kdo-ch">
                {JENIS_KENDALA.map(j => <button key={j} className="kdo-c" aria-pressed={sheet.jenis === j} onClick={() => setSheet({ ...sheet, jenis: sheet.jenis === j ? '' : j })}>{j}</button>)}
              </div>
              <div className="kdo-lb">Keterangan <em>· wajib diisi</em></div>
              <textarea rows={2} value={sheet.ket} onChange={e => setSheet({ ...sheet, ket: e.target.value })} placeholder="Tulis apa yang kurang atau ditunggu. Mis. MCB 2P 16A, 4 pcs" aria-label="Keterangan kendala" />
            </div>
            <div className="foot">
              <button className="kdo-go" disabled={!siap || sibuk} onClick={simpan}>{sibuk ? 'Menyimpan…' : nPanel > 1 ? `Catat kendala di ${nPanel} panel` : 'Catat kendala'}</button>
              <div className="kdo-au">Tercatat otomatis: <b>{fmtTanggalPanjang(hariIni)}</b> · {nama || '-'}</div>
            </div>
          </div>
        </div>
      )}
      {pesan && <div className="kdo-tt" role="status">{pesan}</div>}
    </div>
  )
}
