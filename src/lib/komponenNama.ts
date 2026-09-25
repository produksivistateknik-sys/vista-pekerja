// src/lib/komponenNama.ts
// Nama komponen per (TIPE PANEL, KODE) - satu sumber logika buat view riwayat/review.
//
// BUG FIX (25 Sep 2026, WO 071 RE. TUNAS SUVARNA - PP-PARKIR B.1 WM.4 "Pintu" tampil sebagai
// "Tulangan Pintu Dalam", PP-AC ICU WM.3 "Box (include ambang)" tampil sebagai "Pintu" di Review
// Painting): bom_master itu SATU tabel berisi SEMUA tipe panel, dan kode yang SAMA berarti
// komponen fisik BEDA tergantung tipenya - WM_MS & WM_POLY sama-sama pakai prefix "WM." (WM_MS
// WM.4 = Pintu, WM_POLY WM.4 = Tulangan Pintu Dalam). ReviewPainting/ReviewPotong/RiwayatKerja/
// AkunView dulu nge-key map pakai kode_komponen DOANG, row tipe lain yang kebetulan dikembalikan
// terakhir (query tanpa order) menimpa -> label salah. Data checklist/timer/operator sendiri
// BENAR, cuma label tampilan. Pola key gabungan sama persis fix KomponenPasangView (13 Sep 2026).
import { supabase } from "./supabase";
import { PANEL_TYPES } from "./panelTypes";

const keyOf=(tipe:string,kode:string)=>`${tipe}|${kode}`;

// PANEL_TYPES statis dulu (fallback kalau bom_master gagal diambil), ditimpa bom_master (lebih
// lengkap/update). Dipaginasi walau bom_master sekarang ~100 baris (CLAUDE.md A.1).
export async function fetchKomponenNamaMap():Promise<Record<string,string>>{
  const map:Record<string,string>={};
  Object.entries(PANEL_TYPES).forEach(([tipe,cfg]:[string,any])=>{
    cfg.wps.forEach((w:any)=>w.items.forEach((it:any)=>{map[keyOf(tipe,it.kode)]=it.nama;}));
  });
  const PAGE=1000;
  for(let from=0;;from+=PAGE){
    const{data,error}=await supabase.from("bom_master").select("tipe_panel,kode_komponen,nama_komponen").order("id").range(from,from+PAGE-1);
    if(error){console.error("gagal ambil bom_master (nama komponen pakai fallback statis):",error);break;}
    (data||[]).forEach((b:any)=>{map[keyOf(b.tipe_panel,b.kode_komponen)]=b.nama_komponen;});
    if(!data||data.length<PAGE)break;
  }
  return map;
}

// undefined kalau gak ketemu - fallback tampilan ("?" / kode mentah) tetap diputuskan caller.
export const getNamaKomponen=(map:Record<string,string>,tipe:string|undefined|null,kode:string):string|undefined=>
  tipe?map[keyOf(tipe,kode)]:undefined;
