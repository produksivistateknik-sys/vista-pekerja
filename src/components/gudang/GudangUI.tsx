import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { KoneksiBadge } from "../ui/Primitives";

export { SectionCard, EmptyState } from "../ui/Primitives";

// ─────────────────────────────────────────────────────────────────────────────
// KOMPONEN UI REUSABLE - KHUSUS divisi Gudang (5 tab: Permintaan/Tarik/Database/
// Progress/Riwayat). Dipisah dari GudangHome.tsx biar bisa dipakai ulang di tiap
// tab tanpa copy-paste style manual. GudangHeader/SegmentedControl tetap di sini
// (Gudang-spesifik) - SectionCard/EmptyState (14 Agu 2026) dipindah ke
// ui/Primitives.tsx karena sekarang dipakai juga di form Permintaan operator
// (semua divisi), di-re-export di sini biar import lama (./gudang/GudangUI)
// tetap jalan tanpa ubah tiap file tab Gudang satu-satu.
// ─────────────────────────────────────────────────────────────────────────────

// ── HEADER (Gudang-only, ganti header global App.tsx yang dilewati khusus buat divisi ini) ──
export function GudangHeader({subtitle,notifCount,onBellClick,onLogout}:{
  subtitle:string;notifCount:number;onBellClick:()=>void;onLogout:()=>void;
}){
  return(
    <div style={{background:"#fff",borderBottom:"1.5px solid #e2e8f0",padding:"10px 16px",
      paddingTop:"max(10px, env(safe-area-inset-top))",flexShrink:0,boxShadow:"0 1px 4px #00000008"}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10}}>
        <div style={{minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:19}}>⚡</span>
            <span style={{fontWeight:800,fontSize:17,color:"#0f172a",letterSpacing:-.2}}>PROSES PRODUKSI</span>
          </div>
          <div style={{fontSize:12,color:"#94a3b8",marginTop:2,marginLeft:27}}>{subtitle}</div>
        </div>
        <button onClick={onBellClick} title="Notifikasi" style={{position:"relative",flexShrink:0,width:38,height:38,
          border:"1px solid #e2e8f0",borderRadius:10,background:"#f8fafc",display:"flex",
          alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:16,color:"#64748b"}}>
          🔔
          {notifCount>0&&<span style={{position:"absolute",top:6,right:7,width:8,height:8,
            borderRadius:"50%",background:"#f97316",border:"1.5px solid #fff"}}/>}
        </button>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap" as const,rowGap:6,marginTop:10}}>
        <KoneksiBadge/>
        <span style={{display:"inline-flex",alignItems:"center",gap:4,background:"#eff6ff",color:"#0369a1",
          border:"1px solid #0369a130",borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700}}>🚚 Gudang</span>
        <div style={{flex:1}}/>
        <button onClick={()=>window.location.reload()} title="Refresh" style={{width:34,height:34,
          border:"1px solid #e2e8f0",borderRadius:8,background:"#f8fafc",display:"flex",alignItems:"center",
          justifyContent:"center",cursor:"pointer",fontSize:13,color:"#64748b"}}>🔄</button>
        <button onClick={onLogout} style={{display:"flex",alignItems:"center",gap:5,background:"#fef2f2",
          border:"1.5px solid #fecaca",color:"#dc2626",borderRadius:8,padding:"8px 12px",cursor:"pointer",
          fontSize:12,fontWeight:700,fontFamily:"inherit"}}>
          <span>⏻</span> Keluar
        </button>
      </div>
    </div>
  );
}

