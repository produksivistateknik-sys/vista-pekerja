// BANNER BERANDA OPERATOR (6 Nov 2026) - kartu geser otomatis: deadline mendesak (lib/deadlineBanner), pengingat permintaan
// barang, Vista Apps. Selalu bergerak maju: kartu pertama disalin di ujung, begitu mendarat di salinan posisi dilompat diam-diam
// ke awal (tanpa meluncur mundur). Jeda: disentuh/fokus/kursor di atasnya, tombol jeda, tab tersembunyi, prefers-reduced-motion.
// Data deadline tanpa realtime: dimuat saat Beranda dibuka, disegarkan saat tab aktif/online lagi. Gagal muat = dua kartu tetap
// tampil. memo: App dirender ulang tiap detik (jam header) - tanpa ini banner ikut dirender.
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { hariIniWib } from "../lib/tanggalWib";
import { laporError } from "../lib/laporError";
import { pasangPemulihRealtime } from "../lib/pemulihRealtime";
import { labelSisaHari, labelTanggalDeadline, muatWoDeadline, pilihKartuDeadline, type WoDeadline } from "../lib/deadlineBanner";
import logoVista from "../assets/kop/vista-logo-clean.png";

const JEDA_KARTU_MS = 5000;
const JEDA_SETELAH_SENTUH_MS = 6000;
type Kartu = { kunci: string; ilustrasi: "kalender" | "daftar" | "logo"; judul: string; sub: string; catatan?: string; tingkat?: "merah" | "amber"; aksi?: () => void };

function Ilustrasi({ jenis }: { jenis: Kartu["ilustrasi"] }) {
  if (jenis === "logo") return <span className="bop-lg"><img src={logoVista} alt="" /></span>;
  if (jenis === "kalender") return (
    <svg width="64" height="70" viewBox="0 0 64 70" aria-hidden="true"><rect x="10" y="12" width="44" height="50" rx="8" fill="#fff" stroke="#9cc2f5" strokeWidth="2" /><rect x="10" y="12" width="44" height="14" rx="8" fill="#2f7be8" /><rect x="10" y="20" width="44" height="6" fill="#2f7be8" /><rect x="20" y="6" width="4" height="12" rx="2" fill="#2f7be8" /><rect x="40" y="6" width="4" height="12" rx="2" fill="#2f7be8" /><g fill="#b9d4f7"><circle cx="22" cy="36" r="2.6" /><circle cx="32" cy="36" r="2.6" /><circle cx="42" cy="36" r="2.6" /><circle cx="22" cy="46" r="2.6" /><circle cx="32" cy="46" r="2.6" /></g><circle cx="44" cy="50" r="9" fill="#ef4b52" /><path d="M44 45v6M44 54.4v.1" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" /></svg>
  );
  return (
    <svg width="64" height="70" viewBox="0 0 64 70" aria-hidden="true"><rect x="12" y="8" width="40" height="56" rx="8" fill="#fff" stroke="#9cc2f5" strokeWidth="2" /><rect x="24" y="3" width="16" height="10" rx="4" fill="#2f7be8" /><g fill="#2f7be8"><circle cx="22" cy="27" r="2.6" /><circle cx="22" cy="38" r="2.6" /><circle cx="22" cy="49" r="2.6" /></g><g stroke="#b9d4f7" strokeWidth="3" strokeLinecap="round"><path d="M30 27h14M30 38h14M30 49h14" /></g></svg>
  );
}

function IsiKartu({ k }: { k: Kartu }) {
  return (
    <>
      <span className="bop-il"><Ilustrasi jenis={k.ilustrasi} /></span>
      <span className="bop-stx">
        <b>{k.judul}</b>
        <span>{k.sub}{k.catatan ? " · " : ""}{k.catatan ? <i className={k.tingkat === "merah" ? "bop-merah" : "bop-amber"}>{k.catatan}</i> : null}</span>
      </span>
      {k.aksi ? <i className="ti ti-chevron-right bop-panah" aria-hidden="true" /> : null}
    </>
  );
}

function Slide({ k, label, salinan }: { k: Kartu; label: string; salinan?: boolean }) {
  const umum = { className: "bop-sl", "aria-label": salinan ? undefined : label, "aria-hidden": salinan ? true : undefined };
  return k.aksi
    ? <button type="button" {...umum} tabIndex={salinan ? -1 : undefined} onClick={k.aksi}><IsiKartu k={k} /></button>
    : <div {...umum}><IsiKartu k={k} /></div>;
}

