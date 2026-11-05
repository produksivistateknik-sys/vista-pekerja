// Data Pengingat Wiring utk App (lib/pengingatWiring). Hanya dipasang sekali di App: kanalnya bernama tetap per orang.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import { laporError } from "./laporError";
import { pasangPemulihRealtime } from "./pemulihRealtime";
import { muatPengingat, penerimaPengingat, susunKartu, tandaiPengingat, type Pengingat } from "./pengingatWiring";

const kunciBanner = (id: number) => `vista_pekerja_pengingat_banner_${id}`;
const bacaBannerTutup = (id: number) => { try { return Number(localStorage.getItem(kunciBanner(id))) || 0; } catch { return 0; } };

export function usePengingatWiring(user: any) {
  const aktif = penerimaPengingat(user);
  const pekerjaId = aktif ? Number(user.id) : 0;
  const [baris, setBaris] = useState<Pengingat[]>([]);
  const [dibaca, setDibaca] = useState<Set<number>>(new Set());
  const [bannerTutup, setBannerTutup] = useState(0);

  useEffect(() => {
    if (!pekerjaId) return;
    let batal = false;
    const muat = async () => {
      try {
        const h = await muatPengingat(supabase, pekerjaId);
        if (!batal) { setBaris(h.baris); setDibaca(h.dibaca); }
      } catch (e) {   // gagal muat = daftar lama dipertahankan
        console.error("[pengingat wiring] gagal memuat:", e);
        laporError("supabase_error", e, { aksi: "muat pengingat wiring" });
      }
    };
    const t = setTimeout(() => { setBannerTutup(bacaBannerTutup(pekerjaId)); muat(); }, 0);
    const lepas = pasangPemulihRealtime(supabase, { nama: `pengingat-wiring-${pekerjaId}`, tabel: "wiring_pengingat", label: "pengingat wiring", jedaMs: 800, muat });
    return () => { batal = true; clearTimeout(t); lepas(); };
  }, [pekerjaId]);

  const kartu = useMemo(() => susunKartu(baris, dibaca), [baris, dibaca]);
  const belumKartu = useMemo(() => kartu.filter(k => k.belumDibaca), [kartu]);
  const bannerKartu = belumKartu[0] && belumKartu[0].idTerbaru > bannerTutup ? belumKartu[0] : null;

  const tandai = useCallback(async (ids: number[]) => {
    setDibaca(d => new Set([...d, ...ids]));
    try { await tandaiPengingat(supabase, user, ids); }
    catch (e) {
      console.error("[pengingat wiring] gagal menandai dibaca:", e);
      laporError("gagal_simpan", e, { aksi: "tandai pengingat wiring", jumlah: ids.length });
      setDibaca(d => { const s = new Set(d); ids.forEach(i => s.delete(i)); return s; });
      alert("Gagal menandai pengingat sudah dibaca. Coba lagi.");
    }
  }, [user]);
  const tutupBanner = useCallback((id: number) => {
    setBannerTutup(id);
    try { localStorage.setItem(kunciBanner(pekerjaId), String(id)); } catch { /* storage diblokir: banner muncul lagi saat dibuka ulang */ }
  }, [pekerjaId]);

  return { aktif, kartu, belumKartu, bannerKartu, tandai, tutupBanner };
}
