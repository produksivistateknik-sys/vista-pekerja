// BANNER PILIH ULANG SHIFT (12 Nov 2026, keputusan user butir 1-3): tampil di ATAS konten (tidak mengganti/meng-unmount
// halaman) saat hari kerja berganti sementara aplikasi masih terbuka. Pilihan shift kosong (tidak ada yang terpilih
// otomatis dari kemarin). Yang ditahan hanya mulai timer baru (lib/timerShift perluPilihUlangShift); timer berjalan &
// Simpan Progress tetap bisa dipakai.
import { WARNA } from "../lib/warnaTema";
import { simpanSesiShift, labelHariKerja, tanggalSesiKerja, PESAN_PILIH_ULANG } from "../lib/timerShift";

export function BannerPilihShift({ wsKey, onDipilih }: { wsKey: string; onDipilih?: (shift: string) => void }) {
  const pilih = (s: string) => { simpanSesiShift(wsKey, s); onDipilih?.(s); };
  return (
    <div role="alert" style={{ margin: "12px 16px 0", padding: "12px 14px", borderRadius: 14, background: "#fff7e6", border: "1px solid #f5c26b" }}>
      <div style={{ fontWeight: 800, fontSize: 14, color: "#7a4a00" }}>{PESAN_PILIH_ULANG}</div>
      <div style={{ fontSize: 12, color: "#7a4a00", marginTop: 2 }}>
        Hari kerja: {labelHariKerja(tanggalSesiKerja())}. Timer yang sedang berjalan dan Simpan Progress tetap jalan; mulai timer baru setelah memilih shift.
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
        {["1", "2"].map((s) => (
          <button key={s} onClick={() => pilih(s)}
            style={{ flex: 1, padding: "12px", borderRadius: 12, border: `2px solid ${WARNA.aksen}`, background: "#fff", color: WARNA.aksenTeks,
              cursor: "pointer", fontWeight: 800, fontSize: 15, fontFamily: "inherit" }}>
            Shift {s}
          </button>
        ))}
      </div>
    </div>
  );
}
