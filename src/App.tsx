import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
import { isPushSupported, getPushPermissionState, subscribeToPush } from "./lib/pushNotif";
import { DIVISI_CONFIG } from "./lib/panelTypes";
import { GCss } from "./lib/globalCss";
import { KoneksiBadge } from "./components/ui/Primitives";
import { LandingPage } from "./components/LandingPage";
import { Login } from "./components/Login";
import { ArsipSeksiView } from "./components/ArsipSeksiView";
import { NameplateView } from "./components/NameplateView";
import { QCChecklistTab } from "./components/QCChecklistTab";
import { KomponenProgressView } from "./components/KomponenProgressView";
import { KomponenPasangView, type KomponenPasangTugas } from "./components/KomponenPasangView";
import { TrackingKomponenView } from "./components/TrackingKomponenView";
import { OperatorHome } from "./components/OperatorHome";
// Sprint 5-7 (5 Agu 2026): seluruh komponen/const yang tadinya nempel di App.tsx dipindah
// keluar ke src/lib/ dan src/components/ - struktur/nama fungsi/isi PERSIS SAMA, cuma
// lokasinya pindah. App.tsx sekarang murni shell (routing halaman + header/nav).

// Warehouse & QS - gaya sama persis Nameplate/Yellowmark (Fabrikasi % + Pemasangan Foto per
// panel), tapi masing-masing cuma 1 tugas (bukan sepasang) dan bucket foto sendiri-sendiri.
const TUGAS_WAREHOUSE={field:"warehouse",label:"Warehouse",icon:"📦",color:"#0d9488",progressField:"warehouse_progress" as const,fotoField:"warehouse_photos",historyField:"warehouse_history",updatedByField:"warehouse_updated_by",updatedAtField:"warehouse_updated_at",bucket:"warehouse-photos"};
const TUGAS_QS={field:"qs",label:"QS",icon:"📋",color:"#7c3aed",progressField:"qs_progress" as const,fotoField:"qs_photos",historyField:"qs_history",updatedByField:"qs_updated_by",updatedAtField:"qs_updated_at",bucket:"qs-photos"};