// ── SEGMENTED CONTROL (icon-in-circle + underline di opsi aktif) ─────────────
// `dot` opsional per opsi (2 Sep 2026) - titik merah kecil di pojok icon, dipakai buat notifikasi
// "belum dibaca" (mis. tab BBMB/BBMU di PermintaanGudangTab) - generik, gak spesifik ke 1 fitur.
export function SegmentedControl<T extends string>({options,value,onChange}:{
  options:{key:T;label:string;icon:string;dot?:boolean}[];value:T;onChange:(k:T)=>void;
}){
  return(
    <div style={{display:"flex",gap:6,marginBottom:14,background:"#f1f5f9",borderRadius:14,padding:4}}>
      {options.map(o=>{
        const active=value===o.key;
        return(
          <button key={o.key} onClick={()=>onChange(o.key)} style={{flex:1,display:"flex",alignItems:"center",
            justifyContent:"center",gap:7,padding:"8px 6px",border:"none",
            borderBottom:active?"3px solid #0369a1":"3px solid transparent",borderRadius:"10px 10px 0 0",
            cursor:"pointer",fontFamily:"inherit",background:active?"#eff6ff":"transparent",
            color:active?"#0369a1":"#64748b",transition:"all .15s"}}>
            <span style={{width:22,height:22,borderRadius:"50%",background:"#fff",display:"flex",
              alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0,position:"relative",
              boxShadow:active?"0 1px 3px rgba(0,0,0,0.1)":"none"}}>
              {o.icon}
              {o.dot&&<span style={{position:"absolute",top:-2,right:-2,width:8,height:8,borderRadius:"50%",background:"#dc2626",border:"1.5px solid #fff"}}/>}
            </span>
            <span style={{fontWeight:700,fontSize:12.5}}>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── LOCK/UNLOCK PERMINTAAN (2 Sep 2026) ───────────────────────────────────────
// Gudang bisa "tutup" penerimaan permintaan baru dari operator - baca/tulis gudang_lock_status
// (1 baris, id=1). Realtime supaya kalau di-toggle dari 1 device Gudang, device Gudang lain yang
// kebetulan login bareng ikut ke-update tampilannya juga (bukan cuma operator).
export function GudangLockToggle({adminName}:{adminName:string}){
  const[locked,setLocked]=useState<boolean|null>(null); // null = belum kemuat
  const[loading,setLoading]=useState(false);

  const fetchStatus=async()=>{
    const{data}=await supabase.from("gudang_lock_status").select("is_locked").eq("id",1).single();
    setLocked(data?.is_locked??false);
  };
  useEffect(()=>{
    fetchStatus();
    const ch=supabase.channel("realtime-gudang-lock-status")
      .on("postgres_changes",{event:"*",schema:"public",table:"gudang_lock_status"},fetchStatus)
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);

  const toggle=async()=>{
    if(locked===null)return;
    const next=!locked;
    if(next&&!window.confirm("Kunci permintaan? Operator TIDAK akan bisa kirim permintaan baru (BBMB & BBMU) sampai Anda buka lagi."))return;
    setLoading(true);
    await supabase.from("gudang_lock_status").update({is_locked:next,updated_by:adminName,updated_at:new Date().toISOString()}).eq("id",1);
    setLoading(false);
  };

  if(locked===null)return null;

  return(
    <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:12,
      background:locked?"#fef2f2":"#f0fdf4",border:`1px solid ${locked?"#fecaca":"#bbf7d0"}`}}>
      <div style={{width:34,height:34,borderRadius:10,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",
        background:locked?"#dc2626":"#16a34a",color:"#fff",fontSize:15}}>{locked?"🔒":"🔓"}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:12.5,fontWeight:700,color:"#1e293b"}}>Permintaan Barang {locked?"Terkunci":"Terbuka"}</div>
        <div style={{fontSize:10.5,color:"#94a3b8"}}>
          {locked?"Operator tidak bisa kirim permintaan baru saat ini":"Operator bisa kirim permintaan seperti biasa"}
        </div>
      </div>
      <button onClick={toggle} disabled={loading} style={{flexShrink:0,padding:"7px 14px",borderRadius:8,border:"none",
        background:loading?"#94a3b8":(locked?"#16a34a":"#dc2626"),color:"#fff",
        fontSize:11.5,fontWeight:700,cursor:loading?"default":"pointer",fontFamily:"inherit",whiteSpace:"nowrap" as const}}>
        {loading?"...":locked?"Buka":"Kunci"}
      </button>
    </div>
  );
}
