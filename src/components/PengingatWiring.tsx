// PENGINGAT WIRING (6 Nov 2026) - lonceng, laci, dan banner utk operator Wiring Control & Wiring Power (lihat lib/pengingatWiring).
// Tanpa bunyi/getar (keputusan user). Divisi lain: hook mati, lonceng tetap langsung ke Permintaan.
// memo: App dirender ulang tiap detik (jam header).
import { memo, useEffect } from "react";
import type { KartuPengingat } from "../lib/pengingatWiring";
import { WARNA } from "../lib/warnaTema";

const CSS = `
.pw{color-scheme:light}
.pw button{font-family:inherit;cursor:pointer}
.pw button:focus-visible{outline:2px solid ${WARNA.aksen};outline-offset:2px}
.pw-ban{display:flex;align-items:stretch;gap:6px;padding:8px 12px;background:#eff6ff;border-bottom:1px solid #bfdbfe}
.pw-ban-isi{flex:1;min-width:0;display:flex;gap:8px;align-items:flex-start;text-align:left;border:0;background:none;color:${WARNA.tinta};padding:4px 0;min-height:44px}
.pw-ban-isi i{font-size:18px;color:${WARNA.aksen};margin-top:1px}
.pw-ban-isi span{font-size:12.5px;line-height:1.35;overflow-wrap:anywhere;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}
.pw-lagi{flex:none;align-self:center;min-height:44px;padding:0 10px;border:1px solid #bfdbfe;border-radius:10px;background:#fff;color:${WARNA.aksenTeks};font-size:12px;font-weight:700}
.pw-tutup{flex:none;align-self:center;width:44px;height:44px;border:0;border-radius:10px;background:none;color:#475569;font-size:17px}
.pw-lapis{position:fixed;inset:0;z-index:400;background:#0f172a80;display:flex;align-items:flex-end;justify-content:center}
.pw-laci{width:100%;max-width:560px;max-height:85vh;display:flex;flex-direction:column;background:#fff;color:#1e293b;border-radius:18px 18px 0 0;padding-bottom:env(safe-area-inset-bottom)}
.pw-kep{display:flex;align-items:center;gap:8px;padding:12px 8px 12px 16px;border-bottom:1px solid #e2e8f0}
.pw-kep b{flex:1;font-size:15px}
.pw-semua{min-height:44px;padding:0 10px;border:0;background:none;color:${WARNA.aksenTeks};font-size:12.5px;font-weight:700}
.pw-daftar{overflow-y:auto;overscroll-behavior:contain;padding:8px 12px 14px}
.pw-kartu{display:block;width:100%;text-align:left;border:1px solid #e2e8f0;border-radius:12px;background:#fff;color:#334155;padding:11px 12px;margin-top:8px;font-size:13px;line-height:1.4;overflow-wrap:anywhere}
.pw-kartu.baru{background:#eff6ff;border-color:#93c5fd;color:#1e293b;font-weight:600}
.pw-kartu small{display:block;margin-top:4px;color:#64748b;font-size:11.5px;font-weight:400}
.pw-kosong{padding:26px 8px;text-align:center;color:#64748b;font-size:13px}
`;

const fmtWaktu = (v: string) => new Date(v).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export const BannerPengingat = memo(function BannerPengingat({ kartu, lebih, onBuka, onLihatSemua, onTutup }: {
  kartu: KartuPengingat; lebih: number; onBuka: (k: KartuPengingat) => void; onLihatSemua: () => void; onTutup: (id: number) => void }) {
  return <div className="pw pw-ban" role="status">
    <style>{CSS}</style>
    <button type="button" className="pw-ban-isi" onClick={() => onBuka(kartu)}><i className="ti ti-bell-ringing" aria-hidden="true" /><span>{kartu.pesan}</span></button>
    {lebih > 0 && <button type="button" className="pw-lagi" onClick={onLihatSemua}>+{lebih} lagi</button>}
    <button type="button" className="pw-tutup" aria-label="Tutup pengingat" onClick={() => onTutup(kartu.idTerbaru)}><i className="ti ti-x" aria-hidden="true" /></button>
  </div>;
});

export function LaciPengingat({ kartu, notifCount, onTutup, onBuka, onBukaPermintaan, onTandaiSemua }: {
  kartu: KartuPengingat[]; notifCount: number; onTutup: () => void; onBuka: (k: KartuPengingat) => void; onBukaPermintaan: () => void; onTandaiSemua: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onTutup(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onTutup]);
  const adaBelum = kartu.some(k => k.belumDibaca);
  return <div className="pw pw-lapis" onClick={e => { if (e.target === e.currentTarget) onTutup(); }}>
    <style>{CSS}</style>
    <div className="pw-laci" role="dialog" aria-modal="true" aria-label="Notifikasi">
      <div className="pw-kep"><b>Notifikasi</b>
        {adaBelum && <button type="button" className="pw-semua" onClick={onTandaiSemua}>Tandai semua dibaca</button>}
        <button type="button" className="pw-tutup" aria-label="Tutup" onClick={onTutup}><i className="ti ti-x" aria-hidden="true" /></button></div>
      <div className="pw-daftar">
        {notifCount > 0 && <button type="button" className="pw-kartu baru" onClick={onBukaPermintaan}>{notifCount} permintaan perlu perhatian<small>Buka menu Permintaan</small></button>}
        {kartu.map(k => <button key={k.kunci} type="button" className={"pw-kartu" + (k.belumDibaca ? " baru" : "")} onClick={() => onBuka(k)}>{k.pesan}<small>{fmtWaktu(k.waktu)}{k.belumDibaca ? " · belum dibaca" : ""}</small></button>)}
        {!kartu.length && !notifCount && <div className="pw-kosong">Belum ada pengingat.</div>}
      </div>
    </div>
  </div>;
}
