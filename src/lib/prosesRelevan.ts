// Baca SEMUA bom_proses_relevan (15 Okt 2026) - paginasi .range() + urutan tetap + cek error (aturan A.1/A.2).
// Tabel ini sudah >1000 baris (1005 per 15 Okt): select("*") tanpa range terpotong diam-diam di 1000 -> sebagian
// proses relevan komponen hilang (insiden WO 069 DP-ROOF OU_FS.1 di Vista Teknik). Pola sama dgn loader
// OperatorView.tsx (fix 29 Sep 2026). Gagal = throw (pemanggil memutuskan: jangan pakai data setengah).
import { supabase } from "./supabase";

export type BarisProsesRelevan = { kode_komponen: string; tipe_panel: string; jenis_pekerjaan: string };

export async function bacaSemuaProsesRelevan(): Promise<BarisProsesRelevan[]> {
  const semua: BarisProsesRelevan[] = [];
  for (let dari = 0; ; dari += 1000) {
    const { data, error } = await supabase.from("bom_proses_relevan")
      .select("kode_komponen,tipe_panel,jenis_pekerjaan")
      .order("kode_komponen").order("tipe_panel").order("jenis_pekerjaan")
      .range(dari, dari + 999);
    if (error) throw new Error("bom_proses_relevan: " + error.message);
    semua.push(...((data as any[]) || []));
    if (!data || data.length < 1000) return semua;
  }
}
