// KENDALA - TAMPILAN OPERATOR (23 Okt 2026). Gaya sama dgn tampilan admin vista-teknik (artifact "Kendala Admin
// Sederhana"), lebih ringkas: pilih proyek > panel (termasuk "Umum") > tulis kendala > "Catat kendala"; riwayat per
// panel dikelompokkan per tanggal (terbaru di atas); status Selesai hanya keterangan (tanpa tombol - hanya Admin
// Produksi yang menandai). Pencatat boleh Ubah/Hapus miliknya di hari yang sama. Hari/tanggal/jam/nama otomatis.
// Data & aturan: lib/kendalaProduksi.ts (IDENTIK dgn vista-teknik). Aplikasi operator belum punya mode gelap.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  muatProyekAktif, muatKendala, catatKendala, ubahKendala, hapusKendala, kelompokPerTanggal, ringkasPerPanel, kunciPanel,
  bolehUbahSendiri, teksSelesai, labelDivisi, fmtTanggalPanjang, jamWib, tanggalHariIniWib, type Kendala, type ProyekAktif,
} from '../lib/kendalaProduksi'

const CSS = `
.kdo{--fg:#1d1f23;--mute:#7a7f87;--line:#e8e8e4;--card:#fff;--ok:#2f8f5b;--warn:#c26a0a;--bad:#c0392b;--ink:#1d1f23;
  color:var(--fg);text-align:left;font-size:15px;line-height:1.5;padding:2px 0 40px}
.kdo *{box-sizing:border-box}
.kdo h1{font-size:22px;font-weight:700;letter-spacing:-.02em;margin:0 0 2px}
.kdo-sub{color:var(--mute);font-size:13.5px;margin:0 0 12px}
.kdo-row{display:flex;align-items:baseline;justify-content:space-between;gap:10px;width:100%;background:none;border:0;color:var(--fg);text-align:left;cursor:pointer;font:inherit;padding:12px 0}
.kdo-pr{border-top:1px solid var(--line)}
.kdo-pr:last-child{border-bottom:1px solid var(--line)}
.kdo-pr>.kdo-row{font-weight:700;font-size:15.5px}
.kdo-pn>.kdo-row{padding:9px 0 9px 14px}
.kdo-pn>.kdo-row .nm{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--warn)}
.kdo-l{min-width:0;overflow-wrap:anywhere}
.kdo-ch{display:inline-block;width:12px;color:var(--mute);margin-right:6px;transition:transform .15s}
.kdo-row[aria-expanded="true"] .kdo-ch{transform:rotate(90deg)}
.kdo-meta{color:var(--mute);font-weight:400;font-size:13px;white-space:nowrap}
.kdo-meta.has{color:var(--warn);font-weight:600}
.kdo-body{padding:0 0 14px 14px}
.kdo-dt{font-size:12px;font-weight:600;color:var(--mute);letter-spacing:.04em;text-transform:uppercase;margin:12px 0 2px}
.kdo-it{padding:8px 0;border-bottom:1px solid var(--line)}
.kdo-tx{font-weight:500;overflow-wrap:anywhere;white-space:pre-wrap}
.kdo-it.done .kdo-tx{color:var(--mute);font-weight:400;text-decoration:line-through;text-decoration-color:var(--line)}
.kdo-mt{color:var(--mute);font-size:12.5px;margin-top:1px;overflow-wrap:anywhere}
.kdo-ok{color:var(--ok)}
.kdo-ac{display:flex;gap:14px;margin-top:4px;font-size:13px;flex-wrap:wrap;align-items:center}
.kdo-ac button{border:0;background:none;padding:0;font:inherit;font-size:13px;font-weight:500;color:var(--mute);cursor:pointer}
.kdo-ac .bad{color:var(--bad)}
.kdo-empty{color:var(--mute);font-size:14px;margin:6px 0 4px}
.kdo textarea,.kdo input{width:100%;font:inherit;font-size:15px;color:var(--fg);background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px}
.kdo textarea{min-height:72px;resize:vertical}
.kdo textarea:focus,.kdo input:focus{outline:2px solid #d97706;outline-offset:-1px}
.kdo-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:8px;color:var(--mute);font-size:13px}
.kdo-foot b{color:var(--fg);font-weight:500}
.kdo-btn{height:38px;padding:0 16px;border:0;border-radius:8px;background:var(--ink);color:#fff;font:inherit;font-size:14px;font-weight:600;cursor:pointer}
.kdo-btn:disabled{opacity:.3;cursor:default}
.kdo-err{color:var(--bad);font-size:13px;margin:8px 0}
`