export const BannerBeranda = memo(function BannerBeranda({ onBukaJadwal, onBukaPermintaan }: { onBukaJadwal: () => void; onBukaPermintaan: () => void }) {
  const [wos, setWos] = useState<WoDeadline[]>([]);
  const [hariIni, setHariIni] = useState(hariIniWib);
  const [idx, setIdx] = useState(0);
  const [dijeda, setDijeda] = useState(false);
  const [gerakDikurangi, setGerakDikurangi] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  const trackRef = useRef<HTMLDivElement>(null);
  const idxRef = useRef(0);
  const sentuhRef = useRef(0);

  useEffect(() => {
    let batal = false;
    const muat = async () => {
      setHariIni(hariIniWib());
      try { const data = await muatWoDeadline(); if (!batal) setWos(data); }
      catch (e) {
        console.error("[Banner Beranda] gagal memuat deadline (banner tetap tampil tanpa kartu deadline):", e);
        laporError("supabase_error", e, { aksi: "muat deadline banner beranda" });
      }
    };
    muat();
    const lepas = pasangPemulihRealtime(supabase, { nama: "banner-beranda", tabel: [], muat, pollingMs: 0, label: "Banner Beranda" });
    const iv = setInterval(() => setHariIni(hariIniWib()), 60000); // "N hari lagi" ikut berganti walau layar dibiarkan terbuka
    return () => { batal = true; lepas(); clearInterval(iv); };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const f = () => setGerakDikurangi(mq.matches);
    mq.addEventListener?.("change", f);
    return () => mq.removeEventListener?.("change", f);
  }, []);

  const kartu = useMemo<Kartu[]>(() => [
    ...pilihKartuDeadline(wos, hariIni).map((d): Kartu => ({
      kunci: "wo-" + d.id, ilustrasi: "kalender", judul: `${d.proyek} · WO ${d.wo}`, sub: `Deadline ${labelTanggalDeadline(d.target)}`,
      catatan: labelSisaHari(d.hari), tingkat: d.hari <= 2 ? "merah" : "amber", aksi: onBukaJadwal,
    })),
    { kunci: "permintaan", ilustrasi: "daftar", judul: "Jangan lupa ajukan permintaan barang", sub: "Ajukan lewat menu Permintaan sebelum jam pulang", aksi: onBukaPermintaan },
    { kunci: "vista", ilustrasi: "logo", judul: "Pengelolaan data lebih mudah dengan Vista Apps", sub: "Semua menu tersedia dalam satu aplikasi" },
  ], [wos, hariIni, onBukaJadwal, onBukaPermintaan]);
  const n = kartu.length;

  // Kartu deadline tiba belakangan & disisipkan di depan: browser mempertahankan kartu yang terlihat, sehingga banner mulai dari
  // kartu Permintaan. Saat jumlah kartu berubah posisi kembali ke kartu pertama.
  useLayoutEffect(() => {
    const t = trackRef.current;
    if (!t) return;
    t.style.scrollSnapType = "none";
    t.scrollLeft = 0;
    idxRef.current = 0;
    setIdx(0);
    requestAnimationFrame(() => { t.style.scrollSnapType = ""; });
  }, [n]);

  const ke = useCallback((i: number) => {
    const t = trackRef.current;
    if (!t) return;
    t.scrollTo({ left: i * t.clientWidth, behavior: gerakDikurangi ? "auto" : "smooth" });
  }, [gerakDikurangi]);

  useEffect(() => {
    const iv = setInterval(() => {
      if (gerakDikurangi || dijeda || n < 2 || document.hidden) return;
      if (Date.now() - sentuhRef.current < JEDA_SETELAH_SENTUH_MS) return;
      ke(idxRef.current + 1); // boleh = n (salinan kartu pertama); lompat diam-diam di saatScroll
    }, JEDA_KARTU_MS);
    return () => clearInterval(iv);
  }, [gerakDikurangi, dijeda, n, ke]);

  const reda = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (reda.current) clearTimeout(reda.current); }, []);
  const saatScroll = () => {
    const t = trackRef.current;
    if (!t || !t.clientWidth) return;
    const mentah = Math.round(t.scrollLeft / t.clientWidth);
    const i = mentah % n;
    if (i !== idxRef.current) { idxRef.current = i; setIdx(i); }
    if (reda.current) clearTimeout(reda.current);
    reda.current = setTimeout(() => {
      if (Math.round(t.scrollLeft / t.clientWidth) < n) return;
      t.style.scrollSnapType = "none";
      t.scrollLeft = 0;
      requestAnimationFrame(() => { t.style.scrollSnapType = ""; });
    }, 160);
  };
  const sentuh = () => { sentuhRef.current = Date.now(); };

  return (
    <section className="bop-car" aria-roledescription="carousel" aria-label="Pengingat dan deadline">
      <div className="bop-track" ref={trackRef} onScroll={saatScroll} onPointerDown={sentuh} onTouchStart={sentuh} onFocus={sentuh} onMouseEnter={sentuh}>
        {kartu.map((k, i) => <Slide key={k.kunci} k={k} label={`Kartu ${i + 1} dari ${n}: ${k.judul}`} />)}
        <Slide key="salinan" k={kartu[0]} label="" salinan />
      </div>
      <div className="bop-dots">
        {kartu.map((k, i) => (
          <button key={k.kunci} type="button" aria-label={`Kartu ${i + 1}`} aria-current={i === idx ? "true" : undefined} onClick={() => { sentuh(); ke(i); }}><span /></button>
        ))}
        {!gerakDikurangi && (
          <button type="button" className="bop-jeda" aria-pressed={dijeda} aria-label={dijeda ? "Lanjutkan banner" : "Jeda banner"} onClick={() => setDijeda((x) => !x)}>
            <i className={`ti ti-player-${dijeda ? "play" : "pause"}`} aria-hidden="true" />
          </button>
        )}
      </div>
    </section>
  );
});
