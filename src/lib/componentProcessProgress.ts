// Fase 2-5 (21 Sep 2026) - helper baca/tulis tabel component_process_progress. Domain aktif:
// Pasang Komponen (KomponenPasangView.tsx, Fase 2), WIRING CONTROL/POWER + BUSBAR + proses
// biasa (OperatorView.tsx, Fase 3-5) - SEMUA proses kecuali QC TEST/PACKING/NAMEPLATE/
// YELLOWMARK (struktur beda total, di luar scope - lihat FASE5_PROSES_BIASA_DESIGN.md).
// DUAL-WRITE bersamaan dengan mergePanelChecklist() - checklist TETAP ditulis paralel sebagai
// jaring pengaman, TAPI consumer admin (Task Monitoring/Detail Progres/Rencana Harian/
// Dashboard/Summary Progress/Manajemen WO, vista-teknik) SEKARANG SUDAH baca dari tabel ini
// duluan (Fase 6-10), checklist cuma fallback. Lihat
// supabase/FASE2_COMPONENT_PROCESS_PROGRESS_DESIGN.md dst (vista-teknik repo) utk desain lengkap.
//
// SATU SUMBER LOGIKA (CLAUDE.md B.1) - pctToStatus() ini SATU-SATUNYA tempat yang nentuin
// status dari angka persen di SISI PENULIS (vista-pekerja). Jangan hardcode ambang 100/0 di
// tempat lain yang nulis ke tabel ini - import dari sini.
import { supabase } from "./supabase";
import { withRetry } from "./koneksi";

export type CcpStatus = "not_applicable" | "not_started" | "in_progress" | "done";

export function pctToStatus(pct: number): CcpStatus {
  if (pct >= 100) return "done";
  if (pct > 0) return "in_progress";
  return "not_started";
  // "not_applicable" SENGAJA gak pernah keluar dari fungsi ini - itu status STRUKTURAL
  // (relevansi bom_proses_relevan), bukan turunan dari angka progress. Ditentukan sendiri di
  // pemanggil (seedComponentProcessProgress), bukan di sini - jaga 1 fungsi ini murni
  // "pct -> status kerja", gak nyampur 2 keputusan beda sumber.
}

export type CcpUpsertInput = {
  panelId: number;
  kode: string;
  proses: string;
  tahap: string | null;
  pct: number;
  qtyTotal?: number | null;
  qtyDone?: number | null;
  photos?: any[];
  operatorNama?: string | null;
  operatorAt?: string | null;
  sudahDisimpan100?: boolean;
  updatedBy: string;
};

// Upsert 1 baris. ON CONFLICT nunjuk ke tahap_key (kolom generated STORED dari
// coalesce(tahap,'')) - lihat komentar di migrasi kenapa bukan langsung `tahap` (NULL gak
// dianggap "sama" oleh unique constraint biasa, PostgREST butuh KOLOM ASLI buat target
// on_conflict, gak bisa ekspresi langsung).
export async function upsertComponentProcessProgress(row: CcpUpsertInput) {
  const status = pctToStatus(row.pct);
  return withRetry(() =>
    supabase.from("component_process_progress").upsert(
      {
        panel_id: row.panelId,
        kode_komponen: row.kode,
        proses: row.proses,
        tahap: row.tahap,
        status,
        progress_pct: row.pct,
        qty_total: row.qtyTotal ?? null,
        qty_done: row.qtyDone ?? null,
        photos: row.photos ?? [],
        last_operator_nama: row.operatorNama ?? null,
        last_operator_at: row.operatorAt ?? null,
        sudah_disimpan_100: row.sudahDisimpan100 ?? false,
        updated_at: new Date().toISOString(),
        updated_by: row.updatedBy,
      },
      { onConflict: "panel_id,kode_komponen,proses,tahap_key" }
    )
  );
}

// AUDIT (21 Sep 2026) - ditemukan saat cek bug sesi ini: KomponenPasangView.tsx punya 3 fungsi
// foto-ONLY (simpanFotoStaged, simpanFotoArsipTambahan, hapusFotoTersimpan) yang nulis
// checklist[kode].fotoPemasangan TANPA lewat updatePctLive/simpanProgress - kolom `photos` di
// ccp jadi basi kalau operator tambah/hapus foto TANPA progress-nya ikut berubah (2 aksi
// independen). Dampak SAAT INI nol (belum ada consumer yang baca ccp.photos), tapi tetap bug
// nyata - baris ini SENGAJA UPDATE (bukan upsert penuh via upsertComponentProcessProgress) biar
// TIDAK BERISIKO menimpa status/progress_pct kalau pemanggil salah rekonstruksi pct - kalau
// barisnya belum ada (belum pernah di-dual-write), ini no-op, bukan bikin baris baru asal-asalan.
export async function updateComponentProcessProgressPhotos(
  panelId: number, kode: string, proses: string, tahap: string | null, photos: any[]
) {
  return withRetry(() =>
    supabase.from("component_process_progress")
      .update({ photos, updated_at: new Date().toISOString() })
      .eq("panel_id", panelId).eq("kode_komponen", kode).eq("proses", proses)
      .eq("tahap_key", tahap ?? "")
  );
}

// Query validasi arsip (dipakai tombol "Arsipkan Komponen" yang SUDAH ADA di KomponenPasangView -
// WO-072 restructuring, bukan tombol/alur baru). bool_and kosong (0 baris) dianggap FALSE lewat
// ?? false - kode yang belum pernah di-dual-write (mis. sebelum backfill Fase 2 jalan) gak
// keliru dianggap "siap arsip".
export async function cekPasangKomponenSiapArsip(panelId: number, kode: string): Promise<boolean | null> {
  const { data, error } = await supabase
    .from("component_process_progress")
    .select("status")
    .eq("panel_id", panelId)
    .eq("kode_komponen", kode)
    .eq("proses", "PASANG KOMPONEN");
  if (error) {
    console.error("cekPasangKomponenSiapArsip gagal:", error);
    return null; // null = gak bisa divalidasi (network/tabel blm ada) - pemanggil WAJIB treat
                 // ini sbg "jangan blokir", bukan "gagal" - checklist tetap sumber kebenaran utama
  }
  if (!data || data.length === 0) return null; // belum ada baris - blm sempat di-backfill/dual-write
  return data.every((r) => r.status === "done");
}
