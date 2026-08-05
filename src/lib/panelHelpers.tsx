import { supabase } from "./supabase";

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
