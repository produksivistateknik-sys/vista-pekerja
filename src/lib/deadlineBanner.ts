// DEADLINE UNTUK BANNER BERANDA OPERATOR (6 Nov 2026, keputusan user: opsi B) - WO aktif dgn target <= 7 hari kalender
// (termasuk yang terlambat) dan belum semua panelnya selesai packing, maks 3 kartu, urut terlambat dulu lalu yang
// paling dekat. Tanpa saringan packing, kartu teratas berisi WO yang sudah selesai (dicek live 5 Nov 2026: 3 dari 3).
// Hari dihitung dari tanggal kalender WIB (hariIniWib), bukan jam perangkat. Ambang ini sengaja terpisah dari
// MENDESAK_THRESHOLD_DAYS (lib/urgensiDeadline, tanda kartu tugas 3 hari) dan WoUrgentBanner (7 hari).
import { supabase } from "./supabase";
import { bacaSemuaHalaman } from "./bacaSemua";

export const AMBANG_DEADLINE_HARI = 7;
export const MAKS_KARTU_DEADLINE = 3;

export type WoDeadline = { id: number; wo: string; proyek: string; target: string | null; panels?: { packing_done?: boolean | null }[] };
export type KartuDeadline = { id: number; wo: string; proyek: string; target: string; hari: number };

const MS_HARI = 86400000;
const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const tglUtc = (t: string) => Date.parse(t.slice(0, 10) + "T00:00:00Z");

export function selisihHari(target: string, hariIni: string): number {
  return Math.round((tglUtc(target) - tglUtc(hariIni)) / MS_HARI);
}

export function pilihKartuDeadline(wos: WoDeadline[], hariIni: string): KartuDeadline[] {
  const hasil: KartuDeadline[] = [];
  for (const w of wos || []) {
    if (!w.target || !Number.isFinite(tglUtc(w.target))) continue;
    const panel = w.panels || [];
    if (panel.length > 0 && panel.every((p) => p.packing_done)) continue;
    const hari = selisihHari(w.target, hariIni);
    if (hari <= AMBANG_DEADLINE_HARI) hasil.push({ id: w.id, wo: w.wo, proyek: w.proyek, target: w.target, hari });
  }
  return hasil.sort((a, b) => a.hari - b.hari || a.id - b.id).slice(0, MAKS_KARTU_DEADLINE);
}

export function labelSisaHari(hari: number): string {
  if (hari < 0) return `Terlambat ${Math.abs(hari)} hari`;
  if (hari === 0) return "hari ini";
  return hari === 1 ? "besok" : `${hari} hari lagi`;
}

export function labelTanggalDeadline(target: string): string {
  const d = new Date(tglUtc(target));
  return `${HARI[d.getUTCDay()]}, ${d.getUTCDate()} ${BULAN[d.getUTCMonth()]}`;
}

// Gagal baca dilempar ke pemanggil (banner tetap tampil tanpa kartu deadline).
export function muatWoDeadline(): Promise<WoDeadline[]> {
  return bacaSemuaHalaman((dari, sampai) => supabase.from("work_orders").select("id,wo,proyek,target,panels(packing_done)")
    .is("deleted_at", null).or("is_archived.is.null,is_archived.eq.false").order("target").order("id").range(dari, sampai));
}
