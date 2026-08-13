import { useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// GUDANG HOME - shell navigasi 5-tab (full mobile, gak ada toggle desktop/mobile
// - divisi ini SENGAJA dikecualikan dari isOperatorDivisi di App.tsx). Konten
// tiap tab menyusul per fase terpisah; sementara masih placeholder. TERPISAH
// TOTAL dari divisi "komponen" sub_bagian "Warehouse" (Modul B lama,
// warehouse_progress per panel) - tab "Progress" di sini reuse KomponenProgressView
// yang sama (bukan copy), tab lainnya (Permintaan/Tarik/Database/Riwayat) murni
// baru, tabel sendiri (permintaan/permintaan_item/komponen_bbmb_master).
// ─────────────────────────────────────────────────────────────────────────────

type GudangTab="permintaan"|"tarik"|"database"|"progress"|"riwayat";

const TABS:{key:GudangTab,label:string,icon:string}[]=[
  {key:"permintaan",label:"Permintaan",icon:"📋"},
  {key:"tarik",label:"Tarik",icon:"📦"},
  {key:"database",label:"Database",icon:"🗄️"},
  {key:"progress",label:"Progress",icon:"📊"},
  {key:"riwayat",label:"Riwayat",icon:"🕒"},
];

export function GudangHome({user}:{user:any}){
  void user; // dipake tiap tab konten di fase berikutnya
  const[tab,setTab]=useState<GudangTab>("permintaan");

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{flex:1,overflowY:"auto"}}>
        {tab==="permintaan"&&<PlaceholderTab label="Permintaan (BBMB/BBMU)"/>}
        {tab==="tarik"&&<PlaceholderTab label="Tarik Komponen Keluar"/>}
        {tab==="database"&&<PlaceholderTab label="Database Master Komponen"/>}
        {tab==="progress"&&<PlaceholderTab label="Progress (reuse KomponenProgressView)"/>}
        {tab==="riwayat"&&<PlaceholderTab label="Riwayat Harian"/>}
      </div>
      <div style={{position:"sticky",bottom:0,background:"#fff",borderTop:"1.5px solid #e2e8f0",
        display:"flex",minHeight:52,paddingBottom:"env(safe-area-inset-bottom)",zIndex:100,boxShadow:"0 -2px 10px #00000010"}}>
        {TABS.map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key)} style={{flex:1,border:"none",background:"none",cursor:"pointer",
            display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
            gap:2,color:tab===t.key?"#0369a1":"#94a3b8"}}>
            <span style={{fontSize:18}}>{t.icon}</span>
            <span style={{fontSize:9,fontWeight:700,letterSpacing:.3}}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function PlaceholderTab({label}:{label:string}){
  return(
    <div style={{padding:40,textAlign:"center",color:"#94a3b8"}}>
      <div style={{fontSize:32,marginBottom:10}}>🚧</div>
      <div style={{fontSize:13,fontWeight:600}}>{label}</div>
      <div style={{fontSize:11,marginTop:4}}>Belum dibangun - menyusul fase berikutnya.</div>
    </div>
  );
}
