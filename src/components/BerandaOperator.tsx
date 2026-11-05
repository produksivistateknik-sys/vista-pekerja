// BERANDA OPERATOR (6 Nov 2026) - tampilan saja: header (HeaderOperator), kartu sambutan, grid menu, banner. Acuan: pratinjau
// beranda-operator.html. Daftar menu = menuTiles App.tsx, tidak diubah di sini. Satuan px eksplisit & color-scheme light (alasan
// sama KendalaOperator: index.css sisa template Vite berukuran 18px dan "light dark"; aplikasi operator belum punya tema gelap).
import logoVista from "../assets/kop/vista-logo-clean.png";
import { BannerBeranda } from "./BannerBeranda";

const CSS = `
.bop-hdr{background:linear-gradient(160deg,#3a8df0 0%,#1f6fe5 55%,#1b5fd2 100%);color:#fff;padding:12px 16px 30px;position:sticky;top:0;z-index:100;overflow:hidden;color-scheme:light}
.bop-hdr::before{content:"";position:absolute;right:-60px;top:-90px;width:260px;height:260px;border-radius:50%;background:rgba(255,255,255,.08);pointer-events:none}
.bop-hdr::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:22px;background:#f1f5f9;border-radius:22px 22px 0 0}
.bop-top{display:flex;justify-content:space-between;align-items:center;gap:12px;position:relative}
.bop-logo{flex:none;height:48px;padding:5px 9px;border-radius:14px;background:#fff;display:grid;place-items:center;box-shadow:0 4px 12px rgba(0,0,0,.18)}
.bop-logo img{height:38px;width:auto;display:block}
.bop-kanan{display:flex;align-items:center;gap:2px;min-width:0}
.bop-jam{text-align:right;min-width:0}
.bop-jam b{display:block;font-size:17px;line-height:1.2;white-space:nowrap;font-variant-numeric:tabular-nums;font-weight:700}
.bop-jam span{display:block;font-size:11px;opacity:.9;white-space:nowrap;text-transform:capitalize}
.bop-bell{position:relative;flex:none;width:44px;height:44px;display:grid;place-items:center;border:0;border-radius:12px;background:none;color:#fff;cursor:pointer;font-size:25px}
.bop-bell u{position:absolute;top:7px;right:8px;width:11px;height:11px;border-radius:50%;background:#ff4d4f;border:2px solid #2a7ae8}
.bop-status{display:flex;align-items:center;gap:6px;flex-wrap:wrap;row-gap:6px;margin-top:10px;position:relative}
.bop-status-btn{width:44px;height:44px;flex-shrink:0;border:1px solid #ffffff40;border-radius:10px;background:#ffffff20;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:15px;color:#fff}
.bop-chip-status{background:#ffffff25;color:#fff;border:1px solid #ffffff40;border-radius:20px;padding:2px 10px;font-size:11px;font-weight:700;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bop-hal{font-size:11.5px;color:#ffffffcc}
.bop{--ink:#12306b;--mut:#5a6a89;--ln:#e3eaf6;--ac:#1f6fe5;color-scheme:light;color:var(--ink);max-width:640px;margin:0 auto;padding:6px 16px 18px;display:flex;flex-direction:column;gap:16px;font-size:14px;line-height:1.35;letter-spacing:0;text-align:left}
.bop-wc{border-radius:22px;padding:18px;background:linear-gradient(135deg,#f0f6ff,#dcebff);border:1px solid var(--ln);display:flex;justify-content:space-between;gap:12px;overflow:hidden}
.bop-wc-l{min-width:0;display:flex;flex-direction:column;gap:12px;justify-content:space-between}
.bop-wc small{color:var(--mut);font-size:15px}
.bop-wc h2{margin:0;font-family:inherit;font-size:27px;font-weight:800;line-height:1.1;letter-spacing:0;color:var(--ink);overflow-wrap:anywhere}
.bop-chip{align-self:flex-start;display:inline-flex;gap:6px;align-items:center;background:#dbeafe;color:#1b57c0;border-radius:99px;padding:5px 12px;font-weight:700;font-size:14px}
.bop-wc-r{flex:none;display:flex;align-items:center}
.bop-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.bop .menu-tile-np{background:#fff;border-radius:20px;box-shadow:0 6px 18px rgba(31,80,160,.10);border:1px solid var(--ln);padding:16px 6px 14px;display:flex;flex-direction:column;align-items:center;gap:12px;font:inherit;font-weight:700;font-size:13.5px;color:var(--ink);text-align:center;overflow-wrap:anywhere;cursor:pointer;min-height:44px;transition:transform .12s}
.bop .menu-tile-np:active{transform:translateY(-2px)}
.bop-ic{width:60px;height:60px;border-radius:18px;display:grid;place-items:center;color:#fff;box-shadow:0 6px 14px rgba(0,0,0,.14);font-size:30px}
@media(max-width:374px){.bop-ic{width:52px;height:52px;font-size:26px}.bop-wc-r{display:none}}
.bop-car{display:flex;flex-direction:column;gap:2px;min-width:0}
.bop-track{display:flex;overflow-x:auto;overflow-anchor:none;scroll-snap-type:x mandatory;scrollbar-width:none;border-radius:20px;-webkit-overflow-scrolling:touch}
.bop-track::-webkit-scrollbar{display:none}
.bop-sl{flex:none;width:100%;scroll-snap-align:start;scroll-snap-stop:always;text-align:left;display:flex;align-items:center;gap:14px;background:linear-gradient(135deg,#eef5ff,#e3efff);border:1px solid var(--ln);border-radius:20px;padding:14px 16px;min-height:96px;font:inherit;color:inherit}
button.bop-sl{cursor:pointer}
.bop-il{flex:none;width:64px;height:70px;display:grid;place-items:center}
.bop-lg{width:64px;height:60px;border-radius:18px;background:#fff;display:grid;place-items:center;box-shadow:0 6px 16px rgba(31,80,160,.18)}
.bop-lg img{width:56px;height:auto;display:block}
.bop-stx{flex:1;min-width:0}
.bop-stx b{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:15px;line-height:1.25}
.bop-stx>span{display:block;font-size:12.5px;color:var(--mut);margin-top:2px}
.bop-stx i{font-style:normal;font-weight:700}
.bop-merah{color:#b4232a}.bop-amber{color:#9a5a00}
.bop-panah{flex:none;color:var(--ac);font-size:20px}
.bop-dots{display:flex;justify-content:center;align-items:center}
.bop-dots button{width:44px;height:44px;border:0;background:none;padding:0;display:grid;place-items:center;cursor:pointer}
.bop-dots button span{display:block;width:8px;height:8px;border-radius:99px;background:#c6d3e8;transition:width .2s,background .2s}
.bop-dots button[aria-current="true"] span{width:22px;background:var(--ac)}
.bop-jeda{color:var(--mut);font-size:17px}
.bop button:focus-visible,.bop-hdr button:focus-visible{outline:2px solid var(--ac);outline-offset:2px}
.bop-hdr button:focus-visible{outline-color:#fff}
.bop-nav{position:sticky;bottom:0;background:#fff;border-top:1px solid #e3eaf6;display:flex;padding-bottom:env(safe-area-inset-bottom);z-index:100;box-shadow:0 -4px 14px #00000010;color-scheme:light}
.bop-nv{flex:1;min-width:0;min-height:56px;border:0;background:none;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:8px 2px 9px;color:#6f7d99;font:inherit;font-size:11px;font-weight:600;line-height:1.15;text-align:center;position:relative}
.bop-nv i{font-size:24px}
.bop-nv[aria-current="page"]{color:#1f6fe5;font-weight:700}
.bop-nv[aria-current="page"]::after{content:"";position:absolute;bottom:2px;width:34px;height:3px;border-radius:3px;background:#1f6fe5}
`;