// Tab "Komponen" (GANTI section "Kontribusi Pasang Komponen" yang dulu nempel di card
// OperatorView, 7 Agu 2026) - pola navigasi SAMA PERSIS Tab QS di atas, tapi per-komponen bukan
// per-panel (lihat KomponenPasangView.tsx).
const TUGAS_KOMPONEN_WIRING:KomponenPasangTugas={seksi:"wiring_control",label:"Komponen",icon:"🔌",color:"#6366f1",tahap:"WIRING",fotoBucket:"wiring-komponen-photos"};
const TUGAS_KOMPONEN_ASSEMBLING:KomponenPasangTugas={seksi:"assembling_luar",label:"Komponen",icon:"🔧",color:"#059669",tahap:"ASSEMBLING",fotoBucket:"pasang-komponen-photos"};

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

  // Tab bawah "Arsip" - cuma muncul buat divisi/sub_bagian yang punya seksi arsip otomatis
  // (Warehouse/QS/QC/Assembling Luar/Wiring Control). Assembling Luar dan Wiring Control DIPISAH
  // jadi 2 seksi arsip independen (6 Agu 2026) - dua-duanya divisi terpisah, handle komponen
  // sendiri (Assembling Luar: pasang_komponen_photos per-panel; Wiring Control: fotoPemasangan
  // per-kode), hasil sendiri, gak saling nunggu buat diarsipkan (lihat panels_auto_archive_seksi()
  // trigger). Sebelumnya dua-duanya baca seksi gabungan 'pasang_komponen' - itu bikin kode yang
  // salah satu sisinya gak pernah dapet task jadi stuck selamanya nunggu sisi yang gak akan
  // pernah diisi.
  const arsipSeksi:string|null=!user?null
    :user.divisi==="qc"?"qc"
    :user.divisi==="komponen"&&user.sub_bagian==="Warehouse"?"warehouse"
    :user.divisi==="komponen"&&user.sub_bagian==="QS"?"qs"
    :user.divisi==="assembling"&&user.sub_bagian==="Assembling Luar"?"assembling_luar"
    :user.divisi==="wiring_ctrl"?"wiring_control"
    :null;
  // Tab "Komponen" (7 Agu 2026) - cuma Wiring Control dan Assembling Luar, GANTI section
  // "Kontribusi Pasang Komponen" yang dulu nempel di card OperatorView.
  const komponenPasangTugas:KomponenPasangTugas|null=!user?null
    :user.divisi==="wiring_ctrl"?TUGAS_KOMPONEN_WIRING
    :user.divisi==="assembling"&&user.sub_bagian==="Assembling Luar"?TUGAS_KOMPONEN_ASSEMBLING
    :null;
  const [bottomTab,setBottomTab]=useState<"tugas"|"komponen"|"arsip">("tugas");

  // Banner ajakan aktifkan push notification pengingat Maintenance Rutin - subscribe di-key ke
  // `divisi` (bukan per-orang, device login pakai password bersama per sub-bagian). Cuma muncul
  // sekali per device (localStorage) kalau browser dukung & izin belum diputuskan.
  const PUSH_BANNER_KEY="vista_pekerja_push_banner_dismissed";
  const [showPushBanner,setShowPushBanner]=useState(false);
  const [pushLoading,setPushLoading]=useState(false);
  useEffect(()=>{
    if(!user)return;
    if(!isPushSupported())return;
    if(localStorage.getItem(PUSH_BANNER_KEY))return;
    if(getPushPermissionState()==="default")setShowPushBanner(true);
  },[user]);
  const aktifkanPush=async()=>{
    if(!user?.divisi)return;
    setPushLoading(true);
    const res=await subscribeToPush(user.divisi);
    setPushLoading(false);
    setShowPushBanner(false);
    localStorage.setItem(PUSH_BANNER_KEY,"1");
    if(!res.success)alert("Gagal aktifkan notifikasi: "+(res.error||"unknown error"));
  };
  const tutupPushBanner=()=>{
    setShowPushBanner(false);
    localStorage.setItem(PUSH_BANNER_KEY,"1");
  };

  // Session di-cache penuh di localStorage pas login, gak ada expiry - kalau admin ubah
  // divisi/sub_bagian/nama operator ini dari Vista Teknik pas app-nya masih kebuka, sesi lama
  // bakal nyangkut sampai logout-login manual. Dengerin perubahan row operator_users-nya sendiri
  // biar role ke-refresh live tanpa perlu logout.
  useEffect(()=>{
    if(!user?.id)return;
    const ch=supabase.channel("realtime-operator-session-"+user.id)
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"operator_users",filter:"id=eq."+user.id},(payload:any)=>{
        const fresh={...payload.new,name:payload.new.nama};
        setUser(fresh);
        try{localStorage.setItem("vista_pekerja_session",JSON.stringify(fresh));}catch{}
      })
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[user?.id]);

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
        <div style={{background:"#fff",borderBottom:"1.5px solid #e2e8f0",padding:"6px 16px",
          minHeight:52,paddingTop:"max(6px, env(safe-area-inset-top))",display:"flex",alignItems:"center",justifyContent:"space-between",
          flexWrap:"wrap",rowGap:6,
          position:"sticky",top:0,zIndex:100,boxShadow:"0 1px 4px #00000008"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
            <span style={{fontSize:18}}>⚡</span>
            <span style={{fontWeight:800,fontSize:14,color:"#1e293b"}}>PROSES PRODUKSI</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",rowGap:6,justifyContent:"flex-end"}}>
            <KoneksiBadge/>
            <span style={{background:cfg?.bg,color:cfg?.color,border:`1px solid ${cfg?.color}30`,
              borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>{cfg?.icon} {user.sub_bagian||cfg?.label}</span>
            {isOperatorDivisi&&(
              <button onClick={toggleViewMode} title={viewMode==="desktop"?"Ganti ke tampilan Mobile":"Ganti ke tampilan Desktop"}
                style={{width:40,height:40,flexShrink:0,border:"1px solid #e2e8f0",borderRadius:8,
                  background:"#f8fafc",display:"flex",alignItems:"center",justifyContent:"center",
                  cursor:"pointer",fontSize:15,color:"#64748b"}}>
                {viewMode==="desktop"?"📱":"🖥️"}
              </button>
            )}
            <button onClick={()=>window.location.reload()} title="Refresh"
              style={{width:40,height:40,flexShrink:0,border:"1px solid #e2e8f0",borderRadius:8,
                background:"#f8fafc",display:"flex",alignItems:"center",justifyContent:"center",
                cursor:"pointer",fontSize:15,color:"#64748b"}}>
              🔄
            </button>
            <button onClick={()=>{if(window.confirm("Keluar dari aplikasi?")){setUser(null);try{localStorage.removeItem("vista_pekerja_session");}catch{}setPage("landing");}}}
              style={{display:"flex",alignItems:"center",gap:6,background:"#fef2f2",border:"1.5px solid #fecaca",color:"#dc2626",flexShrink:0,whiteSpace:"nowrap",
                borderRadius:8,padding:"10px 14px",minHeight:40,cursor:"pointer",fontSize:12,fontWeight:700}}>
              <i className="ti ti-logout" style={{fontSize:15}}/> Keluar
            </button>
          </div>
        </div>
        {showPushBanner&&(
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:"#eff6ff",borderBottom:"1px solid #bfdbfe"}}>
            <div style={{fontSize:18}}>🔔</div>
            <div style={{flex:1,fontSize:11,color:"#1e3a5f"}}>
              <div style={{fontWeight:700,marginBottom:1}}>Aktifkan notifikasi maintenance?</div>
              <div style={{color:"#475569"}}>Dapat pengingat langsung ke device ini kalau ada mesin di divisi {cfg?.label||"ini"} yang jadwal maintenance-nya jatuh tempo.</div>
            </div>
            <button onClick={aktifkanPush} disabled={pushLoading} style={{padding:"7px 14px",borderRadius:8,border:"none",background:"#1d4ed8",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>{pushLoading?"...":"Aktifkan"}</button>
            <button onClick={tutupPushBanner} style={{padding:"7px 12px",borderRadius:8,border:"1px solid #cbd5e1",background:"#fff",color:"#64748b",fontSize:11,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>Nanti</button>
          </div>
        )}
        <div style={{flex:1,overflowY:"auto"}}>
          {bottomTab==="arsip"&&arsipSeksi?<ArsipSeksiView seksi={arsipSeksi}/>
            :bottomTab==="komponen"&&komponenPasangTugas?<KomponenPasangView user={user} tugas={komponenPasangTugas}/>
            :user.divisi==="nameplate"?<NameplateView user={user}/>
            :user.divisi==="qc"?<QCChecklistTab user={user}/>
            :user.divisi==="komponen"&&user.sub_bagian==="Warehouse"?<KomponenProgressView user={user} tugas={TUGAS_WAREHOUSE}/>
            :user.divisi==="komponen"&&user.sub_bagian==="QS"?<KomponenProgressView user={user} tugas={TUGAS_QS}/>
            :user.divisi==="komponen"?<TrackingKomponenView user={user}/>
            :<OperatorHome user={user} viewMode={viewMode}/>}
        </div>
        <div style={{position:"sticky",bottom:0,background:"#fff",borderTop:"1.5px solid #e2e8f0",
          display:"flex",minHeight:52,paddingBottom:"env(safe-area-inset-bottom)",zIndex:100,boxShadow:"0 -2px 10px #00000010"}}>
          <button onClick={()=>setBottomTab("tugas")} style={{flex:1,border:"none",background:"none",cursor:"pointer",
            display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
            gap:2,color:bottomTab==="tugas"?cfg?.color:"#94a3b8"}}>
            <span style={{fontSize:18}}>📋</span>
            <span style={{fontSize:9,fontWeight:700,letterSpacing:.3}}>Tugas Saya</span>
          </button>
          {komponenPasangTugas&&(
            <button onClick={()=>setBottomTab("komponen")} style={{flex:1,border:"none",background:"none",cursor:"pointer",
              display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
              gap:2,color:bottomTab==="komponen"?cfg?.color:"#94a3b8"}}>
              <span style={{fontSize:18}}>{komponenPasangTugas.icon}</span>
              <span style={{fontSize:9,fontWeight:700,letterSpacing:.3}}>Komponen</span>
            </button>
          )}
          {arsipSeksi&&(
            <button onClick={()=>setBottomTab("arsip")} style={{flex:1,border:"none",background:"none",cursor:"pointer",
              display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
              gap:2,color:bottomTab==="arsip"?cfg?.color:"#94a3b8"}}>
              <span style={{fontSize:18}}>📦</span>
              <span style={{fontSize:9,fontWeight:700,letterSpacing:.3}}>Arsip</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
