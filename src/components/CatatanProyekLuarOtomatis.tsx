// KOTAK CATATAN PROYEK LUAR YANG TERSIMPAN OTOMATIS (24 Okt 2026, pantau harian). Dipakai ProyekLuarView utk laporan milik
// operator yang masih Berlangsung. Alur & aturan kirim ulang: lib/drafCatatanProyekLuar (draf di HP -> RPC dgn cek bentrok).
// Disimpan ~2 detik setelah berhenti mengetik dan saat kotak ditinggalkan; status selalu terlihat ("Tersimpan 14:05" /
// "Belum terkirim" / bentrok). Tidak ada tombol simpan.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { alertGagalSimpan } from "../lib/koneksi";
import { labelWaktuPL } from "../lib/proyekLuarPantau";
import { bacaDraf, simpanDraf, hapusDraf, kirimCatatan, kirimSemuaDraf, normCatatan, bacaSemuaDraf, EVENT_DRAF_CATATAN_PL } from "../lib/drafCatatanProyekLuar";

type Status = "tersimpan" | "mengetik" | "mengirim" | "tertunda" | "bentrok" | "ditolak";
const JEDA_SIMPAN_MS = 2000;

export function CatatanProyekLuarOtomatis({ laporan, user, onTersimpan }: { laporan: any; user: any; onTersimpan: (data: any) => void }) {
  const id = Number(laporan.id);
  const oleh = String(user?.nama || user?.name || "Operator");
  const awal = bacaDraf(id);
  const [teks, setTeks] = useState<string>(awal ? awal.teks : laporan.catatan || "");
  const [status, setStatusState] = useState<Status>(awal ? (awal.bentrok ? "bentrok" : "tertunda") : "tersimpan");
  const [waktu, setWaktu] = useState<string | null>(null);
  const [server, setServer] = useState<any>(null);       // isi server saat bentrok
  const [pesan, setPesan] = useState("");
  const teksRef = useRef(teks), dasarRef = useRef<string | null>(awal ? awal.dasar : laporan.catatan ?? null);
  const statusRef = useRef<Status>(status);
  const setStatus = (v: Status) => { statusRef.current = v; setStatusState(v); };
  const timer = useRef<any>(null), kirimRef = useRef(false), ulangRef = useRef(false);
  const onTersimpanRef = useRef(onTersimpan);
  useEffect(() => { onTersimpanRef.current = onTersimpan; });

  const muatServer = async () => {
    const { data, error } = await supabase.from("proyek_luar" as any).select("id,catatan,catatan_diubah_oleh,catatan_diubah_pada").eq("id", id).range(0, 0);
    if (error) { console.error("[Catatan Proyek Luar] gagal memuat versi terbaru:", error); return null; }
    return (data as any)?.[0] || null;
  };
  const kirim = async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (kirimRef.current) { ulangRef.current = true; return; }
    if (statusRef.current === "bentrok" || statusRef.current === "ditolak") return;
    const teksKirim = teksRef.current;
    if (normCatatan(teksKirim) === normCatatan(dasarRef.current)) { hapusDraf(id, teksKirim); setStatus("tersimpan"); return; }
    kirimRef.current = true; setStatus("mengirim");
    const r = await kirimCatatan(id, { teks: teksKirim, dasar: dasarRef.current, pekerjaId: user.id, oleh });
    kirimRef.current = false;
    if (r.status === "ok") {
      dasarRef.current = r.data?.catatan ?? null;
      hapusDraf(id, teksKirim);
      setWaktu(new Date().toISOString()); onTersimpanRef.current(r.data);
      if (teksRef.current !== teksKirim) { simpanDraf(id, { teks: teksRef.current, dasar: dasarRef.current, pekerjaId: user.id, oleh }); ulangRef.current = true; }
      else setStatus("tersimpan");
    } else if (r.status === "koneksi") {
      setStatus("tertunda");
    } else if (r.status === "bentrok") {
      const d = bacaDraf(id); if (d) simpanDraf(id, { ...d, bentrok: true });
      setServer(await muatServer()); setStatus("bentrok");
    } else {
      hapusDraf(id); setStatus("ditolak"); setPesan(String(r.error?.message || r.error));
      alertGagalSimpan(r.error, `Simpan catatan Proyek Luar ${id}`, { aksi: "simpan catatan proyek luar",
        catatanServer: "Catatan belum berubah. Laporan yang sudah Selesai tidak bisa diubah dari aplikasi ini." });
    }
    if (ulangRef.current) { ulangRef.current = false; kirim(); }
  };
  const kirimRefFn = useRef(kirim);
  useEffect(() => { kirimRefFn.current = kirim; });

  const ubah = (v: string) => {
    teksRef.current = v; setTeks(v);
    simpanDraf(id, { teks: v, dasar: dasarRef.current, pekerjaId: user.id, oleh });
    if (statusRef.current !== "mengirim") setStatus("mengetik");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; kirimRefFn.current(); }, JEDA_SIMPAN_MS);
  };

  // Mulai: draf tertunda dari sesi sebelumnya langsung dicoba kirim. Sinyal kembali / aplikasi dibuka lagi -> coba lagi.
  useEffect(() => {
    if (statusRef.current === "tertunda") kirimRefFn.current();
    if (statusRef.current === "bentrok") muatServer().then(setServer);
    const coba = () => { if (document.visibilityState === "visible" && statusRef.current === "tertunda") kirimRefFn.current(); };
    const dariLuar = () => { if (statusRef.current === "tertunda" && !bacaSemuaDraf()[String(id)]) setStatus("tersimpan"); }; // terkirim oleh pengirim latar
    window.addEventListener("online", coba); document.addEventListener("visibilitychange", coba); window.addEventListener(EVENT_DRAF_CATATAN_PL, dariLuar);
    return () => {
      window.removeEventListener("online", coba); document.removeEventListener("visibilitychange", coba); window.removeEventListener(EVENT_DRAF_CATATAN_PL, dariLuar);
      if (timer.current) { clearTimeout(timer.current); timer.current = null; kirimSemuaDraf(); } // ditutup sebelum jeda habis -> draf dikirim
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  // Catatan di server berubah (dimuat ulang) & tidak ada tulisan yang belum terkirim -> ikuti server.
  useEffect(() => {
    if (bacaDraf(id) || ["mengetik", "mengirim", "bentrok"].includes(statusRef.current)) return;
    dasarRef.current = laporan.catatan ?? null;
    if (normCatatan(teksRef.current) !== normCatatan(laporan.catatan)) { teksRef.current = laporan.catatan || ""; setTeks(laporan.catatan || ""); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laporan.catatan]);

  const pakaiPunyaSaya = () => {
    dasarRef.current = server?.catatan ?? null;
    simpanDraf(id, { teks: teksRef.current, dasar: dasarRef.current, pekerjaId: user.id, oleh });
    setServer(null); setStatus("tertunda"); kirim();
  };
  const pakaiTerbaru = () => {
    const t = server?.catatan || "";
    teksRef.current = t; setTeks(t); dasarRef.current = server?.catatan ?? null;
    hapusDraf(id); setServer(null); setStatus("tersimpan");
  };

  const baris = Math.min(12, Math.max(4, teks.split(/\r?\n/).length + 1));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>Catatan / deskripsi pekerjaan</label>
      <textarea value={teks} onChange={(e) => ubah(e.target.value)} onBlur={() => { if (timer.current) kirim(); }} rows={baris}
        disabled={status === "ditolak"} placeholder="Tulis pekerjaan yang dilakukan - tersimpan otomatis, bisa ditambah kapan saja selama Berlangsung"
        style={{ width: "100%", boxSizing: "border-box", padding: 10, borderRadius: 8, border: `1.5px solid ${status === "tertunda" ? "#fbbf24" : "#e2e8f0"}`,
          fontSize: 13, lineHeight: 1.5, fontFamily: "inherit", resize: "vertical" }} />
      {status === "tersimpan" && <div style={{ fontSize: 11, color: "#16a34a" }}>✓ Tersimpan otomatis{waktu ? " " + labelWaktuPL(waktu) : ""}</div>}
      {status === "mengetik" && <div style={{ fontSize: 11, color: "#94a3b8" }}>Menyimpan sebentar lagi…</div>}
      {status === "mengirim" && <div style={{ fontSize: 11, color: "#94a3b8" }}>Menyimpan…</div>}
      {status === "tertunda" && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 11, color: "#b45309", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "6px 8px" }}>
          <span>⏳ Belum terkirim - tulisan aman di HP ini, dikirim otomatis saat sinyal kembali.</span>
          <button onClick={() => kirim()} style={{ flexShrink: 0, border: 0, background: "#d97706", color: "#fff", borderRadius: 6, padding: "4px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Kirim sekarang</button>
        </div>
      )}
      {status === "bentrok" && (
        <div style={{ fontSize: 11.5, color: "#92400e", background: "#fefce8", border: "1px solid #fde047", borderRadius: 8, padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          <span>Catatan ini baru saja diubah {server?.catatan_diubah_oleh || "orang lain"}. Tulisan Anda belum menimpa apa pun.</span>
          {server && <span style={{ whiteSpace: "pre-wrap", color: "#475569", background: "#fff", borderRadius: 6, padding: 6 }}>Versi terbaru: {server.catatan || "(kosong)"}</span>}
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <button onClick={pakaiTerbaru} style={{ border: "1px solid #e2e8f0", background: "#fff", color: "#475569", borderRadius: 6, padding: "5px 10px", fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>Pakai versi terbaru</button>
            <button onClick={pakaiPunyaSaya} style={{ border: 0, background: "#1d4ed8", color: "#fff", borderRadius: 6, padding: "5px 10px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>Pakai tulisan saya</button>
          </div>
        </div>
      )}
      {status === "ditolak" && <div style={{ fontSize: 11, color: "#b91c1c" }}>Tidak tersimpan: {pesan}</div>}
    </div>
  );
}