// Warna ikon per menu (acuan pratinjau); menu tanpa warna khusus memakai biru.
const WARNA_MENU: Record<string, [string, string]> = {
  tugas: ["#34c07a", "#1fa65a"], kendala: ["#ff7a7f", "#f2434f"], arsip: ["#2dbf86", "#13975f"], permintaan: ["#a66cf0", "#7b3fd6"],
  proyekluar: ["#ffb547", "#f5921a"], inventaris: ["#ffb547", "#f5921a"], produksistok: ["#ffb547", "#f5921a"], review: ["#2dbf86", "#13975f"],
  tambahan: ["#a66cf0", "#7b3fd6"], komponen: ["#2dbf86", "#13975f"],
};
const BIRU: [string, string] = ["#4aa0ff", "#1f78e8"];

export type TileMenu = { key: string; label: string; icon: string };

export function HeaderOperator({ jamText, tanggalText, notifCount, onLonceng, children }: { jamText: string; tanggalText: string; notifCount: number; onLonceng: () => void; children: React.ReactNode }) {
  return (
    <>
      <style>{CSS}</style>
      <header className="bop-hdr" style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
        <div className="bop-top">
          <span className="bop-logo"><img src={logoVista} alt="Vista Teknik" /></span>
          <div className="bop-kanan">
            <div className="bop-jam"><b>{jamText}</b><span>{tanggalText}</span></div>
            <button type="button" className="bop-bell" onClick={onLonceng} aria-label={notifCount > 0 ? `Notifikasi, ${notifCount} permintaan perlu perhatian` : "Notifikasi"}>
              <i className="ti ti-bell" aria-hidden="true" />{notifCount > 0 && <u />}
            </button>
          </div>
        </div>
        <div className="bop-status">{children}</div>
      </header>
    </>
  );
}

