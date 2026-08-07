import { supabase } from "./supabase";
import { ALL_PROSES, KOMPONEN_PROSES_MAP } from "./panelTypes";

// QC TEST/PACKING itu proses whole-panel (penanda), bukan proses per-komponen - selalu relevan
// apapun kode-nya. Cermin dari PROSES_TANPA_MAPPING_KOMPONEN di
// vista-teknik/src/lib/panelHelpers.ts (NAMEPLATE/YELLOWMARK gak disalin ke sini - dua penanda
// itu gak pernah lewat OperatorView/computeProsesStatus, murni Rencana Harian Vista Teknik).
export const PROSES_TANPA_MAPPING_KOMPONEN=["QC TEST","PACKING"];

// Cermin dari isKomponenRelevant/getRelevantProsesForKode di
// vista-teknik/src/lib/panelHelpers.ts - beda cuma relevanSet/hasMappingSet di sini diterima
// sebagai parameter eksplisit (dari bom_proses_relevan yang di-fetch lokal di OperatorView),
// bukan dibaca dari module-global state kayak GLOBAL_PROSES_RELEVAN_SET di Vista Teknik (repo
// ini gak punya infra global-state itu, cuma OperatorView yang butuh, jadi gak perlu dibikin).
export const isKomponenRelevant=(kode:string,tipe:string,proses:string,relevanSet:Set<string>,hasMappingSet:Set<string>):boolean=>{
  if(PROSES_TANPA_MAPPING_KOMPONEN.includes(proses))return true;
  const mapKey=kode+"|"+tipe;
  if(hasMappingSet.has(mapKey)){
    return relevanSet.has(kode+"|"+tipe+"|"+proses);
  }
  const relevanProses=KOMPONEN_PROSES_MAP[kode];
  if(!relevanProses)return true;
  return relevanProses.includes(proses);
};
export function getRelevantProsesForKode(kode:string,tipe:string,relevanSet:Set<string>,hasMappingSet:Set<string>):string[]{
  const mapKey=kode+"|"+tipe;
  const base=hasMappingSet.has(mapKey)
    ? ALL_PROSES.filter((pr:string)=>relevanSet.has(kode+"|"+tipe+"|"+pr))
    : (KOMPONEN_PROSES_MAP[kode]||[]);
  return [...new Set([...base,...PROSES_TANPA_MAPPING_KOMPONEN])];
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS panel/checklist/progress - dipisah dari App.tsx (Sprint 5, 5 Agu 2026)
// ─────────────────────────────────────────────────────────────────────────────

// Key timer client-side: sama kayak sebelumnya buat semua proses (gak ada suffix), TAPI
// buat BUSBAR (yang punya tahap FABRIKASI/PLATING/HEATSHRINK/PASANG) ditambah suffix tahap
// biar tiap tahap punya status Mulai/Selesai sendiri-sendiri, gak ketuker.
export function timerKey(panelId:number,kode:string,proses:string,pekerjaId:number,tahap?:string|null){
  return `${panelId}_${kode}_${proses}_${pekerjaId}`+(tahap?`_${tahap}`:"");
}
// Urutan tahap BUSBAR - COUPLER/GROUND skip HEAT-SHRINK, semua jenis lain lewat 4 tahap penuh.
export const BUSBAR_URUTAN_TAHAP_LENGKAP=["FABRIKASI","PLATING","HEATSHRINK","PASANG"];
export const BUSBAR_URUTAN_TAHAP_SINGKAT=["FABRIKASI","PLATING","PASANG"];
export const BUSBAR_TAHAP_LABEL:Record<string,string>={FABRIKASI:"Fabrikasi",PLATING:"Plating",HEATSHRINK:"Heat-Shrink",PASANG:"Pasang"};
export function getUrutanTahapBusbar(kode:string):string[]{
  return(kode==="COUPLER"||kode==="GROUND")?BUSBAR_URUTAN_TAHAP_SINGKAT:BUSBAR_URUTAN_TAHAP_LENGKAP;
}
export function hitungProgressBusbarGabungan(busbarTahap:any,urutan:string[]):number{
  if(!busbarTahap||urutan.length===0)return 0;
  const total=urutan.reduce((s,t)=>s+(busbarTahap[t]?.progress||0),0);
  return Math.round((total/urutan.length)*10)/10;
}
// pekerja_per_komponen[kode] BIASANYA array flat (id operator) - TAPI buat BUSBAR sekarang
// berbentuk object per-tahap ({FABRIKASI:[id,...],PLATING:[id,...],...}) karena tiap tahap
// butuh operator sendiri-sendiri yang bisa keisi BERSAMAAN (bukan gantian kayak field lain).
// Helper ini aman dipanggil buat kode APAPUN - otomatis balik [] kalau bentuknya bukan array
// (misal ke-panggil buat kode BUSBAR yang datanya object), biar gak ada .map()/.some() crash.
export function getFlatOperatorIds(task:any,kode:string):number[]{
  const v=(task?.pekerja_per_komponen||{})[kode];
  return Array.isArray(v)?v:[];
}
export function getProgressOnDate(cl:any, proses:string, date:string){
  const byDate=cl?.progressByDate?.[proses];
  if(byDate&&byDate[date]!==undefined) return byDate[date];
  return cl?.progress?.[proses]||0;
}
export function getLatestProgress(cl:any, proses:string){
  const byDate=cl?.progressByDate?.[proses];
  if(byDate&&Object.keys(byDate).length>0){
    const dates=Object.keys(byDate).sort();
    return byDate[dates[dates.length-1]];
  }
  return cl?.progress?.[proses]||0;
}
export type ProsesStatus="NOT YET"|"TO DO"|"IN PROGRESS"|"DONE";
// Ambang progress proses SEBELUMNYA (dalam rantai ALL_PROSES) supaya komponen ini dianggap
// "siap dikerjakan" (TO DO) - di bawah ini masih NOT YET. Cermin dari computeProsesStatus() di
// vista-teknik/src/lib/panelHelpers.ts (juga dipakai Rencana Harian & TaskMonitoring di sana) -
// dua repo terpisah, gak bisa share modul, definisi WAJIB tetap sama.
export const PROSES_STATUS_GATE_PCT=25;
// POTONG (index pertama di ALL_PROSES) dan BUSBAR (proses paralel/independen, gak masuk rantai
// estafet WP) sengaja gak digating proses sebelumnya - selalu TO DO begitu progress masih 0.
// BUG FIX (6 Agu 2026): "proses sebelumnya" TIDAK BOLEH diambil lewat ALL_PROSES[idx-1] mentah -
// BUSBAR duduk di antara PASANG KOMPONEN dan WIRING CONTROL di array, jadi index-1 buat WIRING
// CONTROL nunjuk ke BUSBAR (yang progress-nya SELALU 0 buat kode non-busbar, terverifikasi di
// data live). Akibatnya WIRING CONTROL/WIRING POWER permanen kebaca NOT YET walau progress asli
// udah jalan. Fix: lompatin BUSBAR pas nyari proses sebelumnya. Cermin dari fix yang sama di
// vista-teknik/src/lib/panelHelpers.ts.
// BUG FIX #2 (6 Agu 2026): gate NOT YET dulu dicek SEBELUM cek progress komponen ini sendiri -
// akibatnya komponen yang progress-nya SUDAH JALAN (mis. PAINTING 57%) tetap kebaca NOT YET
// cuma gara-gara proses sebelumnya (RENDAM) di data 0% (kejadian nyata: FS.20 panel 287, urutan
// riil di lapangan gak selalu ngikutin rantai linear ALL_PROSES persis). Kartu jadi ke-lock total
// (pointerEvents:none di OperatorView) walau kerjaannya beneran udah berjalan - operator pilih
// operator & tekan Mulai tapi gak ngefek sama sekali. Fix: kalau progress proses INI SENDIRI
// udah >0, itu bukti nyata kerjaan udah mulai - gak mungkin lagi NOT YET apapun kondisi proses
// sebelumnya. Gate NOT YET cuma relevan pas progress proses ini masih benar-benar 0.
// BUG FIX (7 Agu 2026): "proses sebelumnya" dulu diambil mentah dari ALL_PROSES[idx-1] - gak
// peduli proses itu RELEVAN atau enggak buat kode ini (mis. FINISHING gak relevan buat
// Groundplate/CAPACITOR BANK-2, progress permanen 0, tapi duduk tepat sebelum RENDAM di
// ALL_PROSES - bikin RENDAM ke-gate NOT YET padahal proses relevan terakhir sebelumnya, BENDING,
// udah DONE). Fix: terima daftar proses RELEVAN (dari getRelevantProsesForKode) - gating chain
// difilter ke situ dulu (urutan tetap ngikutin ALL_PROSES). Cermin dari fix yang sama di
// vista-teknik/src/lib/panelHelpers.ts. relevantProses opsional, fallback ke ALL_PROSES penuh.
// UNBLOCK QC TEST (7 Agu 2026): QC TEST sengaja dikeluarin dari gating juga - selalu TO DO
// begitu progress masih 0, gak nunggu WIRING POWER/CONTROL nyampe 25% dulu. PACKING TETAP kena
// gating normal (gak diubah) - masih ngecek progress QC TEST komponen itu via chain di bawah.
export function computeProsesStatus(progressMap:Record<string,number>|undefined|null,proses:string,relevantProses?:string[]):ProsesStatus{
  const progress=progressMap?.[proses]||0;
  if(progress>=100)return "DONE";
  if(progress>0)return "IN PROGRESS";
  if(proses==="BUSBAR"||proses==="QC TEST")return "TO DO";
  const chain=(relevantProses&&relevantProses.length>0)?ALL_PROSES.filter(p=>relevantProses.includes(p)):ALL_PROSES;
  const prosesIdx=chain.indexOf(proses);
  if(prosesIdx<=0)return "TO DO";
  let prevIdx=prosesIdx-1;
  while(prevIdx>=0&&chain[prevIdx]==="BUSBAR")prevIdx--;
  if(prevIdx<0)return "TO DO";
  const prosesSebelumnya=chain[prevIdx];
  const progressSebelumnya=progressMap?.[prosesSebelumnya]||0;
  if(progressSebelumnya<PROSES_STATUS_GATE_PCT)return "NOT YET";
  return "TO DO";
}
export function getFirstCompletionDate(cl:any, proses:string){
  const byDate=cl?.progressByDate?.[proses];
  if(!byDate) return null;
  const doneDates=Object.keys(byDate).filter(d=>byDate[d]>=100).sort();
  return doneDates.length>0?doneDates[0]:null;
}
export function pColor(v:number){
  if(v===100)return"#16a34a"; if(v>=75)return"#ca8a04";
  if(v>=50)return"#ea580c";  if(v>=25)return"#dc2626";
  if(v>0)return"#7c3aed";    return"#94a3b8";
}
export function pBg(v:number){
  if(v===100)return"#dcfce7"; if(v>=75)return"#fef9c3";
  if(v>=50)return"#ffedd5";  if(v>=25)return"#fee2e2";
  if(v>0)return"#f3f0ff";    return"#f1f5f9";
}
// Beberapa komponen BOM punya pasangan nama mirip ("Tulangan X" vs "X" polos, misal
// "Tulangan Groundplate" vs "Groundplate", "Tulangan Pintu Dalam" vs "Pintu Dalam") - dua
// komponen BEDA yang sah, bukan duplikat, tapi gampang ke-skip mata di layar kecil karena
// namanya mirip. Kasih badge kecil "TULANGAN" di depan biar langsung kebeda sekilas mata,
// gak perlu baca teks penuh buat mastiin.
export function renderNamaKomponen(nama:string){
  if(!nama?.startsWith("Tulangan "))return nama;
  return(
    <>
      <span style={{fontSize:8,fontWeight:800,background:"#ede9fe",color:"#6d28d9",borderRadius:4,padding:"1px 5px",marginRight:4,letterSpacing:.3}}>TULANGAN</span>
      {nama.slice(9)}
    </>
  );
}
// Supabase/PostgREST default-nya cuma balikin maks 1000 baris tanpa .range() - panels sekarang
// cuma puluhan baris jadi belum kelihatan gejalanya, tapi begitu proyek nambah dan lewat 1000
// panel, fetch tanpa ini bakal diam-diam kepotong (persis bug renhar/activity_log yang sudah
// pernah kejadian). Dipakai di tempat yang masih fetch panels().select("*") tanpa filter apa pun.
export async function fetchAllPanels(select:string="*"):Promise<any[]>{
  let all:any[]=[];
  let from=0;
  const step=1000;
  while(true){
    const{data}=await supabase.from("panels").select(select).range(from,from+step-1);
    if(!data)break;
    all=all.concat(data);
    if(data.length<step)break;
    from+=step;
  }
  return all;
}