export function KendalaOperator({ db, user, registerBackHandler }: { db: any; user: any; registerBackHandler?: (fn: (() => boolean) | null) => void }) {
  const nama = String(user?.nama || user?.name || '').trim()
  const divisi = String(user?.divisi || '')
  const [proyekAktif, setProyekAktif] = useState<ProyekAktif[]>([])
  const [daftar, setDaftar] = useState<Kendala[]>([])
  const [memuat, setMemuat] = useState(true)
  const [galat, setGalat] = useState<string | null>(null)
  const [buka, setBuka] = useState<Set<string>>(new Set())
  const [draf, setDraf] = useState<Record<string, string>>({})
  const [edit, setEdit] = useState<{ id: number; teks: string } | null>(null)
  const [hapusId, setHapusId] = useState<number | null>(null)
  const [sibuk, setSibuk] = useState<string | null>(null)
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
    registerBackHandler(() => { if (buka.size === 0) return false; setBuka(new Set()); return true })
    return () => registerBackHandler(null)
  }, [registerBackHandler, buka])

  const ringkas = useMemo(() => ringkasPerPanel(daftar), [daftar])
  const perPanel = useMemo(() => {
    const m = new Map<string, Kendala[]>()
    for (const k of daftar) { const key = kunciPanel(k.proyek, k.panel_id); const a = m.get(key) || []; a.push(k); m.set(key, a) }
    return m
  }, [daftar])
  const togel = (key: string) => setBuka(s => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n })
  const jalankan = async (label: string, fn: () => Promise<any>) => {
    setSibuk(label)
    try { await fn(); await muat(); return true }
    catch (e: any) { console.error('[Kendala] ' + label + ' gagal:', e); alert('Gagal ' + label + ':\n' + (e?.message || e)); return false }
    finally { setSibuk(null) }
  }
  const catat = async (proyek: string, panelId: number | null) => {
    const key = kunciPanel(proyek, panelId), teks = (draf[key] || '').trim()
    if (teks.length < 3) return
    if (!nama) { alert('Nama pengguna tidak terbaca - masuk ulang dulu.'); return }
    if (await jalankan('mencatat kendala', () => catatKendala(db, { proyek, panelId, teks, oleh: nama, divisi }))) setDraf(d => ({ ...d, [key]: '' }))
  }
  const meta = (r: { total: number; terbuka: number } | undefined, kosong: string) => {
    if (!r || r.total === 0) return <span className="kdo-meta">{kosong}</span>
    return <span className={'kdo-meta' + (r.terbuka ? ' has' : '')}>{r.terbuka ? `${r.terbuka} belum selesai` : `${r.total} selesai`}</span>
  }

  const item = (k: Kendala) => {
    const done = !!k.teratasi_pada, milik = bolehUbahSendiri(k, nama, hariIni)
    return (
      <div key={k.id} className={'kdo-it' + (done ? ' done' : '')}>
        {edit?.id === k.id ? (
          <div>
            <input value={edit.teks} onChange={e => setEdit({ id: k.id, teks: e.target.value })} aria-label="Ubah kendala" autoFocus />
            <div className="kdo-ac">
              <button disabled={!!sibuk || edit.teks.trim().length < 3} onClick={async () => { if (await jalankan('mengubah kendala', () => ubahKendala(db, k.id, edit.teks.trim(), nama))) setEdit(null) }} style={{ color: 'var(--fg)' }}>Simpan</button>
              <button onClick={() => setEdit(null)}>Batal</button>
            </div>
          </div>
        ) : <div className="kdo-tx">{k.teks}</div>}
        <div className="kdo-mt">{jamWib(k.dicatat_pada)} · {k.pencatat} ({labelDivisi(k.divisi)}){k.diubah_pada ? ' · diubah' : ''}</div>
        {done && <div className="kdo-mt kdo-ok">{teksSelesai(k)}</div>}
        {milik && edit?.id !== k.id && (hapusId === k.id ? (
          <div className="kdo-ac"><span className="bad">Hapus kendala ini?</span>
            <button className="bad" disabled={!!sibuk} onClick={async () => { if (await jalankan('menghapus kendala', () => hapusKendala(db, k.id, nama))) setHapusId(null) }}>Ya, hapus</button>
            <button onClick={() => setHapusId(null)}>Batal</button>
          </div>
        ) : (
          <div className="kdo-ac"><button onClick={() => setEdit({ id: k.id, teks: k.teks })}>Ubah</button><button className="bad" onClick={() => setHapusId(k.id)}>Hapus</button></div>
        ))}
      </div>
    )
  }

  return (
    <div className="kdo">
      <style>{CSS}</style>
      <h1>Kendala</h1>
      <p className="kdo-sub">Pilih proyek dan panel, lalu tulis kendalanya. Hari, tanggal, jam, dan nama tercatat otomatis.</p>
      {galat && <div className="kdo-err">{galat} <button className="kdo-btn" style={{ height: 30 }} onClick={() => { setMemuat(true); muat() }}>Coba lagi</button></div>}
      {memuat ? <p className="kdo-empty">Memuat…</p> : proyekAktif.length === 0 ? <p className="kdo-empty">Belum ada proyek aktif.</p> : (
        <div>
          {proyekAktif.map(pr => {
            const kp = 'p:' + pr.proyek, po = buka.has(kp)
            let total = 0, terbuka = 0
            ;[null, ...pr.panels.map(p => p.id)].forEach(id => { const r = ringkas.get(kunciPanel(pr.proyek, id)); if (r) { total += r.total; terbuka += r.terbuka } })
            return (
              <div key={pr.proyek} className="kdo-pr">
                <button className="kdo-row" aria-expanded={po} onClick={() => togel(kp)}>
                  <span className="kdo-l"><span className="kdo-ch">›</span>{pr.proyek}</span>{meta({ total, terbuka }, 'Tidak ada')}
                </button>
                {po && [{ id: null as number | null, nama: 'Umum' }, ...pr.panels.map(p => ({ id: p.id as number | null, nama: p.nama }))].map(pn => {
                  const key = kunciPanel(pr.proyek, pn.id), o = buka.has(key)
                  const grup = kelompokPerTanggal(perPanel.get(key) || [])
                  return (
                    <div key={key} className="kdo-pn">
                      <button className="kdo-row" aria-expanded={o} onClick={() => togel(key)}>
                        <span className="kdo-l"><span className="kdo-ch">›</span><span className="nm">{pn.nama}</span></span>{meta(ringkas.get(key), '—')}
                      </button>
                      {o && (
                        <div className="kdo-body">
                          {grup.length === 0 && <p className="kdo-empty">Belum ada kendala tercatat.</p>}
                          {grup.map(g => (
                            <div key={g.tanggal}>
                              <div className="kdo-dt">{fmtTanggalPanjang(g.tanggal)}</div>
                              {g.entri.map(item)}
                            </div>
                          ))}
                          <div style={{ marginTop: 14 }}>
                            <textarea value={draf[key] || ''} onChange={e => setDraf(d => ({ ...d, [key]: e.target.value }))} placeholder="Tulis kendala…" aria-label={'Kendala ' + pn.nama} />
                            <div className="kdo-foot">
                              <span>Tercatat: <b>{fmtTanggalPanjang(hariIni)}</b> · {nama || '-'}</span>
                              <button className="kdo-btn" disabled={!!sibuk || (draf[key] || '').trim().length < 3} onClick={() => catat(pr.proyek, pn.id)}>
                                {sibuk === 'mencatat kendala' ? 'Menyimpan…' : 'Catat kendala'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