export function BerandaOperator({ nama, divisiLabel, divisiIkon, menu, onPilihMenu, onBukaJadwal, onBukaPermintaan }: {
  nama: string; divisiLabel: string; divisiIkon?: string; menu: TileMenu[]; onPilihMenu: (key: string) => void; onBukaJadwal: () => void; onBukaPermintaan: () => void;
}) {
  return (
    <main className="bop fi">
      <section className="bop-wc">
        <div className="bop-wc-l">
          <div><small>Selamat datang,</small><h2>{nama}</h2></div>
          <span className="bop-chip">{divisiIkon} {divisiLabel}</span>
        </div>
        <div className="bop-wc-r">
          <svg width="92" height="78" viewBox="0 0 92 78" aria-hidden="true"><rect x="38" y="6" width="42" height="66" rx="9" fill="#2f7be8" opacity=".9" /><rect x="43" y="14" width="32" height="50" rx="5" fill="#cfe3ff" /><path d="M52 34l9-5 9 5v11l-9 5-9-5z" fill="#fff" stroke="#8fb8f2" strokeWidth="2" strokeLinejoin="round" /><path d="M52 34l9 5 9-5M61 39v11" fill="none" stroke="#8fb8f2" strokeWidth="2" /><circle cx="20" cy="46" r="7" fill="#9cc2f5" opacity=".6" /><circle cx="12" cy="30" r="3.5" fill="#9cc2f5" opacity=".5" /></svg>
        </div>
      </section>
      <section className="bop-grid" aria-label="Menu">
        {menu.map((t) => {
          const [a, b] = WARNA_MENU[t.key] || BIRU;
          return (
            <button key={t.key} type="button" className="menu-tile-np" onClick={() => onPilihMenu(t.key)}>
              <span className="bop-ic" style={{ background: `linear-gradient(145deg,${a},${b})` }}><i className={`ti ti-${t.icon}`} aria-hidden="true" /></span>
              {t.label}
            </button>
          );
        })}
      </section>
      <BannerBeranda onBukaJadwal={onBukaJadwal} onBukaPermintaan={onBukaPermintaan} />
    </main>
  );
}
