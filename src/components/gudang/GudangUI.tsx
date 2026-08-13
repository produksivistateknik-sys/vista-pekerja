import type { ReactNode } from "react";
import { KoneksiBadge } from "../ui/Primitives";

// ─────────────────────────────────────────────────────────────────────────────
// KOMPONEN UI REUSABLE - KHUSUS divisi Gudang (5 tab: Permintaan/Tarik/Database/
// Progress/Riwayat). Dipisah dari GudangHome.tsx biar bisa dipakai ulang di tiap
// tab tanpa copy-paste style manual. TIDAK dipakai/mempengaruhi divisi lain -
// header global App.tsx & komponen shared (Card/Inp/Btn di ui/Primitives.tsx)
// TIDAK disentuh sama sekali.
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
export function SegmentedControl<T extends string>({options,value,onChange}:{
  options:{key:T;label:string;icon:string}[];value:T;onChange:(k:T)=>void;
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
              alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0,
              boxShadow:active?"0 1px 3px rgba(0,0,0,0.1)":"none"}}>{o.icon}</span>
            <span style={{fontWeight:700,fontSize:12.5}}>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── SECTION CARD (bungkus konten tiap tab) ────────────────────────────────────
export function SectionCard({icon,title,subtitle,right,children}:{
  icon:string;title:string;subtitle?:string;right?:ReactNode;children:ReactNode;
}){
  return(
    <div style={{background:"#fff",borderRadius:20,border:"1px solid #f1f5f9",
      boxShadow:"0 4px 16px rgba(15,23,42,0.06)",padding:16,marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,
        marginBottom:subtitle?14:12}}>
        <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
          <div style={{width:36,height:36,borderRadius:11,background:"#f1f5f9",display:"flex",
            alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{icon}</div>
          <div style={{minWidth:0}}>
            <div style={{fontWeight:800,fontSize:13.5,color:"#0f172a",textTransform:"uppercase" as const,
              letterSpacing:.3}}>{title}</div>
            {subtitle&&<div style={{fontSize:11.5,color:"#94a3b8",marginTop:1}}>{subtitle}</div>}
          </div>
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

// ── EMPTY STATE (SVG flat: kotak terbuka + badge centang hijau, bukan foto/AI-image) ──
function BoxIllustration(){
  return(
    <svg width="88" height="72" viewBox="0 0 88 72" fill="none">
      <path d="M8 28L44 14L80 28V60C80 62.2 78.2 64 76 64H12C9.8 64 8 62.2 8 60V28Z"
        stroke="#cbd5e1" strokeWidth="3" strokeLinejoin="round" fill="#f8fafc"/>
      <path d="M8 28L44 42L80 28" stroke="#cbd5e1" strokeWidth="3" strokeLinejoin="round"/>
      <path d="M44 42V64" stroke="#cbd5e1" strokeWidth="3"/>
      <circle cx="70" cy="18" r="14" fill="#16a34a"/>
      <path d="M64 18l4 4 8-8" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
export function EmptyState({title,description,tip}:{title:string;description:string;tip?:string}){
  return(
    <div style={{textAlign:"center" as const,padding:"32px 16px"}}>
      <div style={{display:"flex",justifyContent:"center",marginBottom:14}}><BoxIllustration/></div>
      <div style={{fontWeight:800,fontSize:15,color:"#334155",marginBottom:4}}>{title}</div>
      <div style={{fontSize:12.5,color:"#94a3b8",lineHeight:1.5,maxWidth:280,margin:"0 auto"}}>{description}</div>
      {tip&&(
        <div style={{display:"flex",alignItems:"flex-start",gap:8,textAlign:"left" as const,marginTop:18,
          border:"1.5px dashed #cbd5e1",borderRadius:12,padding:"10px 12px",background:"#f8fafc"}}>
          <span style={{fontSize:15,flexShrink:0}}>💡</span>
          <span style={{fontSize:11.5,color:"#64748b",lineHeight:1.5}}>{tip}</span>
        </div>
      )}
    </div>
  );
}
