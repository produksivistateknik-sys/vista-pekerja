import { useState, useMemo, useEffect, useRef } from "react";
import { supabase } from "./lib/supabase";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS (sama persis dengan vista-teknik)
// ─────────────────────────────────────────────────────────────────────────────
const PANEL_TYPES: Record<string,any> = {
  FS: { label:"FS", color:"#f59e0b", wps:[
    { wp:"WP1", range:"FS.1-10", color:"#f59e0b", bg:"#fffbeb", items:[
      {kode:"FS.1",nama:"Frame (include ambang)"},{kode:"FS.2",nama:"Tulangan Kedalaman"},
      {kode:"FS.3",nama:"Tulangan Tegak"},{kode:"FS.4",nama:"Groundplate"},
      {kode:"FS.5",nama:"Box Control"},{kode:"FS.6",nama:"Dudukan ACB"},
      {kode:"FS.7",nama:"Tulangan Support Busbar"},{kode:"FS.8",nama:"UNP"},
      {kode:"FS.9",nama:"Dudukan Capacitor/Detuned"},{kode:"FS.10",nama:"Tulangan Dudukan Capacitor"},
    ]},
    { wp:"WP2", range:"FS.11-15", color:"#22c55e", bg:"#f0fdf4", items:[
      {kode:"FS.11",nama:"Pintu"},{kode:"FS.12",nama:"Sekatan Pintu"},
      {kode:"FS.13",nama:"Hanger"},{kode:"FS.14",nama:"Tutup Atas"},{kode:"FS.15",nama:"Topi"},
    ]},
    { wp:"WP3", range:"FS.16-21", color:"#06b6d4", bg:"#ecfeff", items:[
      {kode:"FS.16",nama:"Sekatan Samping"},{kode:"FS.17",nama:"Sekatan Belakang"},
      {kode:"FS.18",nama:"Bingkai Lantai"},{kode:"FS.19",nama:"Lantai Dasar"},
      {kode:"FS.20",nama:"Tutup Samping"},{kode:"FS.21",nama:"Tutup Belakang"},
    ]},
    { wp:"WP4", range:"FS.22-24", color:"#f97316", bg:"#fff7ed", items:[
      {kode:"FS.22",nama:"Cover Komponen"},{kode:"FS.23",nama:"Tulangan Cover"},{kode:"FS.24",nama:"Sekatan Capacitor"},
    ]},
  ]},
  F3B: { label:"Form 3B", color:"#0ea5e9", wps:[
    { wp:"WP1", range:"F3B.1-12", color:"#f59e0b", bg:"#fffbeb", items:[
      {kode:"F3B.1",nama:"Frame (include ambang)"},{kode:"F3B.2",nama:"Kompartemen"},
      {kode:"F3B.3",nama:"Sekatan Kompartemen"},{kode:"F3B.4",nama:"Tulangan Kedalaman"},
      {kode:"F3B.5",nama:"Tulangan Tegak"},{kode:"F3B.6",nama:"Groundplate"},
      {kode:"F3B.7",nama:"Box Control"},{kode:"F3B.8",nama:"Dudukan ACB"},
      {kode:"F3B.9",nama:"Tulangan Support Busbar"},{kode:"F3B.10",nama:"UNP"},
      {kode:"F3B.11",nama:"Dudukan Capacitor/Detuned"},{kode:"F3B.12",nama:"Tulangan Dudukan Capacitor"},
    ]},
    { wp:"WP2", range:"F3B.13-17", color:"#22c55e", bg:"#f0fdf4", items:[
      {kode:"F3B.13",nama:"Pintu"},{kode:"F3B.14",nama:"Sekatan Pintu"},
      {kode:"F3B.15",nama:"Hanger"},{kode:"F3B.16",nama:"Tutup Atas"},{kode:"F3B.17",nama:"Topi"},
    ]},
    { wp:"WP3", range:"F3B.18-23", color:"#06b6d4", bg:"#ecfeff", items:[
      {kode:"F3B.18",nama:"Sekatan Samping"},{kode:"F3B.19",nama:"Sekatan Belakang"},
      {kode:"F3B.20",nama:"Bingkai Lantai"},{kode:"F3B.21",nama:"Lantai Dasar"},
      {kode:"F3B.22",nama:"Tutup Samping"},{kode:"F3B.23",nama:"Tutup Belakang"},
    ]},
    { wp:"WP4", range:"F3B.24-26", color:"#f97316", bg:"#fff7ed", items:[
      {kode:"F3B.24",nama:"Cover Komponen"},{kode:"F3B.25",nama:"Tulangan Cover"},{kode:"F3B.26",nama:"Sekatan Capacitor"},
    ]},
  ]},
  WM_MS: { label:"WM Mild Steel", color:"#8b5cf6", wps:[
    { wp:"WP1", range:"WM.1-2", color:"#f59e0b", bg:"#fffbeb", items:[{kode:"WM.1",nama:"Tulangan Groundplate"},{kode:"WM.2",nama:"Groundplate"}]},
    { wp:"WP2", range:"WM.3-4", color:"#22c55e", bg:"#f0fdf4", items:[{kode:"WM.3",nama:"Box (include ambang)"},{kode:"WM.4",nama:"Pintu"}]},
    { wp:"WP3", range:"WM.5-6", color:"#06b6d4", bg:"#ecfeff", items:[{kode:"WM.5",nama:"Tulangan Cover"},{kode:"WM.6",nama:"Cover Komponen"}]},
    { wp:"WP4", range:"WM.7-8", color:"#f97316", bg:"#fff7ed", items:[{kode:"WM.7",nama:"Tutup Atas Bawah"},{kode:"WM.8",nama:"Topi"}]},
    { wp:"WP5", range:"WM.9",   color:"#a78bfa", bg:"#f5f3ff", items:[{kode:"WM.9",nama:"Tulangan Pintu Dalam"}]},
    { wp:"WP6", range:"WM.10",  color:"#f472b6", bg:"#fdf2f8", items:[{kode:"WM.10",nama:"Pintu Dalam"}]},
  ]},
  WM_POLY: { label:"WM Poly", color:"#ec4899", wps:[
    { wp:"WP1", range:"WM.1-2", color:"#f59e0b", bg:"#fffbeb", items:[{kode:"WM.1",nama:"Tulangan Groundplate"},{kode:"WM.2",nama:"Groundplate"}]},
    { wp:"WP2", range:"WM.3-4", color:"#22c55e", bg:"#f0fdf4", items:[{kode:"WM.3",nama:"Box (include ambang)"},{kode:"WM.4",nama:"Pintu"}]},
    { wp:"WP3", range:"WM.5-6", color:"#06b6d4", bg:"#ecfeff", items:[{kode:"WM.5",nama:"Tulangan Cover"},{kode:"WM.6",nama:"Cover Komponen"}]},
    { wp:"WP4", range:"WM.7-8", color:"#f97316", bg:"#fff7ed", items:[{kode:"WM.7",nama:"Tutup Atas Bawah"},{kode:"WM.8",nama:"Topi"}]},
    { wp:"WP5", range:"WM.9",   color:"#a78bfa", bg:"#f5f3ff", items:[{kode:"WM.9",nama:"Tulangan Pintu Dalam"}]},
    { wp:"WP6", range:"WM.10",  color:"#f472b6", bg:"#fdf2f8", items:[{kode:"WM.10",nama:"Pintu Dalam"}]},
  ]},
};

const PCT_STEPS  = [25,50,75,90,100];
const QTY_DIVISI = ["mekanik","painting"];

const PROSES_COLOR: Record<string,string> = {
  "POTONG":"#f59e0b","BENDING":"#10b981","STEL":"#3b82f6","FINISHING":"#0891b2","RENDAM":"#0ea5e9","PAINTING":"#8b5cf6",
  "RAKIT":"#ec4899","PASANG KOMPONEN":"#f97316","BUSBAR":"#06b6d4",
  "WIRING CONTROL":"#6366f1","WIRING POWER":"#ef4444","QC TEST":"#14b8a6","PACKING":"#84cc16",
};

const PRIORITAS_COLOR: Record<string,string> = {"Tinggi":"#dc2626","Sedang":"#f59e0b","Rendah":"#22c55e"};

const DIVISI_CONFIG: Record<string,any> = {
  mekanik:    {label:"Mekanik",       icon:"🔧", color:"#d97706",bg:"#fffbeb",proses:null,manualName:true,
    subBagianPassword:{Potong:"potong123",Bending:"bending123",Stel:"stel123",Finishing:"finishing123"},
    subBagianProses:{Potong:["POTONG"],Bending:["BENDING"],Stel:["STEL"],Finishing:["FINISHING"]}},
  painting:   {label:"Painting",      icon:"🎨", color:"#7c3aed",bg:"#f5f3ff",proses:null,manualName:true,
    subBagianPassword:{Rendam:"rendam123",Painting:"painting123"},
    subBagianProses:{Rendam:["RENDAM"],Painting:["PAINTING"]}},
  assembling: {label:"Assembling",    icon:"⚙️", color:"#059669",bg:"#ecfdf5",proses:null,manualName:true,
    subBagianPassword:{"Assembling Luar":"asmluar123","Assembling Dalam":"asmdalam123"},
    subBagianProses:{"Assembling Luar":["RAKIT","PASANG KOMPONEN"],"Assembling Dalam":["BUSBAR"]}},
  // manualName:true - nama login jadi dropdown dari tabel pekerja (semua nama operator per
  // divisi ini), pakai 1 password bersama (field password di bawah), persis pola Potong/
  // Bending/Stel dkk di mekanik. Sebelumnya QC/Wiring lewat operator_users (username+password
  // per orang) - akun individual di situ jadi gak kepakai lagi setelah ini.
  wiring_ctrl:{label:"Wiring Control",icon:"⚡", color:"#6366f1",bg:"#eef2ff",password:"wiring123",  proses:["WIRING CONTROL"],manualName:true},
  wiring_pwr: {label:"Wiring Power",  icon:"🔌", color:"#be185d",bg:"#fdf2f8",password:"wiringp123", proses:["WIRING POWER"],manualName:true},
  qc:         {label:"QC",            icon:"🔍", color:"#16a34a",bg:"#f0fdf4",password:"qc123",      proses:["QC TEST","PACKING"],manualName:true},
  nameplate:  {label:"Nameplate",     icon:"🏷️", color:"#0891b2",bg:"#ecfeff",password:"nameplate123",proses:null},
  komponen:   {label:"Komponen",       icon:"📦", color:"#0d9488",bg:"#f0fdfa",proses:null,manualName:true,
    // "Assembling" sengaja dihapus dari opsi login - sudah gantiin pakai Assembling Luar
    // (Pasang Komponen, divisi "assembling") buat kebutuhan itu. Data lama sub_bagian=Assembling
    // di fcs_tracking_komponen TETAP ada, cuma gak bisa login buat nambah data baru lagi.
    subBagianPassword:{Warehouse:"warehouse123",QS:"qs123"}},
};

function getLocalDateStr(d:Date=new Date()){
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,"0");
  const day=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
const TODAY = getLocalDateStr();
// Duplikat kecil dari src/lib/dateHelpers.ts di vista-teknik (repo terpisah, gak ada shared
// package) - persis pola yang udah dipakai di sini buat getLocalDateStr/TODAY/addDays/fmtDate.
function daysUntil(t:string){ return Math.ceil((new Date(t).getTime()-new Date(TODAY).getTime())/86400000); }

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const TIMER_REQUEST_TIMEOUT_MS=15000;
function withTimeout<T>(promise:PromiseLike<T>, ms:number):Promise<T>{
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_,reject)=>setTimeout(()=>reject(new Error("Request timeout - koneksi lambat")),ms)),
  ]);
}
// Key timer client-side: sama kayak sebelumnya buat semua proses (gak ada suffix), TAPI
// buat BUSBAR (yang punya tahap FABRIKASI/PLATING/HEATSHRINK/PASANG) ditambah suffix tahap
// biar tiap tahap punya status Mulai/Selesai sendiri-sendiri, gak ketuker.
function timerKey(panelId:number,kode:string,proses:string,pekerjaId:number,tahap?:string|null){
  return `${panelId}_${kode}_${proses}_${pekerjaId}`+(tahap?`_${tahap}`:"");
}
// Urutan tahap BUSBAR - COUPLER/GROUND skip HEAT-SHRINK, semua jenis lain lewat 4 tahap penuh.
const BUSBAR_URUTAN_TAHAP_LENGKAP=["FABRIKASI","PLATING","HEATSHRINK","PASANG"];
const BUSBAR_URUTAN_TAHAP_SINGKAT=["FABRIKASI","PLATING","PASANG"];
const BUSBAR_TAHAP_LABEL:Record<string,string>={FABRIKASI:"Fabrikasi",PLATING:"Plating",HEATSHRINK:"Heat-Shrink",PASANG:"Pasang"};
function getUrutanTahapBusbar(kode:string):string[]{
  return(kode==="COUPLER"||kode==="GROUND")?BUSBAR_URUTAN_TAHAP_SINGKAT:BUSBAR_URUTAN_TAHAP_LENGKAP;
}
function hitungProgressBusbarGabungan(busbarTahap:any,urutan:string[]):number{
  if(!busbarTahap||urutan.length===0)return 0;
  const total=urutan.reduce((s,t)=>s+(busbarTahap[t]?.progress||0),0);
  return Math.round((total/urutan.length)*10)/10;
}
// pekerja_per_komponen[kode] BIASANYA array flat (id operator) - TAPI buat BUSBAR sekarang
// berbentuk object per-tahap ({FABRIKASI:[id,...],PLATING:[id,...],...}) karena tiap tahap
// butuh operator sendiri-sendiri yang bisa keisi BERSAMAAN (bukan gantian kayak field lain).
// Helper ini aman dipanggil buat kode APAPUN - otomatis balik [] kalau bentuknya bukan array
// (misal ke-panggil buat kode BUSBAR yang datanya object), biar gak ada .map()/.some() crash.
function getFlatOperatorIds(task:any,kode:string):number[]{
  const v=(task?.pekerja_per_komponen||{})[kode];
  return Array.isArray(v)?v:[];
}
function getProgressOnDate(cl:any, proses:string, date:string){
  const byDate=cl?.progressByDate?.[proses];
  if(byDate&&byDate[date]!==undefined) return byDate[date];
  return cl?.progress?.[proses]||0;
}
function getLatestProgress(cl:any, proses:string){
  const byDate=cl?.progressByDate?.[proses];
  if(byDate&&Object.keys(byDate).length>0){
    const dates=Object.keys(byDate).sort();
    return byDate[dates[dates.length-1]];
  }
  return cl?.progress?.[proses]||0;
}
function getFirstCompletionDate(cl:any, proses:string){
  const byDate=cl?.progressByDate?.[proses];
  if(!byDate) return null;
  const doneDates=Object.keys(byDate).filter(d=>byDate[d]>=100).sort();
  return doneDates.length>0?doneDates[0]:null;
}
function pColor(v:number){
  if(v===100)return"#16a34a"; if(v>=75)return"#ca8a04";
  if(v>=50)return"#ea580c";  if(v>=25)return"#dc2626";
  if(v>0)return"#7c3aed";    return"#94a3b8";
}
function pBg(v:number){
  if(v===100)return"#dcfce7"; if(v>=75)return"#fef9c3";
  if(v>=50)return"#ffedd5";  if(v>=25)return"#fee2e2";
  if(v>0)return"#f3f0ff";    return"#f1f5f9";
}
// Beberapa komponen BOM punya pasangan nama mirip ("Tulangan X" vs "X" polos, misal
// "Tulangan Groundplate" vs "Groundplate", "Tulangan Pintu Dalam" vs "Pintu Dalam") - dua
// komponen BEDA yang sah, bukan duplikat, tapi gampang ke-skip mata di layar kecil karena
// namanya mirip. Kasih badge kecil "TULANGAN" di depan biar langsung kebeda sekilas mata,
// gak perlu baca teks penuh buat mastiin.
function renderNamaKomponen(nama:string){
  if(!nama?.startsWith("Tulangan "))return nama;
  return(
    <>
      <span style={{fontSize:8,fontWeight:800,background:"#ede9fe",color:"#6d28d9",borderRadius:4,padding:"1px 5px",marginRight:4,letterSpacing:.3}}>TULANGAN</span>
      {nama.slice(9)}
    </>
  );
}
function addDays(s:string,n:number){ const d=new Date(s); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); }
function fmtDate(s:string){ return new Date(s).toLocaleDateString("id-ID",{weekday:"short",day:"numeric",month:"short",year:"numeric"}); }
function fmtShort(s:string){ return new Date(s).toLocaleDateString("id-ID",{day:"numeric",month:"short"}); }

// ─────────────────────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────────────────────
const GCss=`
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0}html,body,#root{width:100%;height:100%;overflow-x:hidden;overflow-y:auto}
body{background:#f1f5f9;color:#1e293b;font-family:'Plus Jakarta Sans',sans-serif}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:#f1f5f9}
::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:3px}
input,select,textarea,button{font-family:inherit;outline:none}
input::placeholder,textarea::placeholder{color:#94a3b8}
@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
.fi{animation:fadeIn .25s ease forwards}
.su{animation:slideUp .2s ease forwards}
`;

// ─────────────────────────────────────────────────────────────────────────────
// SHARED UI COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
function Badge({label,color,bg}:any){
  return <span style={{display:"inline-flex",alignItems:"center",padding:"2px 8px",borderRadius:20,
    fontSize:10,fontWeight:700,color,background:bg||color+"18",border:`1px solid ${color}30`,whiteSpace:"nowrap"}}>{label}</span>;
}
function Card({children,style={}}:any){
  return <div style={{background:"#fff",borderRadius:12,border:"1px solid #e2e8f0",
    padding:16,boxShadow:"0 1px 3px #00000008",...style}}>{children}</div>;
}
function Lbl({children}:any){
  return <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:5}}>{children}</div>;
}
function Inp({style={},...p}:any){
  return <input style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #e2e8f0",
    background:"#f8fafc",color:"#1e293b",fontSize:13,...style}} {...p}/>;
}
// @ts-ignore
function _Sel({style={},children,...p}:any){
  return <select style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #e2e8f0",
    background:"#f8fafc",color:"#1e293b",fontSize:13,...style}} {...p}>{children}</select>;
}
function Btn({children,color="#2563eb",outline=false,style={},...p}:any){
  return <button style={{padding:"8px 18px",borderRadius:8,
    border:outline?`1.5px solid ${color}`:"none",cursor:"pointer",
    background:outline?"transparent":color,color:outline?color:"#fff",
    fontWeight:700,fontSize:13,...style}} {...p}>{children}</button>;
}

// ─────────────────────────────────────────────────────────────────────────────
// WO DEADLINE STATUS BANNER - notifikasi read-only, se-perusahaan (bukan cuma WO operator
// yang login), format mirip widget "Daftar Peringatan" di Dashboard.tsx Vista Teknik. Sengaja
// CUMA cek tanggal target (bukan progress panel per komponen) - lebih ringan buat mobile, dan
// WO yang telat submit progress cuma numpang lewat di banner ini gak berdampak (murni awareness,
// bukan data kerja). Scope SEMUA WO aktif (bukan cuma Mendesak/Terlambat) - urut Terlambat
// (paling telat duluan) -> Mendesak (H- kecil duluan) -> Normal (deadline masih jauh, WO tanpa
// target di paling bawah). Default expand cuma nampilin Terlambat+Mendesak, WO Normal di balik
// toggle "Lihat semua WO normal" terpisah biar prioritas visual tetap ke yang urgent.
function categorizeWo(w:any):{level:"late"|"mendesak"|"normal",d:number|null}{
  if(!w.target)return{level:"normal",d:null};
  const d=daysUntil(w.target);
  if(d<0)return{level:"late",d};
  if(d<=7)return{level:"mendesak",d};
  return{level:"normal",d};
}
function WoUrgentBanner(){
  const [wos,setWos]=useState<any[]>([]);
  const [expanded,setExpanded]=useState(false);
  const [showNormal,setShowNormal]=useState(false);

  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      let all:any[]=[];
      let from=0;
      const pageSize=1000;
      while(true){
        const{data,error}=await supabase.from("work_orders").select("id,wo,proyek,target")
          .or("is_archived.is.null,is_archived.eq.false").range(from,from+pageSize-1);
        if(error||!data)break;
        all=all.concat(data);
        if(data.length<pageSize)break;
        from+=pageSize;
      }
      if(!cancelled)setWos(all);
    })();
    return()=>{cancelled=true;};
  },[]);

  const sorted=wos
    .map(w=>({...w,cat:categorizeWo(w)}))
    .sort((a,b)=>(a.cat.d===null?Infinity:a.cat.d)-(b.cat.d===null?Infinity:b.cat.d));

  if(sorted.length===0)return null;

  const lateMendesak=sorted.filter(w=>w.cat.level==="late"||w.cat.level==="mendesak");
  const normalWos=sorted.filter(w=>w.cat.level==="normal");
  const worst=sorted[0];
  const anyDelayed=sorted.some(w=>w.cat.level==="late");
  const anyMendesak=sorted.some(w=>w.cat.level==="mendesak");
  const theme=anyDelayed
    ?{icon:"⛔",border:"#fecaca",bg:"#fef2f2",text:"#dc2626",sub:"#7f1d1d"}
    :anyMendesak
    ?{icon:"⚠️",border:"#fde68a",bg:"#fffbeb",text:"#d97706",sub:"#78350f"}
    :{icon:"📋",border:"#e2e8f0",bg:"#f8fafc",text:"#475569",sub:"#64748b"};

  const rowLabel=(w:any)=>w.cat.level==="late"?"Terlambat "+Math.abs(w.cat.d)+" hari"
    :w.cat.level==="mendesak"?"H-"+w.cat.d+" Mendesak"
    :w.cat.d===null?"Tidak ada target"
    :"H-"+w.cat.d;
  const rowColor=(w:any)=>w.cat.level==="late"?"#dc2626":w.cat.level==="mendesak"?"#d97706":"#64748b";
  const rowBadge=(w:any)=>w.cat.level==="late"?"Terlambat":w.cat.level==="mendesak"?"Mendesak":"Normal";

  const renderRow=(w:any)=>{
    const c=rowColor(w);
    return(
      <div key={w.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 12px",
        borderBottom:`1px solid ${theme.border}50`}}>
        <span style={{color:c,fontSize:12,flexShrink:0}}>●</span>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:11,fontWeight:700,color:c,whiteSpace:"nowrap" as const,overflow:"hidden" as const,textOverflow:"ellipsis" as const}}>
            WO {w.wo} — {w.proyek}
          </div>
          <div style={{fontSize:10,color:w.cat.level==="normal"?"#64748b":theme.sub}}>
            {rowLabel(w)}{w.target?" · Target: "+w.target:""}
          </div>
        </div>
        <Badge label={rowBadge(w)} color={c}/>
      </div>
    );
  };

  return(
    <div style={{marginBottom:16,borderRadius:10,border:`1.5px solid ${theme.border}`,
      background:theme.bg,overflow:"hidden"}}>
      <button onClick={()=>setExpanded(!expanded)}
        style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"9px 12px",
          background:"none",border:"none",cursor:"pointer",textAlign:"left" as const,fontFamily:"inherit"}}>
        <span style={{fontSize:14,flexShrink:0}}>{theme.icon}</span>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:11.5,fontWeight:700,color:theme.text}}>
            Status Deadline WO · {sorted.length} WO aktif
          </div>
          {!expanded&&(
            <div style={{fontSize:10.5,color:theme.sub,whiteSpace:"nowrap" as const,
              overflow:"hidden" as const,textOverflow:"ellipsis" as const}}>
              WO {worst.wo} — {worst.proyek} · {rowLabel(worst)}
            </div>
          )}
        </div>
        <span style={{fontSize:11,color:theme.text,flexShrink:0}}>{expanded?"▲ Tutup":"▼ Lihat semua"}</span>
      </button>
      {expanded&&(
        <div style={{maxHeight:320,overflowY:"auto" as const,borderTop:`1px solid ${theme.border}`}}>
          {lateMendesak.map(renderRow)}
          {normalWos.length>0&&(
            <>
              <button onClick={()=>setShowNormal(!showNormal)}
                style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:6,
                  padding:"8px 12px",background:"none",border:"none",borderBottom:showNormal?`1px solid ${theme.border}50`:"none",
                  cursor:"pointer",fontFamily:"inherit",fontSize:10.5,fontWeight:700,color:"#64748b"}}>
                {showNormal?"▲ Sembunyikan":"▼ Lihat semua WO normal"} ({normalWos.length})
              </button>
              {showNormal&&normalWos.map(renderRow)}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LANDING PAGE
// ─────────────────────────────────────────────────────────────────────────────
function LandingPage({onEnter}:any){
  const [exiting,setExiting]=useState(false);

  const handleEnter=()=>{
    setExiting(true);
    setTimeout(()=>{onEnter();},400);
  };

  return(
    <div style={{minHeight:"100vh",width:"100%",background:"#ffffff",fontFamily:"'Plus Jakarta Sans',sans-serif",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:24,padding:24,
      opacity:exiting?0:1,transform:exiting?"scale(1.04)":"scale(1)",transition:"opacity .4s cubic-bezier(.4,0,.2,1),transform .4s cubic-bezier(.4,0,.2,1)"}}>
      <style>{`
        @keyframes landFadeIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        .land-logo{animation:landFadeIn .6s cubic-bezier(.22,1,.36,1) forwards}
        .land-tagline{animation:landFadeIn .6s .15s cubic-bezier(.22,1,.36,1) both}
        .land-cta{animation:landFadeIn .6s .3s cubic-bezier(.22,1,.36,1) both}
        .land-cta-btn:hover{background:#e06a10!important;transform:translateY(-1px)}
        .land-cta-btn{transition:all .18s!important}
      `}</style>
      <img src="data:image/png;base64,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" alt="Vista Teknik" className="land-logo" style={{width:260,height:"auto"}}/>
      <p className="land-tagline" style={{fontSize:15,color:"#64748b",margin:0,textAlign:"center",letterSpacing:.3}}>Your electrical safety is our priority</p>
      <button onClick={handleEnter} className="land-cta land-cta-btn"
        style={{marginTop:16,padding:"13px 36px",borderRadius:10,border:"none",background:"#f47920",color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
        Masuk ke Aplikasi
      </button>
    </div>
  );
}



// ─────────────────────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────────────────────
function Login({onLogin}:any){
  const [div,setDiv]=useState("mekanik");
  const [username,setUsername]=useState("");
  const [userList,setUserList]=useState<any[]>([]);
  const [pekerjaOptions,setPekerjaOptions]=useState<any[]>([]);
  const [pekerjaTerpilihId,setPekerjaTerpilihId]=useState("");
  const [namaManualTeks,setNamaManualTeks]=useState("");
  const [pwd,setPwd]=useState("");
  const [err,setErr]=useState("");
  const [show,setShow]=useState(false);
  const [loading,setLoading]=useState(false);
  const [success,setSuccess]=useState(false);

  const operatorDivisi=Object.entries(DIVISI_CONFIG)
    .filter(([k])=>k!=="admin")
    .map(([k,v]:any)=>({key:k,...v}));

  useEffect(()=>{
    if(div){
      supabase.from("operator_users").select("id,nama,username").eq("divisi",div).eq("is_active",true)
        .then(({data})=>{setUserList(data??[]);setUsername("");});
      supabase.from("pekerja").select("id,nama,divisi").eq("divisi",div)
        .then(({data})=>{setPekerjaOptions(data??[]);setPekerjaTerpilihId("");});
      setSubBagianTerpilih(null);
      setNamaManualTeks("");
    }
  },[div]);

  const isManualName=!!(DIVISI_CONFIG as any)[div]?.manualName;
  const subBagianOptions=(DIVISI_CONFIG as any)[div]?.subBagianPassword;
  const [subBagianTerpilih,setSubBagianTerpilih]=useState<string|null>(null);

  const go=async()=>{
    if(isManualName&&subBagianOptions){
      if(!subBagianTerpilih){setErr("Pilih sub-bagian dulu!");return;}
      // Warehouse/QS ketik nama manual (bebas, gak perlu terdaftar di tabel pekerja) - beda
      // dari sub-bagian lain yang masih wajib pilih dari daftar pekerja terdaftar.
      const isNamaBebas=subBagianTerpilih==="Warehouse"||subBagianTerpilih==="QS";
      if(isNamaBebas){
        if(!namaManualTeks.trim()){setErr("Ketik nama kamu!");return;}
      } else if(!pekerjaTerpilihId){setErr("Pilih nama kamu!");return;}
      if(!pwd){setErr("Masukkan password!");return;}
      setLoading(true);
      const{data:pwRow,error:pwErr}=await supabase.from("fcs_sub_bagian_password").select("password").eq("sub_bagian",subBagianTerpilih).single();
      const expectedPwd=pwErr?subBagianOptions[subBagianTerpilih]:pwRow?.password;
      if(pwd!==expectedPwd){setErr("Password salah!");setLoading(false);return;}
      if(isNamaBebas){
        const namaBebas=namaManualTeks.trim();
        setSuccess(true);
        setTimeout(()=>onLogin({id:0,nama:namaBebas,name:namaBebas,divisi:div,sub_bagian:subBagianTerpilih}),800);
        setLoading(false);
        return;
      }
      const pekerjaTerpilih=pekerjaOptions.find((p:any)=>String(p.id)===pekerjaTerpilihId);
      if(!pekerjaTerpilih){setErr("Data pekerja gak valid, coba pilih ulang.");setLoading(false);return;}
      setSuccess(true);
      setTimeout(()=>onLogin({id:pekerjaTerpilih.id,nama:pekerjaTerpilih.nama,name:pekerjaTerpilih.nama,divisi:div,sub_bagian:subBagianTerpilih}),800);
      setLoading(false);
      return;
    }
    if(isManualName){
      if(!pekerjaTerpilihId){setErr("Pilih nama kamu!");return;}
      if(!pwd){setErr("Masukkan password!");return;}
      setLoading(true);
      const expectedPwd=(DIVISI_CONFIG as any)[div]?.password;
      if(pwd!==expectedPwd){setErr("Password salah!");setLoading(false);return;}
      const pekerjaTerpilih=pekerjaOptions.find((p:any)=>String(p.id)===pekerjaTerpilihId);
      if(!pekerjaTerpilih){setErr("Data pekerja gak valid, coba pilih ulang.");setLoading(false);return;}
      setSuccess(true);
      setTimeout(()=>onLogin({id:pekerjaTerpilih.id,nama:pekerjaTerpilih.nama,name:pekerjaTerpilih.nama,divisi:div}),800);
      setLoading(false);
      return;
    }
    if(!username){setErr("Pilih nama!");return;}
    if(!pwd){setErr("Masukkan password!");return;}
    setLoading(true);
    const{data,error}=await supabase.from("operator_users").select("*")
      .eq("username",username).eq("password",pwd).eq("is_active",true).single();
    if(error||!data){setErr("Password salah!");setLoading(false);return;}
    await supabase.from("operator_users").update({last_login:new Date().toISOString()}).eq("id",data.id);
    setSuccess(true);
    setTimeout(()=>onLogin({...data,name:data.nama}),800);
    setLoading(false);
  };

  const css=`
    @keyframes lgFadeIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
    @keyframes lgSpin{to{transform:rotate(360deg)}}
    .lg-card{animation:lgFadeIn .5s cubic-bezier(.22,1,.36,1) forwards}
    .lg-inp{width:100%;height:48px;padding:0 16px 0 46px;border-radius:10px;border:1.5px solid #e2e8f0;background:#f8fafc;color:#0f172a;font-size:16px;font-family:inherit;outline:none;transition:border .2s,box-shadow .2s}
    .lg-inp:focus{border-color:#2563eb;background:#fff;box-shadow:0 0 0 3px rgba(37,99,235,.12)}
    .lg-inp.err{border-color:#f87171}
    .lg-sel{width:100%;height:48px;padding:0 16px 0 46px;border-radius:10px;border:1.5px solid #e2e8f0;background:#f8fafc;color:#0f172a;font-size:16px;font-family:inherit;outline:none;cursor:pointer;appearance:none}
    .lg-sel:focus{border-color:#2563eb;background:#fff;box-shadow:0 0 0 3px rgba(37,99,235,.12)}
    .lg-btn{width:100%;height:50px;border-radius:10px;border:none;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 4px 14px rgba(37,99,235,.3)}
    .lg-btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 8px 24px rgba(37,99,235,.4)}
    .lg-btn:disabled{opacity:.75;cursor:not-allowed}
    .lg-btn.success{background:linear-gradient(135deg,#16a34a,#15803d)}
    .lg-spinner{width:16px;height:16px;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;border-radius:50%;animation:lgSpin .65s linear infinite}
    .lg-label{font-size:11px;font-weight:700;color:#475569;margin-bottom:6px;letter-spacing:.3px;text-transform:uppercase}
    .lg-icon{position:absolute;left:14px;top:50%;transform:translateY(-50%);font-size:15px;color:#94a3b8;pointer-events:none}
    .lg-eye{position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#94a3b8;font-size:14px;padding:4px}
    .lg-err{background:#fef2f2;border:1px solid #fecaca;color:#dc2626;border-radius:10px;padding:11px 14px;font-size:13px;display:flex;align-items:center;gap:8px;margin-top:12px}
    .lg-success-overlay{position:fixed;inset:0;background:rgba(255,255,255,.92);display:flex;align-items:center;justify-content:center;z-index:9999}
    .div-tab{flex:1;padding:10px 8px;min-height:48px;border:none;cursor:pointer;font-size:11px;font-weight:700;font-family:inherit;transition:all .15s;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px}
    .subbagian-btn{flex:1;min-width:90px;min-height:44px;padding:10px 8px;border-radius:8px;cursor:pointer;font-weight:700;font-size:12px;font-family:inherit}
    .lg-outer{min-height:100vh;min-height:100dvh;}
    @media(max-width:700px){
      .lg-left{display:none!important}
      .lg-right{width:100%!important;align-items:flex-start!important;overflow-y:auto!important;
        padding:max(24px,calc(env(safe-area-inset-top) + 12px)) 20px max(24px,calc(env(safe-area-inset-bottom) + 12px)) 20px!important;}
    }
  `;


  return(
    <div className="lg-outer" style={{width:"100%",display:"flex",background:"#f1f5f9"}}>
      <style>{GCss}</style>
      <style>{css}</style>
      {success&&(
        <div className="lg-success-overlay">
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:64}}>✅</div>
            <div style={{marginTop:12,fontSize:16,fontWeight:700,color:"#16a34a"}}>Login berhasil!</div>
          </div>
        </div>
      )}
      {/* Left panel */}
      <div className="lg-left" style={{width:"45%",background:"linear-gradient(145deg,#0f172a,#1e3a8a 45%,#1d4ed8 100%)",
        display:"flex",flexDirection:"column",padding:"44px 48px",color:"#fff",position:"relative",overflow:"hidden",flexShrink:0}}>
        <div style={{position:"absolute",top:-80,right:-80,width:320,height:320,borderRadius:"50%",background:"rgba(255,255,255,.04)"}}/>
        <div style={{position:"absolute",bottom:-60,left:-60,width:240,height:240,borderRadius:"50%",background:"rgba(255,255,255,.03)"}}/>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:48,position:"relative",zIndex:1}}>
          <div style={{width:42,height:42,background:"rgba(255,255,255,.15)",borderRadius:11,border:"1px solid rgba(255,255,255,.25)",
            display:"flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{color:"#fff",fontWeight:900,fontSize:19}}>V</span>
          </div>
          <div>
            <div style={{fontWeight:800,fontSize:15,letterSpacing:.3}}>Vista Teknik</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,.55)",fontWeight:500}}>Electrical Switchboard Manufacturing</div>
          </div>
        </div>
        <div style={{position:"relative",zIndex:1}}>
          <div style={{fontSize:28,fontWeight:800,lineHeight:1.3,marginBottom:12}}>Portal Operator<br/>Vista Pekerja</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,.7)",lineHeight:1.8,marginBottom:28,maxWidth:300}}>
            Pilih divisi dan masukkan username + password untuk mengakses jadwal produksi harian Anda.
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {["Jadwal kerja harian","Update progress real-time","Monitoring per shift","Laporan produksi"].map((f:string)=>(
              <div key={f} style={{display:"flex",alignItems:"center",gap:10,fontSize:13}}>
                <div style={{width:26,height:26,borderRadius:7,background:"rgba(255,255,255,.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,flexShrink:0}}>✓</div>
                <span style={{color:"rgba(255,255,255,.82)",fontWeight:500}}>{f}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{fontSize:11,color:"rgba(255,255,255,.38)",marginTop:"auto",paddingTop:32,position:"relative",zIndex:1}}>
          2026 Vista Teknik. All rights reserved.
        </div>
      </div>
      {/* Right panel */}
      <div className="lg-right" style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"48px 40px"}}>
        <div className="lg-card" style={{width:"100%",maxWidth:420,background:"#fff",borderRadius:20,
          padding:"32px 36px",boxShadow:"0 4px 6px rgba(0,0,0,.04),0 24px 60px rgba(0,0,0,.08)"}}>
          <div style={{marginBottom:20}}>
            <div style={{fontSize:22,fontWeight:700,color:"#0f172a",marginBottom:4}}>Selamat datang</div>
            <div style={{fontSize:13,color:"#64748b"}}>Masuk ke akun operator Anda</div>
          </div>
          {/* Divisi tabs */}
          <div style={{marginBottom:16}}>
            <div className="lg-label">Divisi</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap" as const}}>
              {operatorDivisi.map((d:any)=>(
                <button key={d.key} className="div-tab" onClick={()=>setDiv(d.key)}
                  style={{background:div===d.key?d.color+"18":"#f8fafc",
                    border:`1.5px solid ${div===d.key?d.color:"#e2e8f0"}`,
                    color:div===d.key?d.color:"#64748b"}}>
                  <span style={{fontSize:16}}>{d.icon}</span>
                  <span style={{fontSize:10}}>{d.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div style={{height:1,background:"#f1f5f9",marginBottom:16}}/>
          {subBagianOptions&&(
            <div style={{marginBottom:16}}>
              <div className="lg-label">Sub-bagian</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap" as const}}>
                {Object.keys(subBagianOptions).map((sb:string)=>(
                  <button key={sb} type="button" className="subbagian-btn" onClick={()=>{setSubBagianTerpilih(sb);setErr("");setNamaManualTeks("");setPekerjaTerpilihId("");}}
                    style={{
                      border:`1.5px solid ${subBagianTerpilih===sb?"#0d9488":"#e2e8f0"}`,
                      background:subBagianTerpilih===sb?"#0d948818":"#f8fafc",
                      color:subBagianTerpilih===sb?"#0d9488":"#64748b"}}>
                    {sb}
                  </button>
                ))}
              </div>
            </div>
          )}
          {/* Nama */}
          <div style={{marginBottom:12}}>
            <div className="lg-label">Nama</div>
            <div style={{position:"relative"}}>
              <span className="lg-icon">👤</span>
              {isManualName&&(subBagianTerpilih==="Warehouse"||subBagianTerpilih==="QS")?(
                <input className="lg-sel" type="text" value={namaManualTeks}
                  onChange={(e:any)=>{setNamaManualTeks(e.target.value);setErr("");}}
                  placeholder="Ketik nama kamu..."/>
              ):isManualName?(
                <>
                  <select className="lg-sel" value={pekerjaTerpilihId} onChange={(e:any)=>{setPekerjaTerpilihId(e.target.value);setErr("");}}>
                    <option value="">-- Pilih Nama --</option>
                    {pekerjaOptions.map((p:any)=><option key={p.id} value={p.id}>{p.nama}</option>)}
                  </select>
                  <span style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",fontSize:11,color:"#94a3b8",pointerEvents:"none"}}>▼</span>
                </>
              ):(
                <>
                  <select className="lg-sel" value={username} onChange={(e:any)=>{setUsername(e.target.value);setErr("");}}>
                    <option value="">-- Pilih Nama --</option>
                    {userList.map((u:any)=><option key={u.id} value={u.username}>{u.nama}</option>)}
                  </select>
                  <span style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",fontSize:11,color:"#94a3b8",pointerEvents:"none"}}>▼</span>
                </>
              )}
            </div>
          </div>
          {/* Password */}
          <div style={{marginBottom:4}}>
            <div className="lg-label">Password</div>
            <div style={{position:"relative"}}>
              <span className="lg-icon">🔒</span>
              <input className={"lg-inp"+(err?" err":"")} type={show?"text":"password"} value={pwd}
                onChange={(e:any)=>{setPwd(e.target.value);setErr("");}}
                onKeyDown={(e:any)=>e.key==="Enter"&&go()}
                placeholder="Masukkan password..." style={{paddingRight:44}}/>
              <button className="lg-eye" onClick={()=>setShow(!show)}>{show?"🙈":"👁"}</button>
            </div>
          </div>
          {err&&<div className="lg-err"><span>⚠️</span><span>{err}</span></div>}
          <button className={"lg-btn"+(success?" success":"")} onClick={go} disabled={loading||success} style={{marginTop:20}}>
            {loading?<><span className="lg-spinner"/><span>Memuat...</span></>
             :success?<><span>✓</span><span>Berhasil!</span></>
             :<><span>Masuk</span><span style={{fontSize:16}}>→</span></>}
          </button>
          <div style={{marginTop:16,paddingTop:14,borderTop:"1px solid #f1f5f9",textAlign:"center",fontSize:11,color:"#cbd5e1"}}>
            2026 Vista Teknik · Electrical Switchboard Manufacturing
          </div>
        </div>
      </div>
    </div>
  );
}



// ─────────────────────────────────────────────────────────────────────────────
// OPERATOR VIEW — tabel besar per proses (connect ke Supabase)
// ─────────────────────────────────────────────────────────────────────────────
const PROGRESS_STEPS_NP=[25,50,75,100];
// Warehouse/QS: status 3-tahap (bukan persentase) - To Do=0, In Progress=50, Done=100, tetap
// disimpan ke field progress (number) yang sama biar status "selesai/proses/belum" di tempat lain
// (Quality Center, dsb) gak perlu berubah.
const STATUS_3_NP=[{key:"todo",label:"To Do",pct:0},{key:"progress",label:"In Progress",pct:50},{key:"done",label:"Done",pct:100}];

const getUrgensiPanel=(target:string|undefined)=>{
  if(!target)return{level:"normal",label:"",hari:null};
  const hari=Math.ceil((new Date(target).getTime()-new Date().getTime())/86400000);
  if(hari<0)return{level:"telat",label:`Telat ${Math.abs(hari)}hr`,hari};
  if(hari<=3)return{level:"mendesak",label:`H-${hari}`,hari};
  if(hari<=7)return{level:"perhatian",label:`H-${hari}`,hari};
  return{level:"normal",label:`H-${hari}`,hari};
};
const fmtTanggalDeadlineNp=(target:string)=>new Date(target).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"});

const QC_ITEMS=[
  {key:"fisik",label:"Pemeriksaan Fisik",desc:"Kelayakan kualitas fisik panel",icon:"🔍"},
  {key:"spesifikasi",label:"Verifikasi Spesifikasi Komponen",desc:"Sesuai partlist",icon:"📋"},
  {key:"baut",label:"Pengecekan Kekencangan Baut",desc:"",icon:"🔧"},
  {key:"test",label:"QC Test",desc:"Tes elektrikal standar",icon:"⚡"},
];

function QCChecklistTab({user}:any){
  const[panelsList,setPanelsList]=useState<any[]>([]);
  const[loading,setLoading]=useState(true);
  const[search,setSearch]=useState("");
  const[selectedWoId,setSelectedWoId]=useState<number|null>(null);
  const[searchPanel,setSearchPanel]=useState("");
  const[uploadingId,setUploadingId]=useState<string|null>(null);
  const[fotoViewer,setFotoViewer]=useState<{fotos:FotoViewerPekerja[],startIndex:number,label:string}|null>(null);

  const fetchData=async()=>{
    setLoading(true);
    const{data:panels}=await supabase.from("panels").select("*");
    const woIds=[...new Set((panels??[]).map((p:any)=>p.wo_id).filter(Boolean))];
    const{data:wos}=woIds.length>0?await supabase.from("work_orders").select("id,wo,proyek,target,is_archived").in("id",woIds):{data:[]};
    const woMap:Record<number,any>={};
    (wos??[]).forEach((w:any)=>{woMap[w.id]=w;});
    const merged=(panels??[])
      .filter((p:any)=>!woMap[p.wo_id]?.is_archived)
      .map((p:any)=>({...p,_wo:woMap[p.wo_id]||{}}));
    setPanelsList(merged);
    setLoading(false);
  };

  useEffect(()=>{
    fetchData();
    const ch=supabase.channel("realtime-panels-qc")
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"panels"},()=>{fetchData();})
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"panels"},()=>{fetchData();})
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);

  const updateGlobalStatus=async(panelId:number,status:string)=>{
    const panel=panelsList.find((p:any)=>p.id===panelId);
    const prevGlobal=panel?.qc_checklist?._global||{};
    const now=new Date().toISOString();
    const newGlobal:any={...prevGlobal,status,updated_by:user.nama,updated_at:now};
    if(status==="to_do")newGlobal.todo_at=now;
    if(status==="complete")newGlobal.complete_at=now;
    const newChecklist={...(panel?.qc_checklist||{}),_global:newGlobal};
    await supabase.from("panels").update({qc_checklist:newChecklist}).eq("id",panelId);
    setPanelsList(prev=>prev.map((p:any)=>p.id===panelId?{...p,qc_checklist:newChecklist}:p));
  };

  const updateCatatanSeksi=async(panelId:number,itemKey:string,catatan:string)=>{
    const panel=panelsList.find((p:any)=>p.id===panelId);
    const prevData=panel?.qc_checklist?.[itemKey]||{};
    const newChecklist={...(panel?.qc_checklist||{}),[itemKey]:{...prevData,catatan}};
    await supabase.from("panels").update({qc_checklist:newChecklist}).eq("id",panelId);
    setPanelsList(prev=>prev.map((p:any)=>p.id===panelId?{...p,qc_checklist:newChecklist}:p));
  };

  const uploadFotoSeksi=async(panelId:number,itemKey:string,file:File)=>{
    const uploadKey=`${panelId}_${itemKey}`;
    setUploadingId(uploadKey);
    try{
      const fileName=`${panelId}_${itemKey}_${Date.now()}_${file.name}`;
      const{error:upErr}=await supabase.storage.from("qc-photos").upload(fileName,file);
      if(upErr){alert("Gagal upload: "+upErr.message);setUploadingId(null);return;}
      const{data:urlData}=supabase.storage.from("qc-photos").getPublicUrl(fileName);
      const panel=panelsList.find((p:any)=>p.id===panelId);
      const prevData=panel?.qc_checklist?.[itemKey]||{status:"to_do",catatan:""};
      const newFoto=[...(prevData.foto||[]),{url:urlData.publicUrl,name:file.name,uploaded_by:user.nama,uploaded_at:new Date().toISOString()}];
      const newChecklist={...(panel?.qc_checklist||{}),[itemKey]:{...prevData,foto:newFoto}};
      await supabase.from("panels").update({qc_checklist:newChecklist}).eq("id",panelId);
      setPanelsList(prev=>prev.map((p:any)=>p.id===panelId?{...p,qc_checklist:newChecklist}:p));
    }catch(err:any){
      alert("Terjadi kesalahan: "+err.message);
    }
    setUploadingId(null);
  };

  const hapusFotoSeksi=async(panelId:number,itemKey:string,fotoUrl:string)=>{
    const panel=panelsList.find((p:any)=>p.id===panelId);
    const prevData=panel?.qc_checklist?.[itemKey]||{status:"to_do",catatan:""};
    const newFoto=(prevData.foto||[]).filter((f:any)=>f.url!==fotoUrl);
    const newChecklist={...(panel?.qc_checklist||{}),[itemKey]:{...prevData,foto:newFoto}};
    await supabase.from("panels").update({qc_checklist:newChecklist}).eq("id",panelId);
    setPanelsList(prev=>prev.map((p:any)=>p.id===panelId?{...p,qc_checklist:newChecklist}:p));
  };

  const togglePacking=async(panelId:number,currentVal:boolean)=>{
    const newVal=!currentVal;
    await supabase.from("panels").update({
      packing_done:newVal,
      packing_done_by:newVal?user.nama:null,
      packing_done_at:newVal?new Date().toISOString():null,
    }).eq("id",panelId);
    setPanelsList(prev=>prev.map((p:any)=>p.id===panelId?{...p,packing_done:newVal,packing_done_by:newVal?user.nama:null}:p));
  };

  const getQcStatus=(panel:any)=>{
    return panel.qc_checklist?._global?.status||"to_do";
  };
  const fmtTglQc=(iso:string)=>{
    if(!iso)return"";
    const d=new Date(iso);
    return d.toLocaleDateString("id-ID",{day:"numeric",month:"short"})+" "+d.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"});
  };

  const urutanLevelNp:Record<string,number>={telat:0,mendesak:1,perhatian:2,normal:3};

  const projectGroups=useMemo(()=>{
    const groups:Record<string,{wo:any,panels:any[]}>={};
    panelsList.forEach((p:any)=>{
      const woId=String(p.wo_id);
      if(!groups[woId])groups[woId]={wo:p._wo,panels:[]};
      groups[woId].panels.push(p);
    });
    return Object.entries(groups).map(([woId,g])=>{
      const totalPanel=g.panels.length;
      const selesai=g.panels.filter((p:any)=>p.packing_done).length;
      return{woId:Number(woId),wo:g.wo,panels:g.panels,totalPanel,selesai};
    }).sort((a,b)=>{
      const aDone=a.selesai===a.totalPanel;
      const bDone=b.selesai===b.totalPanel;
      if(aDone!==bDone)return aDone?1:-1;
      const uA=getUrgensiPanel(a.wo?.target);const uB=getUrgensiPanel(b.wo?.target);
      const lvA=urutanLevelNp[uA.level]??3;const lvB=urutanLevelNp[uB.level]??3;
      if(lvA!==lvB)return lvA-lvB;
      if(uA.hari!==null&&uB.hari!==null)return uA.hari-uB.hari;
      return 0;
    });
  },[panelsList]);

  const filteredProjects=projectGroups.filter((g:any)=>
    !search||g.wo?.proyek?.toLowerCase().includes(search.toLowerCase())||g.wo?.wo?.toLowerCase().includes(search.toLowerCase())
  );

  const selectedProject=projectGroups.find((g:any)=>g.woId===selectedWoId);
  const warnaUrgMap:Record<string,{bg:string,color:string}>={telat:{bg:"#fef2f2",color:"#dc2626"},mendesak:{bg:"#fff7ed",color:"#ea580c"},perhatian:{bg:"#fefce8",color:"#ca8a04"}};

  if(!selectedWoId){
    return(
      <div style={{padding:"16px",background:"#f8fafc",minHeight:"100%"}}>
        <div style={{position:"relative" as const,marginBottom:14}}>
          <i className="ti ti-search" style={{position:"absolute" as const,left:12,top:11,fontSize:15,color:"#94a3b8"}}/>
          <input value={search} onChange={(e:any)=>setSearch(e.target.value)} placeholder="Cari proyek atau WO"
            style={{width:"100%",height:38,padding:"0 12px 0 34px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:13,outline:"none",background:"#fff",color:"#1e293b",boxSizing:"border-box" as const}}/>
        </div>
        {loading?(
          <div style={{textAlign:"center",padding:32,color:"#94a3b8",fontSize:13}}>Memuat data…</div>
        ):filteredProjects.length===0?(
          <div style={{textAlign:"center",padding:32,color:"#94a3b8",fontSize:13}}>Tidak ada proyek</div>
        ):(
          <div style={{display:"flex",flexDirection:"column" as const,gap:1,background:"#fff",borderRadius:10,border:"1px solid #e2e8f0",overflow:"hidden"}}>
            {filteredProjects.map((g:any,gi:number)=>{
              const allDone=g.selesai===g.totalPanel;
              const urg=getUrgensiPanel(g.wo?.target);
              const w=warnaUrgMap[urg.level];
              return(
                <div key={g.woId} onClick={()=>setSelectedWoId(g.woId)}
                  style={{padding:"13px 14px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",
                    borderTop:gi>0?"1px solid #f1f5f9":"none",background:"#fff"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0,flex:1}}>
                    <div style={{width:38,height:38,borderRadius:10,background:allDone?"linear-gradient(135deg,#4ade80,#16a34a)":"linear-gradient(135deg,#60a5fa,#2563eb)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:allDone?"0 3px 8px #16a34a33":"0 3px 8px #2563eb33"}}>
                      <i className={allDone?"ti ti-check":"ti ti-package"} style={{fontSize:17,color:"#fff"}}/>
                    </div>
                    <div style={{minWidth:0}}>
                      <div style={{fontWeight:600,fontSize:13.5,color:"#0f172a",whiteSpace:"nowrap" as const,overflow:"hidden",textOverflow:"ellipsis"}}>{g.wo?.proyek}</div>
                      <div style={{fontSize:11,color:"#94a3b8",marginTop:1}}>WO {g.wo?.wo} · {g.selesai}/{g.totalPanel} packing selesai</div>
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                    {urg.label&&urg.level!=="normal"&&w&&(
                      <span style={{fontSize:9,fontWeight:600,background:w.bg,color:w.color,borderRadius:5,padding:"3px 7px",whiteSpace:"nowrap" as const}}>{urg.label}</span>
                    )}
                    <i className="ti ti-chevron-right" style={{fontSize:16,color:"#cbd5e1"}}/>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return(
    <div style={{padding:"16px",background:"#f8fafc",minHeight:"100%"}}>
      <button onClick={()=>{setSelectedWoId(null);setSearchPanel("");}}
        style={{display:"flex",alignItems:"center",gap:5,background:"none",border:"none",color:"#2563eb",fontWeight:600,fontSize:12.5,cursor:"pointer",marginBottom:14,padding:0}}>
        <i className="ti ti-chevron-left" style={{fontSize:15}}/> Daftar proyek
      </button>
      <div style={{fontWeight:700,fontSize:15,color:"#0f172a",marginBottom:2}}>{selectedProject?.wo?.proyek}</div>
      <div style={{fontSize:11.5,color:"#94a3b8",marginBottom:12}}>WO {selectedProject?.wo?.wo}</div>

      <div style={{position:"relative" as const,marginBottom:14}}>
        <i className="ti ti-search" style={{position:"absolute" as const,left:12,top:11,fontSize:15,color:"#94a3b8"}}/>
        <input value={searchPanel} onChange={(e:any)=>setSearchPanel(e.target.value)} placeholder="Cari nama panel"
          style={{width:"100%",height:38,padding:"0 12px 0 34px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:13,outline:"none",background:"#fff",color:"#1e293b",boxSizing:"border-box" as const}}/>
      </div>

      <div style={{display:"flex",flexDirection:"column" as const,gap:12}}>
        {(selectedProject?.panels||[]).filter((p:any)=>!searchPanel||p.nama?.toLowerCase().includes(searchPanel.toLowerCase())).map((p:any)=>{
          const cl=p.qc_checklist||{};
          const qcStatus=getQcStatus(p);
          const qcSemuaComplete=qcStatus==="complete";
          const globalData=p.qc_checklist?._global||{};
          return(
            <div key={p.id} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:10,overflow:"hidden"}}>
              <div style={{padding:"14px 14px 12px",borderBottom:"1px solid #f1f5f9",background:"linear-gradient(180deg,#fafbfc,#fff)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <span style={{fontWeight:700,fontSize:14.5,color:"#0f172a"}}>{p.nama}</span>
                  {(globalData.todo_at||globalData.complete_at)&&(
                    <span style={{fontSize:9.5,color:"#94a3b8"}}>
                      {globalData.complete_at?("Selesai "+fmtTglQc(globalData.complete_at)):("Mulai "+fmtTglQc(globalData.todo_at))}
                    </span>
                  )}
                </div>
                <div style={{display:"flex",gap:6}}>
                  {[{k:"to_do",label:"To Do",icon:"ti ti-circle-dashed",color:"#64748b"},
                    {k:"in_progress",label:"Progress",icon:"ti ti-loader-2",color:"#ea580c"},
                    {k:"complete",label:"Complete",icon:"ti ti-circle-check",color:"#16a34a"}].map((s:any)=>{
                    const active=qcStatus===s.k;
                    return(
                      <button key={s.k} onClick={()=>updateGlobalStatus(p.id,s.k)}
                        style={{flex:1,display:"flex",flexDirection:"column" as const,alignItems:"center",gap:3,
                          padding:"9px 4px",borderRadius:10,border:active?"none":"1px solid #e2e8f0",
                          background:active?s.color:"#fff",cursor:"pointer",transition:"all .15s",
                          boxShadow:active?`0 3px 8px ${s.color}44`:"none"}}>
                        <i className={s.icon} style={{fontSize:16,color:active?"#fff":s.color}}/>
                        <span style={{fontSize:9,fontWeight:700,color:active?"#fff":"#94a3b8"}}>{s.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{padding:"10px 10px 4px",display:"flex",flexDirection:"column" as const,gap:8}}>
                {QC_ITEMS.map((item)=>{
                  const savedData=cl[item.key]||{catatan:""};
                  const fotoSeksi=savedData.foto||[];
                  const uploadKey=`${p.id}_${item.key}`;
                  return(
                    <div key={item.key} style={{padding:12,background:"#f8fafc",borderRadius:12,border:"1px solid #eef2f7"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                        <div style={{width:26,height:26,borderRadius:8,background:"#fff",border:"1px solid #e2e8f0",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:13}}>
                          {item.icon}
                        </div>
                        <span style={{fontSize:12.5,color:"#1e293b",fontWeight:700}}>{item.label}</span>
                      </div>
                      <input defaultValue={savedData.catatan||""} placeholder="Catatan (opsional)"
                        onBlur={(e:any)=>updateCatatanSeksi(p.id,item.key,e.target.value)}
                        style={{width:"100%",marginBottom:8,padding:"7px 10px",fontSize:11.5,borderRadius:6,border:"1px solid #e2e8f0",outline:"none",background:"#fff",color:"#1e293b",boxSizing:"border-box" as const}}/>
                      <div>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                          <span style={{fontSize:10.5,fontWeight:600,color:"#64748b"}}>Foto {fotoSeksi.length}</span>
                          <label style={{display:"flex",alignItems:"center",gap:4,cursor:"pointer",color:"#2563eb",fontSize:10.5,fontWeight:600}}>
                            <i className={uploadingId===uploadKey?"ti ti-loader-2":"ti ti-plus"} style={{fontSize:12}}/>
                            Tambah
                            <input type="file" accept="image/*" capture="environment" style={{display:"none"}}
                              onChange={(e:any)=>{if(e.target.files?.[0])uploadFotoSeksi(p.id,item.key,e.target.files[0]);}}/>
                          </label>
                        </div>
                        {fotoSeksi.length>0&&(
                          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
                            {fotoSeksi.map((f:any,fi:number)=>(
                              <div key={fi}>
                                <div onClick={()=>setFotoViewer({fotos:fotoSeksi,startIndex:fi,label:`${item.label}_${p.nama}`})} style={{position:"relative" as const,aspectRatio:"1",borderRadius:8,overflow:"hidden",cursor:"pointer",background:"#f1f5f9",boxShadow:"0 1px 3px rgba(0,0,0,0.08)"}}>
                                  <img src={f.url} style={{width:"100%",height:"100%",objectFit:"cover" as const}}/>
                                  <button onClick={(e:any)=>{e.stopPropagation();hapusFotoSeksi(p.id,item.key,f.url);}}
                                    style={{position:"absolute" as const,top:3,right:3,width:16,height:16,borderRadius:99,background:"rgba(15,23,42,0.6)",color:"#fff",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                                    <i className="ti ti-x" style={{fontSize:9}}/>
                                  </button>
                                </div>
                                <div style={{fontSize:8.5,color:"#94a3b8",marginTop:2}}>{fmtTglQc(f.uploaded_at)}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{padding:"12px 14px"}}>
                {p.packing_done?(
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 12px",background:"#f0fdf4",borderRadius:8}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <i className="ti ti-circle-check" style={{fontSize:18,color:"#16a34a"}}/>
                      <div>
                        <div style={{fontSize:12.5,fontWeight:600,color:"#16a34a"}}>Sudah packing</div>
                        <div style={{fontSize:10,color:"#86efac"}}>oleh {p.packing_done_by}</div>
                      </div>
                    </div>
                    <button onClick={()=>togglePacking(p.id,true)}
                      style={{fontSize:10.5,color:"#94a3b8",background:"none",border:"none",cursor:"pointer",textDecoration:"underline"}}>
                      Batalkan
                    </button>
                  </div>
                ):(
                  <button onClick={()=>{if(qcSemuaComplete)togglePacking(p.id,false);}} disabled={!qcSemuaComplete}
                    style={{width:"100%",height:44,borderRadius:10,border:"none",cursor:qcSemuaComplete?"pointer":"not-allowed",
                      fontSize:13,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:6,
                      background:qcSemuaComplete?"linear-gradient(135deg,#3b82f6,#1d4ed8)":"#f1f5f9",color:qcSemuaComplete?"#fff":"#94a3b8",
                      boxShadow:qcSemuaComplete?"0 4px 12px #1d4ed84a":"none"}}>
                    <i className={qcSemuaComplete?"ti ti-package":"ti ti-lock"} style={{fontSize:16}}/>
                    {qcSemuaComplete?"Tandai sudah packing":"Selesaikan QC dulu"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {fotoViewer&&(
        <FotoZoomViewerPekerja fotos={fotoViewer.fotos} startIndex={fotoViewer.startIndex} label={fotoViewer.label} onClose={()=>setFotoViewer(null)}/>
      )}
    </div>
  );
}

function TrackingKomponenView({user}:any){
  const namaOperator=user?.nama||user?.name||"Operator";
  const subBagian:string=user?.sub_bagian||"Warehouse";
  const[woList,setWoList]=useState<any[]>([]);
  const[selectedWoId,setSelectedWoId]=useState<number|null>(null);
  const[catatan,setCatatan]=useState("");
  const[files,setFiles]=useState<File[]>([]);
  const[uploading,setUploading]=useState(false);
  const[riwayat,setRiwayat]=useState<any[]>([]);
  const[fotoMap,setFotoMap]=useState<Record<number,any[]>>({});
  const[loadingRiwayat,setLoadingRiwayat]=useState(true);

  const[panelList,setPanelList]=useState<any[]>([]);
  const[selectedPanelId,setSelectedPanelId]=useState<number|null>(null);

  const fetchWoList=async()=>{
    const{data}=await supabase.from("work_orders").select("id,wo,proyek").eq("is_archived",false).order("created_at",{ascending:false});
    setWoList(data??[]);
  };

  const fetchPanelList=async(woId:number)=>{
    const{data}=await supabase.from("panels").select("id,no_pnl,nama,tipe,komponen_status").eq("wo_id",woId).is("deleted_at",null).order("no_pnl",{ascending:true});
    setPanelList(data??[]);
  };

  const updateKomponenStatus=async(panelId:number,status:string)=>{
    const panel=panelList.find((p:any)=>p.id===panelId);
    const prevAll=panel?.komponen_status||{};
    const prevMine=prevAll[subBagian]||{};
    const now=new Date().toISOString();
    const newMine:any={...prevMine,status,updated_by:namaOperator,updated_at:now};
    if(status==="to_do")newMine.todo_at=now;
    if(status==="complete")newMine.complete_at=now;
    const newAll={...prevAll,[subBagian]:newMine};
    await supabase.from("panels").update({komponen_status:newAll}).eq("id",panelId);
    setPanelList(prev=>prev.map((p:any)=>p.id===panelId?{...p,komponen_status:newAll}:p));
  };

  const fetchRiwayat=async(panelId:number)=>{
    setLoadingRiwayat(true);
    const{data:tr}=await supabase.from("fcs_tracking_komponen").select("*").eq("panel_id",panelId).order("created_at",{ascending:false});
    setRiwayat(tr??[]);
    if(tr&&tr.length>0){
      const ids=tr.map((t:any)=>t.id);
      const{data:fotos}=await supabase.from("fcs_tracking_komponen_foto").select("*").in("tracking_id",ids);
      const map:Record<number,any[]>={};
      (fotos??[]).forEach((f:any)=>{
        if(!map[f.tracking_id])map[f.tracking_id]=[];
        map[f.tracking_id].push(f);
      });
      setFotoMap(map);
    } else {
      setFotoMap({});
    }
    setLoadingRiwayat(false);
  };

  useEffect(()=>{fetchWoList();},[]);

  useEffect(()=>{
    setSelectedPanelId(null);
    setRiwayat([]);
    if(selectedWoId){fetchPanelList(selectedWoId);}
  },[selectedWoId]);

  useEffect(()=>{
    if(!selectedPanelId){setRiwayat([]);return;}
    fetchRiwayat(selectedPanelId);
    const ch=supabase.channel("realtime-tracking-komponen")
      .on("postgres_changes",{event:"*",schema:"public",table:"fcs_tracking_komponen"},()=>{if(selectedPanelId)fetchRiwayat(selectedPanelId);})
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[selectedPanelId]);

  const[filePreviewUrls,setFilePreviewUrls]=useState<string[]>([]);

  const handleFileSelect=(e:any)=>{
    const picked=Array.from(e.target.files||[]) as File[];
    setFiles(prev=>[...prev,...picked]);
    setFilePreviewUrls(prev=>[...prev,...picked.map(f=>URL.createObjectURL(f))]);
  };

  const removeSelectedFile=(idx:number)=>{
    setFiles(prev=>prev.filter((_,i)=>i!==idx));
    setFilePreviewUrls(prev=>{
      URL.revokeObjectURL(prev[idx]);
      return prev.filter((_,i)=>i!==idx);
    });
  };

  const submitTracking=async()=>{
    if(!selectedWoId){alert("Pilih Work Order dulu");return;}
    if(!selectedPanelId){alert("Pilih Panel dulu");return;}
    if(files.length===0&&!catatan.trim()){alert("Lampirkan foto atau tulis catatan minimal salah satu");return;}
    setUploading(true);
    const{data:tr,error:trErr}=await supabase.from("fcs_tracking_komponen").insert({
      wo_id:selectedWoId,
      panel_id:selectedPanelId,
      sub_bagian:subBagian,
      operator_name:namaOperator,
      catatan:catatan.trim()||null,
    }).select().single();
    if(trErr||!tr){
      alert("Gagal menyimpan: "+(trErr?.message||"unknown error"));
      setUploading(false);
      return;
    }
    for(const file of files){
      const ext=file.name.split(".").pop();
      const safeName=`${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`;
      const path=`${tr.id}/${safeName}`;
      const{error:upErr}=await supabase.storage.from("tracking-komponen").upload(path,file);
      if(upErr){
        alert("Gagal upload foto "+file.name+": "+upErr.message);
        continue;
      }
      const{data:urlData}=supabase.storage.from("tracking-komponen").getPublicUrl(path);
      await supabase.from("fcs_tracking_komponen_foto").insert({
        tracking_id:tr.id,
        file_url:urlData.publicUrl,
      });
    }
    setCatatan("");
    filePreviewUrls.forEach(u=>URL.revokeObjectURL(u));
    setFiles([]);
    setFilePreviewUrls([]);
    setUploading(false);
    fetchRiwayat(selectedPanelId);
  };

  const fmtDateTime=(d:string)=>d?new Date(d).toLocaleString("id-ID",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):"-";

  const subBagianIcon:Record<string,string>={Warehouse:"📦",Assembling:"🔧",QS:"📋",QC:"🔍"};

  return(
    <div style={{padding:16}} className="fi">
      <div style={{fontWeight:800,fontSize:17,color:"#1e293b",marginBottom:4}}>📦 Tracking Komponen</div>
      <div style={{fontSize:12,color:"#64748b",marginBottom:16}}>Halo {namaOperator}, dokumentasi serah terima komponen antar bagian</div>

      <div style={{marginBottom:16,display:"flex",alignItems:"center",gap:12,background:"#fff",border:"1px solid #e2e8f0",borderRadius:14,padding:"14px 16px",boxShadow:"0 2px 8px rgba(0,0,0,0.04)"}}>
        <div style={{width:46,height:46,borderRadius:12,background:"linear-gradient(135deg,#2dd4bf,#0d9488)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:22,boxShadow:"0 3px 10px #0d948844"}}>
          {subBagianIcon[subBagian]}
        </div>
        <div>
          <div style={{fontSize:11.5,fontWeight:600,color:"#94a3b8"}}>Sub-bagian Anda</div>
          <div style={{fontSize:16.5,fontWeight:800,color:"#0f172a"}}>{subBagian}</div>
        </div>
      </div>

      <div style={{marginBottom:14}}>
        <Lbl>Work Order</Lbl>
        <select value={selectedWoId??""} onChange={(e:any)=>setSelectedWoId(e.target.value?Number(e.target.value):null)}
          style={{width:"100%",padding:"12px 14px",borderRadius:12,border:"1.5px solid #cbd5e1",fontSize:15,fontWeight:600,color:"#0f172a",background:"#fff"}}>
          <option value="">Pilih Work Order...</option>
          {woList.map((w:any)=>(
            <option key={w.id} value={w.id}>{w.wo} — {w.proyek}</option>
          ))}
        </select>
      </div>

      {selectedWoId&&(
        <div style={{marginBottom:14}}>
          <Lbl>Panel</Lbl>
          <select value={selectedPanelId??""} onChange={(e:any)=>setSelectedPanelId(e.target.value?Number(e.target.value):null)}
            style={{width:"100%",padding:"12px 14px",borderRadius:12,border:"1.5px solid #cbd5e1",fontSize:15,fontWeight:600,color:"#0f172a",background:"#fff"}}>
            <option value="">Pilih Panel...</option>
            {panelList.map((p:any)=>(
              <option key={p.id} value={p.id}>#{p.no_pnl} {p.nama} ({p.tipe})</option>
            ))}
          </select>
          {panelList.length===0&&(
            <div style={{fontSize:12,color:"#94a3b8",marginTop:6}}>Belum ada panel untuk WO ini</div>
          )}
        </div>
      )}

      {selectedWoId&&selectedPanelId&&(()=>{
        const selectedPanelObj=panelList.find((p:any)=>p.id===selectedPanelId);
        const myStatus=selectedPanelObj?.komponen_status?.[subBagian]?.status||"to_do";
        const myData=selectedPanelObj?.komponen_status?.[subBagian]||{};
        return(
          <div style={{marginBottom:14,background:"#fff",border:"1px solid #e2e8f0",borderRadius:14,padding:14,boxShadow:"0 2px 8px rgba(0,0,0,0.04)"}}>
            <div style={{fontSize:11.5,fontWeight:600,color:"#94a3b8",marginBottom:8}}>Status Komponen ({subBagian})</div>
            <div style={{display:"flex",gap:6}}>
              {[{k:"to_do",label:"To Do",icon:"⚪",color:"#64748b"},
                {k:"in_progress",label:"Progress",icon:"🟠",color:"#ea580c"},
                {k:"complete",label:"Complete",icon:"✅",color:"#0d9488"}].map((s:any)=>{
                const active=myStatus===s.k;
                return(
                  <button key={s.k} onClick={()=>updateKomponenStatus(selectedPanelId,s.k)}
                    style={{flex:1,display:"flex",flexDirection:"column" as const,alignItems:"center",gap:3,
                      padding:"9px 4px",borderRadius:10,border:active?"none":"1px solid #e2e8f0",
                      background:active?s.color:"#fff",cursor:"pointer",transition:"all .15s",
                      boxShadow:active?`0 3px 8px ${s.color}44`:"none"}}>
                    <span style={{fontSize:15}}>{s.icon}</span>
                    <span style={{fontSize:9,fontWeight:700,color:active?"#fff":"#94a3b8"}}>{s.label}</span>
                  </button>
                );
              })}
            </div>
            {(myData.todo_at||myData.complete_at)&&(
              <div style={{display:"flex",gap:10,fontSize:9.5,color:"#94a3b8",marginTop:8}}>
                {myData.todo_at&&<span>To Do: {fmtDateTime(myData.todo_at)}</span>}
                {myData.complete_at&&<span>Selesai: {fmtDateTime(myData.complete_at)}</span>}
              </div>
            )}
          </div>
        );
      })()}

      {selectedWoId&&selectedPanelId&&(
        <>
          <div style={{marginBottom:14}}>
            <Lbl>Catatan</Lbl>
            <textarea value={catatan} onChange={(e:any)=>setCatatan(e.target.value)}
              placeholder="Tulis catatan, misal: komponen lengkap, diserahkan ke assembling"
              style={{width:"100%",minHeight:60,padding:"12px 14px",borderRadius:12,border:"1.5px solid #cbd5e1",fontSize:15,fontWeight:500,color:"#0f172a",fontFamily:"inherit",resize:"vertical" as const}}/>
          </div>

          <div style={{marginBottom:16}}>
            <Lbl>Foto</Lbl>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
              {filePreviewUrls.map((url,idx)=>(
                <div key={idx} style={{position:"relative" as const,aspectRatio:"1",borderRadius:10,overflow:"hidden",background:"#f1f5f9"}}>
                  <img src={url} style={{width:"100%",height:"100%",objectFit:"cover" as const}}/>
                  <button onClick={()=>removeSelectedFile(idx)}
                    style={{position:"absolute" as const,top:4,right:4,width:22,height:22,borderRadius:"50%",background:"rgba(0,0,0,0.6)",border:"none",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
                </div>
              ))}
              <label style={{display:"flex",alignItems:"center",justifyContent:"center",aspectRatio:"1",borderRadius:10,border:"1.5px dashed #cbd5e1",background:"#f8fafc",cursor:"pointer"}}>
                <span style={{fontSize:24,color:"#94a3b8"}}>📷</span>
                <input type="file" accept="image/*" multiple capture="environment" onChange={handleFileSelect} style={{display:"none"}}/>
              </label>
            </div>
          </div>

          <button onClick={submitTracking} disabled={uploading}
            style={{width:"100%",padding:"15px",borderRadius:12,border:"none",
              background:uploading?"#94a3b8":"linear-gradient(135deg,#2dd4bf,#0d9488)",
              color:"#fff",fontSize:16,fontWeight:800,cursor:uploading?"default":"pointer",fontFamily:"inherit",marginBottom:24,
              boxShadow:uploading?"none":"0 4px 14px #0d948844"}}>
            {uploading?"Mengunggah...":"Kirim"}
          </button>

          <div style={{fontSize:12,fontWeight:800,color:"#0f172a",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:8}}>Riwayat</div>
          {loadingRiwayat?(
            <div style={{textAlign:"center" as const,padding:30,color:"#94a3b8",fontSize:13}}>Memuat...</div>
          ):riwayat.length===0?(
            <div style={{textAlign:"center" as const,padding:30,color:"#94a3b8",fontSize:13}}>Belum ada riwayat untuk panel ini</div>
          ):(
            <div style={{display:"flex",flexDirection:"column" as const,gap:10}}>
              {riwayat.map((r:any)=>(
                <div key={r.id} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:"14px 16px",textAlign:"left" as const,boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                    <div style={{width:34,height:34,borderRadius:10,background:"linear-gradient(135deg,#2dd4bf,#0d9488)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:16}}>
                      {subBagianIcon[r.sub_bagian]}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:800,fontSize:14,color:"#0f172a"}}>{r.sub_bagian}</div>
                      <div style={{fontSize:11.5,color:"#94a3b8"}}>oleh {r.operator_name}</div>
                    </div>
                    <span style={{fontSize:10.5,fontWeight:600,color:"#94a3b8",whiteSpace:"nowrap" as const}}>{fmtDateTime(r.created_at)}</span>
                  </div>
                  {r.catatan&&<div style={{fontSize:14,fontWeight:500,color:"#1e293b",marginBottom:10,lineHeight:1.6,textAlign:"left" as const,whiteSpace:"pre-wrap" as const,background:"#f8fafc",borderRadius:8,padding:"8px 10px"}}>{r.catatan}</div>}
                  {(fotoMap[r.id]||[]).length>0&&(
                    <div style={{display:"flex",flexWrap:"wrap" as const,gap:6}}>
                      {(fotoMap[r.id]||[]).map((foto:any)=>(
                        <a key={foto.id} href={foto.file_url} target="_blank" rel="noopener noreferrer">
                          <img src={foto.file_url} style={{width:64,height:64,objectFit:"cover" as const,borderRadius:8,border:"1px solid #e2e8f0",boxShadow:"0 1px 3px rgba(0,0,0,0.08)"}}/>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const STATUS_TUGAS_NP:Record<string,{label:string,bg:string,color:string}>={
  belum:{label:"Belum Mulai",bg:"#f1f5f9",color:"#64748b"},
  proses:{label:"Sedang Dikerjakan",bg:"#fef9c3",color:"#a16207"},
  selesai:{label:"Selesai",bg:"#dcfce7",color:"#16a34a"},
};
const hitungStatusTugasNp=(pct:number,jumlahFoto:number)=>{
  if(pct>=100&&jumlahFoto>=1)return"selesai";
  if(pct>0||jumlahFoto>0)return"proses";
  return"belum";
};
const TUGAS_NP=[
  {field:"nameplate",label:"Nameplate",icon:"🏷️",color:"#0891b2",progressField:"nameplate_progress" as const,fotoField:"nameplate_photos",historyField:"nameplate_history",updatedByField:"nameplate_updated_by",updatedAtField:"nameplate_updated_at"},
  {field:"yellowmark",label:"Yellowmark",icon:"🟡",color:"#ca8a04",progressField:"yellowmark_progress" as const,fotoField:"yellowmark_photos",historyField:"yellowmark_history",updatedByField:"yellowmark_updated_by",updatedAtField:"yellowmark_updated_at"},
];
// Warehouse & QS - gaya sama persis Nameplate/Yellowmark (Fabrikasi % + Pemasangan Foto per
// panel), tapi masing-masing cuma 1 tugas (bukan sepasang) dan bucket foto sendiri-sendiri.
const TUGAS_WAREHOUSE={field:"warehouse",label:"Warehouse",icon:"📦",color:"#0d9488",progressField:"warehouse_progress" as const,fotoField:"warehouse_photos",historyField:"warehouse_history",updatedByField:"warehouse_updated_by",updatedAtField:"warehouse_updated_at",bucket:"warehouse-photos"};
const TUGAS_QS={field:"qs",label:"QS",icon:"📋",color:"#7c3aed",progressField:"qs_progress" as const,fotoField:"qs_photos",historyField:"qs_history",updatedByField:"qs_updated_by",updatedAtField:"qs_updated_at",bucket:"qs-photos"};
// Kompres foto sebelum upload (canvas resize max-width 1600px + JPEG q0.8) - foto asli dari
// kamera HP bisa 3-8MB, operator sering upload lewat data seluler.
const compressImageNp=(file:File):Promise<Blob>=>new Promise((resolve,reject)=>{
  const img=new Image();
  const url=URL.createObjectURL(file);
  img.onload=()=>{
    const maxW=1600;
    const scale=Math.min(1,maxW/img.width);
    const canvas=document.createElement("canvas");
    canvas.width=Math.round(img.width*scale);
    canvas.height=Math.round(img.height*scale);
    const ctx=canvas.getContext("2d");
    if(!ctx){URL.revokeObjectURL(url);reject(new Error("Canvas tidak didukung"));return;}
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    canvas.toBlob(blob=>{
      URL.revokeObjectURL(url);
      if(blob)resolve(blob);else reject(new Error("Gagal kompres foto"));
    },"image/jpeg",0.8);
  };
  img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("Gagal membaca foto"));};
  img.src=url;
});
const downloadFotoNp=async(url:string,label:string)=>{
  try{
    const res=await fetch(url);
    const blob=await res.blob();
    const blobUrl=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=blobUrl;
    a.download=`${label}_${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  }catch(err:any){
    alert("Gagal download: "+err.message);
  }
};

type FotoViewerPekerja={url:string,uploaded_at?:string,uploaded_by?:string,name?:string};

// Viewer gaya ClickUp: prev/next antar foto dalam galeri yang sama, toolbar atas rapi
// (nama+posisi, Download, Close), scroll-wheel zoom + drag buat geser waktu di-zoom (mouse),
// pinch dua-jari + drag satu-jari (touch), thumbnail strip di bawah buat lompat foto.
// Dipakai sama semua tempat foto hasil kerja (Nameplate/Warehouse/QS/QC).
function FotoZoomViewerPekerja({fotos,startIndex,label,onClose}:{fotos:FotoViewerPekerja[],startIndex:number,label?:string,onClose:()=>void}){
  const[index,setIndex]=useState(startIndex);
  const[zoom,setZoom]=useState(1);
  const[pan,setPan]=useState({x:0,y:0});
  const draggingRef=useRef(false);
  const dragStartRef=useRef({x:0,y:0,panX:0,panY:0});
  const pinchStartDist=useRef<number|null>(null);
  const pinchStartZoom=useRef(1);
  const panStartTouchRef=useRef<{x:number,y:number,panX:number,panY:number}|null>(null);

  const foto=fotos[index];
  const resetView=()=>{setZoom(1);setPan({x:0,y:0});};
  const goPrev=()=>{if(index>0){setIndex(index-1);resetView();}};
  const goNext=()=>{if(index<fotos.length-1){setIndex(index+1);resetView();}};

  useEffect(()=>{
    const handler=(e:KeyboardEvent)=>{
      if(e.key==="ArrowLeft")goPrev();
      else if(e.key==="ArrowRight")goNext();
      else if(e.key==="Escape")onClose();
    };
    window.addEventListener("keydown",handler);
    return()=>window.removeEventListener("keydown",handler);
  },[index,fotos.length]);

  const handleWheel=(e:any)=>{
    e.preventDefault();
    setZoom(z=>{
      const next=Math.min(4,Math.max(1,z+(e.deltaY<0?0.25:-0.25)));
      if(next===1)setPan({x:0,y:0});
      return next;
    });
  };

  const handleMouseDown=(e:any)=>{
    if(zoom<=1)return;
    draggingRef.current=true;
    dragStartRef.current={x:e.clientX,y:e.clientY,panX:pan.x,panY:pan.y};
  };
  const handleMouseMove=(e:any)=>{
    if(!draggingRef.current)return;
    setPan({x:dragStartRef.current.panX+(e.clientX-dragStartRef.current.x),y:dragStartRef.current.panY+(e.clientY-dragStartRef.current.y)});
  };
  const handleMouseUp=()=>{draggingRef.current=false;};

  const handleTouchStart=(e:any)=>{
    if(e.touches.length===2){
      const[a,b]=e.touches;
      pinchStartDist.current=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
      pinchStartZoom.current=zoom;
      panStartTouchRef.current=null;
    } else if(e.touches.length===1&&zoom>1){
      const t=e.touches[0];
      panStartTouchRef.current={x:t.clientX,y:t.clientY,panX:pan.x,panY:pan.y};
    }
  };
  const handleTouchMove=(e:any)=>{
    if(e.touches.length===2&&pinchStartDist.current){
      const[a,b]=e.touches;
      const dist=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
      const scale=dist/pinchStartDist.current;
      const next=Math.min(4,Math.max(1,pinchStartZoom.current*scale));
      setZoom(next);
      if(next===1)setPan({x:0,y:0});
    } else if(e.touches.length===1&&panStartTouchRef.current){
      const t=e.touches[0];
      const st=panStartTouchRef.current;
      setPan({x:st.panX+(t.clientX-st.x),y:st.panY+(t.clientY-st.y)});
    }
  };
  const handleTouchEnd=()=>{pinchStartDist.current=null;panStartTouchRef.current=null;};

  const fmtTgl=(iso?:string)=>{
    if(!iso)return"";
    const d=new Date(iso);
    return d.toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"})+" "+d.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"});
  };

  return(
    <div onClick={onClose}
      style={{position:"fixed" as const,inset:0,background:"rgba(0,0,0,0.92)",zIndex:9999,display:"flex",flexDirection:"column" as const}}>
      <div onClick={(e:any)=>e.stopPropagation()}
        style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 18px",background:"linear-gradient(rgba(0,0,0,0.55),transparent)",flexShrink:0}}>
        <div style={{minWidth:0}}>
          <div style={{color:"#fff",fontSize:13,fontWeight:700,whiteSpace:"nowrap" as const,overflow:"hidden",textOverflow:"ellipsis"}}>
            {foto.name||label||"Foto"}{fotos.length>1?` · ${index+1}/${fotos.length}`:""}
          </div>
          {(foto.uploaded_by||foto.uploaded_at)&&(
            <div style={{color:"#cbd5e1",fontSize:11,marginTop:2}}>
              {foto.uploaded_by?`Diupload oleh ${foto.uploaded_by}`:""}{foto.uploaded_at?" · "+fmtTgl(foto.uploaded_at):""}
            </div>
          )}
        </div>
        <div style={{display:"flex",gap:8,flexShrink:0}}>
          <button onClick={()=>downloadFotoNp(foto.url,foto.name||label||"foto")}
            style={{display:"flex",alignItems:"center",gap:6,background:"rgba(255,255,255,0.15)",color:"#fff",border:"none",borderRadius:8,padding:"8px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>
            <i className="ti ti-download" style={{fontSize:15}}/> Download
          </button>
          <button onClick={onClose}
            style={{width:34,height:34,borderRadius:99,background:"rgba(255,255,255,0.15)",color:"#fff",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <i className="ti ti-x" style={{fontSize:17}}/>
          </button>
        </div>
      </div>

      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",position:"relative" as const,overflow:"hidden",minHeight:0}}
        onClick={(e:any)=>e.stopPropagation()}>
        {fotos.length>1&&index>0&&(
          <button onClick={goPrev}
            style={{position:"absolute" as const,left:14,top:"50%",transform:"translateY(-50%)",width:40,height:40,borderRadius:99,background:"rgba(255,255,255,0.15)",color:"#fff",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2}}>
            <i className="ti ti-chevron-left" style={{fontSize:20}}/>
          </button>
        )}
        <div
          onWheel={handleWheel}
          onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
          style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",touchAction:"none" as const,cursor:zoom>1?(draggingRef.current?"grabbing":"grab"):"default"}}>
          <img src={foto.url} draggable={false}
            style={{maxWidth:"90%",maxHeight:"90%",objectFit:"contain" as const,transform:`translate(${pan.x}px,${pan.y}px) scale(${zoom})`,transformOrigin:"center",transition:draggingRef.current?"none":"transform .08s"}}/>
        </div>
        {fotos.length>1&&index<fotos.length-1&&(
          <button onClick={goNext}
            style={{position:"absolute" as const,right:14,top:"50%",transform:"translateY(-50%)",width:40,height:40,borderRadius:99,background:"rgba(255,255,255,0.15)",color:"#fff",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2}}>
            <i className="ti ti-chevron-right" style={{fontSize:20}}/>
          </button>
        )}
      </div>

      <div onClick={(e:any)=>e.stopPropagation()} style={{flexShrink:0,padding:"10px 18px 16px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:14,marginBottom:fotos.length>1?12:0}}>
          <button onClick={()=>setZoom(z=>{const n=Math.max(1,z-0.5);if(n===1)setPan({x:0,y:0});return n;})}
            style={{width:32,height:32,borderRadius:99,background:"rgba(255,255,255,0.15)",color:"#fff",border:"none",fontSize:17,fontWeight:700,cursor:"pointer"}}>−</button>
          <span style={{color:"#fff",fontSize:12,fontWeight:700,minWidth:40,textAlign:"center" as const}}>{Math.round(zoom*100)}%</span>
          <button onClick={()=>setZoom(z=>Math.min(4,z+0.5))}
            style={{width:32,height:32,borderRadius:99,background:"rgba(255,255,255,0.15)",color:"#fff",border:"none",fontSize:17,fontWeight:700,cursor:"pointer"}}>+</button>
        </div>
        {fotos.length>1&&(
          <div style={{display:"flex",gap:6,overflowX:"auto" as const,justifyContent:fotos.length<=8?"center":"flex-start",padding:"2px 0"}}>
            {fotos.map((f,fi)=>(
              <img key={fi} src={f.url} onClick={()=>{setIndex(fi);resetView();}}
                style={{width:48,height:48,objectFit:"cover" as const,borderRadius:6,cursor:"pointer",flexShrink:0,
                  border:fi===index?"2px solid #fff":"2px solid transparent",opacity:fi===index?1:0.55}}/>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function NameplateView({user}:any){
  const[panelsList,setPanelsList]=useState<any[]>([]);
  const[loading,setLoading]=useState(true);
  const[search,setSearch]=useState("");
  const[selectedWoId,setSelectedWoId]=useState<number|null>(null);
  const[expandedTugas,setExpandedTugas]=useState<Set<string>>(new Set());
  const toggleTugas=(panelId:number,field:string)=>{
    const key=`${panelId}_${field}`;
    setExpandedTugas(prev=>{
      const next=new Set(prev);
      if(next.has(key))next.delete(key);else next.add(key);
      return next;
    });
  };

  // Foto yang baru dipilih tapi BELUM disimpan permanen (staging lokal saja, belum ada
  // di Supabase Storage/DB) - operator masih bisa Batalkan sebelum tekan Simpan Progress.
  const[stagedFotos,setStagedFotos]=useState<Record<string,{file:File,previewUrl:string}[]>>({});
  const[savingKey,setSavingKey]=useState<string|null>(null);
  const[uploadProgress,setUploadProgress]=useState<{current:number,total:number}|null>(null);

  const[fotoViewer,setFotoViewer]=useState<{fotos:FotoViewerPekerja[],startIndex:number,label:string}|null>(null);

  const pilihFotoStaged=(panelId:number,field:string,fileList:FileList|null)=>{
    if(!fileList||fileList.length===0)return;
    const key=`${panelId}_${field}`;
    const dipilih=Array.from(fileList).map(file=>({file,previewUrl:URL.createObjectURL(file)}));
    setStagedFotos(prev=>({...prev,[key]:[...(prev[key]||[]),...dipilih]}));
  };

  const batalkanFotoStaged=(panelId:number,field:string,idx:number)=>{
    const key=`${panelId}_${field}`;
    setStagedFotos(prev=>{
      const arr=prev[key]||[];
      URL.revokeObjectURL(arr[idx]?.previewUrl);
      return{...prev,[key]:arr.filter((_,i)=>i!==idx)};
    });
  };

  const simpanProgressTugas=async(p:any,t:typeof TUGAS_NP[number])=>{
    const key=`${p.id}_${t.field}`;
    const staged=stagedFotos[key]||[];
    const pct=p[t.progressField]||0;
    const existingFoto=p[t.fotoField]||[];
    const hist=p[t.historyField]||[];
    const existIdx=hist.findIndex((h:any)=>h.tanggal===TODAY);
    const pctBerubah=existIdx<0||hist[existIdx].pct!==pct;
    if(!pctBerubah&&staged.length===0){alert("Tidak ada perubahan untuk disimpan");return;}
    setSavingKey(key);
    try{
      const fotoTerupload:any[]=[];
      for(let i=0;i<staged.length;i++){
        setUploadProgress({current:i+1,total:staged.length});
        const s=staged[i];
        const blob=await compressImageNp(s.file);
        const path=`${p.id}/${t.field}/${Date.now()}_${Math.random().toString(36).slice(2,8)}.jpg`;
        const{error:upErr}=await supabase.storage.from("nameplate-photos").upload(path,blob,{contentType:"image/jpeg"});
        if(upErr){alert(`Gagal upload salah satu foto: ${upErr.message}`);continue;}
        const{data:urlData}=supabase.storage.from("nameplate-photos").getPublicUrl(path);
        fotoTerupload.push({url:urlData.publicUrl,uploaded_by:user.nama,uploaded_at:new Date().toISOString()});
      }
      setUploadProgress(null);
      const newFoto=[...existingFoto,...fotoTerupload];
      const newHist=[...hist];
      if(existIdx>=0)newHist[existIdx]={...newHist[existIdx],pct,ts:new Date().toISOString()};
      else newHist.push({tanggal:TODAY,pct,oleh:user.nama,ts:new Date().toISOString()});
      const patch={
        [t.progressField]:pct,
        [t.updatedByField]:user.nama,
        [t.updatedAtField]:new Date().toISOString(),
        [t.historyField]:newHist,
        [t.fotoField]:newFoto,
      };
      await supabase.from("panels").update(patch).eq("id",p.id);
      setPanelsList(prev=>prev.map((pp:any)=>pp.id===p.id?{...pp,...patch}:pp));
      staged.forEach(s=>URL.revokeObjectURL(s.previewUrl));
      setStagedFotos(prev=>{const next={...prev};delete next[key];return next;});
    }catch(err:any){
      alert("Terjadi kesalahan: "+err.message);
    }
    setUploadProgress(null);
    setSavingKey(null);
  };

  const fetchData=async()=>{
    setLoading(true);
    const{data:panels}=await supabase.from("panels").select("*");
    const woIds=[...new Set((panels??[]).map((p:any)=>p.wo_id).filter(Boolean))];
    const{data:wos}=woIds.length>0?await supabase.from("work_orders").select("id,wo,proyek,target,is_archived").in("id",woIds):{data:[]};
    const woMap:Record<number,any>={};
    (wos??[]).forEach((w:any)=>{woMap[w.id]=w;});
    const merged=(panels??[])
      .filter((p:any)=>!woMap[p.wo_id]?.is_archived)
      .map((p:any)=>({...p,_wo:woMap[p.wo_id]||{}}));
    setPanelsList(merged);
    setLoading(false);
  };

  useEffect(()=>{
    fetchData();
    const ch=supabase.channel("realtime-panels-nameplate")
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"panels"},()=>{fetchData();})
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"panels"},()=>{fetchData();})
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);

  const[lockLoading,setLockLoading]=useState(false);

  const updateProgress=(panelId:number,field:"nameplate_progress"|"yellowmark_progress",val:number)=>{
    setPanelsList(prev=>prev.map((p:any)=>p.id===panelId?{...p,[field]:val}:p));
  };

  const kunciProgress=async(panelList:any[])=>{
    setLockLoading(true);
    let count=0;
    for(const p of panelList){
      const npHist=p.nameplate_history||[];
      const ymHist=p.yellowmark_history||[];
      const npExistIdx=npHist.findIndex((h:any)=>h.tanggal===TODAY);
      const ymExistIdx=ymHist.findIndex((h:any)=>h.tanggal===TODAY);
      const npChanged=npExistIdx<0||npHist[npExistIdx].pct!==(p.nameplate_progress||0);
      const ymChanged=ymExistIdx<0||ymHist[ymExistIdx].pct!==(p.yellowmark_progress||0);
      if(!npChanged&&!ymChanged)continue;
      const newNpHist=[...npHist];
      if(npExistIdx>=0)newNpHist[npExistIdx]={...newNpHist[npExistIdx],pct:p.nameplate_progress||0,ts:new Date().toISOString()};
      else newNpHist.push({tanggal:TODAY,pct:p.nameplate_progress||0,oleh:user.nama,ts:new Date().toISOString()});
      const newYmHist=[...ymHist];
      if(ymExistIdx>=0)newYmHist[ymExistIdx]={...newYmHist[ymExistIdx],pct:p.yellowmark_progress||0,ts:new Date().toISOString()};
      else newYmHist.push({tanggal:TODAY,pct:p.yellowmark_progress||0,oleh:user.nama,ts:new Date().toISOString()});
      await supabase.from("panels").update({
        nameplate_progress:p.nameplate_progress||0,nameplate_updated_by:user.nama,nameplate_updated_at:new Date().toISOString(),nameplate_history:newNpHist,
        yellowmark_progress:p.yellowmark_progress||0,yellowmark_updated_by:user.nama,yellowmark_updated_at:new Date().toISOString(),yellowmark_history:newYmHist,
      }).eq("id",p.id);
      count++;
    }
    setLockLoading(false);
    alert(count>0?`${count} panel berhasil dikunci`:"Tidak ada perubahan untuk dikunci");
    fetchData();
  };

  const urutanLevelNp:Record<string,number>={telat:0,mendesak:1,perhatian:2,normal:3};

  const projectGroups=useMemo(()=>{
    const groups:Record<string,{wo:any,panels:any[]}>={};
    panelsList.forEach((p:any)=>{
      const woId=String(p.wo_id);
      if(!groups[woId])groups[woId]={wo:p._wo,panels:[]};
      groups[woId].panels.push(p);
    });
    return Object.entries(groups).map(([woId,g])=>{
      const totalPanel=g.panels.length;
      const selesai=g.panels.filter((p:any)=>
        hitungStatusTugasNp(p.nameplate_progress||0,(p.nameplate_photos||[]).length)==="selesai"&&
        hitungStatusTugasNp(p.yellowmark_progress||0,(p.yellowmark_photos||[]).length)==="selesai"
      ).length;
      return{woId:Number(woId),wo:g.wo,panels:g.panels,totalPanel,selesai};
    }).sort((a,b)=>{
      const aDone=a.selesai===a.totalPanel;
      const bDone=b.selesai===b.totalPanel;
      if(aDone!==bDone)return aDone?1:-1;
      const uA=getUrgensiPanel(a.wo?.target);const uB=getUrgensiPanel(b.wo?.target);
      const lvA=urutanLevelNp[uA.level]??3;const lvB=urutanLevelNp[uB.level]??3;
      if(lvA!==lvB)return lvA-lvB;
      if(uA.hari!==null&&uB.hari!==null)return uA.hari-uB.hari;
      return 0;
    });
  },[panelsList]);

  const filteredProjects=projectGroups.filter((g:any)=>
    !search||g.wo?.proyek?.toLowerCase().includes(search.toLowerCase())||g.wo?.wo?.toLowerCase().includes(search.toLowerCase())
  );

  const selectedProject=projectGroups.find((g:any)=>g.woId===selectedWoId);

  const warnaUrgMap:Record<string,{bg:string,color:string}>={telat:{bg:"#fef2f2",color:"#dc2626"},mendesak:{bg:"#fff7ed",color:"#ea580c"},perhatian:{bg:"#fefce8",color:"#ca8a04"}};

  if(!selectedWoId){
    return(
      <div style={{padding:"12px 14px"}}>
        <input value={search} onChange={(e:any)=>setSearch(e.target.value)} placeholder="🔍 Cari proyek atau WO..."
          style={{width:"100%",height:36,padding:"0 12px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:13,marginBottom:12,outline:"none"}}/>
        {loading?(
          <div style={{textAlign:"center",padding:40,color:"#94a3b8"}}>
            <i className="ti ti-loader-2" style={{fontSize:26,display:"block",marginBottom:8}}/>
            Memuat data...
          </div>
        ):filteredProjects.length===0?(
          <div style={{textAlign:"center",padding:40,color:"#94a3b8"}}>
            <i className="ti ti-folder-x" style={{fontSize:32,display:"block",marginBottom:8}}/>
            Tidak ada proyek
          </div>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {filteredProjects.map((g:any)=>{
              const allDone=g.selesai===g.totalPanel;
              const pctWo=g.totalPanel>0?Math.round((g.selesai/g.totalPanel)*100):0;
              const urg=getUrgensiPanel(g.wo?.target);
              const w=warnaUrgMap[urg.level];
              return(
                <div key={g.woId} onClick={()=>setSelectedWoId(g.woId)}
                  style={{position:"relative" as const,background:"#fff",borderRadius:16,padding:"14px 16px 14px 20px",cursor:"pointer",
                    opacity:allDone?0.72:1,border:"1px solid #eef0f3",boxShadow:"0 1px 3px rgba(15,23,42,0.05)",overflow:"hidden"}}>
                  <div style={{position:"absolute" as const,left:0,top:0,bottom:0,width:4,background:allDone?"#16a34a":"#0891b2"}}/>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:10}}>
                    <div style={{minWidth:0,flex:1}}>
                      <div style={{fontWeight:800,fontSize:14.5,color:"#0f172a",whiteSpace:"nowrap" as const,overflow:"hidden",textOverflow:"ellipsis"}}>{g.wo?.proyek}</div>
                      <div style={{fontSize:11,color:"#94a3b8",marginTop:3}}>
                        WO {g.wo?.wo}{g.wo?.target?` · Deadline ${fmtTanggalDeadlineNp(g.wo.target)}`:""}
                      </div>
                    </div>
                    {urg.label&&urg.level!=="normal"&&w?(
                      <span style={{fontSize:9,fontWeight:800,background:w.bg,color:w.color,borderRadius:20,padding:"4px 9px",whiteSpace:"nowrap" as const,flexShrink:0}}>{urg.level==="telat"?"\u26a0 ":"\u23f0 "}{urg.label}</span>
                    ):(
                      <i className="ti ti-chevron-right" style={{fontSize:18,color:"#cbd5e1",flexShrink:0,marginTop:2}}/>
                    )}
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                    <span style={{fontSize:11,fontWeight:700,color:allDone?"#16a34a":"#64748b"}}>
                      {allDone?"\u2713 Semua selesai":`${g.selesai}/${g.totalPanel} panel selesai`}
                    </span>
                    <span style={{fontSize:11,fontWeight:800,color:allDone?"#16a34a":"#0891b2"}}>{pctWo}%</span>
                  </div>
                  <div style={{height:6,borderRadius:99,background:"#f1f5f9",overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${pctWo}%`,borderRadius:99,background:allDone?"#16a34a":"#0891b2",transition:"width .35s ease"}}/>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return(
    <div style={{padding:"14px 14px 28px",background:"#f8fafc",minHeight:"100%"}}>
      <button onClick={()=>setSelectedWoId(null)}
        style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:"#0891b2",fontWeight:700,fontSize:13,cursor:"pointer",marginBottom:12,padding:0}}>
        <i className="ti ti-arrow-left" style={{fontSize:16}}/> Kembali ke Daftar Proyek
      </button>

      <div style={{background:"#fff",borderRadius:16,padding:16,marginBottom:14,border:"1px solid #eef0f3",boxShadow:"0 1px 3px rgba(15,23,42,0.05)",
        display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
        <div style={{minWidth:0}}>
          <div style={{fontWeight:800,fontSize:15.5,color:"#0f172a"}}>{selectedProject?.wo?.proyek}</div>
          <div style={{fontSize:11.5,color:"#94a3b8",marginTop:3}}>
            WO {selectedProject?.wo?.wo}{selectedProject?.wo?.target?` · Deadline ${fmtTanggalDeadlineNp(selectedProject.wo.target)}`:""}
          </div>
        </div>
        <button onClick={()=>kunciProgress(selectedProject?.panels||[])} disabled={lockLoading}
          style={{display:"flex",alignItems:"center",gap:6,background:lockLoading?"#cbd5e1":"#0891b2",color:"#fff",border:"none",borderRadius:10,padding:"9px 14px",
            fontSize:12,fontWeight:700,cursor:lockLoading?"not-allowed":"pointer",whiteSpace:"nowrap" as const,flexShrink:0,
            boxShadow:lockLoading?"none":"0 3px 10px #0891b240"}}>
          <i className={lockLoading?"ti ti-loader-2":"ti ti-lock"} style={{fontSize:14}}/>
          {lockLoading?"Mengunci...":"Kunci"}
        </button>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {(selectedProject?.panels||[]).map((p:any)=>{
          const statusPerTugas=TUGAS_NP.map(t=>hitungStatusTugasNp(p[t.progressField]||0,(p[t.fotoField]||[]).length));
          const done=statusPerTugas.every(s=>s==="selesai");
          return(
            <div key={p.id} style={{background:"#fff",borderRadius:14,border:"1px solid #eef0f3",overflow:"hidden",
              boxShadow:done?"0 1px 2px rgba(15,23,42,0.03)":"0 1px 3px rgba(15,23,42,0.05)",opacity:done?0.85:1}}>
              <div style={{padding:"12px 15px 8px",display:"flex",alignItems:"center",gap:8}}>
                <div style={{fontWeight:700,fontSize:13.5,color:"#0f172a",flex:1,minWidth:0,whiteSpace:"nowrap" as const,overflow:"hidden",textOverflow:"ellipsis"}}>{p.nama}</div>
                {done&&<i className="ti ti-circle-check-filled" style={{fontSize:16,color:"#16a34a",flexShrink:0}}/>}
              </div>

              <div style={{display:"flex",flexDirection:"column",gap:8,padding:"0 10px 10px"}}>
                {TUGAS_NP.map((t,ti)=>{
                  const pct=p[t.progressField]||0;
                  const fotoArr=p[t.fotoField]||[];
                  const status=statusPerTugas[ti];
                  const st=STATUS_TUGAS_NP[status];
                  const key=`${p.id}_${t.field}`;
                  const expanded=expandedTugas.has(key);
                  const staged=stagedFotos[key]||[];
                  const saving=savingKey===key;
                  return(
                    <div key={t.field} style={{border:"1px solid #f1f5f9",borderRadius:12,overflow:"hidden",background:"#fafbfc"}}>
                      <div onClick={()=>toggleTugas(p.id,t.field)}
                        style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",cursor:"pointer"}}>
                        <div style={{width:32,height:32,borderRadius:9,background:st.bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:15}}>
                          {t.icon}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:12.5,fontWeight:700,color:"#1e293b"}}>{t.label}</div>
                          <div style={{fontSize:10,fontWeight:600,color:st.color,marginTop:1}}>{st.label}</div>
                        </div>
                        <i className="ti ti-chevron-down" style={{fontSize:15,color:"#cbd5e1",flexShrink:0,transition:"transform .2s",transform:expanded?"rotate(180deg)":"none"}}/>
                      </div>
                      {expanded&&(
                        <div style={{padding:"2px 12px 14px",borderTop:"1px solid #f1f5f9"}}>
                          <div style={{marginBottom:14,marginTop:12}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                              <span style={{fontSize:10.5,fontWeight:700,color:"#94a3b8",letterSpacing:.3}}>FABRIKASI</span>
                              <span style={{fontSize:11,fontWeight:800,color:pct>=100?"#16a34a":t.color}}>{pct}%</span>
                            </div>
                            <div style={{display:"flex",gap:4}}>
                              {PROGRESS_STEPS_NP.map(s=>(
                                <button key={s} onClick={()=>updateProgress(p.id,t.progressField,pct>=s?s-25:s)}
                                  style={{flex:1,height:30,borderRadius:8,border:"none",cursor:"pointer",fontSize:10,fontWeight:700,
                                    background:pct>=s?t.color:"#f1f5f9",color:pct>=s?"#fff":"#94a3b8"}}>{s}%</button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <div style={{fontSize:10.5,fontWeight:700,color:"#94a3b8",marginBottom:8,letterSpacing:.3}}>PEMASANGAN (FOTO)</div>
                            {fotoArr.length===0&&staged.length===0?(
                              <div style={{fontSize:11.5,color:"#cbd5e1",padding:"6px 0 10px",fontStyle:"italic" as const}}>Belum ada foto</div>
                            ):(
                              <div style={{display:"flex",flexWrap:"wrap" as const,gap:8,marginBottom:10}}>
                                {fotoArr.map((f:any,fi:number)=>(
                                  <div key={`saved_${fi}`} onClick={()=>setFotoViewer({fotos:fotoArr,startIndex:fi,label:`${t.label}_${p.nama}`})} style={{cursor:"pointer"}}>
                                    <img src={f.url} style={{width:60,height:60,borderRadius:10,objectFit:"cover" as const,border:"1px solid #eef0f3",boxShadow:"0 1px 3px rgba(15,23,42,0.06)"}}/>
                                    <div style={{fontSize:8,color:"#94a3b8",marginTop:3,textAlign:"center" as const}}>{f.uploaded_at?new Date(f.uploaded_at).toLocaleDateString("id-ID",{day:"numeric",month:"short"}):""}</div>
                                  </div>
                                ))}
                                {staged.map((s,si)=>(
                                  <div key={`staged_${si}`} style={{position:"relative" as const}}>
                                    <img src={s.previewUrl} style={{width:60,height:60,borderRadius:10,objectFit:"cover" as const,border:`1.5px dashed ${t.color}`}}/>
                                    <button onClick={()=>batalkanFotoStaged(p.id,t.field,si)}
                                      style={{position:"absolute" as const,top:-6,right:-6,width:18,height:18,borderRadius:99,background:"#dc2626",color:"#fff",border:"2px solid #fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 1px 3px rgba(0,0,0,0.2)"}}>
                                      <i className="ti ti-x" style={{fontSize:10}}/>
                                    </button>
                                    <div style={{fontSize:8,color:t.color,marginTop:3,textAlign:"center" as const,fontWeight:700}}>belum disimpan</div>
                                  </div>
                                ))}
                              </div>
                            )}
                            <label style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:11.5,fontWeight:700,color:t.color,background:`${t.color}0f`,border:`1.5px dashed ${t.color}55`,borderRadius:10,padding:"9px 13px",
                                cursor:saving?"not-allowed":"pointer",opacity:saving?0.5:1,pointerEvents:saving?"none" as const:"auto" as const}}>
                              <i className="ti ti-camera-plus" style={{fontSize:14}}/> Tambah Foto
                              <input type="file" accept="image/*" multiple disabled={saving} style={{display:"none"}}
                                onChange={(e:any)=>{pilihFotoStaged(p.id,t.field,e.target.files);e.target.value="";}}/>
                            </label>
                            <button onClick={()=>simpanProgressTugas(p,t)} disabled={saving}
                              style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginTop:12,width:"100%",
                                background:saving?"#cbd5e1":t.color,color:"#fff",border:"none",borderRadius:11,padding:"11px 10px",fontSize:12.5,fontWeight:700,
                                cursor:saving?"not-allowed":"pointer",boxShadow:saving?"none":`0 4px 12px ${t.color}40`}}>
                              <i className={saving?"ti ti-loader-2":"ti ti-device-floppy"} style={{fontSize:15}}/>
                              {saving?(uploadProgress?`Upload foto ${uploadProgress.current}/${uploadProgress.total}...`:"Menyimpan..."):"Simpan Progress"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {fotoViewer&&(
        <FotoZoomViewerPekerja fotos={fotoViewer.fotos} startIndex={fotoViewer.startIndex} label={fotoViewer.label} onClose={()=>setFotoViewer(null)}/>
      )}
    </div>
  );
}

// Sama persis pola NameplateView, digenerikkan buat 1 tugas (Warehouse ATAU QS, bukan sepasang) -
// dipakai via prop `tugas` (TUGAS_WAREHOUSE/TUGAS_QS), termasuk nama bucket foto sendiri-sendiri.
function KomponenProgressView({user,tugas}:{user:any,tugas:{field:string,label:string,icon:string,color:string,progressField:string,fotoField:string,historyField:string,updatedByField:string,updatedAtField:string,bucket:string}}){
  const[panelsList,setPanelsList]=useState<any[]>([]);
  const[loading,setLoading]=useState(true);
  const[search,setSearch]=useState("");
  const[selectedWoId,setSelectedWoId]=useState<number|null>(null);
  const[expandedPanel,setExpandedPanel]=useState<Set<number>>(new Set());
  const togglePanel=(panelId:number)=>{
    setExpandedPanel(prev=>{
      const next=new Set(prev);
      if(next.has(panelId))next.delete(panelId);else next.add(panelId);
      return next;
    });
  };

  const[stagedFotos,setStagedFotos]=useState<Record<number,{file:File,previewUrl:string}[]>>({});
  const[savingKey,setSavingKey]=useState<number|null>(null);
  const[uploadProgress,setUploadProgress]=useState<{current:number,total:number}|null>(null);

  const[fotoViewer,setFotoViewer]=useState<{fotos:FotoViewerPekerja[],startIndex:number,label:string}|null>(null);

  const pilihFotoStaged=(panelId:number,fileList:FileList|null)=>{
    if(!fileList||fileList.length===0)return;
    const dipilih=Array.from(fileList).map(file=>({file,previewUrl:URL.createObjectURL(file)}));
    setStagedFotos(prev=>({...prev,[panelId]:[...(prev[panelId]||[]),...dipilih]}));
  };

  const batalkanFotoStaged=(panelId:number,idx:number)=>{
    setStagedFotos(prev=>{
      const arr=prev[panelId]||[];
      URL.revokeObjectURL(arr[idx]?.previewUrl);
      return{...prev,[panelId]:arr.filter((_,i)=>i!==idx)};
    });
  };

  const simpanProgressPanel=async(p:any)=>{
    const staged=stagedFotos[p.id]||[];
    const pct=p[tugas.progressField]||0;
    const existingFoto=p[tugas.fotoField]||[];
    const hist=p[tugas.historyField]||[];
    const existIdx=hist.findIndex((h:any)=>h.tanggal===TODAY);
    const pctBerubah=existIdx<0||hist[existIdx].pct!==pct;
    if(!pctBerubah&&staged.length===0){alert("Tidak ada perubahan untuk disimpan");return;}
    setSavingKey(p.id);
    try{
      const fotoTerupload:any[]=[];
      for(let i=0;i<staged.length;i++){
        setUploadProgress({current:i+1,total:staged.length});
        const s=staged[i];
        const blob=await compressImageNp(s.file);
        const path=`${p.id}/${tugas.field}/${Date.now()}_${Math.random().toString(36).slice(2,8)}.jpg`;
        const{error:upErr}=await supabase.storage.from(tugas.bucket).upload(path,blob,{contentType:"image/jpeg"});
        if(upErr){alert(`Gagal upload salah satu foto: ${upErr.message}`);continue;}
        const{data:urlData}=supabase.storage.from(tugas.bucket).getPublicUrl(path);
        fotoTerupload.push({url:urlData.publicUrl,uploaded_by:user.nama,uploaded_at:new Date().toISOString()});
      }
      setUploadProgress(null);
      const newFoto=[...existingFoto,...fotoTerupload];
      const newHist=[...hist];
      if(existIdx>=0)newHist[existIdx]={...newHist[existIdx],pct,ts:new Date().toISOString()};
      else newHist.push({tanggal:TODAY,pct,oleh:user.nama,ts:new Date().toISOString()});
      const patch={
        [tugas.progressField]:pct,
        [tugas.updatedByField]:user.nama,
        [tugas.updatedAtField]:new Date().toISOString(),
        [tugas.historyField]:newHist,
        [tugas.fotoField]:newFoto,
      };
      await supabase.from("panels").update(patch).eq("id",p.id);
      dirtyProgressRef.current.delete(p.id);
      setPanelsList(prev=>prev.map((pp:any)=>pp.id===p.id?{...pp,...patch}:pp));
      staged.forEach(s=>URL.revokeObjectURL(s.previewUrl));
      setStagedFotos(prev=>{const next={...prev};delete next[p.id];return next;});
    }catch(err:any){
      alert("Terjadi kesalahan: "+err.message);
    }
    setUploadProgress(null);
    setSavingKey(null);
  };

  // Panel yang persentase-nya barusan diklik tapi belum "Simpan Progress" - dilindungi dari
  // ketiban fetchData() (realtime nyala buat SEMUA update tabel panels, bukan cuma punya sendiri,
  // jadi tanpa ini klik yang belum disimpan bisa ke-timpa balik pas ada panel lain yang berubah).
  const dirtyProgressRef=useRef<Set<number>>(new Set());

  const fetchData=async()=>{
    setLoading(true);
    const{data:panels}=await supabase.from("panels").select("*");
    const woIds=[...new Set((panels??[]).map((p:any)=>p.wo_id).filter(Boolean))];
    const{data:wos}=woIds.length>0?await supabase.from("work_orders").select("id,wo,proyek,target,is_archived").in("id",woIds):{data:[]};
    const woMap:Record<number,any>={};
    (wos??[]).forEach((w:any)=>{woMap[w.id]=w;});
    setPanelsList(prev=>{
      const prevMap:Record<number,any>={};
      prev.forEach((p:any)=>{prevMap[p.id]=p;});
      return(panels??[])
        .filter((p:any)=>!woMap[p.wo_id]?.is_archived)
        .map((p:any)=>{
          const merged={...p,_wo:woMap[p.wo_id]||{}};
          if(dirtyProgressRef.current.has(p.id)&&prevMap[p.id]){
            merged[tugas.progressField]=prevMap[p.id][tugas.progressField];
          }
          return merged;
        });
    });
    setLoading(false);
  };

  useEffect(()=>{
    fetchData();
    const ch=supabase.channel(`realtime-panels-${tugas.field}`)
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"panels"},()=>{fetchData();})
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"panels"},()=>{fetchData();})
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[tugas.field]);

  const[lockLoading,setLockLoading]=useState(false);

  const updateProgress=(panelId:number,val:number)=>{
    dirtyProgressRef.current.add(panelId);
    setPanelsList(prev=>prev.map((p:any)=>p.id===panelId?{...p,[tugas.progressField]:val}:p));
  };

  const kunciProgress=async(panelList:any[])=>{
    setLockLoading(true);
    let count=0;
    for(const p of panelList){
      const hist=p[tugas.historyField]||[];
      const existIdx=hist.findIndex((h:any)=>h.tanggal===TODAY);
      const changed=existIdx<0||hist[existIdx].pct!==(p[tugas.progressField]||0);
      if(!changed)continue;
      const newHist=[...hist];
      if(existIdx>=0)newHist[existIdx]={...newHist[existIdx],pct:p[tugas.progressField]||0,ts:new Date().toISOString()};
      else newHist.push({tanggal:TODAY,pct:p[tugas.progressField]||0,oleh:user.nama,ts:new Date().toISOString()});
      await supabase.from("panels").update({
        [tugas.progressField]:p[tugas.progressField]||0,
        [tugas.updatedByField]:user.nama,
        [tugas.updatedAtField]:new Date().toISOString(),
        [tugas.historyField]:newHist,
      }).eq("id",p.id);
      dirtyProgressRef.current.delete(p.id);
      count++;
    }
    setLockLoading(false);
    alert(count>0?`${count} panel berhasil dikunci`:"Tidak ada perubahan untuk dikunci");
    fetchData();
  };

  const urutanLevelNp:Record<string,number>={telat:0,mendesak:1,perhatian:2,normal:3};
  // Beda dari Nameplate/Yellowmark: Warehouse/QS dianggap "Selesai" cukup dari persentase 100%,
  // gak wajib ada foto (foto tetap boleh dilampirkan, tapi bukan syarat status selesai).
  const hitungStatusKomponen=(pct:number)=>{
    if(pct>=100)return"selesai";
    if(pct>0)return"proses";
    return"belum";
  };

  const projectGroups=useMemo(()=>{
    const groups:Record<string,{wo:any,panels:any[]}>={};
    panelsList.forEach((p:any)=>{
      const woId=String(p.wo_id);
      if(!groups[woId])groups[woId]={wo:p._wo,panels:[]};
      groups[woId].panels.push(p);
    });
    return Object.entries(groups).map(([woId,g])=>{
      const totalPanel=g.panels.length;
      const selesai=g.panels.filter((p:any)=>hitungStatusKomponen(p[tugas.progressField]||0)==="selesai").length;
      return{woId:Number(woId),wo:g.wo,panels:g.panels,totalPanel,selesai};
    }).sort((a,b)=>{
      const aDone=a.selesai===a.totalPanel;
      const bDone=b.selesai===b.totalPanel;
      if(aDone!==bDone)return aDone?1:-1;
      const uA=getUrgensiPanel(a.wo?.target);const uB=getUrgensiPanel(b.wo?.target);
      const lvA=urutanLevelNp[uA.level]??3;const lvB=urutanLevelNp[uB.level]??3;
      if(lvA!==lvB)return lvA-lvB;
      if(uA.hari!==null&&uB.hari!==null)return uA.hari-uB.hari;
      return 0;
    });
  },[panelsList,tugas]);

  const filteredProjects=projectGroups.filter((g:any)=>
    !search||g.wo?.proyek?.toLowerCase().includes(search.toLowerCase())||g.wo?.wo?.toLowerCase().includes(search.toLowerCase())
  );

  const selectedProject=projectGroups.find((g:any)=>g.woId===selectedWoId);

  const warnaUrgMap:Record<string,{bg:string,color:string}>={telat:{bg:"#fef2f2",color:"#dc2626"},mendesak:{bg:"#fff7ed",color:"#ea580c"},perhatian:{bg:"#fefce8",color:"#ca8a04"}};

  const STATUS_ICON_KP:Record<string,string>={belum:"ti-circle-dashed",proses:"ti-loader-2",selesai:"ti-circle-check-filled"};
  const STATUS_3_ICON:Record<string,string>={todo:"ti-circle-dashed",progress:"ti-loader-2",done:"ti-circle-check-filled"};

  if(!selectedWoId){
    const totalPanelSemua=projectGroups.reduce((s,g)=>s+g.totalPanel,0);
    const selesaiSemua=projectGroups.reduce((s,g)=>s+g.selesai,0);
    return(
      <div style={{padding:"14px 14px 28px",background:"#f8fafc",minHeight:"100%"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,padding:"14px 16px",borderRadius:16,
          background:`linear-gradient(135deg,${tugas.color},${tugas.color}cc)`,boxShadow:`0 6px 18px ${tugas.color}33`}}>
          <div style={{width:42,height:42,borderRadius:12,background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>
            {tugas.icon}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{color:"#fff",fontWeight:800,fontSize:15}}>{tugas.label}</div>
            <div style={{color:"rgba(255,255,255,0.85)",fontSize:11.5,marginTop:1}}>{selesaiSemua}/{totalPanelSemua} panel selesai · {projectGroups.length} proyek</div>
          </div>
        </div>

        <div style={{position:"relative" as const,marginBottom:14}}>
          <i className="ti ti-search" style={{position:"absolute" as const,left:13,top:"50%",transform:"translateY(-50%)",fontSize:16,color:"#94a3b8"}}/>
          <input value={search} onChange={(e:any)=>setSearch(e.target.value)} placeholder="Cari proyek atau WO..."
            style={{width:"100%",height:42,padding:"0 14px 0 38px",border:"1.5px solid #e2e8f0",borderRadius:12,fontSize:13.5,outline:"none",background:"#fff",boxSizing:"border-box" as const,color:"#1e293b"}}/>
        </div>

        {loading?(
          <div style={{textAlign:"center",padding:40,color:"#94a3b8"}}>
            <i className="ti ti-loader-2" style={{fontSize:26,display:"block",marginBottom:8}}/>
            Memuat data...
          </div>
        ):filteredProjects.length===0?(
          <div style={{textAlign:"center",padding:40,color:"#94a3b8"}}>
            <i className="ti ti-folder-x" style={{fontSize:32,display:"block",marginBottom:8}}/>
            Tidak ada proyek
          </div>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {filteredProjects.map((g:any)=>{
              const allDone=g.selesai===g.totalPanel;
              const pctWo=g.totalPanel>0?Math.round((g.selesai/g.totalPanel)*100):0;
              const urg=getUrgensiPanel(g.wo?.target);
              const w=warnaUrgMap[urg.level];
              return(
                <div key={g.woId} onClick={()=>setSelectedWoId(g.woId)}
                  style={{position:"relative" as const,background:"#fff",borderRadius:16,padding:"14px 16px 14px 20px",cursor:"pointer",
                    opacity:allDone?0.72:1,border:"1px solid #eef0f3",boxShadow:"0 1px 3px rgba(15,23,42,0.05)",overflow:"hidden"}}>
                  <div style={{position:"absolute" as const,left:0,top:0,bottom:0,width:4,background:allDone?"#16a34a":tugas.color}}/>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:10}}>
                    <div style={{minWidth:0,flex:1}}>
                      <div style={{fontWeight:800,fontSize:14.5,color:"#0f172a",whiteSpace:"nowrap" as const,overflow:"hidden",textOverflow:"ellipsis"}}>{g.wo?.proyek}</div>
                      <div style={{fontSize:11,color:"#94a3b8",marginTop:3}}>
                        WO {g.wo?.wo}{g.wo?.target?` · Deadline ${fmtTanggalDeadlineNp(g.wo.target)}`:""}
                      </div>
                    </div>
                    {urg.label&&urg.level!=="normal"&&w?(
                      <span style={{fontSize:9,fontWeight:800,background:w.bg,color:w.color,borderRadius:20,padding:"4px 9px",whiteSpace:"nowrap" as const,flexShrink:0}}>
                        {urg.level==="telat"?"⚠ ":"⏰ "}{urg.label}
                      </span>
                    ):(
                      <i className="ti ti-chevron-right" style={{fontSize:18,color:"#cbd5e1",flexShrink:0,marginTop:2}}/>
                    )}
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                    <span style={{fontSize:11,fontWeight:700,color:allDone?"#16a34a":"#64748b"}}>
                      {allDone?"✓ Semua selesai":`${g.selesai}/${g.totalPanel} panel selesai`}
                    </span>
                    <span style={{fontSize:11,fontWeight:800,color:allDone?"#16a34a":tugas.color}}>{pctWo}%</span>
                  </div>
                  <div style={{height:6,borderRadius:99,background:"#f1f5f9",overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${pctWo}%`,borderRadius:99,background:allDone?"#16a34a":tugas.color,transition:"width .35s ease"}}/>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return(
    <div style={{padding:"14px 14px 28px",background:"#f8fafc",minHeight:"100%"}}>
      <button onClick={()=>setSelectedWoId(null)}
        style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:tugas.color,fontWeight:700,fontSize:13,cursor:"pointer",marginBottom:12,padding:0}}>
        <i className="ti ti-arrow-left" style={{fontSize:16}}/> Kembali ke Daftar Proyek
      </button>

      <div style={{background:"#fff",borderRadius:16,padding:16,marginBottom:14,border:"1px solid #eef0f3",boxShadow:"0 1px 3px rgba(15,23,42,0.05)",
        display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
        <div style={{minWidth:0}}>
          <div style={{fontWeight:800,fontSize:15.5,color:"#0f172a"}}>{selectedProject?.wo?.proyek}</div>
          <div style={{fontSize:11.5,color:"#94a3b8",marginTop:3}}>
            WO {selectedProject?.wo?.wo}{selectedProject?.wo?.target?` · Deadline ${fmtTanggalDeadlineNp(selectedProject.wo.target)}`:""}
          </div>
        </div>
        <button onClick={()=>kunciProgress(selectedProject?.panels||[])} disabled={lockLoading}
          style={{display:"flex",alignItems:"center",gap:6,background:lockLoading?"#cbd5e1":tugas.color,color:"#fff",border:"none",borderRadius:10,padding:"9px 14px",
            fontSize:12,fontWeight:700,cursor:lockLoading?"not-allowed":"pointer",whiteSpace:"nowrap" as const,flexShrink:0,
            boxShadow:lockLoading?"none":`0 3px 10px ${tugas.color}40`}}>
          <i className={lockLoading?"ti ti-loader-2":"ti ti-lock"} style={{fontSize:14}}/>
          {lockLoading?"Mengunci...":"Kunci"}
        </button>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {(selectedProject?.panels||[]).map((p:any)=>{
          const pct=p[tugas.progressField]||0;
          const fotoArr=p[tugas.fotoField]||[];
          const status=hitungStatusKomponen(pct);
          const st=STATUS_TUGAS_NP[status];
          const expanded=expandedPanel.has(p.id);
          const staged=stagedFotos[p.id]||[];
          const saving=savingKey===p.id;
          return(
            <div key={p.id} style={{background:"#fff",borderRadius:14,border:"1px solid #eef0f3",overflow:"hidden",
              boxShadow:expanded?"0 6px 18px rgba(15,23,42,0.07)":"0 1px 2px rgba(15,23,42,0.03)",transition:"box-shadow .15s"}}>
              <div onClick={()=>togglePanel(p.id)}
                style={{display:"flex",alignItems:"center",gap:11,padding:"13px 15px",cursor:"pointer"}}>
                <div style={{width:38,height:38,borderRadius:11,background:st.bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <i className={`ti ${STATUS_ICON_KP[status]}`} style={{fontSize:18,color:st.color}}/>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:13.5,color:"#0f172a",whiteSpace:"nowrap" as const,overflow:"hidden",textOverflow:"ellipsis"}}>{p.nama}</div>
                  <div style={{fontSize:10.5,fontWeight:600,color:st.color,marginTop:1}}>{st.label}</div>
                </div>
                <i className={`ti ti-chevron-down`} style={{fontSize:16,color:"#cbd5e1",flexShrink:0,transition:"transform .2s",transform:expanded?"rotate(180deg)":"none"}}/>
              </div>
              {expanded&&(
                <div style={{padding:"2px 15px 16px",borderTop:"1px solid #f1f5f9"}}>
                  <div style={{marginBottom:16,marginTop:14}}>
                    <div style={{display:"flex",alignItems:"center",gap:5,fontSize:10.5,fontWeight:700,color:"#94a3b8",marginBottom:8,letterSpacing:0.3}}>
                      <i className="ti ti-tool" style={{fontSize:12}}/> FABRIKASI
                    </div>
                    <div style={{display:"flex",gap:6}}>
                      {STATUS_3_NP.map(s=>{
                        const active=s.key==="todo"?pct===0:s.key==="done"?pct>=100:(pct>0&&pct<100);
                        return(
                          <button key={s.key} onClick={()=>updateProgress(p.id,s.pct)}
                            style={{flex:1,display:"flex",flexDirection:"column" as const,alignItems:"center",gap:4,padding:"10px 4px",borderRadius:11,
                              border:active?"none":"1.5px solid #eef0f3",cursor:"pointer",
                              background:active?tugas.color:"#fff",boxShadow:active?`0 4px 12px ${tugas.color}40`:"none",transition:"all .15s"}}>
                            <i className={`ti ${STATUS_3_ICON[s.key]}`} style={{fontSize:16,color:active?"#fff":"#94a3b8"}}/>
                            <span style={{fontSize:10,fontWeight:700,color:active?"#fff":"#64748b"}}>{s.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:5,fontSize:10.5,fontWeight:700,color:"#94a3b8",marginBottom:8,letterSpacing:0.3}}>
                      <i className="ti ti-camera" style={{fontSize:12}}/> PEMASANGAN (FOTO)
                    </div>
                    {fotoArr.length===0&&staged.length===0?(
                      <div style={{fontSize:11.5,color:"#cbd5e1",padding:"10px 0 12px",fontStyle:"italic" as const}}>Belum ada foto</div>
                    ):(
                      <div style={{display:"flex",flexWrap:"wrap" as const,gap:8,marginBottom:12}}>
                        {fotoArr.map((f:any,fi:number)=>(
                          <div key={`saved_${fi}`} onClick={()=>setFotoViewer({fotos:fotoArr,startIndex:fi,label:`${tugas.label}_${p.nama}`})} style={{cursor:"pointer"}}>
                            <img src={f.url} style={{width:62,height:62,borderRadius:10,objectFit:"cover" as const,border:"1px solid #eef0f3",boxShadow:"0 1px 3px rgba(15,23,42,0.06)"}}/>
                            <div style={{fontSize:8,color:"#94a3b8",marginTop:3,textAlign:"center" as const}}>{f.uploaded_at?new Date(f.uploaded_at).toLocaleDateString("id-ID",{day:"numeric",month:"short"}):""}</div>
                          </div>
                        ))}
                        {staged.map((s,si)=>(
                          <div key={`staged_${si}`} style={{position:"relative" as const}}>
                            <img src={s.previewUrl} style={{width:62,height:62,borderRadius:10,objectFit:"cover" as const,border:`1.5px dashed ${tugas.color}`}}/>
                            <button onClick={()=>batalkanFotoStaged(p.id,si)}
                              style={{position:"absolute" as const,top:-6,right:-6,width:19,height:19,borderRadius:99,background:"#dc2626",color:"#fff",border:"2px solid #fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 1px 3px rgba(0,0,0,0.2)"}}>
                              <i className="ti ti-x" style={{fontSize:10}}/>
                            </button>
                            <div style={{fontSize:8,color:tugas.color,marginTop:3,textAlign:"center" as const,fontWeight:700}}>belum disimpan</div>
                          </div>
                        ))}
                      </div>
                    )}
                    <label style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:11.5,fontWeight:700,color:tugas.color,background:`${tugas.color}0f`,border:`1.5px dashed ${tugas.color}55`,borderRadius:10,padding:"9px 13px",
                        cursor:saving?"not-allowed":"pointer",opacity:saving?0.5:1,pointerEvents:saving?"none" as const:"auto" as const}}>
                      <i className="ti ti-camera-plus" style={{fontSize:14}}/> Tambah Foto
                      <input type="file" accept="image/*" multiple disabled={saving} style={{display:"none"}}
                        onChange={(e:any)=>{pilihFotoStaged(p.id,e.target.files);e.target.value="";}}/>
                    </label>
                    <button onClick={()=>simpanProgressPanel(p)} disabled={saving}
                      style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginTop:12,width:"100%",
                        background:saving?"#cbd5e1":tugas.color,color:"#fff",border:"none",borderRadius:11,padding:"11px 10px",fontSize:12.5,fontWeight:700,
                        cursor:saving?"not-allowed":"pointer",boxShadow:saving?"none":`0 4px 12px ${tugas.color}40`}}>
                      <i className={saving?"ti ti-loader-2":"ti ti-device-floppy"} style={{fontSize:15}}/>
                      {saving?(uploadProgress?`Upload foto ${uploadProgress.current}/${uploadProgress.total}...`:"Menyimpan..."):"Simpan Progress"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {fotoViewer&&(
        <FotoZoomViewerPekerja fotos={fotoViewer.fotos} startIndex={fotoViewer.startIndex} label={fotoViewer.label} onClose={()=>setFotoViewer(null)}/>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// REVIEW POTONG - histori read-only "hari ini/kemarin motong apa aja", navigasi
// per tanggal tunggal, dikelompokkan PROYEK -> PANEL -> semua komponen yang
// dipotong di tanggal itu (shift jadi badge per-baris, bukan level grouping -
// biar 1 panel yang kerja lintas shift tetap muncul SATU kali aja, gak duplikat).
// Sumber data: panels.checklist[kode].history.POTONG (bukan raw_schedule/jejak -
// itu murni penjadwalan, gak punya shift/qty per checkpoint). Tiap entry history
// sudah {ts,pct,shift,tanggal} - tanggal/shift di situ udah otomatis benar sesuai
// logic hariKerjaAwal (shift 2 lewat tengah malam) karena ditulis pakai logic
// yang sama pas operator submit progress - jadi di sini tinggal pakai apa
// adanya, gak perlu hitung ulang. Qty per checkpoint dihitung dari SELISIH
// persentase antar-checkpoint berurutan (checkpoint sebelumnya start dari 0%).
function ReviewPotongView(){
  const[loading,setLoading]=useState(true);
  const[entries,setEntries]=useState<any[]>([]);
  const[viewDate,setViewDate]=useState(TODAY);
  const[expandedProyek,setExpandedProyek]=useState<Record<string,boolean>>({});
  const[expandedPanel,setExpandedPanel]=useState<Record<string,boolean>>({});

  // kode->nama komponen: bom_master (live, dikelola dari Master Data BOM Vista Teknik) jadi
  // sumber UTAMA - PANEL_TYPES statis cuma fallback kalau kebetulan ada kode yang belum
  // sempat ke-sync ke bom_master. Tanpa ini, komponen yang ditambah/diubah namanya setelah
  // config statis terakhir di-update bakal nongol sebagai kode mentah (FS.27) doang.
  const[kodeNamaMap,setKodeNamaMap]=useState<Record<string,string>>({});
  useEffect(()=>{
    const map:Record<string,string>={};
    Object.values(PANEL_TYPES).forEach((cfg:any)=>{
      cfg.wps.forEach((w:any)=>w.items.forEach((it:any)=>{map[it.kode]=it.nama;}));
    });
    supabase.from("bom_master").select("kode_komponen,nama_komponen").then(({data}:any)=>{
      (data||[]).forEach((b:any)=>{map[b.kode_komponen]=b.nama_komponen;});
      setKodeNamaMap({...map});
    });
  },[]);

  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      setLoading(true);
      let allPanels:any[]=[];
      let from=0;
      while(true){
        const{data}=await supabase.from("panels").select("id,nama,tipe,wo_id,checklist").range(from,from+999);
        allPanels=allPanels.concat(data||[]);
        if(!data||data.length<1000)break;
        from+=1000;
      }
      const woIds=[...new Set(allPanels.map((p:any)=>p.wo_id).filter(Boolean))];
      const{data:wos}=woIds.length>0?await supabase.from("work_orders").select("id,wo,proyek").in("id",woIds):{data:[]};
      const woMap:Record<number,any>={};
      (wos||[]).forEach((w:any)=>{woMap[w.id]=w;});

      const rows:any[]=[];
      allPanels.forEach((p:any)=>{
        Object.entries(p.checklist||{}).forEach(([kode,cl]:any)=>{
          const histSemua=cl?.history?.POTONG||[];
          const histSampaiHariIni=histSemua.filter((h:any)=>h.tanggal<=viewDate);
          const histHariIni=histSemua.filter((h:any)=>h.tanggal===viewDate);
          if(histHariIni.length===0)return;
          // Urutkan SEMUA checkpoint (bukan cuma hari ini) biar qty delta dihitung dari
          // checkpoint sebelumnya yang bener (bisa aja checkpoint sebelumnya itu H-1/H-2).
          const sortedSemua=[...histSampaiHariIni].sort((a:any,b:any)=>String(a.ts).localeCompare(String(b.ts)));
          const qtyTotal=Number(cl.qty)||0;
          sortedSemua.forEach((h:any,idx:number)=>{
            if(h.tanggal!==viewDate)return;
            const pctSebelum=idx>0?Number(sortedSemua[idx-1].pct)||0:0;
            const qtySkrg=Math.round((Number(h.pct)||0)/100*qtyTotal);
            const qtySblm=Math.round(pctSebelum/100*qtyTotal);
            const delta=qtySkrg-qtySblm;
            if(delta<=0)return;
            rows.push({
              tanggal:h.tanggal,shift:h.shift||"1",panelId:p.id,panelNama:p.nama,
              proyek:woMap[p.wo_id]?.proyek||"(Tanpa Proyek)",wo:woMap[p.wo_id]?.wo||"",
              kode,namaKomponen:kodeNamaMap[kode]||kode,qtyDelta:delta,ts:h.ts,
            });
          });
        });
      });

      const panelIdsRelevan=[...new Set(rows.map((r:any)=>r.panelId))];
      const{data:timers}=panelIdsRelevan.length>0
        ?await supabase.from("fcs_timer_kerja").select("panel_id,kode_komponen,tanggal,pekerja:pekerja_id(nama)").eq("proses","POTONG").in("panel_id",panelIdsRelevan).eq("tanggal",viewDate)
        :{data:[]};
      const operatorMap:Record<string,Set<string>>={};
      (timers||[]).forEach((t:any)=>{
        const key=`${t.panel_id}|${t.kode_komponen}|${t.tanggal}`;
        if(!operatorMap[key])operatorMap[key]=new Set();
        if(t.pekerja?.nama)operatorMap[key].add(t.pekerja.nama);
      });
      rows.forEach((r:any)=>{
        const key=`${r.panelId}|${r.kode}|${r.tanggal}`;
        r.operators=[...(operatorMap[key]||new Set())];
      });

      if(!cancelled){setEntries(rows);setLoading(false);}
    })();
    return()=>{cancelled=true;};
  },[viewDate,kodeNamaMap]);

  const naturalKodeSort=(a:string,b:string)=>{
    const parse=(k:string)=>{const m=k.match(/^(.*?)(\d+)$/);return m?{prefix:m[1],num:parseInt(m[2],10)}:{prefix:k,num:0};};
    const pa=parse(a),pb=parse(b);
    if(pa.prefix!==pb.prefix)return pa.prefix.localeCompare(pb.prefix);
    return pa.num-pb.num;
  };

  // PROYEK -> PANEL -> list komponen (flat, gak dipecah shift lagi - shift jadi
  // badge per-baris di bawah, biar 1 panel gak muncul dobel walau kerja lintas shift).
  const groupedProyek=useMemo(()=>{
    const byProyek:Record<string,{wo:string,panels:Record<string,{panelId:number,panelNama:string,items:any[]}>}>={};
    entries.forEach((r:any)=>{
      if(!byProyek[r.proyek])byProyek[r.proyek]={wo:r.wo,panels:{}};
      const panelKey=String(r.panelId);
      if(!byProyek[r.proyek].panels[panelKey])byProyek[r.proyek].panels[panelKey]={panelId:r.panelId,panelNama:r.panelNama,items:[]};
      byProyek[r.proyek].panels[panelKey].items.push(r);
    });
    return Object.entries(byProyek).sort((a,b)=>a[0].localeCompare(b[0])).map(([proyek,data])=>({
      proyek,wo:data.wo,
      panels:Object.values(data.panels).sort((a,b)=>a.panelNama.localeCompare(b.panelNama)).map(p=>({
        ...p,items:p.items.sort((a:any,b:any)=>naturalKodeSort(a.kode,b.kode)),
      })),
    }));
  },[entries]);

  const toggleProyek=(proyek:string)=>setExpandedProyek(prev=>({...prev,[proyek]:!(prev[proyek]??true)}));
  const togglePanel=(key:string)=>setExpandedPanel(prev=>({...prev,[key]:!(prev[key]??true)}));

  return(
    <div style={{padding:16,maxWidth:560,margin:"0 auto"}} className="fi">
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
        <div style={{width:40,height:40,borderRadius:10,background:"linear-gradient(135deg,#f59e0b,#d97706)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,boxShadow:"0 3px 10px #d9770644"}}>📋</div>
        <div>
          <div style={{fontWeight:800,fontSize:15,color:"#1e293b"}}>Review Potong</div>
          <div style={{fontSize:11,color:"#64748b"}}>Riwayat komponen yang sudah dipotong</div>
        </div>
      </div>

      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,background:"#fff",borderRadius:12,padding:"10px 14px",border:"1.5px solid #e2e8f0"}}>
        <button onClick={()=>setViewDate(addDays(viewDate,-1))} style={{width:34,height:34,borderRadius:8,border:"1px solid #e2e8f0",background:"#f8fafc",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",color:"#475569"}}>‹</button>
        <div style={{flex:1,textAlign:"center" as const}}>
          <div style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>📅 {fmtDate(viewDate)}</div>
          {viewDate===TODAY&&<div style={{fontSize:10,color:"#d97706",fontWeight:700,marginTop:2}}>Hari Ini</div>}
        </div>
        <button onClick={()=>setViewDate(addDays(viewDate,1))} disabled={viewDate>=TODAY} style={{width:34,height:34,borderRadius:8,border:"1px solid #e2e8f0",background:viewDate>=TODAY?"#f1f5f9":"#f8fafc",cursor:viewDate>=TODAY?"not-allowed":"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",color:viewDate>=TODAY?"#cbd5e1":"#475569"}}>›</button>
      </div>

      {loading?(
        <div style={{textAlign:"center",padding:40,color:"#94a3b8"}}>
          <div style={{fontSize:24,marginBottom:8}}>⏳</div>
          Memuat riwayat...
        </div>
      ):groupedProyek.length===0?(
        <div style={{textAlign:"center",padding:40,color:"#94a3b8"}}>
          <div style={{fontSize:32,marginBottom:8}}>📭</div>
          <div style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>Belum ada riwayat</div>
          <div style={{fontSize:12,marginTop:4}}>Belum ada komponen yang dipotong di tanggal ini</div>
        </div>
      ):(
        groupedProyek.map(({proyek,wo,panels})=>{
          const isProyekOpen=expandedProyek[proyek]??true;
          return(
            <div key={proyek} style={{marginBottom:10,background:"#fff",borderRadius:10,border:"1px solid #e2e8f0",overflow:"hidden"}}>
              <div onClick={()=>toggleProyek(proyek)} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",cursor:"pointer",background:"#f8fafc"}}>
                <span style={{fontSize:11,color:"#94a3b8"}}>{isProyekOpen?"▾":"▸"}</span>
                <span style={{fontWeight:800,fontSize:13,color:"#1e293b",flex:1}}>{proyek}{wo?" - WO "+wo:""}</span>
                <span style={{background:"#fffbeb",color:"#d97706",borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:700}}>{panels.length} panel</span>
              </div>
              {isProyekOpen&&(
                <div style={{padding:"6px 10px 10px"}}>
                  {panels.map(p=>{
                    const panelKey=proyek+"|"+p.panelId;
                    const isPanelOpen=expandedPanel[panelKey]??true;
                    return(
                      <div key={p.panelId} style={{marginTop:6}}>
                        <div onClick={()=>togglePanel(panelKey)} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 6px",cursor:"pointer"}}>
                          <span style={{fontSize:10,color:"#94a3b8"}}>{isPanelOpen?"▾":"▸"}</span>
                          <span style={{fontWeight:700,fontSize:12,color:"#334155",flex:1}}>{p.panelNama}</span>
                          <span style={{fontSize:10,color:"#94a3b8"}}>{p.items.length} komponen</span>
                        </div>
                        {isPanelOpen&&(
                          <div style={{display:"flex",flexDirection:"column" as const,gap:5,paddingLeft:18,marginTop:2}}>
                            {p.items.map((r:any,i:number)=>(
                              <div key={i} style={{display:"flex",alignItems:"center",gap:8,background:"#f8fafc",borderRadius:8,padding:"7px 10px"}}>
                                <div style={{flex:1,minWidth:0}}>
                                  <div style={{fontSize:11.5,color:"#334155"}}>{r.namaKomponen}</div>
                                  <div style={{display:"flex",gap:5,flexWrap:"wrap" as const,marginTop:3,alignItems:"center"}}>
                                    <span style={{background:r.shift==="2"?"#ede9fe":"#eff6ff",color:r.shift==="2"?"#6d28d9":"#1d4ed8",borderRadius:20,padding:"1px 7px",fontSize:9,fontWeight:700}}>Shift {r.shift}</span>
                                    {r.operators.map((op:string)=>(
                                      <span key={op} style={{fontSize:10,color:"#64748b",fontWeight:600}}>👤 {op}</span>
                                    ))}
                                  </div>
                                </div>
                                <div style={{fontWeight:800,fontSize:13,color:"#d97706",flexShrink:0}}>{r.qtyDelta} <span style={{fontSize:9,fontWeight:700,color:"#92400e"}}>pcs</span></div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// Komponen ad-hoc (di luar BOM/jadwal normal) - dipakai operator Potong buat
// kasus darurat/tambahan yang gak kebagian slot di raw_schedule. Disimpan di
// tabel TERPISAH (komponen_tambahan), sengaja gak nyentuh raw_schedule sama
// sekali biar auto-geser/cascading/jejak logic gak pernah "liat" data ini.
// Gak ada cek kapasitas (memang buat kondisi darurat/di luar rencana).
function KomponenTambahanView({user}:any){
  const namaOperator=user?.nama||user?.name||"Operator";
  const wsKey=`vista_pekerja_ws_${user.divisi}_${user.sub_bagian||""}_${user.id||user.username||user.nama||""}`;
  const sesiKerja=(()=>{
    try{
      const saved=JSON.parse(localStorage.getItem(wsKey)||"{}");
      if(saved.tanggal&&saved.shift)return{tanggal:saved.tanggal as string,shift:saved.shift as string};
    }catch{}
    return{tanggal:TODAY,shift:"1"};
  })();

  const[woList,setWoList]=useState<any[]>([]);
  const[selectedWoId,setSelectedWoId]=useState<number|null>(null);
  const[panelList,setPanelList]=useState<any[]>([]);
  const[selectedPanelId,setSelectedPanelId]=useState<number|null>(null);
  const[namaKomponen,setNamaKomponen]=useState("");
  const[qty,setQty]=useState("");
  const[submitting,setSubmitting]=useState(false);
  const[items,setItems]=useState<any[]>([]);
  const[loading,setLoading]=useState(true);
  const[,setTick]=useState(0);

  const fetchWoList=async()=>{
    const{data}=await supabase.from("work_orders").select("id,wo,proyek").eq("is_archived",false).order("created_at",{ascending:false});
    setWoList(data??[]);
  };
  const fetchPanelList=async(woId:number)=>{
    const{data}=await supabase.from("panels").select("id,no_pnl,nama").eq("wo_id",woId).is("deleted_at",null).order("no_pnl",{ascending:true});
    setPanelList(data??[]);
  };
  const fetchItems=async()=>{
    setLoading(true);
    const{data}=await supabase.from("komponen_tambahan").select("*").eq("tanggal",sesiKerja.tanggal).order("created_at",{ascending:false});
    setItems(data??[]);
    setLoading(false);
  };

  useEffect(()=>{
    fetchWoList();
    fetchItems();
    const ch=supabase.channel("realtime-komponen-tambahan-pekerja")
      .on("postgres_changes",{event:"*",schema:"public",table:"komponen_tambahan"},fetchItems)
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);
  useEffect(()=>{
    setSelectedPanelId(null);
    if(selectedWoId){fetchPanelList(selectedWoId);}else{setPanelList([]);}
  },[selectedWoId]);

  useEffect(()=>{
    const anyRunning=items.some((it:any)=>it.status==="berjalan");
    if(!anyRunning)return;
    const t=setInterval(()=>setTick(v=>v+1),1000);
    return()=>clearInterval(t);
  },[items]);

  const tambahKomponen=async()=>{
    if(!selectedWoId||!selectedPanelId||!namaKomponen.trim()||!qty||Number(qty)<=0){
      alert("Lengkapi proyek, panel, nama komponen, dan qty dulu");
      return;
    }
    setSubmitting(true);
    const wo=woList.find((w:any)=>w.id===selectedWoId);
    const panel=panelList.find((p:any)=>p.id===selectedPanelId);
    const{error}=await supabase.from("komponen_tambahan").insert({
      wo_id:selectedWoId,
      panel_id:selectedPanelId,
      proyek:wo?.proyek||null,
      wo:wo?.wo||null,
      panel_nama:panel?.nama||panel?.no_pnl||null,
      nama_komponen:namaKomponen.trim(),
      qty:Number(qty),
      proses:"POTONG",
      tanggal:sesiKerja.tanggal,
      shift:sesiKerja.shift,
      status:"belum_mulai",
    });
    setSubmitting(false);
    if(error){
      alert("Gagal menyimpan: "+error.message);
      return;
    }
    setNamaKomponen("");
    setQty("");
    fetchItems();
  };

  const mulaiKerja=async(id:number)=>{
    await supabase.from("komponen_tambahan").update({status:"berjalan",waktu_mulai:new Date().toISOString(),operator_nama:namaOperator}).eq("id",id);
    fetchItems();
  };
  const selesaiKerja=async(id:number)=>{
    await supabase.from("komponen_tambahan").update({status:"selesai",waktu_selesai:new Date().toISOString()}).eq("id",id);
    fetchItems();
  };

  const durasiLabel=(it:any)=>{
    if(!it.waktu_mulai)return "";
    const end=it.waktu_selesai?new Date(it.waktu_selesai).getTime():Date.now();
    const totalMenit=(end-new Date(it.waktu_mulai).getTime())/60000;
    const jam=Math.floor(totalMenit/60);
    const menit=Math.round(totalMenit%60);
    const detik=Math.max(0,Math.round(totalMenit*60));
    return jam>0?`${jam}j ${menit}m`:totalMenit>=1?`${menit}m`:`${detik}d`;
  };

  return(
    <div style={{padding:"14px 16px"}}>
      <div style={{fontSize:12,color:"#64748b",marginBottom:14}}>
        Input komponen tambahan (di luar BOM/jadwal normal) untuk kondisi darurat. Tidak ada pengecekan kapasitas.
      </div>
      <div style={{background:"#fff",borderRadius:12,padding:14,marginBottom:16,border:"1px solid #f1f5f9"}}>
        <div style={{fontWeight:800,fontSize:13,color:"#1e293b",marginBottom:10}}>+ Tambah Komponen</div>
        <select value={selectedWoId??""} onChange={e=>setSelectedWoId(e.target.value?Number(e.target.value):null)}
          style={{width:"100%",padding:"9px 10px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:12.5,marginBottom:8}}>
          <option value="">Pilih Proyek / WO...</option>
          {woList.map((w:any)=>(<option key={w.id} value={w.id}>{w.proyek} - {w.wo}</option>))}
        </select>
        <select value={selectedPanelId??""} onChange={e=>setSelectedPanelId(e.target.value?Number(e.target.value):null)} disabled={!selectedWoId}
          style={{width:"100%",padding:"9px 10px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:12.5,marginBottom:8}}>
          <option value="">Pilih Panel...</option>
          {panelList.map((p:any)=>(<option key={p.id} value={p.id}>{p.no_pnl} {p.nama?`- ${p.nama}`:""}</option>))}
        </select>
        <input value={namaKomponen} onChange={e=>setNamaKomponen(e.target.value)} placeholder="Nama komponen"
          style={{width:"100%",padding:"9px 10px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:12.5,marginBottom:8,boxSizing:"border-box"}}/>
        <input value={qty} onChange={e=>setQty(e.target.value.replace(/[^0-9]/g,""))} placeholder="Qty" inputMode="numeric"
          style={{width:"100%",padding:"9px 10px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:12.5,marginBottom:10,boxSizing:"border-box"}}/>
        <button disabled={submitting} onClick={tambahKomponen}
          style={{width:"100%",padding:"11px",borderRadius:8,border:"none",background:"#2563eb",color:"#fff",fontWeight:700,fontSize:13,cursor:submitting?"not-allowed":"pointer"}}>
          {submitting?"Menyimpan...":"+ Tambah"}
        </button>
      </div>
      <div style={{fontWeight:800,fontSize:13,color:"#1e293b",marginBottom:8}}>Komponen Tambahan Hari Ini</div>
      {loading?(
        <div style={{textAlign:"center",color:"#94a3b8",padding:20}}>Memuat...</div>
      ):items.length===0?(
        <div style={{textAlign:"center",color:"#94a3b8",padding:20,background:"#fff",borderRadius:12}}>Belum ada komponen tambahan hari ini.</div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {items.map((it:any)=>{
            const running=it.status==="berjalan";
            const selesai=it.status==="selesai";
            return(
              <div key={it.id} style={{background:"#fff",borderRadius:10,padding:"10px 12px",border:"1px solid #f1f5f9"}}>
                <div style={{fontSize:12.5,fontWeight:700,color:"#334155"}}>{it.nama_komponen} <span style={{fontWeight:600,color:"#d97706"}}>({it.qty} pcs)</span></div>
                <div style={{fontSize:10.5,color:"#94a3b8",marginTop:2,marginBottom:8}}>{it.proyek} • {it.panel_nama}</div>
                {selesai?(
                  <div style={{fontSize:11.5,fontWeight:700,color:"#16a34a"}}>✓ Selesai ({durasiLabel(it)})</div>
                ):(
                  <button disabled={false}
                    onClick={()=>running?selesaiKerja(it.id):mulaiKerja(it.id)}
                    style={{fontSize:13,fontWeight:700,border:"none",borderRadius:10,padding:"12px 14px",minHeight:44,width:"100%",cursor:"pointer",
                      background:running?"#fef2f2":"#f0fdf4",color:running?"#dc2626":"#16a34a"}}>
                    {running?`⏹ Selesai ${durasiLabel(it)}`:"▶ Mulai"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Wrapper tab switcher "Tugas Saya" / "Review" / "Komponen Tambahan" - komponen
// TERPISAH dari OperatorView (bukan state internal di dalamnya) supaya gak ada
// resiko urutan hooks React berubah pas toggle tab (OperatorView isinya banyak
// hook, early return bersyarat di tengah function itu bisa bikin "rendered
// fewer hooks than expected" kalau tab-nya di-switch pas beberapa hook di
// bawah belum sempat jalan). Dengan swap komponen (bukan swap konten di dalam
// 1 komponen), tiap komponen punya hook-nya sendiri, aman.
function OperatorHome({user,viewMode}:any){
  const[mainTab,setMainTab]=useState<"tugas"|"review"|"tambahan">("tugas");
  const bisaReview=user.divisi==="mekanik"&&user.sub_bagian==="Potong";

  return(
    <div>
      {bisaReview&&(
        <div style={{display:"flex",gap:2,padding:"8px 16px 0",background:"#fff",borderBottom:"1px solid #f1f5f9"}}>
          {[{key:"tugas",label:"📋 Tugas Saya"},{key:"review",label:"🗂 Review"},{key:"tambahan",label:"➕ Tambahan"}].map(t=>(
            <button key={t.key} onClick={()=>setMainTab(t.key as any)}
              style={{padding:"8px 16px",fontSize:12,fontWeight:mainTab===t.key?800:600,
                color:mainTab===t.key?"#d97706":"#94a3b8",cursor:"pointer",background:"none",
                border:"none",borderBottom:mainTab===t.key?"2.5px solid #d97706":"2.5px solid transparent",
                fontFamily:"inherit"}}>{t.label}</button>
          ))}
        </div>
      )}
      {bisaReview&&mainTab==="review"?<ReviewPotongView/>:bisaReview&&mainTab==="tambahan"?<KomponenTambahanView user={user}/>:<OperatorView user={user} viewMode={viewMode}/>}
    </div>
  );
}

function OperatorView({user,viewMode}:any){
  void viewMode; // dipake nanti buat render mobile vs desktop
  const wsKey=`vista_pekerja_ws_${user.divisi}_${user.sub_bagian||""}_${user.id||user.username||user.nama||""}`;
  // Kalau app dibuka/reload jam 00:00-06:59 DAN sesi kerja sebelumnya (localStorage) tercatat
  // shift 2 di tanggal KEMARIN (belum ganti hari), hari kerja-nya tetap dianggap kemarin -
  // biar shift 2 yang kerja lewat tengah malam (HP di-lock/di-background OS lalu reload) gak
  // ke-hitung sebagai hari baru di Rencana Harian.
  const hariKerjaAwal=(()=>{
    try{
      const saved=JSON.parse(localStorage.getItem(wsKey)||"{}");
      const jamSekarang=new Date().getHours();
      const kemarin=addDays(TODAY,-1);
      if(jamSekarang<7&&saved.shift==="2"&&saved.tanggal===kemarin)return kemarin;
    }catch{}
    return TODAY;
  })();
  const [viewDate,setViewDate]=useState(hariKerjaAwal);
  const [bomPanelTypes,setBomPanelTypes]=useState<any>({});
  useEffect(()=>{
    supabase.from("bom_master").select("*").then(({data}:any)=>{
      if(!data||data.length===0)return;
      const grouped:any={};
      data.forEach((b:any)=>{
        if(!grouped[b.tipe_panel])grouped[b.tipe_panel]={};
        if(!grouped[b.tipe_panel][b.wp])grouped[b.tipe_panel][b.wp]=[];
        grouped[b.tipe_panel][b.wp].push({kode:b.kode_komponen,nama:b.nama_komponen});
      });
      const result:any={};
      Object.entries(grouped).forEach(([tipe,wpMap]:any)=>{
        const origCfg=(PANEL_TYPES as any)[tipe];
        if(!origCfg)return;
        const wps=origCfg.wps.map((origWp:any)=>{
          const items=(wpMap[origWp.wp]||[]).sort((a:any,b:any)=>String(a.kode).localeCompare(String(b.kode),undefined,{numeric:true}));
          return{...origWp,items:items.length>0?items:origWp.items};
        });
        result[tipe]={...origCfg,wps};
      });
      setBomPanelTypes(result);
    });
  },[]);
  const getEffCfg=(tipe:string)=>(bomPanelTypes?.[tipe]?.wps?.length>0)?bomPanelTypes[tipe]:(PANEL_TYPES as any)[tipe];
  const [shift,setShift]=useState(()=>{
    try{
      const saved=JSON.parse(localStorage.getItem(wsKey)||"{}");
      return saved.tanggal===hariKerjaAwal&&saved.shift?saved.shift:"1";
    }catch{return "1";}
  });
  const [shiftSet,setShiftSet]=useState(()=>{
    try{
      const saved=JSON.parse(localStorage.getItem(wsKey)||"{}");
      return saved.tanggal===hariKerjaAwal?!!saved.shiftSet:false;
    }catch{return false;}
  });
  useEffect(()=>{
    // Simpan hariKerjaAwal (tanggal sesi kerja sesungguhnya), BUKAN viewDate - viewDate bisa
    // berubah bebas kalau operator navigasi lihat hari lain (tombol prev/next), dan itu gak
    // boleh ikut nimpa/ngerusak status shift sesi kerja yang sebenarnya lagi berjalan.
    try{localStorage.setItem(wsKey,JSON.stringify({tanggal:hariKerjaAwal,shift,shiftSet}));}catch{}
  },[shift,shiftSet,wsKey,hariKerjaAwal]);
  const [catatan,setCatatan]=useState<Record<string,string>>({});
  const [savedNote,setSavedNote]=useState<Record<string,boolean>>({});
  const [lockMsg,setLockMsg]=useState(false);
  const [pernahDikunci,setPernahDikunci]=useState(false);
  const [lockedCells,setLockedCells]=useState<Record<string,boolean>>({});
  const [fProyek,setFProyek]=useState("ALL");
  const [fPanel,setFPanel]=useState("ALL");
  const [renhar,setRenhar]=useState<any[]>([]);
  const [panelsMap,setPanelsMap]=useState<Record<number,any>>({});
  // Sinkron manual (bukan lewat dependency effect) biar useEffect subscribe realtime renhar
  // gak perlu depend ke panelsMap - kalau iya, channel-nya bakal resubscribe terus-menerus.
  const panelsMapRef=useRef<Record<number,any>>({});
  useEffect(()=>{panelsMapRef.current=panelsMap;},[panelsMap]);
  const [loadingData,setLoadingData]=useState(false);
  const [pekerjaList,setPekerjaList]=useState<any[]>([]);
  const [woTargetMap,setWoTargetMap]=useState<Record<number,string>>({});
  const [wiringInfoMap,setWiringInfoMap]=useState<Record<string,any>>({});
  const [komponenInfoMap,setKomponenInfoMap]=useState<Record<string,any>>({});
  const [selectedKomponen,setSelectedKomponen]=useState<Record<string,string[]>>(()=>{
    try{
      const saved=JSON.parse(localStorage.getItem(wsKey+"_komp")||"{}");
      return saved.tanggal===TODAY&&saved.data?saved.data:{};
    }catch{return {};}
  });
  useEffect(()=>{
    try{localStorage.setItem(wsKey+"_komp",JSON.stringify({tanggal:TODAY,data:selectedKomponen}));}catch{}
  },[selectedKomponen,wsKey]);
  const [komponenPopup,setKomponenPopup]=useState<{proses:string,panelId:number}|null>(null);
  const [tempSelectedKomponen,setTempSelectedKomponen]=useState<string[]>([]);
  // Khusus BENDING/STEL mobile: titik awal pilih komponen dibalik jadi Jenis Komponen -> Panel
  // (bukan Panel -> Komponen). Sumber datanya tetap selectedKomponen yang sama persis.
  const [komponenPopupJenis,setKomponenPopupJenis]=useState<{proses:string,namaKomponen:string}|null>(null);
  const [tempSelectedPanelJenis,setTempSelectedPanelJenis]=useState<number[]>([]);
  // Flash "Tersimpan" sesaat di tombol Simpan Progress buat proses yg blm ada feedback visual saat disimpan <100%.
  const [savedFlash,setSavedFlash]=useState<Record<string,boolean>>({});
  const PROSES_FLASH_TERSIMPAN=["FINISHING","RENDAM","PAINTING","WIRING CONTROL","WIRING POWER","RAKIT","PASANG KOMPONEN","BUSBAR"];

  // Auto-scroll + highlight kartu accordion begitu popup Konfirmasi ditutup, biar operator
  // langsung lihat hasil konfirmasinya tanpa perlu scroll manual cari sendiri.
  const accordionRefs=useRef<Record<string,HTMLDivElement|null>>({});
  const [highlightGroup,setHighlightGroup]=useState<string|null>(null);
  const scrollDanHighlightGroup=(proses:string,groupKey:string)=>{
    if(!groupKey)return;
    const key=`${proses}_${groupKey}`;
    // Double rAF - nunggu React selesai render & browser selesai paint dulu abis setSelectedKomponen,
    // baru elemen kartunya PASTI ada di DOM sebelum di-scrollIntoView.
    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        const el=accordionRefs.current[key];
        if(!el)return;
        el.scrollIntoView({behavior:"smooth",block:"center"});
        setHighlightGroup(key);
        setTimeout(()=>setHighlightGroup(prev=>prev===key?null:prev),2500);
      });
    });
  };

  const getUrgensi=(woId:number)=>{
    const target=woTargetMap[woId];
    if(!target)return{level:"normal",label:"",hari:null};
    const hari=Math.ceil((new Date(target).getTime()-new Date().getTime())/86400000);
    if(hari<0)return{level:"telat",label:`Telat ${Math.abs(hari)}hr`,hari};
    if(hari<=3)return{level:"mendesak",label:`H-${hari}`,hari};
    if(hari<=7)return{level:"perhatian",label:`H-${hari}`,hari};
    return{level:"normal",label:`H-${hari}`,hari};
  };
  const [operatorModal,setOperatorModal]=useState<any>(null);
  const [terakhirKerjaPekerjaId,setTerakhirKerjaPekerjaId]=useState<number|null>(null);

  useEffect(()=>{
    if(!operatorModal){setTerakhirKerjaPekerjaId(null);return;}
    const task=renhar.find((r:any)=>r.id===operatorModal.taskId);
    if(!task){setTerakhirKerjaPekerjaId(null);return;}
    const panelId=task.panel_id||task.panelId;
    supabase.from("fcs_timer_kerja").select("pekerja_id,mulai")
      .eq("panel_id",panelId).eq("kode_komponen",operatorModal.kode).eq("proses",task.proses)
      .order("mulai",{ascending:false}).limit(1).then(({data})=>{
        setTerakhirKerjaPekerjaId(data&&data.length>0?data[0].pekerja_id:null);
      });
  },[operatorModal]);
  const [timerAktif,setTimerAktif]=useState<Record<string,any>>({});
  const [timerPernahMulai,setTimerPernahMulai]=useState<Record<string,boolean>>({});
  const [timerSelesaiHariIni,setTimerSelesaiHariIni]=useState<Record<string,boolean>>({});
  const [timerDurasiSelesai,setTimerDurasiSelesai]=useState<Record<string,number>>({});
  const [timerLoading,setTimerLoading]=useState<string|null>(null);
  const [, setTimerTick]=useState(0);
  useEffect(()=>{
    // Maksa re-render tiap detik SELAMA ada timer yang lagi jalan, biar durasi timer
    // keliatan jalan live kayak stopwatch beneran (30 detik kayak sebelumnya kerasa
    // beku/patah-patah, baru "loncat" pas render lain kepicu). Interval cuma nyala
    // pas ada timer aktif - kalau gak ada, gak jalan sama sekali (hemat, gak nguras
    // baterai/CPU pas nganggur).
    if(Object.keys(timerAktif).length===0)return;
    const iv=setInterval(()=>setTimerTick(t=>t+1),1000);
    return ()=>clearInterval(iv);
  },[timerAktif]);
  const [tempPekerjaIds,setTempPekerjaIds]=useState<number[]>([]);
  const [bulkAssignProses,setBulkAssignProses]=useState<string|null>(null);
  const [expandedPanel,setExpandedPanel]=useState<Record<string,string|null>>({});
  const [bulkAssignGroupKey,setBulkAssignGroupKey]=useState<string|null>(null);
  const [tempBulkPekerjaIds,setTempBulkPekerjaIds]=useState<number[]>([]);

  const cfg=DIVISI_CONFIG[user.divisi];
  const isQtyBased=QTY_DIVISI.includes(user.divisi);
  const PROSES_CARD_MODE:Record<string,string>={
    POTONG:'qty',RENDAM:'qty',PAINTING:'qty',
    BENDING:'qty',STEL:'qty',FINISHING:'qty',RAKIT:'qty',"PASANG KOMPONEN":'qty',
    "WIRING CONTROL":'timer',"WIRING POWER":'timer',BUSBAR:'timer',
  };
  // Khusus WIRING CONTROL, dua komponen ini dapat tambahan bagian "Foto Pemasangan" di
  // kartunya (alur operator+timer yang sudah jalan TIDAK berubah, cuma ditambah foto bukti).
  const WIRING_KOMPONEN_FOTO_NAMA=["Box Control","Pintu"];
  // Proses qty-mode yang qty-nya dikunci sampai operator klik Mulai (biar gak bisa keisi
  // tanpa operator ter-assign). RENDAM/PAINTING/RAKIT/PASANG KOMPONEN dulu gak ada di sini -
  // itu lubang yang sama persis kayak bug "operator kosong padahal 100%" yang udah diperbaiki
  // buat POTONG/BENDING/STEL. FINISHING sengaja gak dikasih auto-assign (harus eksplisit Pilih
  // Operator dulu baru bisa Mulai, baru qty kebuka) - itu udah aman by design.
  const PROSES_QTY_LOCK_SEBELUM_MULAI=["POTONG","BENDING","STEL","FINISHING","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN"];
  const PROSES_AUTO_ASSIGN_SAAT_QTY=["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN"];
  const myProses:string[]=(user.sub_bagian&&cfg.subBagianProses?.[user.sub_bagian])||cfg.proses||[];

  // Load data dari Supabase
  useEffect(()=>{
    setPernahDikunci(false);
    loadData();
    // load semua pekerja untuk kolom OPERATOR
    supabase.from("pekerja").select("id,nama,divisi").then(({data})=>setPekerjaList(data??[]));
    // Ambil semua timer aktif (lintas tanggal) + semua timer hari ini (aktif maupun sudah selesai)
    supabase.from("fcs_timer_kerja").select("*").or(`selesai.is.null,tanggal.eq.${viewDate}`).then(({data})=>{
      const mapAktif:Record<string,any>={};
      const mapPernahMulai:Record<string,boolean>={};
      const mapSelesaiHariIni:Record<string,boolean>={};
      const mapDurasiSelesai:Record<string,number>={};
      (data??[]).forEach((t:any)=>{
        const key=timerKey(t.panel_id,t.kode_komponen,t.proses,t.pekerja_id,t.tahap);
        if(!t.selesai&&t.tanggal===viewDate)mapAktif[key]=t;
        mapPernahMulai[key]=true;
        if(t.tanggal===viewDate&&t.selesai){
          mapSelesaiHariIni[key]=true;
          mapDurasiSelesai[key]=(mapDurasiSelesai[key]||0)+Number(t.durasi_menit||0);
        }
      });
      setTimerAktif(mapAktif);
      setTimerPernahMulai(mapPernahMulai);
      setTimerSelesaiHariIni(mapSelesaiHariIni);
      setTimerDurasiSelesai(mapDurasiSelesai);
    });

    const renharChannel=supabase.channel("realtime-renhar-pekerja")
      .on("postgres_changes",{event:"*",schema:"public",table:"renhar"},(payload:any)=>{
        // Merge tertarget - JANGAN loadData() penuh di sini. loadData() bikin loadingData=true
        // yang ganti SELURUH layar jadi spinner - dan karena tulisan operator sendiri (Mulai/
        // Pilih Operator) ke tabel renhar ini JUGA nge-trigger event ini (echo ke diri sendiri),
        // dulu tiap klik Mulai/Pilih Operator kerasa kayak "restart" penuh di HP operator.
        if(payload.eventType==="DELETE"){
          const oldRow=payload.old;
          if(oldRow?.id)setRenhar(prev=>prev.filter((t:any)=>t.id!==oldRow.id));
          return;
        }
        const row=payload.new;
        if(!row||row.tanggal!==viewDate||row.divisi!==user.divisi)return;
        setRenhar(prev=>{
          const exists=prev.some((t:any)=>t.id===row.id);
          return exists?prev.map((t:any)=>t.id===row.id?row:t):[...prev,row];
        });
        // Task baru bisa referensiin panel yang belum ke-load - fetch panel itu aja kalau perlu.
        const panelId=row.panel_id||row.panelId;
        if(panelId&&!panelsMapRef.current[panelId]){
          supabase.from("panels").select("*").eq("id",panelId).maybeSingle().then(({data})=>{
            if(data)setPanelsMap(prev=>prev[data.id]?prev:{...prev,[data.id]:data});
          });
        }
      })
      .subscribe();
    return()=>{supabase.removeChannel(renharChannel);};
  },[viewDate,user.divisi]);

  useEffect(()=>{
    const fetchTimerData=()=>{
      supabase.from("fcs_timer_kerja").select("*").or(`selesai.is.null,tanggal.eq.${viewDate}`).then(({data})=>{
        const mapAktif:Record<string,any>={};
        const mapPernahMulai:Record<string,boolean>={};
        const mapSelesaiHariIni:Record<string,boolean>={};
        const mapDurasiSelesai:Record<string,number>={};
        (data??[]).forEach((t:any)=>{
          const key=timerKey(t.panel_id,t.kode_komponen,t.proses,t.pekerja_id,t.tahap);
          if(!t.selesai&&t.tanggal===viewDate)mapAktif[key]=t;
          mapPernahMulai[key]=true;
          if(t.tanggal===viewDate&&t.selesai){
            mapSelesaiHariIni[key]=true;
            mapDurasiSelesai[key]=(mapDurasiSelesai[key]||0)+Number(t.durasi_menit||0);
          }
        });
        setTimerAktif(mapAktif);
        setTimerPernahMulai(mapPernahMulai);
        setTimerSelesaiHariIni(mapSelesaiHariIni);
        setTimerDurasiSelesai(mapDurasiSelesai);
      });
    };
    const timerChannel=supabase.channel("realtime-timer-kerja-pekerja")
      .on("postgres_changes",{event:"*",schema:"public",table:"fcs_timer_kerja"},()=>{fetchTimerData();})
      .subscribe();
    return()=>{supabase.removeChannel(timerChannel);};
  },[viewDate]);

  const loadData=async()=>{
    setLoadingData(true);
    // ambil renhar berdasarkan divisi dan tanggal
    const {data:renharData}=await supabase.from("renhar").select("*")
      .eq("tanggal",viewDate).eq("divisi",user.divisi);
    const tasks=renharData??[];
    setRenhar(tasks);

    // ambil panels
    const panelIds=[...new Set(tasks.map((t:any)=>t.panel_id||t.panelId).filter(Boolean))];
    if(panelIds.length>0){
      const {data:panels}=await supabase.from("panels").select("*").in("id",panelIds as any);
      const map:Record<number,any>={};
      (panels??[]).forEach((p:any)=>{map[p.id]=p;});
      setPanelsMap(map);
    } else {
      setPanelsMap({});
    }

    // ambil target tanggal WO untuk hitung urgensi/deadline
    const woIds=[...new Set(tasks.map((t:any)=>t.wo_id||t.woId).filter(Boolean))];
    if(woIds.length>0){
      const{data:wos}=await supabase.from("work_orders").select("id,target").in("id",woIds as any);
      const targetMap:Record<number,string>={};
      (wos??[]).forEach((w:any)=>{targetMap[w.id]=w.target;});
      setWoTargetMap(targetMap);
    } else {
      setWoTargetMap({});
    }
    // Ambil info wiring (CREATE BY, CREATE ON, TARGET SELESAI) dari fcs_schedule dan raw_schedule
    const wiringProses=["WIRING CONTROL","WIRING POWER"];
    const wiringTasks=tasks.filter((t:any)=>wiringProses.includes(t.proses));
    if(wiringTasks.length>0){
      const wiringPanelIds=[...new Set(wiringTasks.map((t:any)=>t.panel_id||t.panelId).filter(Boolean))];
      const wiringProsesNames=[...new Set(wiringTasks.map((t:any)=>t.proses))];
      const[{data:fcsData},{data:rawData}]=await Promise.all([
        supabase.from("fcs_schedule").select("panel_id,jenis_pekerjaan,kode_komponen,qty_total,generated_by,created_at")
          .in("panel_id",wiringPanelIds as any).in("jenis_pekerjaan",wiringProsesNames),
        supabase.from("raw_schedule").select("panel_id,proses,schedule")
          .in("panel_id",wiringPanelIds as any).in("proses",wiringProsesNames),
      ]);
      const infoMap:Record<string,any>={};
      (fcsData||[]).forEach((row:any)=>{
        const key=`${row.panel_id}_${row.jenis_pekerjaan}`;
        if(!infoMap[key])infoMap[key]={bobot:row.kode_komponen,jumlahOrang:row.qty_total,createdBy:row.generated_by,createdAt:row.created_at,targetSelesai:null};
      });
      (rawData||[]).forEach((row:any)=>{
        const key=`${row.panel_id}_${row.proses}`;
        let lastTgl:string|null=null;
        Object.entries(row.schedule||{}).forEach(([tgl,entries]:any)=>{
          (entries||[]).forEach((e:any)=>{
            (e.komponen||[]).forEach((k:string)=>{
              if(k.startsWith("__wiring_")){if(!lastTgl||tgl>lastTgl)lastTgl=tgl;}
            });
          });
        });
        if(lastTgl&&infoMap[key])infoMap[key].targetSelesai=lastTgl;
      });
      setWiringInfoMap(infoMap);
    } else {
      setWiringInfoMap({});
    }

    // Ambil info komponen (CREATE BY, CREATE ON, TARGET SELESAI) untuk proses biasa
    const nonWiringProses=["POTONG","BENDING","STEL","FINISHING","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","BUSBAR"];
    const nonWiringTasks=tasks.filter((t:any)=>nonWiringProses.includes(t.proses));
    if(nonWiringTasks.length>0){
      const nwPanelIds=[...new Set(nonWiringTasks.map((t:any)=>t.panel_id||t.panelId).filter(Boolean))];
      const nwProsesNames=[...new Set(nonWiringTasks.map((t:any)=>t.proses))];
      const[{data:fcsDtNw},{data:rawDtNw}]=await Promise.all([
        supabase.from("fcs_schedule").select("panel_id,jenis_pekerjaan,kode_komponen,generated_by,created_at")
          .in("panel_id",nwPanelIds as any).in("jenis_pekerjaan",nwProsesNames),
        supabase.from("raw_schedule").select("panel_id,proses,schedule")
          .in("panel_id",nwPanelIds as any).in("proses",nwProsesNames),
      ]);
      const kompMap:Record<string,any>={};
      (fcsDtNw||[]).forEach((row:any)=>{
        const key=`${row.panel_id}_${row.jenis_pekerjaan}_${row.kode_komponen}`;
        if(!kompMap[key])kompMap[key]={createdBy:row.generated_by,createdAt:row.created_at,targetSelesai:null};
      });
      (rawDtNw||[]).forEach((row:any)=>{
        Object.entries(row.schedule||{}).forEach(([tgl,entries]:any)=>{
          (entries||[]).forEach((e:any)=>{
            (e.komponen||[]).forEach((k:string)=>{
              if(k.startsWith("__wiring_"))return;
              const key=`${row.panel_id}_${row.proses}_${k}`;
              if(!kompMap[key])kompMap[key]={createdBy:e.createdBy||null,createdAt:e.createdAt||null,targetSelesai:null};
              else if(!kompMap[key].createdBy&&e.createdBy){kompMap[key].createdBy=e.createdBy;kompMap[key].createdAt=e.createdAt;}
              if(!kompMap[key].targetSelesai||tgl>kompMap[key].targetSelesai)kompMap[key].targetSelesai=tgl;
            });
          });
        });
      });
      setKomponenInfoMap(kompMap);
    } else {
      setKomponenInfoMap({});
    }
    setLoadingData(false);
  };

  // ── Realtime listener untuk panels (qty update dari Vista Teknik) ──
  // Depend ke renhar (bukan panelsMap!) - panelsMap berubah tiap qty diketik lokal,
  // kalau jadi dependency effect ini bakal resubscribe terus-menerus dan bikin race
  // condition antara update lokal vs echo dari server (progress bisa "balik" gak 100%).
  useEffect(()=>{
    const panelIds=[...new Set(renhar.map((t:any)=>t.panel_id||t.panelId).filter(Boolean))];
    if(!panelIds.length) return;

    const channel=supabase.channel('realtime-panels-pekerja')
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'panels'},
        (payload:any)=>{
          const updated=payload.new;
          if(!panelIds.includes(updated.id)) return;
          setPanelsMap(prev=>{
            const oldPanel=prev[updated.id];
            if(!oldPanel) return {...prev,[updated.id]:updated};
            // Recalculate progress jika qty berubah
            const oldChecklist=oldPanel.checklist||{};
            const newChecklist={...updated.checklist};
            Object.keys(newChecklist).forEach(kode=>{
              const oldQty=oldChecklist[kode]?.qty||1;
              const newQty=newChecklist[kode]?.qty||1;
              if(newQty!==oldQty && oldQty>0 && newQty>0){
                const ratio=oldQty/newQty;
                const newProgress:any={};
                Object.keys(newChecklist[kode]?.progress||{}).forEach(pr=>{
                  const old=newChecklist[kode].progress[pr]||0;
                  newProgress[pr]=Math.min(100,Math.round(old*ratio));
                });
                newChecklist[kode]={...newChecklist[kode],progress:newProgress};
              }
            });
            return{...prev,[updated.id]:{...updated,checklist:newChecklist}};
          });
        }
      )
      .subscribe();
    return()=>{supabase.removeChannel(channel);};
  },[renhar]);

  const todayTasks=useMemo(()=>{
    const urutanLevel:Record<string,number>={telat:0,mendesak:1,perhatian:2,normal:3};
    return [...renhar].sort((a:any,b:any)=>{
      const woIdA=a.wo_id||a.woId;const woIdB=b.wo_id||b.woId;
      const uA=getUrgensi(woIdA);const uB=getUrgensi(woIdB);
      const lvA=urutanLevel[uA.level]??3;const lvB=urutanLevel[uB.level]??3;
      if(lvA!==lvB)return lvA-lvB;
      if(uA.hari!==null&&uB.hari!==null)return uA.hari-uB.hari;
      return 0;
    });
  },[renhar,woTargetMap]);
  const proyekList=[...new Set(todayTasks.map((t:any)=>t.proyek))];
  const panelList=[...new Set(todayTasks.filter((t:any)=>fProyek==="ALL"||t.proyek===fProyek).map((t:any)=>t.panel))];

  const filteredTasks=useMemo(()=>todayTasks.filter((t:any)=>
    (fProyek==="ALL"||t.proyek===fProyek)&&
    (fPanel==="ALL"||t.panel===fPanel)
  ),[todayTasks,fProyek,fPanel]);

  const tasksByProses=useMemo(()=>{
    const g:Record<string,any[]>={};
    filteredTasks.forEach((t:any)=>{
      if(!g[t.proses])g[t.proses]=[];
      g[t.proses].push(t);
    });
    return g;
  },[filteredTasks]);

  const isCellLocked=(panelId:number,kode:string,proses:string)=>
    !!lockedCells[`${panelId}_${kode}_${proses}_${viewDate}_${shift}`];

  const getLockedFloor=(panelId:number,kode:string,proses:string)=>{
    const panel=panelsMap[panelId];
    const qtyByDate=panel?.checklist?.[kode]?.qtyProsesByDate?.[proses]||{};
    const pastDates=Object.keys(qtyByDate).filter((d:string)=>d<viewDate);
    if(!pastDates.length)return 0;
    return Math.max(...pastDates.map((d:string)=>qtyByDate[d]||0));
  };

  // Debounce penulisan qty ke Supabase per (panelId_kode_proses) - biar gak nembak 1 request
  // per keystroke yang bisa race sama echo realtime dan bikin input kerasa "reset".
  const qtyWriteTimers=useRef<Record<string,any>>({});
  // Antrian promise per taskId - biar panggilan updatePekerjaPerKomponenBatch yang nembak
  // nyaris bersamaan (misal ngetik qty komponen A lalu buru-buru ke komponen B sebelum React
  // sempat re-render) gak jalan interleaved dan saling timpa, tapi antre satu-satu.
  const pekerjaPerKomponenQueue=useRef<Record<number,Promise<any>>>({});

  // Update qty proses ke local state (instan) + Supabase (di-debounce di background)
  const updateQtyProses=(panelId:number,kode:string,proses:string,val:number)=>{
    if(isCellLocked(panelId,kode,proses))return;
    const floor=getLockedFloor(panelId,kode,proses);
    const panel=panelsMap[panelId];
    if(!panel)return;
    const cl=panel.checklist?.[kode]||{qty:0,qtyProses:{},progress:{},progressByDate:{},qtyProsesByDate:{}};
    const qtyKomp=cl.qty||0;
    const qtyProses=Math.min(Math.max(Number(val)||0,floor),qtyKomp);
    const pct=qtyKomp>0?Math.min(100,Math.round((qtyProses/qtyKomp)*100)):0;
    const newChecklist={
      ...panel.checklist,
      [kode]:{
        ...cl,
        qtyProses:{...(cl.qtyProses||{}),[proses]:qtyProses},
        qtyProsesByDate:{
          ...(cl.qtyProsesByDate||{}),
          [proses]:{...((cl.qtyProsesByDate||{})[proses]||{}),[viewDate]:qtyProses}
        },
        progressByDate:{
          ...(cl.progressByDate||{}),
          [proses]:{...((cl.progressByDate||{})[proses]||{}),[viewDate]:pct}
        },
        progress:{...(cl.progress||{}),[proses]:pct},
      }
    };
    // update local instan - responsif tanpa jeda, gak nunggu network
    setPanelsMap(prev=>({...prev,[panelId]:{...panel,checklist:newChecklist}}));

    // penulisan ke Supabase di-debounce - cuma 1 request yang akhirnya dikirim per jeda ngetik
    const debounceKey=`${panelId}_${kode}_${proses}`;
    if(qtyWriteTimers.current[debounceKey])clearTimeout(qtyWriteTimers.current[debounceKey]);
    qtyWriteTimers.current[debounceKey]=setTimeout(()=>{
      delete qtyWriteTimers.current[debounceKey];
      supabase.from("panels").update({checklist:newChecklist}).eq("id",panelId);
    },600);
  };

  const isWiringProses=(pr:string)=>pr==="WIRING CONTROL"||pr==="WIRING POWER";

  const canEditProgressKomponen=(task:any,kode:string,panelId:number,proses:string):boolean=>{
    if(proses==="PACKING"){
      const panel=panelsMap[panelId];
      const cl=panel?.qc_checklist||{};
      return QC_ITEMS.every(item=>cl[item.key]?.status==="lolos");
    }
    // BUSBAR sekarang punya alur & kartu sendiri (per-tahap, lihat simpanProgressTahapBusbar) -
    // gerbang lama (generic PCT_STEPS/canEditProgressKomponen) sengaja dimatiin buat BUSBAR
    // biar gak ke-pakai keliru sama jalur lama (pekerja_per_komponen buat BUSBAR sekarang
    // berbentuk object per-tahap, bukan array flat - gak kompatibel sama pengecekan generic ini).
    if(proses==="BUSBAR")return false;
    if(!isWiringProses(proses))return true;
    const ids=(task?.pekerja_per_komponen||{})[kode]||[];
    if(ids.length===0)return false;
    // Boleh ubah persentase selama timer lagi aktif ATAU udah pernah di-Selesai-in hari ini -
    // biar operator yang udah stop timer duluan tetap bisa catat progress, bukan cuma pas timer jalan.
    return ids.some((pid:number)=>!!timerAktif[`${panelId}_${kode}_${proses}_${pid}`]||!!timerSelesaiHariIni[`${panelId}_${kode}_${proses}_${pid}`]);
  };

  const canLockKomponen=(task:any,kode:string,panelId:number,proses:string):boolean=>{
    if(proses==="BUSBAR")return false;
    if(!isWiringProses(proses))return true;
    const ids=(task?.pekerja_per_komponen||{})[kode]||[];
    if(ids.length===0)return false;
    return ids.some((pid:number)=>timerSelesaiHariIni[`${panelId}_${kode}_${proses}_${pid}`]);
  };

  const startTimer=async(pekerjaId:number,panelId:number,kode:string,proses:string,tanggal:string,tahap?:string)=>{
    const key=timerKey(panelId,kode,proses,pekerjaId,tahap);
    setTimerLoading(key);
    try{
      let q=supabase.from("fcs_timer_kerja")
        .select("*").eq("pekerja_id",pekerjaId).eq("panel_id",panelId)
        .eq("kode_komponen",kode).eq("proses",proses).is("selesai",null);
      q=tahap?q.eq("tahap",tahap):q.is("tahap",null);
      const{data:existing}=await withTimeout(q.order("mulai",{ascending:false}).limit(1).maybeSingle(),TIMER_REQUEST_TIMEOUT_MS);
      if(existing){
        setTimerAktif(prev=>({...prev,[key]:existing}));
        setTimerPernahMulai(prev=>({...prev,[key]:true}));
        return;
      }
      const{data,error}=await withTimeout(supabase.from("fcs_timer_kerja").insert({
        pekerja_id:pekerjaId,panel_id:panelId,kode_komponen:kode,proses,tanggal,mulai:new Date().toISOString(),tahap:tahap||null
      }).select().single(),TIMER_REQUEST_TIMEOUT_MS);
      if(error){
        alert("Gagal mulai timer: "+error.message);
        return;
      }
      if(data){
        setTimerAktif(prev=>({...prev,[key]:data}));
        setTimerPernahMulai(prev=>({...prev,[key]:true}));
      }
    }catch(err:any){
      alert("Gagal mulai timer - koneksi bermasalah, coba lagi.\n("+(err?.message||"unknown error")+")");
    }finally{
      setTimerLoading(null);
    }
  };

  const stopTimer=async(pekerjaId:number,panelId:number,kode:string,proses:string,tahap?:string)=>{
    const key=timerKey(panelId,kode,proses,pekerjaId,tahap);
    const timer=timerAktif[key];
    if(!timer)return;
    setTimerLoading(key);
    try{
      const{error}=await withTimeout(supabase.from("fcs_timer_kerja").update({selesai:new Date().toISOString()}).eq("id",timer.id),TIMER_REQUEST_TIMEOUT_MS);
      if(error){
        alert("Gagal selesai-in timer: "+error.message);
        return;
      }
      setTimerAktif(prev=>{const n={...prev};delete n[key];return n;});
      setTimerSelesaiHariIni(prev=>({...prev,[key]:true}));
      // Cek apakah progress sudah 100% dan lebih cepat dari rencana - kirim notifikasi
      if(!tahap)await cekDanKirimNotifikasiAvailable(pekerjaId,panelId,kode,proses);
    }catch(err:any){
      alert("Gagal selesai-in timer - koneksi bermasalah, coba lagi.\n("+(err?.message||"unknown error")+")");
    }finally{
      setTimerLoading(null);
    }
  };

  const cekDanKirimNotifikasiAvailable=async(pekerjaId:number,panelId:number,kode:string,proses:string)=>{
    const panel=panelsMap[panelId];
    if(!panel)return;
    const pct=panel.checklist?.[kode]?.progress?.[proses]||0;
    if(pct<100)return;
    // Cari tanggal TERJAUH di mana komponen ini sudah di-assign manual di raw_schedule
    // (ini jadi acuan "rencana selesai" - bukan dari rentangTanggal lagi, tapi dari assignment manual planner)
    const{data:rawRows}=await supabase.from("raw_schedule").select("schedule").eq("panel_id",panelId).eq("proses",proses);
    let tanggalRencanaSelesai:string|null=null;
    for(const row of rawRows||[]){
      for(const[tglKey,entries] of Object.entries(row.schedule||{}) as [string,any[]][]){
        for(const entry of entries){
          if((entry.komponen||[]).includes(kode)){
            if(!tanggalRencanaSelesai||tglKey>tanggalRencanaSelesai)tanggalRencanaSelesai=tglKey;
          }
        }
      }
    }
    if(!tanggalRencanaSelesai)return;
    const hariIni=getLocalDateStr();
    if(hariIni>=tanggalRencanaSelesai)return; // tidak lebih cepat, tidak perlu notifikasi
    const pekerja=pekerjaList.find((p:any)=>p.id===pekerjaId);
    const allItems=getEffCfg(panel.tipe)?.wps.flatMap((w:any)=>w.items)||[];
    const namaKomponen=allItems.find((it:any)=>it.kode===kode)?.nama||kode;
    await supabase.from("fcs_notifikasi").insert({
      tipe:"available",pekerja_id:pekerjaId,pekerja_nama:pekerja?.nama||"",
      panel_id:panelId,panel_nama:panel.nama,kode_komponen:kode,nama_komponen:namaKomponen,proses,
      tanggal_rencana_selesai:tanggalRencanaSelesai,tanggal_aktual_selesai:hariIni,
    });
  };

    // Gabungin semua kode per taskId jadi SATU map sebelum ditulis, biar gak saling overwrite.
    // Dua lapis proteksi race:
    // 1. Serialisasi per taskId lewat pekerjaPerKomponenQueue - panggilan yang nembak nyaris
    //    bersamaan (bulk ATAU satu-satu dari qty onChange) diantre, gak jalan interleaved.
    // 2. Base map buat merge diambil FRESH dari DB (bukan renhar di state lokal yang bisa
    //    lag dari render), biar gak ketinggalan tulisan dari panggilan lain yang barusan lewat.
    const updatePekerjaPerKomponenBatch=async(rowsToAssign:any[],getPekerjaIds:(r:any)=>number[])=>{
      const byTask=new Map<number,any[]>();
      rowsToAssign.forEach(r=>{
        if(!byTask.has(r.task.id))byTask.set(r.task.id,[]);
        byTask.get(r.task.id)!.push(r);
      });
      for(const[taskId,rowsSatuTask] of byTask){
        const prevInQueue=pekerjaPerKomponenQueue.current[taskId]||Promise.resolve();
        const thisWrite=prevInQueue.then(async()=>{
          const{data:fresh}=await supabase.from("renhar").select("pekerja_per_komponen").eq("id",taskId).maybeSingle();
          const baseMap=fresh?.pekerja_per_komponen||{};
          const newMap={...baseMap};
          rowsSatuTask.forEach(r=>{
            if(r.tahap){
              // BUSBAR per-tahap: merge ke object nested, JANGAN timpa tahap lain yang udah keisi.
              const existingForKode=(baseMap[r.kode]&&typeof baseMap[r.kode]==="object"&&!Array.isArray(baseMap[r.kode]))?baseMap[r.kode]:{};
              newMap[r.kode]={...existingForKode,[r.tahap]:getPekerjaIds(r)};
            } else {
              newMap[r.kode]=getPekerjaIds(r);
            }
          });
          const{error}=await supabase.from("renhar").update({pekerja_per_komponen:newMap}).eq("id",taskId);
          if(!error){
            setRenhar(prev=>prev.map((t:any)=>t.id===taskId?{...t,pekerja_per_komponen:newMap}:t));
          }
        });
        pekerjaPerKomponenQueue.current[taskId]=thisWrite;
        await thisWrite;
      }
    };
    // Assign SATU komponen (dipanggil dari modal "Pilih Operator" per-komponen individual di
    // tabel desktop) - didelegasikan ke versi batch yang udah dibenerin (serialisasi + fetch
    // fresh dari DB sebelum merge), biar gak ada lagi jalur terpisah yang masih rawan stale-
    // closure race (baca renhar state lokal yang bisa lag, nimpa balik assignment kode lain
    // di task yang sama kalau ada penulisan lain yang nyaris bersamaan).
    const updatePekerjaPerKomponen=async(taskId:number,kode:string,pekerjaIds:number[])=>{
      await updatePekerjaPerKomponenBatch([{task:{id:taskId},kode}],()=>pekerjaIds);
    };
    // Assign operator KHUSUS SATU TAHAP BUSBAR - beda operator per tahap boleh keisi
    // bersamaan (gak saling timpa), lihat catatan nested-merge di updatePekerjaPerKomponenBatch.
    const updateOperatorBusbarTahap=async(taskId:number,kode:string,tahap:string,pekerjaIds:number[])=>{
      await updatePekerjaPerKomponenBatch([{task:{id:taskId},kode,tahap}],()=>pekerjaIds);
    };

    const bulkAssignAndStart=async(_proses:string,rowsToAssign:any[],pekerjaIds:number[])=>{
      // Cuma assign operator, TIDAK auto-start timer.
      // Operator klik tombol Mulai manual satu-satu per komponen.
      await updatePekerjaPerKomponenBatch(rowsToAssign,()=>pekerjaIds);
    };

    const bulkAssignAndStartDesktop=async(proses:string,rowsToAssign:any[],pekerjaIds:number[])=>{
      // Khusus desktop: assign operator SEKALIGUS start timer buat semua baris terkumpul.
      await updatePekerjaPerKomponenBatch(rowsToAssign,()=>pekerjaIds);
      for(const r of rowsToAssign){
        for(const pid of pekerjaIds){
          await startTimer(pid,r.panelId,r.kode,proses,viewDate);
        }
      }
    };

    const bulkStopDesktop=async(proses:string,rowsToStop:any[])=>{
      for(const r of rowsToStop){
        const idsKomp=(r.task.pekerja_per_komponen||{})[r.kode]||[];
        for(const pid of idsKomp){
          const key=`${r.panelId}_${r.kode}_${proses}_${pid}`;
          if(timerAktif[key]){
            await stopTimer(pid,r.panelId,r.kode,proses);
          }
        }
      }
    };

    // Khusus POTONG: operator = pekerja yang lagi login (gak ada picker), assign + start timer sekaligus.
    const startUntukUserSendiri=async(proses:string,rowsToAssign:any[])=>{
      await updatePekerjaPerKomponenBatch(rowsToAssign,()=>[user.id]);
      for(const r of rowsToAssign){
        await startTimer(user.id,r.panelId,r.kode,proses,viewDate);
      }
    };

  const updatePctManual=async(panelId:number,kode:string,proses:string,pct:number)=>{
    const panel=panelsMap[panelId];
    if(!panel)return;
    const cl=panel.checklist?.[kode]||{qty:0,qtyProses:{},progress:{},progressByDate:{}};
    const newChecklist={
      ...panel.checklist,
      [kode]:{
        ...cl,
        progressByDate:{
          ...(cl.progressByDate||{}),
          [proses]:{...((cl.progressByDate||{})[proses]||{}),[viewDate]:pct}
        },
        progress:{...(cl.progress||{}),[proses]:pct},
      }
    };
    setPanelsMap(prev=>({...prev,[panelId]:{...panel,checklist:newChecklist}}));
    await supabase.from("panels").update({checklist:newChecklist}).eq("id",panelId);
  };

  // Foto Pemasangan buat Box Control/Pintu di WIRING CONTROL - disimpan per-kode di
  // checklist[kode].fotoPemasangan, gak nyentuh progress/timer/qty proses yang udah jalan.
  const[stagedFotoWiring,setStagedFotoWiring]=useState<Record<string,{file:File,previewUrl:string}[]>>({});
  const[savingFotoWiring,setSavingFotoWiring]=useState<string|null>(null);
  const[fotoViewerWiring,setFotoViewerWiring]=useState<{fotos:FotoViewerPekerja[],startIndex:number,label:string}|null>(null);

  const pilihFotoWiring=(panelId:number,kode:string,fileList:FileList|null)=>{
    if(!fileList||fileList.length===0)return;
    const key=`${panelId}_${kode}`;
    const dipilih=Array.from(fileList).map(file=>({file,previewUrl:URL.createObjectURL(file)}));
    setStagedFotoWiring(prev=>({...prev,[key]:[...(prev[key]||[]),...dipilih]}));
  };
  const batalkanFotoWiring=(panelId:number,kode:string,idx:number)=>{
    const key=`${panelId}_${kode}`;
    setStagedFotoWiring(prev=>{
      const arr=prev[key]||[];
      URL.revokeObjectURL(arr[idx]?.previewUrl);
      return{...prev,[key]:arr.filter((_,i)=>i!==idx)};
    });
  };
  const simpanFotoWiring=async(panelId:number,kode:string)=>{
    const key=`${panelId}_${kode}`;
    const staged=stagedFotoWiring[key]||[];
    if(staged.length===0)return;
    const panel=panelsMap[panelId];
    if(!panel)return;
    setSavingFotoWiring(key);
    try{
      const cl=panel.checklist?.[kode]||{};
      const existing=cl.fotoPemasangan||[];
      const fotoTerupload:any[]=[];
      for(const s of staged){
        const blob=await compressImageNp(s.file);
        const path=`${panelId}/${kode}/${Date.now()}_${Math.random().toString(36).slice(2,8)}.jpg`;
        const{error:upErr}=await supabase.storage.from("wiring-komponen-photos").upload(path,blob,{contentType:"image/jpeg"});
        if(upErr){alert(`Gagal upload salah satu foto: ${upErr.message}`);continue;}
        const{data:urlData}=supabase.storage.from("wiring-komponen-photos").getPublicUrl(path);
        fotoTerupload.push({url:urlData.publicUrl,uploaded_by:user.nama,uploaded_at:new Date().toISOString()});
      }
      const newFoto=[...existing,...fotoTerupload];
      const newChecklist={...panel.checklist,[kode]:{...cl,fotoPemasangan:newFoto}};
      await supabase.from("panels").update({checklist:newChecklist}).eq("id",panelId);
      setPanelsMap(prev=>({...prev,[panelId]:{...panel,checklist:newChecklist}}));
      staged.forEach(s=>URL.revokeObjectURL(s.previewUrl));
      setStagedFotoWiring(prev=>{const next={...prev};delete next[key];return next;});
    }catch(err:any){
      alert("Terjadi kesalahan: "+err.message);
    }
    setSavingFotoWiring(null);
  };

  // Foto Pemasangan Pasang Komponen (Assembling Luar) - PER PANEL (bukan per-kode, satu
  // galeri buat seluruh pemasangan panel itu), disimpan di kolom panels.pasang_komponen_photos.
  const[stagedFotoPk,setStagedFotoPk]=useState<Record<number,{file:File,previewUrl:string}[]>>({});
  const[savingFotoPk,setSavingFotoPk]=useState<number|null>(null);
  const[fotoViewerPk,setFotoViewerPk]=useState<{fotos:FotoViewerPekerja[],startIndex:number,label:string}|null>(null);

  const pilihFotoPk=(panelId:number,fileList:FileList|null)=>{
    if(!fileList||fileList.length===0)return;
    const dipilih=Array.from(fileList).map(file=>({file,previewUrl:URL.createObjectURL(file)}));
    setStagedFotoPk(prev=>({...prev,[panelId]:[...(prev[panelId]||[]),...dipilih]}));
  };
  const batalkanFotoPk=(panelId:number,idx:number)=>{
    setStagedFotoPk(prev=>{
      const arr=prev[panelId]||[];
      URL.revokeObjectURL(arr[idx]?.previewUrl);
      return{...prev,[panelId]:arr.filter((_,i)=>i!==idx)};
    });
  };
  const simpanFotoPk=async(panelId:number)=>{
    const staged=stagedFotoPk[panelId]||[];
    if(staged.length===0)return;
    const panel=panelsMap[panelId];
    if(!panel)return;
    setSavingFotoPk(panelId);
    try{
      const existing=panel.pasang_komponen_photos||[];
      const fotoTerupload:any[]=[];
      for(const s of staged){
        const blob=await compressImageNp(s.file);
        const path=`${panelId}/${Date.now()}_${Math.random().toString(36).slice(2,8)}.jpg`;
        const{error:upErr}=await supabase.storage.from("pasang-komponen-photos").upload(path,blob,{contentType:"image/jpeg"});
        if(upErr){alert(`Gagal upload salah satu foto: ${upErr.message}`);continue;}
        const{data:urlData}=supabase.storage.from("pasang-komponen-photos").getPublicUrl(path);
        fotoTerupload.push({url:urlData.publicUrl,uploaded_by:user.nama,uploaded_at:new Date().toISOString()});
      }
      const newFoto=[...existing,...fotoTerupload];
      await supabase.from("panels").update({pasang_komponen_photos:newFoto}).eq("id",panelId);
      setPanelsMap(prev=>({...prev,[panelId]:{...panel,pasang_komponen_photos:newFoto}}));
      staged.forEach(s=>URL.revokeObjectURL(s.previewUrl));
      setStagedFotoPk(prev=>{const next={...prev};delete next[panelId];return next;});
    }catch(err:any){
      alert("Terjadi kesalahan: "+err.message);
    }
    setSavingFotoPk(null);
  };

  // Kunci progress — simpan ke Supabase
  // Kunci progress SATU komponen aja (dipanggil dari tombol per kartu di mobile)
  const lockSingleKomponen=async(panelId:number,kode:string,proses:string):Promise<boolean>=>{
    const panel=panelsMap[panelId];
    if(!panel)return false;
    const task=todayTasks.find((t:any)=>(t.panel_id||t.panelId)===panelId&&t.proses===proses&&(t.komponen||[]).includes(kode));
    if(!task)return false;
    if(!canLockKomponen(task,kode,panelId,proses)){alert('Belum bisa dikunci - pastikan timer sudah pernah dijalankan hari ini.');return false;}
    const cl=panel.checklist?.[kode];
    if(!cl||cl.qty===0)return false;
    const pct=getProgressOnDate(cl,proses,viewDate);
    if(pct===0){alert('Progress masih 0%, belum ada yang bisa dikunci.');return false;}
    const newChecklist={...panel.checklist};
    const prevHist=cl.history?.[proses]||[];
    const existIdx=prevHist.findIndex((h:any)=>h.tanggal===viewDate&&String(h.shift)===String(shift));
    const idsKomp=(task.pekerja_per_komponen||{})[kode]||[];
    const workerObjs=idsKomp.map((wid:number)=>pekerjaList.find((p:any)=>p.id===wid)).filter(Boolean);
    const pekerjaNamaLog=workerObjs.length>0?workerObjs.map((w:any)=>w.nama).join(', '):user.nama;
    const checkpointEntry={panel_id:panelId,kode_komponen:kode,proses,checkpoint:pct,pekerja_nama:pekerjaNamaLog,tanggal:viewDate};
    if(existIdx>=0){
      if(prevHist[existIdx].pct===pct)return true;
      const updatedHist=[...prevHist];
      updatedHist[existIdx]={...updatedHist[existIdx],pct,ts:new Date().toISOString()};
      newChecklist[kode]={...cl,history:{...(cl.history||{}),[proses]:updatedHist}};
    } else {
      const newEntry={pct,tanggal:viewDate,shift,ts:new Date().toISOString()};
      newChecklist[kode]={...cl,history:{...(cl.history||{}),[proses]:[...prevHist,newEntry]}};
      // TIDAK setLockedCells - biar qty tetap bisa diedit lanjut, cuma checkpoint aja yang disimpan
    }
    await supabase.from('progress_checkpoint_log').insert([checkpointEntry]);
    await supabase.from('panels').update({checklist:newChecklist}).eq('id',panelId);
    setPanelsMap((prev:any)=>({...prev,[panelId]:{...panel,checklist:newChecklist}}));
    if((proses==='WIRING CONTROL'||proses==='WIRING POWER')&&pct>=100){
      const{data:rawRows}=await supabase.from('raw_schedule').select('id,schedule').eq('panel_id',panelId).eq('proses',proses);
      for(const row of rawRows||[]){
        let berubah=false;
        const newSchedule:any={};
        for(const[tglKey,entries] of Object.entries(row.schedule||{}) as [string,any[]][]){
          const newEntries=entries.map((entry:any)=>{
            const filteredKomp=(entry.komponen||[]).filter((k:string)=>k!==kode);
            if(filteredKomp.length!==(entry.komponen||[]).length)berubah=true;
            return{...entry,komponen:filteredKomp};
          }).filter((entry:any)=>(entry.komponen||[]).length>0);
          if(newEntries.length>0)newSchedule[tglKey]=newEntries;
        }
        if(berubah){
          await supabase.from('raw_schedule').update({schedule:newSchedule}).eq('id',row.id);
        }
      }
    }
    return true;
  };

  // ── BUSBAR: alur khusus 3-4 tahap berurutan (FABRIKASI->PLATING->[HEATSHRINK->]PASANG) ──
  // Semua tahap (4/3) berdiri sendiri-sendiri, gak ada lagi konsep "tahap aktif" - operator
  // bebas kerjakan tahap manapun kapan saja, gak ada urutan/estafet wajib.
  const getBusbarTahapState=(cl:any,kode:string)=>{
    const urutan=getUrutanTahapBusbar(kode);
    const fresh:any={};
    urutan.forEach((t:string)=>{fresh[t]=cl?.busbarTahap?.[t]||{progress:0,sudahDisimpan100:false};});
    return fresh;
  };
  // Update progress tahap AKTIF secara live (tiap klik PCT_STEPS) - langsung ke-refleksi ke
  // progress.BUSBAR gabungan juga, tapi belum bikin checkpoint log / pindah tahap (itu baru
  // kejadian pas "Simpan Progress" diklik).
  const updatePctManualBusbarTahap=async(panelId:number,kode:string,tahap:string,pct:number)=>{
    const panel=panelsMap[panelId];
    if(!panel)return;
    const cl=panel.checklist?.[kode]||{qty:0,qtyProses:{},progress:{},progressByDate:{}};
    const urutan=getUrutanTahapBusbar(kode);
    const busbarTahapState=getBusbarTahapState(cl,kode);
    const newBusbarTahap={...busbarTahapState,[tahap]:{...busbarTahapState[tahap],progress:pct}};
    const combined=hitungProgressBusbarGabungan(newBusbarTahap,urutan);
    const newChecklist={
      ...panel.checklist,
      [kode]:{
        ...cl,
        busbarTahap:newBusbarTahap,
        progressByDate:{...(cl.progressByDate||{}),BUSBAR:{...((cl.progressByDate||{}).BUSBAR||{}),[viewDate]:combined}},
        progress:{...(cl.progress||{}),BUSBAR:combined},
      }
    };
    setPanelsMap(prev=>({...prev,[panelId]:{...panel,checklist:newChecklist}}));
    await supabase.from("panels").update({checklist:newChecklist}).eq("id",panelId);
  };
  const canSimpanBusbarTahap=(task:any,panelId:number,kode:string,tahap:string):boolean=>{
    const ids=(task?.pekerja_per_komponen||{})[kode]?.[tahap]||[];
    if(ids.length===0)return false;
    return ids.some((pid:number)=>!!timerAktif[timerKey(panelId,kode,"BUSBAR",pid,tahap)]||!!timerSelesaiHariIni[timerKey(panelId,kode,"BUSBAR",pid,tahap)]);
  };
  // Simpan Progress SATU tahap tertentu (dipilih eksplisit lewat parameter tahap) - gak ada
  // lagi auto-pindah/estafet, tiap tahap berdiri sendiri dan bisa disimpan kapan saja.
  const simpanProgressTahapBusbar=async(panelId:number,kode:string,tahap:string):Promise<boolean>=>{
    const panel=panelsMap[panelId];
    if(!panel)return false;
    const task=todayTasks.find((t:any)=>(t.panel_id||t.panelId)===panelId&&t.proses==="BUSBAR"&&(t.komponen||[]).includes(kode));
    if(!task)return false;
    const cl=panel.checklist?.[kode];
    if(!cl)return false;
    const urutan=getUrutanTahapBusbar(kode);
    const busbarTahapState=getBusbarTahapState(cl,kode);
    if(!canSimpanBusbarTahap(task,panelId,kode,tahap)){
      alert('Belum bisa disimpan - pastikan operator sudah dipilih dan timer sudah pernah dijalankan buat tahap ini.');
      return false;
    }
    const pctTahap=busbarTahapState[tahap]?.progress||0;
    if(pctTahap===0){alert('Progress tahap ini masih 0%, belum ada yang bisa disimpan.');return false;}

    const newBusbarTahap={
      ...busbarTahapState,
      [tahap]:{...busbarTahapState[tahap],progress:pctTahap,sudahDisimpan100:pctTahap>=100},
    };
    const combined=hitungProgressBusbarGabungan(newBusbarTahap,urutan);

    const prevHist=cl.history?.BUSBAR||[];
    const existIdx=prevHist.findIndex((h:any)=>h.tanggal===viewDate&&String(h.shift)===String(shift));
    const idsKomp=(task.pekerja_per_komponen||{})[kode]?.[tahap]||[];
    const workerObjs=idsKomp.map((wid:number)=>pekerjaList.find((p:any)=>p.id===wid)).filter(Boolean);
    const pekerjaNamaLog=workerObjs.length>0?workerObjs.map((w:any)=>w.nama).join(', '):user.nama;
    const checkpointEntry={panel_id:panelId,kode_komponen:kode,proses:"BUSBAR",checkpoint:combined,pekerja_nama:pekerjaNamaLog,tanggal:viewDate};

    const newChecklist={...panel.checklist};
    const patchBase={busbarTahap:newBusbarTahap,progress:{...(cl.progress||{}),BUSBAR:combined},progressByDate:{...(cl.progressByDate||{}),BUSBAR:{...((cl.progressByDate||{}).BUSBAR||{}),[viewDate]:combined}}};
    if(existIdx>=0){
      const updatedHist=[...prevHist];
      updatedHist[existIdx]={...updatedHist[existIdx],pct:combined,ts:new Date().toISOString()};
      newChecklist[kode]={...cl,...patchBase,history:{...(cl.history||{}),BUSBAR:updatedHist}};
    } else {
      const newEntry={pct:combined,tanggal:viewDate,shift,ts:new Date().toISOString()};
      newChecklist[kode]={...cl,...patchBase,history:{...(cl.history||{}),BUSBAR:[...prevHist,newEntry]}};
    }

    await supabase.from('progress_checkpoint_log').insert([checkpointEntry]);
    await supabase.from('panels').update({checklist:newChecklist}).eq('id',panelId);
    setPanelsMap((prev:any)=>({...prev,[panelId]:{...panel,checklist:newChecklist}}));
    return true;
  };

  // Khusus POTONG: simpan checkpoint progress buat SEMUA komponen terkumpul sekaligus
  // (skip yang masih 0% - biar gak keluar alert berulang per baris).
  const lockBulkKomponen=async(proses:string,rows:any[])=>{
    const eligible=rows.filter((r:any)=>r.pct>0);
    if(eligible.length===0){alert("Belum ada progress yang bisa disimpan.");return;}
    for(const r of eligible){
      await lockSingleKomponen(r.panelId,r.kode,proses);
    }
  };

  const lockProgress=async()=>{
    let count=0;
    const newLocked={...lockedCells};
    const checkpointLogEntries:any[]=[];

    for(const [panelId,panel] of Object.entries(panelsMap)){
      const relatedTasks=todayTasks.filter((t:any)=>(t.panel_id||t.panelId)===Number(panelId));
      if(!relatedTasks.length)continue;
      const newChecklist={...panel.checklist};
      const processed=new Set();

      relatedTasks.forEach((task:any)=>{
        (task.komponen||[]).forEach((kode:string)=>{
          const cl=newChecklist[kode];
          if(!cl||cl.qty===0)return;
          myProses.forEach(pr=>{
            if(task.proses!==pr)return;
            const cellKey=`${kode}_${pr}`;
            if(processed.has(cellKey))return;
            if(!canLockKomponen(task,kode,Number(panelId),pr))return;
            const pct=getProgressOnDate(cl,pr,viewDate);
            if(pct===0)return;
            const prevHist=cl.history?.[pr]||[];
            const existIdx=prevHist.findIndex((h:any)=>h.tanggal===viewDate&&String(h.shift)===String(shift));
            if(existIdx>=0){
              if(prevHist[existIdx].pct!==pct){
                const updatedHist=[...prevHist];
                updatedHist[existIdx]={...updatedHist[existIdx],pct,ts:new Date().toISOString()};
                newChecklist[kode]={...cl,history:{...(cl.history||{}),[pr]:updatedHist}};
                const idsKomp=(task.pekerja_per_komponen||{})[kode]||[];
                const workerObjs=idsKomp.map((wid:number)=>pekerjaList.find((p:any)=>p.id===wid)).filter(Boolean);
                const pekerjaNamaLog=workerObjs.length>0?workerObjs.map((w:any)=>w.nama).join(", "):user.nama;
                checkpointLogEntries.push({
                  panel_id:Number(panelId),
                  kode_komponen:kode,
                  proses:pr,
                  checkpoint:pct,
                  pekerja_nama:pekerjaNamaLog,
                  tanggal:viewDate,
                });
              }
              processed.add(cellKey);
              return;
            }
            const newEntry={pct,tanggal:viewDate,shift,ts:new Date().toISOString()};
            newChecklist[kode]={
              ...cl,
              history:{...(cl.history||{}),[pr]:[...prevHist,newEntry]}
            };
            newLocked[`${panelId}_${kode}_${pr}_${viewDate}_${shift}`]=true;
            processed.add(cellKey);
            count++;
            {
              const idsKomp=(task.pekerja_per_komponen||{})[kode]||[];
              const workerObjs=idsKomp.map((wid:number)=>pekerjaList.find((p:any)=>p.id===wid)).filter(Boolean);
              const pekerjaNamaLog=workerObjs.length>0?workerObjs.map((w:any)=>w.nama).join(", "):user.nama;
              checkpointLogEntries.push({
                panel_id:Number(panelId),
                kode_komponen:kode,
                proses:pr,
                checkpoint:pct,
                pekerja_nama:pekerjaNamaLog,
                tanggal:viewDate,
              });
            }
          });
        });
      });

      // simpan ke Supabase - termasuk busbar_progress
      const busbarTasks=relatedTasks.filter((t:any)=>t.proses==="BUSBAR");
      let busbarProgressUpdate:any=null;
      if(busbarTasks.length>0){
        const newBusbarProgress={...(panel.busbar_progress||{})};
        busbarTasks.forEach((t:any)=>{
          (t.komponen||[]).forEach((komp:string)=>{
            // Progress busbar disimpan di checklist dengan key nama komponen
            const cl=newChecklist[komp]||panel.checklist?.[komp];
            const pct=cl?.progress?.["BUSBAR"]||getProgressOnDate(cl,"BUSBAR",viewDate)||0;
            newBusbarProgress[komp]=pct;
          });
        });
        busbarProgressUpdate=newBusbarProgress;
      }
      await supabase.from("panels").update({
        checklist:newChecklist,
        ...(busbarProgressUpdate?{busbar_progress:busbarProgressUpdate}:{})
      }).eq("id",Number(panelId));
      setPanelsMap(prev=>({...prev,[panelId]:{...panel,checklist:newChecklist,
        ...(busbarProgressUpdate?{busbar_progress:busbarProgressUpdate}:{})}}));

      // Bersihkan komponen yang sudah 100% selesai dari SEMUA tanggal di raw_schedule (khusus WIRING CONTROL/POWER)
      for(const proses of myProses){
        if(proses!=="WIRING CONTROL"&&proses!=="WIRING POWER")continue;
        const komponenSelesai=Object.keys(newChecklist).filter(kode=>
          (newChecklist[kode]?.progress?.[proses]||0)>=100
        );
        if(komponenSelesai.length===0)continue;
        const{data:rawRows}=await supabase.from("raw_schedule").select("id,schedule").eq("panel_id",Number(panelId)).eq("proses",proses);
        for(const row of rawRows||[]){
          let berubah=false;
          const newSchedule:any={};
          for(const[tglKey,entries] of Object.entries(row.schedule||{}) as [string,any[]][]){
            const newEntries=entries.map((entry:any)=>{
              const filteredKomp=(entry.komponen||[]).filter((k:string)=>!komponenSelesai.includes(k));
              if(filteredKomp.length!==(entry.komponen||[]).length)berubah=true;
              return{...entry,komponen:filteredKomp};
            }).filter((entry:any)=>(entry.komponen||[]).length>0);
            if(newEntries.length>0)newSchedule[tglKey]=newEntries;
          }
          if(berubah){
            await supabase.from("raw_schedule").update({schedule:newSchedule}).eq("id",row.id);
          }
        }
      }
    }

    // simpan checkpoint log - siapa nyampein checkpoint berapa, buat riwayat kontribusi per operator
    if(checkpointLogEntries.length>0){
      await supabase.from("progress_checkpoint_log").insert(checkpointLogEntries);
    }

    // simpan catatan ke tabel kendala - 1 baris per (proses, panel) supaya bisa dikelompokkan per proyek/panel
    // Cek dulu kendala yang sudah ada hari ini biar gak dobel kalau isinya sama pas dikunci ulang
    const { data: existingKendalaHariIni } = await supabase.from("kendala")
      .select("proses,panel_id,catatan")
      .eq("tanggal",viewDate)
      .eq("operator",user.nama);
    const existingKendalaMap=new Map();
    (existingKendalaHariIni||[]).forEach((e:any)=>{
      existingKendalaMap.set(e.proses+"|"+e.panel_id,e.catatan);
    });

    const kendalaLogged=new Set();
    for(const task of todayTasks){
      const proses=task.proses;
      if(!catatan[proses]?.trim())continue;
      const panelIdTask=task.panel_id||task.panelId;
      const comboKey=proses+"|"+panelIdTask;
      if(kendalaLogged.has(comboKey))continue;
      kendalaLogged.add(comboKey);
      const catatanTrim=catatan[proses].trim();
      if(existingKendalaMap.get(comboKey)===catatanTrim)continue;
      await supabase.from("kendala").insert({
        divisi:user.divisi,
        divisi_label:cfg.label,
        tanggal:viewDate,
        proses,
        catatan:catatanTrim,
        operator:user.nama,
        ts:new Date().toISOString(),
        proyek:task.proyek||null,
        panel:task.panel||null,
        panel_id:panelIdTask||null,
      });
    }

    // Hitung busbar tasks juga
    const busbarCount=todayTasks.filter((t:any)=>t.proses==="BUSBAR").length;
    if(count>0||busbarCount>0||Object.keys(catatan).some(k=>catatan[k]?.trim())){
      setLockedCells(newLocked);
      setLockMsg(true);
      setTimeout(()=>setLockMsg(false),2500);
    }
    // Selalu set pernahDikunci=true setiap kali tombol diklik (terlepas ada perubahan atau tidak)
    setPernahDikunci(true);
  };

  const thS:any={background:"#1e3a8a",color:"#fff",padding:"7px 8px",fontWeight:700,fontSize:10,
    whiteSpace:"nowrap",letterSpacing:.3,textAlign:"center",borderRight:"1px solid #ffffff15",
    position:"sticky",top:0,zIndex:3};

  // ── Setup shift screen ──
  if(!shiftSet){
    return(
      <div style={{padding:20,maxWidth:480,margin:"0 auto"}} className="fi">
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:24}}>
          <div style={{width:48,height:48,borderRadius:12,background:cfg.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>{cfg.icon}</div>
          <div>
            <div style={{fontWeight:800,fontSize:17,color:"#1e293b"}}>{cfg.label}</div>
            <div style={{fontSize:12,color:"#64748b"}}>Setup sesi kerja hari ini</div>
          </div>
        </div>
        <Card>
          <div style={{marginBottom:16}}>
            <Lbl>Tanggal</Lbl>
            <Inp type="date" value={viewDate} onChange={(e:any)=>setViewDate(e.target.value)}/>
          </div>
          <div style={{marginBottom:16}}>
            <Lbl>Shift</Lbl>
            <div style={{display:"flex",gap:10}}>
              {["1","2"].map(s=>(
                <button key={s} onClick={()=>setShift(s)}
                  style={{flex:1,padding:"12px",borderRadius:10,border:`2px solid ${shift===s?cfg.color:"#e2e8f0"}`,
                    background:shift===s?cfg.color+"18":"#f8fafc",color:shift===s?cfg.color:"#64748b",
                    cursor:"pointer",fontWeight:800,fontSize:16,transition:"all .15s"}}>
                  Shift {s}
                </button>
              ))}
            </div>
          </div>
          <Btn color={cfg.color} style={{width:"100%",padding:13,fontSize:15}} onClick={()=>setShiftSet(true)}>
            Mulai Kerja →
          </Btn>
        </Card>
      </div>
    );
  }

  // ── No tasks ──
  if(loadingData){
    return(
      <div style={{padding:40,textAlign:"center",color:"#64748b"}}>
        <div style={{fontSize:24,marginBottom:8}}>⏳</div>
        <div style={{fontWeight:600}}>Memuat data...</div>
      </div>
    );
  }

  if(todayTasks.length===0){
    return(
      <div style={{padding:16,maxWidth:520,margin:"0 auto"}} className="fi">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:36,height:36,borderRadius:10,background:cfg.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{cfg.icon}</div>
            <div>
              <div style={{fontWeight:700,fontSize:14,color:"#1e293b"}}>{user.nama} — Shift {shift}</div>
              <div style={{fontSize:11,color:"#64748b"}}>{fmtDate(viewDate)}</div>
            </div>
          </div>
          <button onClick={()=>setShiftSet(false)}
            style={{fontSize:11,color:"#94a3b8",background:"none",border:"1px solid #e2e8f0",borderRadius:6,padding:"4px 10px",cursor:"pointer"}}>
            Ganti Shift
          </button>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:20,background:"#fff",borderRadius:12,padding:"10px 14px",border:"1.5px solid #e2e8f0"}}>
          <button onClick={()=>setViewDate(addDays(viewDate,-1))} style={{width:34,height:34,borderRadius:8,border:"1px solid #e2e8f0",background:"#f8fafc",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",color:"#475569"}}>‹</button>
          <div style={{flex:1,textAlign:"center"}}>
            <div style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>{fmtDate(viewDate)}</div>
            {viewDate===TODAY&&<div style={{fontSize:11,color:"#2563eb",fontWeight:600}}>Hari Ini</div>}
          </div>
          <button onClick={()=>setViewDate(addDays(viewDate,1))} style={{width:34,height:34,borderRadius:8,border:"1px solid #e2e8f0",background:"#f8fafc",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",color:"#475569"}}>›</button>
        </div>
        <div style={{textAlign:"center",padding:"40px 20px"}}>
          <div style={{fontSize:40,marginBottom:10}}>📋</div>
          <div style={{fontWeight:700,fontSize:15,color:"#1e293b",marginBottom:6}}>Tidak ada jadwal</div>
          <div style={{fontSize:13,color:"#94a3b8",marginBottom:16}}>Belum ada rencana kerja untuk tanggal ini</div>
        </div>
      </div>
    );
  }

  // ── Main tabel ──
  return(
    <div style={{padding:16}} className="fi">
      {/* header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:40,height:40,borderRadius:10,background:cfg.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{cfg.icon}</div>
          <div>
            <div style={{fontWeight:800,fontSize:15,color:"#1e293b"}}>{cfg.label} — {fmtDate(viewDate)}</div>
            <div style={{fontSize:12,color:"#64748b"}}>Shift {shift} · {todayTasks.length} tugas</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:4,background:"#fff",borderRadius:8,padding:"4px 8px",border:"1px solid #e2e8f0"}}>
            <button onClick={()=>setViewDate(addDays(viewDate,-1))} style={{width:26,height:26,borderRadius:6,border:"none",background:"#f8fafc",cursor:"pointer",fontSize:14,color:"#475569"}}>‹</button>
            <span style={{fontSize:11,fontWeight:600,color:"#475569",padding:"0 4px"}}>{fmtShort(viewDate)}</span>
            <button onClick={()=>setViewDate(addDays(viewDate,1))} style={{width:26,height:26,borderRadius:6,border:"none",background:"#f8fafc",cursor:"pointer",fontSize:14,color:"#475569"}}>›</button>
          </div>
          <button onClick={()=>setShiftSet(false)}
            style={{fontSize:11,color:"#94a3b8",background:"none",border:"1px solid #e2e8f0",borderRadius:6,padding:"5px 10px",cursor:"pointer"}}>
            Ganti Shift
          </button>
        </div>
      </div>

      <WoUrgentBanner/>

      {/* stats per proses */}
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        {myProses.map(pr=>{
          const tasks=tasksByProses[pr]||[];
          if(!tasks.length)return null;
          const totalKomp=tasks.reduce((a:number,t:any)=>{
            const panel=panelsMap[t.panel_id||t.panelId];
            return a+(t.komponen||[]).filter((k:string)=>(panel?.checklist?.[k]?.qty||0)>0).length;
          },0);
          const doneKomp=tasks.reduce((a:number,t:any)=>{
            const panel=panelsMap[t.panel_id||t.panelId];
            return a+(t.komponen||[]).filter((k:string)=>getLatestProgress(panel?.checklist?.[k],pr)>=100).length;
          },0);
          const pc=PROSES_COLOR[pr]||"#64748b";
          return(
            <div key={pr} style={{background:"#fff",borderRadius:8,padding:"6px 12px",border:`1.5px solid ${pc}30`,
              borderLeft:`3px solid ${pc}`,display:"flex",gap:8,alignItems:"center"}}>
              <span style={{fontSize:11,fontWeight:700,color:pc}}>{pr}</span>
              <span style={{fontSize:11,color:"#94a3b8"}}>{doneKomp}/{totalKomp} komponen</span>
            </div>
          );
        })}
      </div>

      {/* filter */}
      {(proyekList.length>1||panelList.length>1)&&(
        <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center",
          background:"#fff",borderRadius:10,padding:"8px 12px",border:"1px solid #e2e8f0"}}>
          <span style={{fontSize:11,color:"#94a3b8",fontWeight:600}}>Filter:</span>
          {proyekList.length>1&&(
            <select value={fProyek} onChange={e=>{setFProyek(e.target.value);setFPanel("ALL");}}
              style={{padding:"4px 10px",borderRadius:8,border:"1.5px solid #e2e8f0",
                background:"#f8fafc",fontSize:11,fontWeight:600,color:"#475569",cursor:"pointer"}}>
              <option value="ALL">Semua Proyek</option>
              {proyekList.map((p:any)=><option key={p} value={p}>{p}</option>)}
            </select>
          )}
          {panelList.length>1&&(
            <select value={fPanel} onChange={e=>setFPanel(e.target.value)}
              style={{padding:"4px 10px",borderRadius:8,border:"1.5px solid #e2e8f0",
                background:"#f8fafc",fontSize:11,fontWeight:600,color:"#475569",cursor:"pointer",maxWidth:220}}>
              <option value="ALL">Semua Panel</option>
              {panelList.map((p:any)=><option key={p} value={p}>{p}</option>)}
            </select>
          )}
          {(fProyek!=="ALL"||fPanel!=="ALL")&&(
            <button onClick={()=>{setFProyek("ALL");setFPanel("ALL");}}
              style={{padding:"4px 10px",borderRadius:8,border:"1px solid #fecaca",
                background:"#fef2f2",color:"#dc2626",fontSize:11,fontWeight:600,cursor:"pointer"}}>
              ✕ Reset
            </button>
          )}
        </div>
      )}

      {/* tabel per proses */}
      {myProses.map(proses=>{
        const tasks=tasksByProses[proses]||[];
        if(!tasks.length)return null;
        const pc=PROSES_COLOR[proses]||"#64748b";

        const rows:any[]=[];
        // Safety-net: kalau ada 2 renhar row yang kebetulan sama-sama punya kode komponen yang
        // sama buat panel+proses ini (mis. bug dobel-insert lama, atau data yang belum sempat
        // dibersihin), jangan sampai nongol jadi 2 row/card - ambil yang pertama ketemu aja.
        const seenRowKeys=new Set<string>();
        tasks.forEach((task:any)=>{
          const panelId=task.panel_id||task.panelId;
          const panel=panelsMap[panelId];
          if(!panel)return;
          const panelCfg=getEffCfg(panel.tipe);
          if(!panelCfg)return;
          const allItems=panelCfg.wps.flatMap((w:any)=>w.items);
          const priColor=PRIORITAS_COLOR[task.prioritas||"Sedang"]||"#64748b";

          (task.komponen||[]).forEach((kode:string,ki:number)=>{
            // Handle token wiring khusus: __wiring_{org}org_{bobot}
            if(kode.startsWith("__wiring_")){
              // Token wiring cuma buat ekstrak badge bobot/jumlah orang (via wiringInfoMap di row komponen real).
              // Gak bikin baris sendiri lagi - komponen real di bawah yang jadi baris (per-komponen tracking).
              return;
            }
            const rowKey=`${panelId}_${kode}`;
            if(seenRowKeys.has(rowKey))return;
            seenRowKeys.add(rowKey);
            const isBusbarKomp=proses==="BUSBAR";
            const item=allItems.find((it:any)=>it.kode===kode);
            // Untuk BUSBAR, komponen adalah nama langsung (H-BUS, INCOMING, dll)
            if(!item&&!isBusbarKomp)return;
            const busbarItem=isBusbarKomp?{kode,nama:kode}:null;
            const cl=panel.checklist?.[kode]||{qty:0,qtyProses:{},progress:{},progressByDate:{},qtyProsesByDate:{}};
            const qtyKomp=isBusbarKomp?0:cl.qty||0;
            const qtyProses=isBusbarKomp?0:cl.qtyProsesByDate?.[proses]?.[viewDate]??cl.qtyProses?.[proses]??0;
            const pct=isBusbarKomp?(cl.progress?.[proses]||0):getProgressOnDate(cl,proses,viewDate);
            const wpDef=isBusbarKomp?null:panelCfg.wps.find((w:any)=>w.items.some((it:any)=>it.kode===kode));
            const wInfoLookup=wiringInfoMap[`${panelId}_${proses}`];
            const wiringBadge=wInfoLookup&&wInfoLookup.bobot?wInfoLookup:null;
            // Sudah disimpan (klik "Simpan Progress") hari ini dengan pct 100 - bukan cuma qty kebetulan penuh.
            const sudahDisimpan100=(cl.history?.[proses]||[]).some((h:any)=>h.tanggal===viewDate&&h.pct===100);
            // Timer pernah dimulai (walau udah di-stop lagi) - buat gating input qty di POTONG/BENDING/STEL/FINISHING.
            const idsKompRow=getFlatOperatorIds(task,kode);
            const sudahPernahMulai=idsKompRow.some((pid:number)=>!!timerPernahMulai[`${panelId}_${kode}_${proses}_${pid}`]);
            rows.push({task,panel,panelId,item:item||busbarItem,kode,qtyKomp,qtyProses,pct,priColor,ki,wpDef,
              isFirst:ki===0,rowCount:(task.komponen||[]).length,isBusbar:isBusbarKomp,
              aktualSelesai:getFirstCompletionDate(cl,proses),wiringBadge,sudahDisimpan100,sudahPernahMulai});
          });
        });

        const isDone=(r:any)=>r.pct===100;
        const isDrilldownProses=["WIRING CONTROL","WIRING POWER","BUSBAR"].includes(proses);
        const PROSES_KUMPUL_DULU_DESKTOP=["POTONG","RENDAM","PAINTING"];
        // Mobile: titik awal pilih komponen dibalik jadi Jenis Komponen -> Panel buat proses ini.
        const PROSES_PILIH_PER_KOMPONEN=["BENDING","STEL","FINISHING","RENDAM","PAINTING","BUSBAR","RAKIT","PASANG KOMPONEN"];
        const visibleRows=(isDrilldownProses||viewMode==='mobile'||PROSES_KUMPUL_DULU_DESKTOP.includes(proses))?rows.filter((r:any)=>(selectedKomponen[`${proses}_${r.panelId}`]||[]).includes(r.kode)):rows;
      const isWiringProses=["WIRING CONTROL","WIRING POWER"].includes(proses);
      // Proses yang operatornya dipilih per-kartu individual (bukan bulk satu grup sekaligus) -
      // WIRING udah dari revisi sebelumnya, RAKIT/PASANG KOMPONEN nyusul sekarang. Dipisah dari
      // isWiringProses karena itu masih dipakai buat hal lain yang genuinely wiring-only
      // (badge bobot/jumlah orang, gating PCT_STEPS desktop) yang gak boleh ikut kena.
      const operatorPerKartu=isWiringProses||proses==="RAKIT"||proses==="PASANG KOMPONEN";
      // Pasang Komponen khusus Assembling Luar pakai mode persentase-check (25/50/75/100),
      // bukan input qty - scoped ke sub_bagian ini aja, gak ganggu proses lain atau
      // sub-bagian lain kalau nanti PASANG KOMPONEN di-assign ke tempat lain juga.
      const cardMode=(proses==="PASANG KOMPONEN"&&user.sub_bagian==="Assembling Luar")?'pct':(PROSES_CARD_MODE[proses]||'qty');

        return(
          <Card key={proses} style={{marginBottom:20,padding:0,overflow:"hidden"}}>
            <div style={{background:pc,padding:"10px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontWeight:800,fontSize:14,color:"#fff"}}>{proses}</div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <span style={{fontSize:12,color:"#ffffff99"}}>Shift {shift}</span>
                <span style={{background:"#ffffff22",color:"#fff",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>
                  {visibleRows.filter((r:any)=>isDone(r)).length}/{visibleRows.length} selesai
                </span>
              </div>
            </div>
            {(isDrilldownProses||viewMode==='mobile'||PROSES_KUMPUL_DULU_DESKTOP.includes(proses))&&(
              viewMode==='mobile'&&PROSES_PILIH_PER_KOMPONEN.includes(proses)?(
              <div style={{display:"flex",flexWrap:"wrap",gap:8,padding:"10px 16px",background:"#f8fafc",borderBottom:"1px solid #f1f5f9"}}>
                {(()=>{
                  const seenNama=new Set();
                  const jenisList:any[]=[];
                  rows.forEach((r:any)=>{
                    const nama=r.item?.nama||r.kode;
                    if(!seenNama.has(nama)){
                      seenNama.add(nama);
                      jenisList.push({namaKomponen:nama});
                    }
                  });
                  return jenisList.map((jg:any)=>{
                    const groupRows=rows.filter((r:any)=>(r.item?.nama||r.kode)===jg.namaKomponen);
                    const panelCount=new Set(groupRows.map((r:any)=>r.panelId)).size;
                    const selRows=groupRows.filter((r:any)=>(selectedKomponen[`${proses}_${r.panelId}`]||[]).includes(r.kode));
                    const selCount=selRows.length;
                    const belumDikerjakanCount=selRows.filter((r:any)=>(r.pct||0)===0).length;
                    const dikerjakanRows=selRows.filter((r:any)=>(r.pct||0)>0&&(r.pct||0)<100);
                    const dikerjakanCount=dikerjakanRows.length;
                    const dikerjakanPcs=dikerjakanRows.reduce((s:number,r:any)=>s+(r.qtyProses||0),0);
                    const selesaiCount=selRows.filter((r:any)=>(r.pct||0)>=100).length;
                    // Sama kayak panelSudahTuntas versi lama, cuma sekarang di-agregat per jenis komponen.
                    const groupAllRows=groupRows.filter((r:any)=>r.qtyKomp>0);
                    const groupSudahTuntas=groupAllRows.length>0&&groupAllRows.every((r:any)=>r.pct===100&&r.sudahDisimpan100);
                    return(
                      <button key={jg.namaKomponen} disabled={groupSudahTuntas}
                        onClick={()=>{setKomponenPopupJenis({proses,namaKomponen:jg.namaKomponen});setTempSelectedPanelJenis(selRows.map((r:any)=>r.panelId));}}
                        style={{display:"flex",flexDirection:"column",alignItems:"flex-start",gap:2,
                          padding:"6px 12px",borderRadius:8,border:groupSudahTuntas?"1px solid #e2e8f0":selCount>0?"1.5px solid #6366f1":"1px solid #e2e8f0",
                          background:groupSudahTuntas?"#f8fafc":selCount>0?"#eef2ff":"#fff",
                          cursor:groupSudahTuntas?"not-allowed":"pointer",textAlign:"left",opacity:groupSudahTuntas?0.5:1}}>
                        <span style={{fontSize:9,color:"#94a3b8"}}>{panelCount} panel</span>
                        <span style={{fontSize:12,fontWeight:700,color:"#1e293b"}}>{jg.namaKomponen}</span>
                        {groupSudahTuntas?(
                          <span style={{fontSize:9,color:"#16a34a",fontWeight:600}}>✅ Selesai semua</span>
                        ):selCount>0?(
                          <span style={{fontSize:9,color:"#4f46e5",fontWeight:600,display:"flex",gap:6,flexWrap:"wrap" as const}}>
                            {belumDikerjakanCount>0&&<span>{belumDikerjakanCount} belum</span>}
                            {dikerjakanCount>0&&<span>{dikerjakanCount} dikerjakan{dikerjakanPcs>0?` (${dikerjakanPcs}pcs)`:""}</span>}
                            {selesaiCount>0&&<span style={{color:"#16a34a"}}>{selesaiCount} selesai</span>}
                          </span>
                        ):(
                          <span style={{fontSize:9,color:"#94a3b8",fontWeight:600}}>+ Pilih Panel</span>
                        )}
                      </button>
                    );
                  });
                })()}
              </div>
              ):(
              <div style={{display:"flex",flexWrap:"wrap",gap:8,padding:"10px 16px",background:"#f8fafc",borderBottom:"1px solid #f1f5f9"}}>
                {(()=>{
                  const seenPanel=new Set();
                  const panelList:any[]=[];
                  rows.forEach((r:any)=>{
                    if(!seenPanel.has(r.panelId)){
                      seenPanel.add(r.panelId);
                      panelList.push({panelId:r.panelId,panel:r.panel,proyek:r.task.proyek});
                    }
                  });
                  return panelList.map((pg:any)=>{
                    const panelKey=`${proses}_${pg.panelId}`;
                    const selKodeList=selectedKomponen[panelKey]||[];
                    const selCount=selKodeList.length;
                    const selRows=rows.filter((r:any)=>r.panelId===pg.panelId&&selKodeList.includes(r.kode));
                    const belumDikerjakanCount=selRows.filter((r:any)=>(r.pct||0)===0).length;
                    const dikerjakanRows=selRows.filter((r:any)=>(r.pct||0)>0&&(r.pct||0)<100);
                    const dikerjakanCount=dikerjakanRows.length;
                    const dikerjakanPcs=dikerjakanRows.reduce((s:number,r:any)=>s+(r.qtyProses||0),0);
                    const selesaiCount=selRows.filter((r:any)=>(r.pct||0)>=100).length;
                    // Panel di-disable kalau SEMUA komponen relevannya (qtyKomp>0) di proses ini
                    // udah 100% DAN sudah disimpan - gak ada kerjaan tersisa. Berlaku semua
                    // proses yang make popup ini (dulu cuma POTONG/BENDING/STEL, proses lain
                    // yang lewat sini - RAKIT/PASANG KOMPONEN/WIRING CONTROL/WIRING POWER/BUSBAR -
                    // gak pernah dapet efek ini).
                    const panelAllRows=rows.filter((r:any)=>r.panelId===pg.panelId&&r.qtyKomp>0);
                    const panelSudahTuntas=panelAllRows.length>0&&panelAllRows.every((r:any)=>r.pct===100&&r.sudahDisimpan100);
                    return(
                      <button key={pg.panelId} disabled={panelSudahTuntas}
                        onClick={()=>{setKomponenPopup({proses,panelId:pg.panelId});setTempSelectedKomponen(selectedKomponen[panelKey]||[]);}}
                        style={{display:"flex",flexDirection:"column",alignItems:"flex-start",gap:2,
                          padding:"6px 12px",borderRadius:8,border:panelSudahTuntas?"1px solid #e2e8f0":selCount>0?"1.5px solid #6366f1":"1px solid #e2e8f0",
                          background:panelSudahTuntas?"#f8fafc":selCount>0?"#eef2ff":"#fff",
                          cursor:panelSudahTuntas?"not-allowed":"pointer",textAlign:"left",opacity:panelSudahTuntas?0.5:1}}>
                        <span style={{fontSize:9,color:"#94a3b8"}}>{pg.proyek}</span>
                        <span style={{fontSize:12,fontWeight:700,color:"#1e293b"}}>{pg.panel.nama}</span>
                        {panelSudahTuntas?(
                          <span style={{fontSize:9,color:"#16a34a",fontWeight:600}}>✅ Selesai semua</span>
                        ):selCount>0?(
                          <span style={{fontSize:9,color:"#4f46e5",fontWeight:600,display:"flex",gap:6,flexWrap:"wrap" as const}}>
                            {belumDikerjakanCount>0&&<span>{belumDikerjakanCount} belum</span>}
                            {dikerjakanCount>0&&<span>{dikerjakanCount} dikerjakan{dikerjakanPcs>0?` (${dikerjakanPcs}pcs)`:""}</span>}
                            {selesaiCount>0&&<span style={{color:"#16a34a"}}>{selesaiCount} selesai</span>}
                          </span>
                        ):(
                          <span style={{fontSize:9,color:"#94a3b8",fontWeight:600}}>+ Pilih Komponen</span>
                        )}
                      </button>
                    );
                  });
                })()}
              </div>
              )
            )}
            {komponenPopup&&komponenPopup.proses===proses&&(()=>{
              const panelRows=rows.filter((r:any)=>r.panelId===komponenPopup.panelId);
              const panelInfo=panelRows[0];
              return(
                <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:16}}
                  onClick={()=>setKomponenPopup(null)}>
                  <div onClick={(e:any)=>e.stopPropagation()} style={{background:"#fff",borderRadius:12,width:"100%",maxWidth:400,maxHeight:"80vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>
                    <div style={{padding:"14px 16px",borderBottom:"1px solid #f1f5f9"}}>
                      <div style={{fontSize:11,color:"#94a3b8"}}>{panelInfo?.task.proyek}</div>
                      <div style={{fontSize:15,fontWeight:700,color:"#1e293b"}}>{panelInfo?.panel.nama}</div>
                      <div style={{fontSize:11,color:"#64748b",marginTop:4}}>Pilih komponen yang mau dikerjakan</div>
                    </div>
                    <div style={{overflowY:"auto",padding:"8px 16px",flex:1}}>
                      {panelRows.map((r:any)=>{
                        const checked=tempSelectedKomponen.includes(r.kode);
                        const panelKeyPopup=`${proses}_${komponenPopup.panelId}`;
                        const alreadyConfirmed=(selectedKomponen[panelKeyPopup]||[]).includes(r.kode);
                        const sudahSelesai=(r.qtyKomp>0||r.isBusbar)&&r.pct===100&&r.sudahDisimpan100;
                        const isDisabled=alreadyConfirmed||sudahSelesai;
                        return(
                          <label key={r.kode} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 4px",borderBottom:"1px solid #f8fafc",
                            cursor:isDisabled?"not-allowed":"pointer",opacity:isDisabled?0.55:1}}>
                            <input type="checkbox" checked={checked} disabled={isDisabled}
                              onChange={()=>{
                                if(isDisabled)return;
                                setTempSelectedKomponen((prev:string[])=>checked?prev.filter(k=>k!==r.kode):[...prev,r.kode]);
                              }}
                              style={{width:16,height:16}}/>
                            <div style={{display:"flex",flexDirection:"column",gap:2,flex:1}}>
                              <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                                <span style={{fontSize:13,fontWeight:600,color:"#374151"}}>{renderNamaKomponen(r.item.nama)}</span>
                                {r.wiringBadge&&(
                                  <span style={{fontSize:9,fontWeight:700,background:"#eef2ff",color:"#4f46e5",borderRadius:6,padding:"1px 6px"}}>
                                    ⚡ {(r.wiringBadge.bobot||"").replace("_"," ")} · {r.wiringBadge.jumlahOrang||"–"}org
                                  </span>
                                )}
                                {isDisabled&&(()=>{
                                  const pct=r.pct||0;
                                  const statusBadgeLabel=pct>=100?"Selesai":pct>0?`Dikerjakan${r.qtyProses?` ${r.qtyProses}pcs`:""}`:"Belum";
                                  const statusBadgeColor=pct>=100?"#16a34a":pct>0?"#2563eb":"#94a3b8";
                                  const statusBadgeBg=pct>=100?"#dcfce7":pct>0?"#dbeafe":"#f1f5f9";
                                  return(
                                    <span style={{fontSize:9,fontWeight:700,background:statusBadgeBg,color:statusBadgeColor,borderRadius:6,padding:"1px 6px"}}>
                                      {statusBadgeLabel}
                                    </span>
                                  );
                                })()}
                              </div>
                              <span style={{fontSize:10,color:"#94a3b8",fontFamily:"'DM Mono',monospace"}}>{r.kode}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                    <div style={{display:"flex",gap:8,padding:"12px 16px",borderTop:"1px solid #f1f5f9"}}>
                      <button onClick={()=>setTempSelectedKomponen(panelRows.filter((r:any)=>{
                          const alreadyConfirmed=(selectedKomponen[`${proses}_${komponenPopup.panelId}`]||[]).includes(r.kode);
                          const sudahSelesai=(r.qtyKomp>0||r.isBusbar)&&r.pct===100&&r.sudahDisimpan100;
                          return !alreadyConfirmed&&!sudahSelesai;
                        }).map((r:any)=>r.kode))}
                        style={{fontSize:11,color:"#1d4ed8",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Pilih Semua</button>
                      <button onClick={()=>setTempSelectedKomponen([])}
                        style={{fontSize:11,color:"#dc2626",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Kosongkan</button>
                      <div style={{flex:1}}/>
                      <button onClick={()=>setKomponenPopup(null)}
                        style={{padding:"8px 14px",borderRadius:8,border:"1px solid #e2e8f0",background:"#fff",fontSize:12,fontWeight:600,color:"#64748b",cursor:"pointer"}}>Batal</button>
                      <button onClick={()=>{
                          const panelKeyKonfirmasi=`${proses}_${komponenPopup.panelId}`;
                          const prevSelected=selectedKomponen[panelKeyKonfirmasi]||[];
                          const newlyAdded=tempSelectedKomponen.filter(k=>!prevSelected.includes(k));
                          const targetKode=newlyAdded[0]||tempSelectedKomponen[0];
                          const targetRow=panelRows.find((r:any)=>r.kode===targetKode);
                          setSelectedKomponen((prev:any)=>({...prev,[panelKeyKonfirmasi]:tempSelectedKomponen}));
                          setKomponenPopup(null);
                          if(targetRow)scrollDanHighlightGroup(proses,targetRow.item?.nama||targetRow.kode);
                        }}
                        style={{padding:"8px 14px",borderRadius:8,border:"none",background:"#4f46e5",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer"}}>
                        Konfirmasi ({tempSelectedKomponen.length})
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
            {komponenPopupJenis&&komponenPopupJenis.proses===proses&&(()=>{
              const groupRows=rows.filter((r:any)=>(r.item?.nama||r.kode)===komponenPopupJenis.namaKomponen);
              return(
                <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:16}}
                  onClick={()=>setKomponenPopupJenis(null)}>
                  <div onClick={(e:any)=>e.stopPropagation()} style={{background:"#fff",borderRadius:12,width:"100%",maxWidth:400,maxHeight:"80vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>
                    <div style={{padding:"14px 16px",borderBottom:"1px solid #f1f5f9"}}>
                      <div style={{fontSize:15,fontWeight:700,color:"#1e293b"}}>{komponenPopupJenis.namaKomponen}</div>
                      <div style={{fontSize:11,color:"#64748b",marginTop:4}}>Pilih panel yang mau dikerjakan</div>
                    </div>
                    <div style={{overflowY:"auto",padding:"8px 16px",flex:1}}>
                      {groupRows.map((r:any)=>{
                        const checked=tempSelectedPanelJenis.includes(r.panelId);
                        const panelKeyPopup=`${proses}_${r.panelId}`;
                        const alreadyConfirmed=(selectedKomponen[panelKeyPopup]||[]).includes(r.kode);
                        const sudahSelesai=(r.qtyKomp>0||r.isBusbar)&&r.pct===100&&r.sudahDisimpan100;
                        const isDisabled=alreadyConfirmed||sudahSelesai;
                        return(
                          <label key={r.panelId} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 4px",borderBottom:"1px solid #f8fafc",
                            cursor:isDisabled?"not-allowed":"pointer",opacity:isDisabled?0.55:1}}>
                            <input type="checkbox" checked={checked} disabled={isDisabled}
                              onChange={()=>{
                                if(isDisabled)return;
                                setTempSelectedPanelJenis((prev:number[])=>checked?prev.filter(id=>id!==r.panelId):[...prev,r.panelId]);
                              }}
                              style={{width:16,height:16}}/>
                            <div style={{display:"flex",flexDirection:"column",gap:2,flex:1}}>
                              <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                                <span style={{fontSize:13,fontWeight:600,color:"#374151"}}>{r.panel.nama}</span>
                                {r.wiringBadge&&(
                                  <span style={{fontSize:9,fontWeight:700,background:"#eef2ff",color:"#4f46e5",borderRadius:6,padding:"1px 6px"}}>
                                    ⚡ {(r.wiringBadge.bobot||"").replace("_"," ")} · {r.wiringBadge.jumlahOrang||"–"}org
                                  </span>
                                )}
                                {isDisabled&&(()=>{
                                  const pct=r.pct||0;
                                  const statusBadgeLabel=pct>=100?"Selesai":pct>0?`Dikerjakan${r.qtyProses?` ${r.qtyProses}pcs`:""}`:"Belum";
                                  const statusBadgeColor=pct>=100?"#16a34a":pct>0?"#2563eb":"#94a3b8";
                                  const statusBadgeBg=pct>=100?"#dcfce7":pct>0?"#dbeafe":"#f1f5f9";
                                  return(
                                    <span style={{fontSize:9,fontWeight:700,background:statusBadgeBg,color:statusBadgeColor,borderRadius:6,padding:"1px 6px"}}>
                                      {statusBadgeLabel}
                                    </span>
                                  );
                                })()}
                              </div>
                              <span style={{fontSize:10,color:"#94a3b8"}}>{r.task.proyek}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                    <div style={{display:"flex",gap:8,padding:"12px 16px",borderTop:"1px solid #f1f5f9"}}>
                      <button onClick={()=>setTempSelectedPanelJenis(groupRows.filter((r:any)=>{
                          const alreadyConfirmed=(selectedKomponen[`${proses}_${r.panelId}`]||[]).includes(r.kode);
                          const sudahSelesai=(r.qtyKomp>0||r.isBusbar)&&r.pct===100&&r.sudahDisimpan100;
                          return !alreadyConfirmed&&!sudahSelesai;
                        }).map((r:any)=>r.panelId))}
                        style={{fontSize:11,color:"#1d4ed8",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Pilih Semua</button>
                      <button onClick={()=>setTempSelectedPanelJenis([])}
                        style={{fontSize:11,color:"#dc2626",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Kosongkan</button>
                      <div style={{flex:1}}/>
                      <button onClick={()=>setKomponenPopupJenis(null)}
                        style={{padding:"8px 14px",borderRadius:8,border:"1px solid #e2e8f0",background:"#fff",fontSize:12,fontWeight:600,color:"#64748b",cursor:"pointer"}}>Batal</button>
                      <button onClick={()=>{
                          setSelectedKomponen((prev:any)=>{
                            const next={...prev};
                            groupRows.forEach((r:any)=>{
                              const key=`${proses}_${r.panelId}`;
                              const existing=next[key]||[];
                              const isSel=tempSelectedPanelJenis.includes(r.panelId);
                              const already=existing.includes(r.kode);
                              if(isSel&&!already)next[key]=[...existing,r.kode];
                              else if(!isSel&&already)next[key]=existing.filter((k:string)=>k!==r.kode);
                            });
                            return next;
                          });
                          setKomponenPopupJenis(null);
                          scrollDanHighlightGroup(proses,komponenPopupJenis.namaKomponen);
                        }}
                        style={{padding:"8px 14px",borderRadius:8,border:"none",background:"#4f46e5",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer"}}>
                        Konfirmasi ({tempSelectedPanelJenis.length})
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
            {viewMode==='desktop'&&PROSES_KUMPUL_DULU_DESKTOP.includes(proses)&&visibleRows.length>0&&(
              <div style={{padding:"10px 16px",background:"#f8fafc",borderBottom:"1px solid #f1f5f9"}}>
                {proses==="POTONG"?(
                  <button onClick={()=>startUntukUserSendiri(proses,visibleRows)}
                    style={{padding:"8px 16px",borderRadius:8,border:"none",background:"#16a34a",color:"#fff",fontWeight:700,fontSize:12,cursor:"pointer"}}>
                    ▶ Mulai ({visibleRows.length} komponen)
                  </button>
                ):(
                  <button onClick={()=>{setBulkAssignProses(proses);setTempBulkPekerjaIds([]);}}
                    style={{padding:"8px 16px",borderRadius:8,border:"none",background:"#2563eb",color:"#fff",fontWeight:700,fontSize:12,cursor:"pointer"}}>
                    Pilih Operator & Mulai ({visibleRows.length} komponen)
                  </button>
                )}
                {(()=>{
                  const adaTimerJalan=visibleRows.some((r:any)=>{
                    const idsKomp=(r.task.pekerja_per_komponen||{})[r.kode]||[];
                    return idsKomp.some((pid:number)=>!!timerAktif[`${r.panelId}_${r.kode}_${proses}_${pid}`]);
                  });
                  if(!adaTimerJalan)return null;
                  return(
                    <button onClick={()=>bulkStopDesktop(proses,visibleRows)}
                      style={{marginLeft:8,padding:"8px 16px",borderRadius:8,border:"none",background:"#dc2626",color:"#fff",fontWeight:700,fontSize:12,cursor:"pointer"}}>
                      ⏹ Selesai Semua
                    </button>
                  );
                })()}
                {proses!=="POTONG"&&bulkAssignProses===proses&&viewMode==='desktop'&&(
                  <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
                    onClick={()=>setBulkAssignProses(null)}>
                    <div style={{background:"#fff",borderRadius:14,padding:20,width:"100%",maxWidth:380,maxHeight:"80vh",overflowY:"auto"}}
                      onClick={(e:any)=>e.stopPropagation()}>
                      <div style={{fontWeight:800,fontSize:14,color:"#1e293b",marginBottom:4}}>Pilih Operator</div>
                      <div style={{fontSize:11,color:"#94a3b8",marginBottom:14}}>Operator akan di-assign & timer langsung mulai untuk {visibleRows.length} komponen terkumpul di {proses}.</div>
                      <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:16}}>
                        {pekerjaList.filter((p:any)=>p.divisi===user.divisi).map((p:any)=>{
                          const checked=tempBulkPekerjaIds.includes(p.id);
                          return(
                            <label key={p.id} style={{display:"flex",alignItems:"center",gap:10,border:`1.5px solid ${checked?"#2563eb":"#e2e8f0"}`,borderRadius:10,padding:"10px 12px",cursor:"pointer",background:checked?"#eff6ff":"#fff"}}>
                              <input type="checkbox" checked={checked}
                                onChange={()=>setTempBulkPekerjaIds((prev:number[])=>checked?prev.filter((id:number)=>id!==p.id):[...prev,p.id])}/>
                              <span style={{fontSize:13,fontWeight:600,color:"#1e293b"}}>{p.nama}</span>
                            </label>
                          );
                        })}
                      </div>
                      <div style={{display:"flex",gap:8}}>
                        <button onClick={()=>setBulkAssignProses(null)}
                          style={{flex:1,padding:"10px",borderRadius:10,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#64748b",fontWeight:700,fontSize:13,cursor:"pointer"}}>Batal</button>
                        <button disabled={tempBulkPekerjaIds.length===0}
                          onClick={async()=>{
                            await bulkAssignAndStartDesktop(proses,visibleRows,tempBulkPekerjaIds);
                            setBulkAssignProses(null);
                          }}
                          style={{flex:1,padding:"10px",borderRadius:10,border:"none",
                            background:tempBulkPekerjaIds.length===0?"#94a3b8":"#16a34a",color:"#fff",fontWeight:700,fontSize:13,
                            cursor:tempBulkPekerjaIds.length===0?"not-allowed":"pointer"}}>
                          Mulai ({tempBulkPekerjaIds.length})
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            {viewMode==='mobile'?(
              <div style={{display:"flex",flexDirection:"column",gap:10,padding:"4px 2px"}}>
  {(()=>{
    // Khusus POTONG/BENDING/STEL/WIRING CONTROL/WIRING POWER: kartu detail komponen
    // disembunyikan dari daftar HANYA setelah progress 100% DAN "Simpan Progress" sudah
    // diklik (sudahDisimpan100) - bukan cuma begitu progress kebetulan penuh. visibleRows
    // (header counter) & rows (chip panel) tetap gak ikut difilter, cuma tampilan kartu ini aja.
    const cardListRows=["POTONG","BENDING","STEL","FINISHING","WIRING CONTROL","WIRING POWER","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","BUSBAR"].includes(proses)?visibleRows.filter((r:any)=>!(isDone(r)&&r.sudahDisimpan100)):visibleRows;
    const komponenGroups:Record<string,{namaKomponen:string,rows:any[]}> = {};
    cardListRows.forEach((r:any)=>{
      const key=r.item?.nama||r.kode;
      if(!komponenGroups[key])komponenGroups[key]={namaKomponen:r.item?.nama||r.kode,rows:[]};
      komponenGroups[key].rows.push(r);
    });
    const groups=Object.values(komponenGroups);
    if(groups.length===0){
      const semuaSudahSelesai=visibleRows.length>0&&cardListRows.length===0;
      return(
        <div style={{textAlign:"center",padding:"24px 10px",color:semuaSudahSelesai?"#16a34a":"#94a3b8",fontSize:12}}>
          {semuaSudahSelesai?"✅ Semua komponen di proses ini sudah selesai.":(
            <>Belum ada komponen dikumpulkan.<br/>Tap panel di atas untuk pilih komponen.</>
          )}
        </div>
      );
    }
    const potongTimerInfo=(()=>{
      if(proses!=="POTONG")return{ada:false,label:""};
      for(const r of visibleRows){
        const idsKomp=(r.task.pekerja_per_komponen||{})[r.kode]||[];
        const runningPid=idsKomp.find((pid:number)=>!!timerAktif[`${r.panelId}_${r.kode}_${proses}_${pid}`]);
        if(runningPid!==undefined){
          const key=`${r.panelId}_${r.kode}_${proses}_${runningPid}`;
          const timer=timerAktif[key];
          const menitBerjalan=(Date.now()-new Date(timer.mulai).getTime())/60000;
          const totalMenit=(timerDurasiSelesai[key]||0)+menitBerjalan;
          const jam=Math.floor(totalMenit/60);
          const menit=Math.round(totalMenit%60);
          const detik=Math.max(0,Math.round(totalMenit*60));
          const label=jam>0?`${jam}j ${menit}m`:totalMenit>=1?`${menit}m`:`${detik}d`;
          return{ada:true,label};
        }
      }
      return{ada:false,label:""};
    })();
    const adaTimerJalanPotong=potongTimerInfo.ada;
    const bulkToolbarPotong=proses==="POTONG"?(
      <div key="bulk-toolbar-potong" style={{display:"flex",gap:8}}>
        <button onClick={()=>adaTimerJalanPotong?bulkStopDesktop(proses,visibleRows):startUntukUserSendiri(proses,visibleRows)}
          style={{flex:1,minHeight:48,padding:"10px",borderRadius:10,border:"none",
            background:adaTimerJalanPotong?"#dc2626":"#16a34a",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>
          {adaTimerJalanPotong?`⏹ Selesai ${potongTimerInfo.label}`:"▶ Mulai"}
        </button>
        <button onClick={()=>lockBulkKomponen(proses,visibleRows)}
          style={{flex:1,minHeight:48,padding:"10px",borderRadius:10,border:"none",background:"#1d4ed8",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>
          💾 Simpan Semua Progress
        </button>
      </div>
    ):null;
    // RENDAM/PAINTING: sama seperti POTONG (assign + mulai sekaligus buat semua komponen
    // terkumpul), bedanya operatornya masih harus dipilih manual (gak auto = user login).
    const adaTimerJalanAssignMulai=(proses==="RENDAM"||proses==="PAINTING")&&visibleRows.some((r:any)=>{
      const idsKomp=(r.task.pekerja_per_komponen||{})[r.kode]||[];
      return idsKomp.some((pid:number)=>!!timerAktif[`${r.panelId}_${r.kode}_${proses}_${pid}`]);
    });
    const bulkToolbarAssignMulai=(proses==="RENDAM"||proses==="PAINTING")?(
      <div key="bulk-toolbar-assignmulai" style={{display:"flex",flexDirection:"column",gap:8}}>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>{setBulkAssignProses(proses);setTempBulkPekerjaIds([]);}}
            style={{flex:1,minHeight:48,padding:"10px",borderRadius:10,border:"none",background:"#2563eb",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>
            Pilih Operator & Mulai ({visibleRows.length})
          </button>
          {adaTimerJalanAssignMulai&&(
            <button onClick={()=>bulkStopDesktop(proses,visibleRows)}
              style={{flex:1,minHeight:48,padding:"10px",borderRadius:10,border:"none",background:"#dc2626",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>
              ⏹ Selesai Semua
            </button>
          )}
        </div>
        {bulkAssignProses===proses&&(
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
            onClick={()=>setBulkAssignProses(null)}>
            <div style={{background:"#fff",borderRadius:14,padding:20,width:"100%",maxWidth:380,maxHeight:"80vh",overflowY:"auto"}}
              onClick={(e:any)=>e.stopPropagation()}>
              <div style={{fontWeight:800,fontSize:14,color:"#1e293b",marginBottom:4}}>Pilih Operator</div>
              <div style={{fontSize:11,color:"#94a3b8",marginBottom:14}}>Operator akan di-assign & timer langsung mulai untuk {visibleRows.length} komponen terkumpul di {proses}.</div>
              <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:16}}>
                {pekerjaList.filter((p:any)=>p.divisi===user.divisi).map((p:any)=>{
                  const checked=tempBulkPekerjaIds.includes(p.id);
                  return(
                    <label key={p.id} style={{display:"flex",alignItems:"center",gap:10,border:`1.5px solid ${checked?"#2563eb":"#e2e8f0"}`,borderRadius:10,padding:"10px 12px",cursor:"pointer",background:checked?"#eff6ff":"#fff"}}>
                      <input type="checkbox" checked={checked}
                        onChange={()=>setTempBulkPekerjaIds((prev:number[])=>checked?prev.filter((id:number)=>id!==p.id):[...prev,p.id])}/>
                      <span style={{fontSize:13,fontWeight:600,color:"#1e293b"}}>{p.nama}</span>
                    </label>
                  );
                })}
              </div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>setBulkAssignProses(null)}
                  style={{flex:1,padding:"10px",borderRadius:10,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#64748b",fontWeight:700,fontSize:13,cursor:"pointer"}}>Batal</button>
                <button disabled={tempBulkPekerjaIds.length===0}
                  onClick={async()=>{
                    await bulkAssignAndStartDesktop(proses,visibleRows,tempBulkPekerjaIds);
                    setBulkAssignProses(null);
                  }}
                  style={{flex:1,padding:"10px",borderRadius:10,border:"none",
                    background:tempBulkPekerjaIds.length===0?"#94a3b8":"#16a34a",color:"#fff",fontWeight:700,fontSize:13,
                    cursor:tempBulkPekerjaIds.length===0?"not-allowed":"pointer"}}>
                  Mulai ({tempBulkPekerjaIds.length})
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    ):null;
    return[bulkToolbarPotong,bulkToolbarAssignMulai,...groups.map(group=>{
      const groupKey=group.namaKomponen;
      const isOpen=expandedPanel[proses]===groupKey;
      const panelCount=new Set(group.rows.map((r:any)=>r.panelId)).size;
      const belumAdaOperatorCount=group.rows.filter((r:any)=>{
        if(proses==="BUSBAR"){
          const ppk=(r.task.pekerja_per_komponen||{})[r.kode];
          return!ppk||!Object.values(ppk).some((ids:any)=>Array.isArray(ids)&&ids.length>0);
        }
        return getFlatOperatorIds(r.task,r.kode).length===0;
      }).length;
      const isHighlighted=highlightGroup===`${proses}_${groupKey}`;
      return(
        <div key={groupKey} ref={(el)=>{accordionRefs.current[`${proses}_${groupKey}`]=el;}}
          style={{background:isHighlighted?"#fefce8":"#fff",border:isHighlighted?"1.5px solid #facc15":"1.5px solid #e2e8f0",
            borderRadius:14,overflow:"hidden",transition:"background .6s ease, border-color .6s ease"}}>
          <div onClick={()=>setExpandedPanel(prev=>({...prev,[proses]:isOpen?null:groupKey}))}
            style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",cursor:"pointer",background:isOpen?"#eff6ff":"#fff"}}>
            <div style={{display:"flex",flexDirection:"column",gap:2}}>
              <span style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>{group.namaKomponen}</span>
              <span style={{fontSize:10,color:"#94a3b8"}}>{panelCount} panel · {group.rows.length} komponen{belumAdaOperatorCount>0?` · ${belumAdaOperatorCount} belum ada operator`:""}</span>
            </div>
            <span style={{fontSize:14,color:"#94a3b8",transition:"transform .15s",transform:isOpen?"rotate(180deg)":"none"}}>▾</span>
          </div>
          {isOpen&&(
            <div style={{padding:"0 14px 14px 14px",display:"flex",flexDirection:"column",gap:10}}>
              {proses!=="POTONG"&&proses!=="RENDAM"&&proses!=="PAINTING"&&!operatorPerKartu&&proses!=="BUSBAR"&&(
                <button onClick={()=>{setBulkAssignProses(proses);setBulkAssignGroupKey(groupKey);setTempBulkPekerjaIds([]);}}
                  style={{padding:"10px",minHeight:44,borderRadius:10,border:"none",background:"#2563eb",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>
                  Pilih Operator ({group.rows.length} komponen)
                </button>
              )}
              {proses!=="POTONG"&&proses!=="RENDAM"&&proses!=="PAINTING"&&!operatorPerKartu&&proses!=="BUSBAR"&&bulkAssignProses===proses&&bulkAssignGroupKey===groupKey&&(
                <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
                  onClick={()=>{setBulkAssignProses(null);setBulkAssignGroupKey(null);}}>
                  <div style={{background:"#fff",borderRadius:14,padding:20,width:"100%",maxWidth:380,maxHeight:"80vh",overflowY:"auto"}}
                    onClick={(e:any)=>e.stopPropagation()}>
                    <div style={{fontWeight:800,fontSize:14,color:"#1e293b",marginBottom:4}}>Pilih Operator</div>
                    <div style={{fontSize:11,color:"#94a3b8",marginBottom:14}}>Operator akan di-set untuk SEMUA {group.rows.length} "{group.namaKomponen}" di {panelCount} panel (menimpa operator lama kalau ada). Timer tetap diklik manual per komponen.</div>
                    <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:16}}>
                      {pekerjaList.filter((p:any)=>p.divisi===user.divisi).map((p:any)=>{
                        const checked=tempBulkPekerjaIds.includes(p.id);
                        return(
                          <label key={p.id} style={{display:"flex",alignItems:"center",gap:10,border:`1.5px solid ${checked?"#2563eb":"#e2e8f0"}`,borderRadius:10,padding:"10px 12px",cursor:"pointer",background:checked?"#eff6ff":"#fff"}}>
                            <input type="checkbox" checked={checked}
                              onChange={()=>setTempBulkPekerjaIds((prev:number[])=>checked?prev.filter((id:number)=>id!==p.id):[...prev,p.id])}/>
                            <span style={{fontSize:13,fontWeight:600,color:"#1e293b"}}>{p.nama}</span>
                          </label>
                        );
                      })}
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>{setBulkAssignProses(null);setBulkAssignGroupKey(null);}}
                        style={{flex:1,minHeight:44,padding:"10px",borderRadius:10,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#64748b",fontWeight:700,fontSize:13,cursor:"pointer"}}>Batal</button>
                      <button disabled={tempBulkPekerjaIds.length===0}
                        onClick={async()=>{
                          await bulkAssignAndStart(proses,group.rows,tempBulkPekerjaIds);
                          setBulkAssignProses(null);
                          setBulkAssignGroupKey(null);
                        }}
                        style={{flex:1,minHeight:44,padding:"10px",borderRadius:10,border:"none",
                          background:tempBulkPekerjaIds.length===0?"#94a3b8":"#16a34a",color:"#fff",fontWeight:700,fontSize:13,
                          cursor:tempBulkPekerjaIds.length===0?"not-allowed":"pointer"}}>
                        Simpan ({tempBulkPekerjaIds.length})
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {group.rows.map((r:any)=>{
                const done=isDone(r);
                const bisaEdit=canEditProgressKomponen(r.task,r.kode,r.panelId,proses);
                const kInfo=r.wiringBadge||komponenInfoMap[`${r.panelId}_${proses}_${r.kode}`]||{};
                const fmtD=(d:string)=>d?new Date(d).toLocaleDateString("id-ID",{day:"numeric",month:"short"}):"–";
                const isBusbarProses=proses==="BUSBAR";
                const idsKomp=isBusbarProses?[]:getFlatOperatorIds(r.task,r.kode);
                const workers=idsKomp.map((id:number)=>pekerjaList.find((p:any)=>p.id===id)).filter(Boolean);
                const busbarUrutan=isBusbarProses?getUrutanTahapBusbar(r.kode):[];
                const busbarTahapState=isBusbarProses?getBusbarTahapState(panelsMap[r.panelId]?.checklist?.[r.kode],r.kode):null;
                return(
                  <div key={`${r.task.id}-${r.kode}-m`} style={{background:done?"#f0fdf4":"#fff",
                    border:`1.5px solid ${done?"#bbf7d0":"#e2e8f0"}`,borderRadius:14,padding:"12px 14px",
                    display:"flex",flexDirection:"column",gap:10}}>
                    {proses==="PASANG KOMPONEN"&&user.sub_bagian==="Assembling Luar"&&(
                      <div style={{fontSize:9,fontWeight:700,color:"#94a3b8",letterSpacing:.4}}>SECTION 1 · FABRIKASI</div>
                    )}
                    {isBusbarProses?(
                      // ── BUSBAR: SEMUA tahap (4/3) tampil sekaligus, masing-masing berdiri sendiri
                      // (operator, timer, persentase, simpan) - gak ada "tahap aktif"/estafet lagi.
                      <div style={{display:"flex",flexDirection:"column",gap:8}}>
                        {busbarUrutan.map((t:string,ti:number)=>{
                          const idsKompTahap=(r.task.pekerja_per_komponen?.[r.kode]?.[t])||[];
                          const workersTahap=idsKompTahap.map((id:number)=>pekerjaList.find((p:any)=>p.id===id)).filter(Boolean);
                          const stTahap=busbarTahapState?.[t]||{progress:0,sudahDisimpan100:false};
                          const pctTahap=stTahap.progress||0;
                          const bisaEditTahap=canSimpanBusbarTahap(r.task,r.panelId,r.kode,t);
                          const timerKeysTahap=workersTahap.map((w:any)=>timerKey(r.panelId,r.kode,"BUSBAR",w.id,t));
                          const anyTimerRunningTahap=timerKeysTahap.some((k:string)=>!!timerAktif[k]);
                          const anyLoadingTahap=timerKeysTahap.some((k:string)=>timerLoading===k);
                          let durasiLabelTahap="";
                          const runningKeyTahap=timerKeysTahap.find((k:string)=>timerAktif[k]);
                          if(runningKeyTahap){
                            const timer=timerAktif[runningKeyTahap];
                            const menitBerjalan=(Date.now()-new Date(timer.mulai).getTime())/60000;
                            const totalMenit=(timerDurasiSelesai[runningKeyTahap]||0)+menitBerjalan;
                            const jam=Math.floor(totalMenit/60);
                            const menit=Math.round(totalMenit%60);
                            const detik=Math.max(0,Math.round(totalMenit*60));
                            durasiLabelTahap=jam>0?`${jam}j ${menit}m`:totalMenit>=1?`${menit}m`:`${detik}d`;
                          }
                          const flashKeyTahap=`${r.panelId}_${r.kode}_BUSBAR_${t}`;
                          const flashingTahap=!!savedFlash[flashKeyTahap];
                          return(
                            <div key={t} style={{border:"1px solid #e2e8f0",borderRadius:10,padding:"8px 10px",
                              background:stTahap.sudahDisimpan100?"#f0fdf4":"#fafafa",display:"flex",flexDirection:"column",gap:6}}>
                              <div style={{fontSize:11,fontWeight:800,color:stTahap.sudahDisimpan100?"#16a34a":"#374151"}}>
                                {stTahap.sudahDisimpan100?"✅ ":""}{ti+1}. {BUSBAR_TAHAP_LABEL[t]}
                              </div>
                              {workersTahap.length===0?(
                                <button onClick={()=>{setOperatorModal({taskId:r.task.id,kode:r.kode,tahap:t});setTempPekerjaIds(idsKompTahap);}}
                                  style={{fontSize:11,color:"#2563eb",fontWeight:700,background:"#eff6ff",border:"1.5px dashed #93c5fd",borderRadius:8,padding:"8px 10px",cursor:"pointer",textAlign:"center"}}>
                                  + Pilih Operator {BUSBAR_TAHAP_LABEL[t]}
                                </button>
                              ):(
                                <div style={{display:"flex",flexWrap:"wrap",gap:6,alignItems:"center"}}>
                                  {workersTahap.map((w:any)=>(
                                    <span key={w.id} style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:10,fontWeight:700,
                                      color:DIVISI_CONFIG[w.divisi]?.color||"#64748b",background:DIVISI_CONFIG[w.divisi]?.bg||"#f1f5f9",
                                      borderRadius:20,padding:"3px 8px"}}>
                                      {DIVISI_CONFIG[w.divisi]?.icon} {w.nama}
                                    </span>
                                  ))}
                                  <button onClick={()=>{setOperatorModal({taskId:r.task.id,kode:r.kode,tahap:t});setTempPekerjaIds(idsKompTahap);}}
                                    style={{fontSize:9,color:"#64748b",fontWeight:700,background:"none",border:"1px dashed #cbd5e1",borderRadius:8,padding:"3px 7px",cursor:"pointer"}}>
                                    ✏️ Edit
                                  </button>
                                </div>
                              )}
                              {workersTahap.length>0&&(
                                <button disabled={anyLoadingTahap}
                                  onClick={()=>{
                                    if(anyTimerRunningTahap){
                                      workersTahap.forEach((w:any)=>{
                                        const k=timerKey(r.panelId,r.kode,"BUSBAR",w.id,t);
                                        if(timerAktif[k])stopTimer(w.id,r.panelId,r.kode,"BUSBAR",t);
                                      });
                                    } else {
                                      workersTahap.forEach((w:any)=>startTimer(w.id,r.panelId,r.kode,"BUSBAR",viewDate,t));
                                    }
                                  }}
                                  style={{fontSize:12,fontWeight:700,border:"none",borderRadius:8,padding:"9px 10px",minHeight:38,cursor:anyLoadingTahap?"not-allowed":"pointer",
                                    background:anyTimerRunningTahap?"#fef2f2":"#f0fdf4",color:anyTimerRunningTahap?"#dc2626":"#16a34a"}}>
                                  {anyLoadingTahap?"...":anyTimerRunningTahap?`⏹ Selesai ${durasiLabelTahap}`:"▶ Mulai"}
                                </button>
                              )}
                              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                                {PCT_STEPS.map((s:number)=>{
                                  const reached=pctTahap>=s;
                                  const isNext=s===PCT_STEPS.find((x:number)=>x>pctTahap);
                                  const prevStep=PCT_STEPS[PCT_STEPS.indexOf(s)-1]||0;
                                  return(
                                    <button key={s} disabled={!bisaEditTahap}
                                      onClick={()=>{if(bisaEditTahap)updatePctManualBusbarTahap(r.panelId,r.kode,t,reached?prevStep:s);}}
                                      style={{flex:1,minWidth:36,padding:"7px 3px",borderRadius:7,border:"none",
                                        cursor:bisaEditTahap?"pointer":"not-allowed",
                                        background:reached?pColor(s):isNext?"#eff6ff":"#f1f5f9",
                                        color:reached?"#fff":isNext?pc:"#94a3b8",
                                        fontWeight:700,fontSize:10,outline:isNext&&bisaEditTahap?`2px solid ${pc}`:"none"}}>
                                      {reached?"✓":`${s}%`}
                                    </button>
                                  );
                                })}
                              </div>
                              <button disabled={pctTahap===0} onClick={async()=>{
                                  const berhasil=await simpanProgressTahapBusbar(r.panelId,r.kode,t);
                                  if(berhasil&&pctTahap<100){
                                    setSavedFlash(prev=>({...prev,[flashKeyTahap]:true}));
                                    setTimeout(()=>setSavedFlash(prev=>({...prev,[flashKeyTahap]:false})),1500);
                                  }
                                }}
                                style={{fontSize:11,fontWeight:700,border:"none",borderRadius:8,padding:"9px 10px",minHeight:38,
                                  cursor:pctTahap===0?"not-allowed":"pointer",
                                  background:flashingTahap?"#16a34a":"#eff6ff",color:flashingTahap?"#fff":"#1d4ed8"}}>
                                {flashingTahap?"✅ Tersimpan":`💾 Simpan ${BUSBAR_TAHAP_LABEL[t]}`}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ):(
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      {workers.length===0&&(
                        operatorPerKartu?(
                          <button onClick={()=>{setOperatorModal({taskId:r.task.id,kode:r.kode});setTempPekerjaIds(idsKomp);}}
                            style={{fontSize:12,color:"#2563eb",fontWeight:700,background:"#eff6ff",border:"1.5px dashed #93c5fd",borderRadius:10,padding:"10px 12px",cursor:"pointer",textAlign:"center"}}>
                            + Pilih Operator
                          </button>
                        ):(
                          <div style={{fontSize:11,color:"#94a3b8",fontStyle:"italic",padding:"6px 0"}}>
                            {proses==="POTONG"?'Belum dimulai - klik "▶ Mulai Semua" di atas.':'Belum ada operator - klik "Pilih Operator" di atas.'}
                          </div>
                        )
                      )}
                      {workers.length>0&&proses==="POTONG"&&(
                        <div style={{display:"flex",flexWrap:"wrap",gap:6,alignItems:"center"}}>
                          {workers.map((w:any)=>(
                            <span key={w.id} style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:11,fontWeight:700,
                              color:DIVISI_CONFIG[w.divisi]?.color||"#64748b",background:DIVISI_CONFIG[w.divisi]?.bg||"#f1f5f9",
                              borderRadius:20,padding:"4px 10px"}}>
                              {DIVISI_CONFIG[w.divisi]?.icon} {w.nama}
                            </span>
                          ))}
                        </div>
                      )}
                      {workers.length>0&&proses!=="POTONG"&&(()=>{
                        const timerKeys=workers.map((w:any)=>timerKey(r.panelId,r.kode,proses,w.id));
                        const anyTimerRunning=timerKeys.some((k:string)=>!!timerAktif[k]);
                        const anyLoading=timerKeys.some((k:string)=>timerLoading===k);
                        let durasiLabel="";
                        const runningKey=timerKeys.find((k:string)=>timerAktif[k]);
                        if(runningKey){
                          const timer=timerAktif[runningKey];
                          const menitBerjalan=(Date.now()-new Date(timer.mulai).getTime())/60000;
                          const totalMenit=(timerDurasiSelesai[runningKey]||0)+menitBerjalan;
                          const jam=Math.floor(totalMenit/60);
                          const menit=Math.round(totalMenit%60);
                          const detik=Math.max(0,Math.round(totalMenit*60));
                          durasiLabel=jam>0?`${jam}j ${menit}m`:totalMenit>=1?`${menit}m`:`${detik}d`;
                        }
                        return(
                          <div style={{display:"flex",flexDirection:"column",gap:6}}>
                            <div style={{display:"flex",flexWrap:"wrap",gap:6,alignItems:"center"}}>
                              {workers.map((w:any)=>(
                                <span key={w.id} style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:11,fontWeight:700,
                                  color:DIVISI_CONFIG[w.divisi]?.color||"#64748b",background:DIVISI_CONFIG[w.divisi]?.bg||"#f1f5f9",
                                  borderRadius:20,padding:"4px 10px"}}>
                                  {DIVISI_CONFIG[w.divisi]?.icon} {w.nama}
                                </span>
                              ))}
                              {operatorPerKartu&&(
                                <button onClick={()=>{setOperatorModal({taskId:r.task.id,kode:r.kode});setTempPekerjaIds(idsKomp);}}
                                  style={{fontSize:10,color:"#64748b",fontWeight:700,background:"none",border:"1px dashed #cbd5e1",borderRadius:8,padding:"4px 8px",cursor:"pointer"}}>
                                  ✏️ Edit Operator
                                </button>
                              )}
                            </div>
                            <button disabled={anyLoading}
                              onClick={()=>{
                                if(anyTimerRunning){
                                  workers.forEach((w:any)=>{
                                    const k=timerKey(r.panelId,r.kode,proses,w.id);
                                    if(timerAktif[k])stopTimer(w.id,r.panelId,r.kode,proses);
                                  });
                                } else {
                                  workers.forEach((w:any)=>startTimer(w.id,r.panelId,r.kode,proses,viewDate));
                                }
                              }}
                              style={{fontSize:13,fontWeight:700,border:"none",borderRadius:10,padding:"12px 14px",minHeight:44,cursor:anyLoading?"not-allowed":"pointer",
                                background:anyTimerRunning?"#fef2f2":"#f0fdf4",color:anyTimerRunning?"#dc2626":"#16a34a"}}>
                              {anyLoading?"...":anyTimerRunning?`⏹ Selesai ${durasiLabel}`:"▶ Mulai"}
                            </button>
                          </div>
                        );
                      })()}
                      {proses!=="POTONG"&&(()=>{
                        const flashKey=`${r.panelId}_${r.kode}_${proses}`;
                        const flashing=!!savedFlash[flashKey];
                        const disabledBtn=r.pct===0;
                        return(
                        <button disabled={disabledBtn} onClick={async()=>{
                            const berhasil=await lockSingleKomponen(r.panelId,r.kode,proses);
                            if(berhasil&&r.pct<100&&PROSES_FLASH_TERSIMPAN.includes(proses)){
                              setSavedFlash(prev=>({...prev,[flashKey]:true}));
                              setTimeout(()=>setSavedFlash(prev=>({...prev,[flashKey]:false})),1500);
                            }
                          }}
                          style={{fontSize:12,fontWeight:700,border:"none",borderRadius:10,padding:"12px 14px",minHeight:44,
                            cursor:disabledBtn?"not-allowed":"pointer",
                            background:flashing?"#16a34a":"#eff6ff",color:flashing?"#fff":"#1d4ed8"}}>
                          {flashing?"✅ Tersimpan":"💾 Simpan Progress"}
                        </button>
                        );
                      })()}
                    </div>
                    )}

                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                      <div style={{display:"flex",flexDirection:"column",gap:3}}>
                        <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                          {r.wpDef&&<span style={{background:r.wpDef.color+"18",color:r.wpDef.color,border:`1px solid ${r.wpDef.color}33`,borderRadius:4,padding:"1px 6px",fontSize:10,fontWeight:700}}>{r.wpDef.wp}</span>}
                          <span style={{fontWeight:700,fontSize:13,color:"#374151"}}>{renderNamaKomponen(r.item.nama)}</span>
                        </div>
                        <div style={{fontSize:10,color:"#94a3b8"}}>{r.task.proyek} · {r.panel.nama}</div>
                        <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                          <span style={{fontSize:10,color:"#94a3b8",fontFamily:"'DM Mono',monospace"}}>{r.kode}</span>
                          <Badge label={r.task.prioritas||"Sedang"} color={r.priColor}/>
                          {cardMode==='timer'&&r.wiringBadge&&(
                            <span style={{background:"#eef2ff",color:"#4f46e5",borderRadius:6,padding:"1px 6px",fontSize:9,fontWeight:700}}>
                              ⚡ {(r.wiringBadge.bobot||"").replace("_"," ")} · {r.wiringBadge.jumlahOrang||"–"}org
                            </span>
                          )}
                        </div>
                      </div>
                      {r.pct===100
                        ?<Badge label="TERCAPAI" color="#16a34a" bg="#dcfce7"/>
                        :r.pct===0
                        ?<Badge label="BELUM MULAI" color="#94a3b8" bg="#f1f5f9"/>
                        :<Badge label="ON PROGRESS" color="#2563eb" bg="#dbeafe"/>
                      }
                    </div>

                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,fontSize:10,color:"#64748b"}}>
                      <div>QTY KOMP: <b style={{color:"#475569"}}>{r.qtyKomp} 🔒</b></div>
                      <div>CREATE BY: <b style={{color:"#475569"}}>{kInfo.createdBy||"–"}</b></div>
                      <div>TARGET: <b style={{color:"#1d4ed8"}}>{fmtD(kInfo.targetSelesai)}</b></div>
                      <div>AKTUAL: <b style={{color:r.pct>=100?"#16a34a":"#94a3b8"}}>{r.pct>=100?fmtD(r.aktualSelesai):"–"}</b></div>
                    </div>

                    {cardMode==='qty'?(()=>{
                      const locked=isCellLocked(r.panelId,r.kode,proses);
                      const floor=getLockedFloor(r.panelId,r.kode,proses);
                      const qtyLocked=PROSES_QTY_LOCK_SEBELUM_MULAI.includes(proses)&&!r.sudahPernahMulai;
                      return(
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          {locked?(
                            <span style={{padding:"7px 10px",borderRadius:8,border:"1.5px solid #16a34a",background:"#f0fdf4",fontSize:13,fontWeight:700,color:"#16a34a"}}>{r.qtyProses} 🔒</span>
                          ):(
                            <div style={{display:"flex",flexDirection:"column",gap:2,alignItems:"center"}}>
                              <input type="number" min={floor} max={r.qtyKomp} value={r.qtyProses===0?"":r.qtyProses}
                                onChange={(e:any)=>{
                                  if(PROSES_AUTO_ASSIGN_SAAT_QTY.includes(proses)&&!((r.task.pekerja_per_komponen||{})[r.kode]?.length)){
                                    startUntukUserSendiri(proses,[r]);
                                  }
                                  updateQtyProses(r.panelId,r.kode,proses,Number(e.target.value));
                                }}
                                disabled={r.qtyKomp===0||qtyLocked}
                                placeholder={qtyLocked?"–":undefined}
                                style={{width:78,minHeight:44,padding:"8px",borderRadius:8,
                                  border:`1.5px solid ${r.qtyKomp===0||qtyLocked?"#e2e8f0":floor>0?"#f59e0b":"#2563eb"}`,
                                  background:r.qtyKomp===0||qtyLocked?"#f8fafc":floor>0?"#fffbeb":"#eff6ff",
                                  fontSize:16,textAlign:"center",fontWeight:700,fontFamily:"'DM Mono',monospace",
                                  color:r.qtyKomp===0?"#cbd5e1":floor>0?"#b45309":"#1d4ed8"}}/>
                              {qtyLocked&&<span style={{fontSize:9,color:"#94a3b8",fontWeight:600,whiteSpace:"nowrap"}}>Klik Mulai dulu</span>}
                            </div>
                          )}
                          <div style={{flex:1,background:"#e2e8f0",borderRadius:99,height:8,overflow:"hidden"}}>
                            <div style={{width:`${r.pct}%`,height:"100%",background:pColor(r.pct),borderRadius:99}}/>
                          </div>
                          <span style={{fontWeight:800,color:pColor(r.pct),fontFamily:"'DM Mono',monospace",fontSize:13,minWidth:34}}>{r.pct}%</span>
                        </div>
                      );
                    })():isBusbarProses?null:(()=>{
                      // Pasang Komponen (Assembling Luar) pakai mode % - tapi tetap kunci
                      // sampai operator dipilih dulu, konsisten sama semangat "Klik Mulai
                      // dulu" yang berlaku di mode qty. Proses lain yang lewat jalur PCT_STEPS
                      // ini gak kepengaruh (bisaEditPk default ke bisaEdit apa adanya).
                      const bisaEditPk=(proses==="PASANG KOMPONEN"&&user.sub_bagian==="Assembling Luar")?(bisaEdit&&workers.length>0):bisaEdit;
                      return(
                      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                        {PCT_STEPS.map((s:number)=>{
                          const reached=r.pct>=s;
                          const isNext=!done&&s===PCT_STEPS.find((x:number)=>x>r.pct);
                          const prevStep=PCT_STEPS[PCT_STEPS.indexOf(s)-1]||0;
                          return(
                            <button key={s} disabled={!bisaEditPk}
                              onClick={()=>{if(bisaEditPk)updatePctManual(r.panelId,r.kode,proses,reached?prevStep:s);}}
                              style={{flex:1,minWidth:40,padding:"9px 4px",borderRadius:8,border:"none",
                                cursor:bisaEditPk?"pointer":"not-allowed",
                                background:reached?pColor(s):isNext?"#eff6ff":"#f1f5f9",
                                color:reached?"#fff":isNext?pc:"#94a3b8",
                                fontWeight:700,fontSize:11,outline:isNext&&bisaEditPk?`2px solid ${pc}`:"none"}}>
                              {reached?"✓":`${s}%`}
                            </button>
                          );
                        })}
                      </div>
                      );
                    })()}
                    {proses==="PASANG KOMPONEN"&&user.sub_bagian==="Assembling Luar"&&(()=>{
                      const panelPk=panelsMap[r.panelId];
                      const fotoArr=panelPk?.pasang_komponen_photos||[];
                      const staged=stagedFotoPk[r.panelId]||[];
                      const saving=savingFotoPk===r.panelId;
                      return(
                        <div style={{borderTop:"1px solid #f1f5f9",paddingTop:8,marginTop:2}}>
                          <div style={{fontSize:9,fontWeight:700,color:"#94a3b8",letterSpacing:.4,marginBottom:6}}>SECTION 2 · PEMASANGAN (FOTO)</div>
                          {fotoArr.length===0&&staged.length===0?(
                            <div style={{fontSize:11,color:"#94a3b8",padding:"2px 0 6px"}}>Belum ada foto</div>
                          ):(
                            <div style={{display:"flex",flexWrap:"wrap" as const,gap:6,marginBottom:8}}>
                              {fotoArr.map((f:any,fi:number)=>(
                                <img key={`saved_${fi}`} onClick={()=>setFotoViewerPk({fotos:fotoArr,startIndex:fi,label:`Pasang Komponen_${r.panel.nama}`})}
                                  src={f.url} style={{width:52,height:52,borderRadius:6,objectFit:"cover" as const,border:"1px solid #e2e8f0",cursor:"pointer"}}/>
                              ))}
                              {staged.map((s,si)=>(
                                <div key={`staged_${si}`} style={{position:"relative" as const}}>
                                  <img src={s.previewUrl} style={{width:52,height:52,borderRadius:6,objectFit:"cover" as const,border:"1.5px dashed #0891b2"}}/>
                                  <button onClick={()=>batalkanFotoPk(r.panelId,si)}
                                    style={{position:"absolute" as const,top:-6,right:-6,width:16,height:16,borderRadius:99,background:"#dc2626",color:"#fff",border:"2px solid #fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                                    <i className="ti ti-x" style={{fontSize:9}}/>
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          <div style={{display:"flex",gap:6,flexWrap:"wrap" as const}}>
                            <label style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:11,fontWeight:700,color:"#0891b2",background:"#ecfeff",border:"1px dashed #67e8f9",borderRadius:6,padding:"6px 10px",
                                cursor:saving?"not-allowed":"pointer",opacity:saving?0.5:1,pointerEvents:saving?"none" as const:"auto" as const}}>
                              + Tambah Foto
                              <input type="file" accept="image/*" multiple disabled={saving} style={{display:"none"}}
                                onChange={(e:any)=>{pilihFotoPk(r.panelId,e.target.files);e.target.value="";}}/>
                            </label>
                            {staged.length>0&&(
                              <button onClick={()=>simpanFotoPk(r.panelId)} disabled={saving}
                                style={{fontSize:11,fontWeight:700,color:"#fff",background:saving?"#94a3b8":"#0891b2",border:"none",borderRadius:6,padding:"6px 12px",cursor:saving?"not-allowed":"pointer"}}>
                                {saving?"⏳ Menyimpan...":"💾 Simpan Foto"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                    {proses==="WIRING CONTROL"&&WIRING_KOMPONEN_FOTO_NAMA.includes(r.item?.nama)&&(()=>{
                      const cl=panelsMap[r.panelId]?.checklist?.[r.kode];
                      const fotoArr=cl?.fotoPemasangan||[];
                      const keyFoto=`${r.panelId}_${r.kode}`;
                      const staged=stagedFotoWiring[keyFoto]||[];
                      const saving=savingFotoWiring===keyFoto;
                      return(
                        <div style={{borderTop:"1px solid #f1f5f9",paddingTop:8,marginTop:2}}>
                          <div style={{fontSize:9,fontWeight:700,color:"#94a3b8",letterSpacing:.4,marginBottom:6}}>FOTO PEMASANGAN</div>
                          {fotoArr.length===0&&staged.length===0?(
                            <div style={{fontSize:11,color:"#94a3b8",padding:"2px 0 6px"}}>Belum ada foto</div>
                          ):(
                            <div style={{display:"flex",flexWrap:"wrap" as const,gap:6,marginBottom:8}}>
                              {fotoArr.map((f:any,fi:number)=>(
                                <img key={`saved_${fi}`} onClick={()=>setFotoViewerWiring({fotos:fotoArr,startIndex:fi,label:`${r.item?.nama}_${r.panel.nama}`})}
                                  src={f.url} style={{width:52,height:52,borderRadius:6,objectFit:"cover" as const,border:"1px solid #e2e8f0",cursor:"pointer"}}/>
                              ))}
                              {staged.map((s,si)=>(
                                <div key={`staged_${si}`} style={{position:"relative" as const}}>
                                  <img src={s.previewUrl} style={{width:52,height:52,borderRadius:6,objectFit:"cover" as const,border:"1.5px dashed #4f46e5"}}/>
                                  <button onClick={()=>batalkanFotoWiring(r.panelId,r.kode,si)}
                                    style={{position:"absolute" as const,top:-6,right:-6,width:16,height:16,borderRadius:99,background:"#dc2626",color:"#fff",border:"2px solid #fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                                    <i className="ti ti-x" style={{fontSize:9}}/>
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          <div style={{display:"flex",gap:6,flexWrap:"wrap" as const}}>
                            <label style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:11,fontWeight:700,color:"#4f46e5",background:"#eef2ff",border:"1px dashed #a5b4fc",borderRadius:6,padding:"6px 10px",
                                cursor:saving?"not-allowed":"pointer",opacity:saving?0.5:1,pointerEvents:saving?"none" as const:"auto" as const}}>
                              + Tambah Foto
                              <input type="file" accept="image/*" multiple disabled={saving} style={{display:"none"}}
                                onChange={(e:any)=>{pilihFotoWiring(r.panelId,r.kode,e.target.files);e.target.value="";}}/>
                            </label>
                            {staged.length>0&&(
                              <button onClick={()=>simpanFotoWiring(r.panelId,r.kode)} disabled={saving}
                                style={{fontSize:11,fontWeight:700,color:"#fff",background:saving?"#94a3b8":"#4f46e5",border:"none",borderRadius:6,padding:"6px 12px",cursor:saving?"not-allowed":"pointer"}}>
                                {saving?"⏳ Menyimpan...":"💾 Simpan Foto"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    })];
  })()}
</div>
            ):(
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead>
                  <tr>
                    <th style={{...thS,textAlign:"left",minWidth:40,position:"sticky",left:0,zIndex:4}}>NO</th>
                    <th style={{...thS,textAlign:"left",minWidth:100,position:"sticky",left:40,zIndex:4}}>PROYEK</th>
                    <th style={{...thS,textAlign:"left",minWidth:160,position:"sticky",left:140,zIndex:4}}>NAMA PANEL</th>
                    {false?(
                      <>
                        <th style={{...thS,minWidth:80}}>BOBOT</th>
                        <th style={{...thS,minWidth:60}}>ORANG</th>
                        <th style={{...thS,minWidth:100}}>CREATE BY</th>
                        <th style={{...thS,minWidth:100}}>CREATE ON</th>
                        <th style={{...thS,minWidth:110}}>TARGET SELESAI</th>
                        <th style={{...thS,minWidth:110}}>AKTUAL SELESAI</th>
                      </>
                    ):(
                      <>
                        <th style={{...thS,minWidth:50}}>WP</th>
                        <th style={{...thS,textAlign:"left",minWidth:160}}>KOMPONEN</th>
                        <th style={{...thS,minWidth:50}}>KODE</th>
                        <th style={{...thS,minWidth:70}}>PRIORITAS</th>
                        <th style={{...thS,minWidth:60}}>QTY KOMP</th>
                        {isQtyBased&&<th style={{...thS,minWidth:70}}>QTY PROSES</th>}
                        <th style={{...thS,minWidth:100}}>CREATE BY</th>
                        <th style={{...thS,minWidth:100}}>CREATE ON</th>
                        <th style={{...thS,minWidth:110}}>TARGET SELESAI</th>
                        <th style={{...thS,minWidth:110}}>AKTUAL SELESAI</th>
                      </>
                    )}
                    <th style={{...thS,minWidth:70}}>PROGRESS</th>
                    <th style={{...thS,textAlign:"left",minWidth:140}}>OPERATOR</th>
                    {!isWiringProses&&!isQtyBased&&PCT_STEPS.map(s=>(
                      <th key={s} style={{...thS,minWidth:50,borderBottom:`2px solid ${pc}`}}>{s}%</th>
                    ))}
                    {isWiringProses&&PCT_STEPS.map(s=>(
                      <th key={s} style={{...thS,minWidth:50,borderBottom:`2px solid ${pc}`}}>{s}%</th>
                    ))}
                    <th style={{...thS,minWidth:80}}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((r:any,ri:number)=>{
                    const done=isDone(r);
                    const rBg=done?"#f0fdf4":ri%2===0?"#fff":"#f8fafc";
                    const td:any={padding:"6px 8px",borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",
                      background:rBg,verticalAlign:"middle"};
                    return(
                      <tr key={`${r.task.id}-${r.kode}`}>
                        <td style={{...td,position:"sticky",left:0,zIndex:1,textAlign:"center",fontFamily:"'DM Mono',monospace",color:"#94a3b8",fontWeight:700}}>{ri+1}</td>
                        <td style={{...td,position:"sticky",left:40,zIndex:1,fontWeight:600,fontSize:11,color:"#475569",whiteSpace:"nowrap"}}>
                          {(()=>{
                            const urg=getUrgensi(r.task.wo_id||r.task.woId);
                            const warnaMap:Record<string,{bg:string,color:string}>={
                              telat:{bg:"#fef2f2",color:"#dc2626"},
                              mendesak:{bg:"#fff7ed",color:"#ea580c"},
                              perhatian:{bg:"#fefce8",color:"#ca8a04"},
                              normal:{bg:"",color:""},
                            };
                            const w=warnaMap[urg.level];
                            return(
                              <div style={{display:"flex",flexDirection:"column",gap:2}}>
                                <span>{r.task.proyek}</span>
                                {urg.label&&urg.level!=="normal"&&(
                                  <span style={{fontSize:8,fontWeight:700,background:w.bg,color:w.color,borderRadius:4,padding:"1px 5px",width:"fit-content"}}>
                                    {urg.level==="telat"?"⚠️ ":"⏰ "}{urg.label}
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td style={{...td,position:"sticky",left:140,zIndex:1,fontWeight:600,fontSize:11,color:"#1e293b",whiteSpace:"nowrap"}}>
                          <span style={{fontSize:10,color:"#94a3b8",marginRight:4}}>#{r.panel.no_pnl||r.panel.noPnl}</span>{r.panel.nama}
                          {r.task.carryOver&&r.isFirst&&(
                            <span style={{marginLeft:6,background:"#fef9c3",border:"1px solid #fde047",color:"#92400e",
                              borderRadius:4,padding:"1px 6px",fontSize:9,fontWeight:700}}>↩ Lanjutan</span>
                          )}
                        </td>
                        {false?(()=>{
                          const wInfo=wiringInfoMap[`${r.panelId}_${proses}`]||{};
                          const BOBOT_COLOR:any={EASY:"#16a34a",MEDIUM:"#d97706",HARD:"#dc2626",VERY_HARD:"#7c3aed"};
                          const bc=BOBOT_COLOR[wInfo.bobot]||"#6366f1";
                          const fmtDate=(d:string)=>d?new Date(d).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"}):"-";
                          return(
                            <>
                              <td style={{...td,textAlign:"center"}}>
                                <span style={{background:bc+"18",color:bc,border:`1px solid ${bc}33`,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700}}>
                                  {(wInfo.bobot||"–").replace("_"," ")}
                                </span>
                              </td>
                              <td style={{...td,textAlign:"center",fontWeight:700,color:"#475569"}}>{wInfo.jumlahOrang||"–"} org</td>
                              <td style={{...td,fontSize:10,color:"#475569"}}>{wInfo.createdBy||"–"}</td>
                              <td style={{...td,fontSize:10,color:"#64748b"}}>{fmtDate(wInfo.createdAt)}</td>
                              <td style={{...td,fontSize:10,fontWeight:600,color:"#1d4ed8"}}>{fmtDate(wInfo.targetSelesai)}</td>
                              <td style={{...td,fontSize:10,fontWeight:600,color:r.pct>=100?"#16a34a":"#94a3b8"}}>{r.pct>=100?fmtDate(r.aktualSelesai):"-"}</td>
                            </>
                          );
                        })():(
                          <>
                            <td style={{...td,textAlign:"center"}}>
                              {r.wpDef&&<span style={{background:r.wpDef.color+"18",color:r.wpDef.color,border:`1px solid ${r.wpDef.color}33`,borderRadius:4,padding:"1px 6px",fontSize:10,fontWeight:700}}>{r.wpDef.wp}</span>}
                            </td>
                            <td style={{...td,fontWeight:600,color:"#374151",whiteSpace:"nowrap"}}>
                              {renderNamaKomponen(r.item.nama)}
                              {r.wiringBadge&&(()=>{
                                const BOBOT_COLOR:any={EASY:"#16a34a",MEDIUM:"#d97706",HARD:"#dc2626",VERY_HARD:"#7c3aed"};
                                const bc=BOBOT_COLOR[r.wiringBadge.bobot]||"#6366f1";
                                return(
                                  <span style={{marginLeft:6,background:bc+"18",color:bc,border:`1px solid ${bc}33`,borderRadius:6,padding:"1px 6px",fontSize:9,fontWeight:700,whiteSpace:"nowrap"}}>
                                    ⚡ {(r.wiringBadge.bobot||"").replace("_"," ")} · {r.wiringBadge.jumlahOrang||"–"}org
                                  </span>
                                );
                              })()}
                            </td>
                            <td style={{...td,textAlign:"center",fontFamily:"'DM Mono',monospace",fontSize:10,color:"#94a3b8"}}>{r.kode}</td>
                            <td style={{...td,textAlign:"center"}}>
                              <Badge label={r.task.prioritas||"Sedang"} color={r.priColor}/>
                            </td>
                            <td style={{...td,textAlign:"center"}}>
                              <span style={{fontWeight:800,fontFamily:"'DM Mono',monospace",color:r.qtyKomp===0?"#fca5a5":"#475569",
                                background:r.qtyKomp===0?"#fef2f2":"#f1f5f9",borderRadius:6,padding:"3px 8px",fontSize:12}}>
                                {r.qtyKomp} 🔒
                              </span>
                            </td>
                            {(()=>{
                              const kInfo=r.wiringBadge||komponenInfoMap[`${r.panelId}_${proses}_${r.kode}`]||{};
                              const fmtDate=(d:string)=>d?new Date(d).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"}):"–";
                              const locked=isCellLocked(r.panelId,r.kode,proses);
                              const floor=getLockedFloor(r.panelId,r.kode,proses);
                              const qtyLocked=PROSES_QTY_LOCK_SEBELUM_MULAI.includes(proses)&&!r.sudahPernahMulai;
                              return(
                                <>
                                  {isQtyBased&&(
                                    <td style={{...td,textAlign:"center"}}>
                                      {locked?(
                                        <span style={{width:60,padding:"4px 6px",borderRadius:7,border:"1.5px solid #16a34a",
                                          background:"#f0fdf4",fontSize:12,textAlign:"center",fontWeight:700,
                                          fontFamily:"'DM Mono',monospace",color:"#16a34a",display:"inline-block"}}>
                                          {r.qtyProses} 🔒
                                        </span>
                                      ):(
                                        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                                          <input type="number" min={floor} max={r.qtyKomp} value={r.qtyProses===0?"":r.qtyProses}
                                            onChange={e=>{
                                              if(PROSES_AUTO_ASSIGN_SAAT_QTY.includes(proses)&&!((r.task.pekerja_per_komponen||{})[r.kode]?.length)){
                                                startUntukUserSendiri(proses,[r]);
                                              }
                                              updateQtyProses(r.panelId,r.kode,proses,Number(e.target.value));
                                            }}
                                            disabled={r.qtyKomp===0||qtyLocked}
                                            placeholder={qtyLocked?"–":undefined}
                                            style={{width:60,padding:"4px 6px",borderRadius:7,
                                              border:`1.5px solid ${r.qtyKomp===0||qtyLocked?"#e2e8f0":floor>0?"#f59e0b":"#2563eb"}`,
                                              background:r.qtyKomp===0||qtyLocked?"#f8fafc":floor>0?"#fffbeb":"#eff6ff",
                                              fontSize:12,textAlign:"center",fontWeight:700,
                                              fontFamily:"'DM Mono',monospace",
                                              color:r.qtyKomp===0?"#cbd5e1":floor>0?"#b45309":"#1d4ed8"}}/>
                                          {qtyLocked?(
                                            <span style={{fontSize:9,color:"#94a3b8",fontWeight:600,whiteSpace:"nowrap"}}>Klik Mulai dulu</span>
                                          ):floor>0&&<span style={{fontSize:9,color:"#f59e0b",fontWeight:700}}>min {floor} 🔒</span>}
                                        </div>
                                      )}
                                    </td>
                                  )}
                                  <td style={{...td,fontSize:10,color:"#475569"}}>{kInfo.createdBy||"–"}</td>
                                  <td style={{...td,fontSize:10,color:"#64748b"}}>{fmtDate(kInfo.createdAt)}</td>
                                  <td style={{...td,fontSize:10,fontWeight:600,color:"#1d4ed8"}}>{fmtDate(kInfo.targetSelesai)}</td>
                                  <td style={{...td,fontSize:10,fontWeight:600,color:r.pct>=100?"#16a34a":"#94a3b8"}}>{r.pct>=100?fmtDate(r.aktualSelesai):"–"}</td>
                                </>
                              );
                            })()}
                          </>
                        )}
                        <td style={{...td,textAlign:"center"}}>
                          {isQtyBased?(
                            <div style={{display:"flex",alignItems:"center",gap:5,justifyContent:"center"}}>
                              <div style={{width:50,background:"#e2e8f0",borderRadius:99,height:5,overflow:"hidden"}}>
                                <div style={{width:`${r.pct}%`,height:"100%",background:pColor(r.pct),borderRadius:99}}/>
                              </div>
                              <span style={{fontWeight:800,color:pColor(r.pct),fontFamily:"'DM Mono',monospace",fontSize:11,minWidth:28}}>{r.pct}%</span>
                            </div>
                          ):(
                            <span style={{fontWeight:800,color:pColor(r.pct),fontFamily:"'DM Mono',monospace",fontSize:11}}>{r.pct}%</span>
                          )}
                        </td>
                        {/* OPERATOR */}
                        <td style={{...td,verticalAlign:"middle"}}>
                          {(()=>{
                            const idsKomp=(r.task.pekerja_per_komponen||{})[r.kode]||[];
                            const workers=idsKomp
                              .map((id:number)=>pekerjaList.find((p:any)=>p.id===id))
                              .filter(Boolean);
                            return(
                              <div style={{display:"flex",flexDirection:"column",gap:3}}>
                                {workers.map((w:any)=>{
                                  const key=`${r.panelId}_${r.kode}_${proses}_${w.id}`;
                                  const timer=timerAktif[key];
                                  const loading=timerLoading===key;
                                  let durasiLabel="";
                                  if(timer){
                                    const menitBerjalan=(Date.now()-new Date(timer.mulai).getTime())/60000;
                                    const totalMenit=(timerDurasiSelesai[key]||0)+menitBerjalan;
                                    const jam=Math.floor(totalMenit/60);
                                    const menit=Math.round(totalMenit%60);
                                    const detik=Math.max(0,Math.round(totalMenit*60));
                                    durasiLabel=jam>0?`${jam}j ${menit}m`:totalMenit>=1?`${menit}m`:`${detik}d`;
                                  }
                                  return(
                                    <div key={w.id} style={{display:"flex",alignItems:"center",gap:5,
                                      background:DIVISI_CONFIG[w.divisi]?.bg||"#f1f5f9",
                                      borderRadius:20,padding:"2px 6px 2px 8px",whiteSpace:"nowrap"}}>
                                      <span style={{fontSize:10}}>{DIVISI_CONFIG[w.divisi]?.icon}</span>
                                      <span style={{fontSize:10,fontWeight:700,color:DIVISI_CONFIG[w.divisi]?.color||"#64748b"}}>{w.nama}</span>
                                      <button disabled={loading||proses==="BUSBAR"}
                                        title={proses==="BUSBAR"?"BUSBAR (per-tahap) cuma bisa dikerjakan lewat mobile":undefined}
                                        onClick={()=>timer?stopTimer(w.id,r.panelId,r.kode,proses):startTimer(w.id,r.panelId,r.kode,proses,viewDate)}
                                        style={{fontSize:8,fontWeight:700,border:"none",borderRadius:10,padding:"2px 6px",cursor:(loading||proses==="BUSBAR")?"not-allowed":"pointer",
                                          background:timer?"#fef2f2":"#f0fdf4",color:timer?"#dc2626":"#16a34a"}}>
                                        {loading?"...":proses==="BUSBAR"?"📱 Mobile":timer?`⏹ ${durasiLabel}`:"▶ Mulai"}
                                      </button>
                                    </div>
                                  );
                                })}
                                {proses!=="POTONG"&&(
                                  <button onClick={()=>{setOperatorModal({taskId:r.task.id,kode:r.kode});setTempPekerjaIds(idsKomp);}}
                                    style={{fontSize:9,color:"#94a3b8",fontWeight:600,background:"none",border:"1px dashed #cbd5e1",borderRadius:8,padding:"2px 6px",cursor:"pointer"}}>
                                    {workers.length>0?"+ Edit":"+ Pilih Operator"}
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        {/* STEP checkmarks */}
                        {!isQtyBased&&(()=>{
                          const bisaEdit=canEditProgressKomponen(r.task,r.kode,r.panelId,proses);
                          return PCT_STEPS.map(s=>{
                          const reached=r.pct>=s;
                          const isNext=!done&&s===PCT_STEPS.find(x=>x>r.pct);
                          const prevStep=PCT_STEPS[PCT_STEPS.indexOf(s)-1]||0;
                          return(
                            <td key={s} style={{...td,textAlign:"center",padding:"4px",
                              background:reached?pBg(s)+"cc":rBg,opacity:bisaEdit?1:0.4}}>
                              <button disabled={!bisaEdit}
                                onClick={()=>{if(bisaEdit)updatePctManual(r.panelId,r.kode,proses,reached?prevStep:s);}}
                                title={!bisaEdit?(proses==="PACKING"?"QC checklist belum lolos semua":"Pilih operator dan klik Mulai dulu"):reached?`Batalkan ${s}%`:`Set ${s}%`}
                                style={{width:22,height:22,borderRadius:5,border:"none",cursor:bisaEdit?"pointer":"not-allowed",
                                  background:reached?pColor(s):isNext?"#eff6ff":"transparent",
                                  display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto",
                                  outline:isNext&&bisaEdit?`2px solid ${pc}`:"none",transition:"all .12s"}}>
                                {reached
                                  ?<span style={{color:"#fff",fontSize:12,fontWeight:700}}>✓</span>
                                  :isNext?<span style={{color:pc,fontSize:11,fontWeight:700}}>→</span>
                                  :<span style={{color:"#e2e8f0",fontSize:11}}>·</span>
                                }
                              </button>
                            </td>
                          );
                          });
                        })()}
                        <td style={{...td,textAlign:"center"}}>
                          {r.pct===100
                            ?<Badge label="TERCAPAI" color="#16a34a" bg="#dcfce7"/>
                            :r.pct===0
                            ?<Badge label="BELUM MULAI" color="#94a3b8" bg="#f1f5f9"/>
                            :<Badge label="ON PROGRESS" color="#2563eb" bg="#dbeafe"/>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            )}
            {/* catatan per proses */}
            <div style={{padding:"12px 16px",borderTop:"1px solid #f1f5f9",background:"#fafafa"}}>
              <div style={{fontSize:11,fontWeight:700,color:"#64748b",marginBottom:6}}>📝 CATATAN {proses}</div>
              <div style={{display:"flex",gap:8}}>
                <input value={catatan[proses]||""} onChange={e=>setCatatan(prev=>({...prev,[proses]:e.target.value}))}
                  placeholder={`Catatan kendala untuk ${proses}...`}
                  style={{flex:1,padding:"7px 12px",borderRadius:8,border:"1.5px solid #e2e8f0",
                    background:"#fff",fontSize:12,color:"#1e293b"}}/>
                <Btn color={cfg.color} style={{padding:"7px 16px",fontSize:12}}
                  onClick={()=>{
                    setSavedNote(prev=>({...prev,[proses]:true}));
                    setTimeout(()=>setSavedNote(prev=>({...prev,[proses]:false})),2000);
                  }}>
                  {savedNote[proses]?"✓ Terkirim":"Simpan"}
                </Btn>
              </div>
            </div>
          </Card>
        );
      })}

      {/* TOMBOL KUNCI PROGRESS */}
      {todayTasks.length>0&&(
        <div style={{marginTop:16,marginBottom:8}}>
          <button onClick={lockProgress}
            style={{width:"100%",padding:"14px",borderRadius:12,border:"none",
              cursor:"pointer",fontWeight:800,fontSize:14,
              background:lockMsg||pernahDikunci?"#16a34a":"#1d4ed8",color:"#fff",
              boxShadow:"0 4px 14px #2563eb33",transition:"all .2s",
              display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            {lockMsg?"✅ Progress hari ini berhasil dikunci & tersimpan!":pernahDikunci?"✅ Sudah Dikunci — Kunci Ulang":"🔒 Kunci Progress Hari Ini"}
          </button>
          <div style={{fontSize:11,color:"#94a3b8",textAlign:"center",marginTop:8,lineHeight:1.5}}>
            Klik di akhir shift untuk menyimpan progress hari ini sebagai catatan permanen.<br/>
            Bisa diklik lagi jika ada update di shift berikutnya (tersimpan terpisah).
          </div>
        </div>
      )}

      {operatorModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:200,
          display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
          onClick={()=>setOperatorModal(null)}>
          <div style={{background:"#fff",borderRadius:14,padding:20,width:"100%",maxWidth:380,maxHeight:"80vh",overflowY:"auto"}}
            onClick={(e:any)=>e.stopPropagation()}>
            <div style={{fontWeight:800,fontSize:14,color:"#1e293b",marginBottom:4}}>Pilih Operator</div>
            <div style={{fontSize:11,color:"#94a3b8",marginBottom:14}}>Bisa pilih lebih dari satu orang</div>
            <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:16}}>
              {pekerjaList.filter((p:any)=>p.divisi===user.divisi).map((p:any)=>{
                const checked=tempPekerjaIds.includes(p.id);
                return(
                  <label key={p.id} style={{display:"flex",alignItems:"center",gap:10,border:`1.5px solid ${checked?"#2563eb":"#e2e8f0"}`,
                    borderRadius:10,padding:"10px 12px",cursor:"pointer",background:checked?"#eff6ff":"#fff"}}>
                    <input type="checkbox" checked={checked}
                      onChange={()=>setTempPekerjaIds(prev=>checked?prev.filter(id=>id!==p.id):[...prev,p.id])}/>
                    <span style={{fontSize:13,fontWeight:600,color:"#1e293b"}}>{p.nama}</span>
                    {terakhirKerjaPekerjaId===p.id&&(
                      <span title="Terakhir kerja komponen ini" style={{width:8,height:8,borderRadius:99,background:"#eab308",marginLeft:"auto"}}/>
                    )}
                  </label>
                );
              })}
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setOperatorModal(null)}
                style={{flex:1,padding:"10px",borderRadius:10,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#64748b",fontWeight:700,fontSize:13,cursor:"pointer"}}>Batal</button>
              <button onClick={async()=>{
                  if(operatorModal.tahap)await updateOperatorBusbarTahap(operatorModal.taskId,operatorModal.kode,operatorModal.tahap,tempPekerjaIds);
                  else await updatePekerjaPerKomponen(operatorModal.taskId,operatorModal.kode,tempPekerjaIds);
                  setOperatorModal(null);
                }}
                style={{flex:1,padding:"10px",borderRadius:10,border:"none",background:"#2563eb",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>Simpan</button>
            </div>
          </div>
        </div>
      )}
      {fotoViewerWiring&&(
        <FotoZoomViewerPekerja fotos={fotoViewerWiring.fotos} startIndex={fotoViewerWiring.startIndex} label={fotoViewerWiring.label} onClose={()=>setFotoViewerWiring(null)}/>
      )}
      {fotoViewerPk&&(
        <FotoZoomViewerPekerja fotos={fotoViewerPk.fotos} startIndex={fotoViewerPk.startIndex} label={fotoViewerPk.label} onClose={()=>setFotoViewerPk(null)}/>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
export default function App(){
  const [user,setUser]=useState<any>(()=>{
    try{
      const saved=localStorage.getItem("vista_pekerja_session");
      return saved?JSON.parse(saved):null;
    }catch{return null;}
  });
  const [page,setPage]=useState<string>(()=>{
    try{
      return localStorage.getItem("vista_pekerja_session")?"app":"landing";
    }catch{return "landing";}
  });

  const cfg=user?DIVISI_CONFIG[user.divisi]:null;
  const [viewMode,setViewMode]=useState<"desktop"|"mobile">(()=>{
    try{return (localStorage.getItem("vista_pekerja_viewmode") as any)||"desktop";}catch{return "desktop";}
  });
  const toggleViewMode=()=>{
    const next=viewMode==="desktop"?"mobile":"desktop";
    setViewMode(next);
    try{localStorage.setItem("vista_pekerja_viewmode",next);}catch{}
  };
  const isOperatorDivisi=user&&!["nameplate","qc","komponen"].includes(user.divisi);

  if(page==="landing") return <LandingPage onEnter={()=>setPage("login")}/>;
  if(!user) return <Login onLogin={(u:any)=>{
    setUser(u);
    try{localStorage.setItem("vista_pekerja_session",JSON.stringify(u));}catch{}
    setPage("app");
  }}/>;

  return(
    <div style={{minHeight:"100vh",background:"#f1f5f9"}}>
      <style>{GCss}</style>
      <div style={{display:"flex",flexDirection:"column",minHeight:"100vh"}}>
        <div style={{background:"#fff",borderBottom:"1.5px solid #e2e8f0",padding:"0 16px",
          minHeight:52,paddingTop:"max(0px, env(safe-area-inset-top))",display:"flex",alignItems:"center",justifyContent:"space-between",
          position:"sticky",top:0,zIndex:100,boxShadow:"0 1px 4px #00000008"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:18}}>⚡</span>
            <span style={{fontWeight:800,fontSize:14,color:"#1e293b"}}>PROSES PRODUKSI</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{background:cfg?.bg,color:cfg?.color,border:`1px solid ${cfg?.color}30`,
              borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>{cfg?.icon} {user.sub_bagian||cfg?.label}</span>
            {isOperatorDivisi&&(
              <button onClick={toggleViewMode} title={viewMode==="desktop"?"Ganti ke tampilan Mobile":"Ganti ke tampilan Desktop"}
                style={{width:40,height:40,border:"1px solid #e2e8f0",borderRadius:8,
                  background:"#f8fafc",display:"flex",alignItems:"center",justifyContent:"center",
                  cursor:"pointer",fontSize:15,color:"#64748b"}}>
                {viewMode==="desktop"?"📱":"🖥️"}
              </button>
            )}
            <button onClick={()=>window.location.reload()} title="Refresh"
              style={{width:40,height:40,border:"1px solid #e2e8f0",borderRadius:8,
                background:"#f8fafc",display:"flex",alignItems:"center",justifyContent:"center",
                cursor:"pointer",fontSize:15,color:"#64748b"}}>
              🔄
            </button>
            <button onClick={()=>{setUser(null);try{localStorage.removeItem("vista_pekerja_session");}catch{}setPage("landing");}}
              style={{background:"#f8fafc",border:"1px solid #e2e8f0",color:"#64748b",
                borderRadius:8,padding:"10px 14px",minHeight:40,cursor:"pointer",fontSize:12,fontWeight:600}}>Keluar</button>
          </div>
        </div>
        <div style={{flex:1,overflowY:"auto"}}>
          {user.divisi==="nameplate"?<NameplateView user={user}/>
            :user.divisi==="qc"?<QCChecklistTab user={user}/>
            :user.divisi==="komponen"&&user.sub_bagian==="Warehouse"?<KomponenProgressView user={user} tugas={TUGAS_WAREHOUSE}/>
            :user.divisi==="komponen"&&user.sub_bagian==="QS"?<KomponenProgressView user={user} tugas={TUGAS_QS}/>
            :user.divisi==="komponen"?<TrackingKomponenView user={user}/>
            :<OperatorHome user={user} viewMode={viewMode}/>}
        </div>
        <div style={{position:"sticky",bottom:0,background:"#fff",borderTop:"1.5px solid #e2e8f0",
          display:"flex",minHeight:52,paddingBottom:"env(safe-area-inset-bottom)",zIndex:100,boxShadow:"0 -2px 10px #00000010"}}>
          <button style={{flex:1,border:"none",background:"none",cursor:"pointer",
            display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
            gap:2,color:cfg?.color}}>
            <span style={{fontSize:18}}>📋</span>
            <span style={{fontSize:9,fontWeight:700,letterSpacing:.3}}>Tugas Saya</span>
          </button>
        </div>
      </div>
    </div>
  );
}




