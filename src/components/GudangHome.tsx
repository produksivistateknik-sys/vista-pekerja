import { useState } from "react";
import { PermintaanGudangTab } from "./PermintaanGudangTab";
import { TarikGudangTab } from "./TarikGudangTab";
import { DatabaseGudangTab } from "./DatabaseGudangTab";
import { RiwayatGudangTab } from "./RiwayatGudangTab";
import { KomponenProgressView } from "./KomponenProgressView";

// Tab "Progress" - REUSE KomponenProgressView.tsx yang sama persis dipakai divisi
// komponen>Warehouse (Modul B lama, TIDAK disentuh). Object `tugas` ini cuma
// literal data (nama-nama kolom), didefinisikan ulang di sini (App.tsx gak
// meng-export TUGAS_WAREHOUSE-nya) - komponennya sendiri 100% direuse dari satu
// sumber (import langsung), nilainya HARUS identik dengan yang di App.tsx.
const TUGAS_WAREHOUSE_GUDANG={field:"warehouse",label:"Warehouse",icon:"📦",color:"#0d9488",progressField:"warehouse_progress" as const,fotoField:"warehouse_photos",historyField:"warehouse_history",updatedByField:"warehouse_updated_by",updatedAtField:"warehouse_updated_at",bucket:"warehouse-photos"};

// ─────────────────────────────────────────────────────────────────────────────
// GUDANG HOME - shell navigasi 5-tab (full mobile, gak ada toggle desktop/mobile
// - divisi ini SENGAJA dikecualikan dari isOperatorDivisi di App.tsx). TERPISAH
// TOTAL dari divisi "komponen" sub_bagian "Warehouse" (Modul B lama,
// warehouse_progress per panel, TIDAK disentuh) - tab "Progress" di sini reuse
// KomponenProgressView yang sama persis (bukan copy), tab lainnya (Permintaan/
// Tarik/Database/Riwayat) murni baru, tabel sendiri (permintaan/permintaan_item/
// komponen_bbmb_master).
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
  const[tab,setTab]=useState<GudangTab>("permintaan");

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",width:"100%"}}>
      <div style={{flex:1,overflowY:"auto",width:"100%",paddingBottom:"calc(52px + env(safe-area-inset-bottom))"}}>
        {tab==="permintaan"&&<PermintaanGudangTab user={user}/>}
        {tab==="tarik"&&<TarikGudangTab user={user}/>}
        {tab==="database"&&<DatabaseGudangTab/>}
        {tab==="progress"&&<KomponenProgressView user={user} tugas={TUGAS_WAREHOUSE_GUDANG}/>}
        {tab==="riwayat"&&<RiwayatGudangTab/>}
      </div>
      {/* position:fixed (bukan sticky) - sengaja anchor ke VIEWPORT asli, bukan ke containing
          block terdekat di rantai parent (GudangHome dinest 1 level lebih dalam dari nav bawah
          punya App.tsx buat divisi non-gudang, jadi sticky+width:100% masih bisa kepotong lebar
          parent). Aman dipakai di sini persis kayak modal (lihat globalCss.ts) - gak ada ancestor
          yang pakai "transform" (animasi .fi/.su sengaja pakai "translate" biar gak bikin
          containing-block baru buat descendant position:fixed). */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,width:"100%",background:"#fff",borderTop:"1.5px solid #e2e8f0",
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
