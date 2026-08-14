import { useKoneksiStatus } from "../../lib/koneksi";

// ─────────────────────────────────────────────────────────────────────────────
// SHARED UI COMPONENTS - dipisah dari App.tsx (Sprint 5, 5 Agu 2026)
// ─────────────────────────────────────────────────────────────────────────────
export function Badge({label,color,bg}:any){
  return <span style={{display:"inline-flex",alignItems:"center",padding:"2px 8px",borderRadius:20,
    fontSize:10,fontWeight:700,color,background:bg||color+"18",border:`1px solid ${color}30`,whiteSpace:"nowrap"}}>{label}</span>;
}
// Titik status koneksi kecil di header - "Tersambung"(hijau)/"Koneksi lambat"(kuning)/"Terputus"(merah),
// dilaporkan otomatis dari withRetry() tiap ada request ke Supabase. Gak nyimpen data sendiri, cuma
// baca status global lewat useKoneksiStatus().
export function KoneksiBadge(){
  const status=useKoneksiStatus();
  const cfg={ok:{dot:"#16a34a",label:"Tersambung"},lambat:{dot:"#ca8a04",label:"Koneksi lambat"},putus:{dot:"#dc2626",label:"Terputus"}}[status];
  return <span title={cfg.label} style={{display:"inline-flex",alignItems:"center",gap:4,padding:"2px 8px",borderRadius:20,
    fontSize:10,fontWeight:700,color:cfg.dot,background:cfg.dot+"14",border:`1px solid ${cfg.dot}30`,whiteSpace:"nowrap"}}>
    <span style={{width:6,height:6,borderRadius:"50%",background:cfg.dot,display:"inline-block"}}/>
    {status!=="ok"&&cfg.label}
  </span>;
}
export function Card({children,style={}}:any){
  return <div style={{background:"#fff",borderRadius:12,border:"1.5px solid #e2e8f0",
    padding:16,boxShadow:"0 1px 3px #00000008",...style}}>{children}</div>;
}
export function Lbl({children}:any){
  return <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:5}}>{children}</div>;
}
export function Inp({style={},...p}:any){
  return <input style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #e2e8f0",
    background:"#f8fafc",color:"#1e293b",fontSize:13,...style}} {...p}/>;
}
export function Btn({children,color="#2563eb",outline=false,style={},...p}:any){
  return <button style={{padding:"8px 18px",borderRadius:8,
    border:outline?`1.5px solid ${color}`:"none",cursor:"pointer",
    background:outline?"transparent":color,color:outline?color:"#fff",
    fontWeight:700,fontSize:13,...style}} {...p}>{children}</button>;
}

// ─────────────────────────────────────────────────────────────────────────────
// SectionCard/EmptyState/CardToggle - awalnya dibikin buat redesign Gudang (14 Agu
// 2026, components/gudang/GudangUI.tsx), dipindah ke sini pas dipakai juga buat
// form Permintaan Barang operator (semua divisi) supaya cuma 1 sumber - GudangUI.tsx
// sekarang tinggal import dari sini, behaviour Gudang TIDAK berubah (iconBg/variant
// default persis gaya lama).
// ─────────────────────────────────────────────────────────────────────────────

// ── SECTION CARD (bungkus konten section) ─────────────────────────────────────
export function SectionCard({icon,title,subtitle,right,iconBg,children}:{
  icon:string;title:string;subtitle?:string;right?:any;iconBg?:string;children:any;
}){
  return(
    <div style={{background:"#fff",borderRadius:20,border:"1px solid #f1f5f9",
      boxShadow:"0 4px 16px rgba(15,23,42,0.06)",padding:16,marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,
        marginBottom:subtitle?14:12}}>
        <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
          <div style={{width:36,height:36,borderRadius:11,background:iconBg||"#f1f5f9",display:"flex",
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

// ── EMPTY STATE (SVG flat, bukan foto/AI-image) ───────────────────────────────
// "box-check": kotak terbuka + badge centang hijau (Gudang). "box-paper": kotak
// terbuka + kertas keluar + aksen bintang (form Permintaan operator).
function BoxCheckIllustration(){
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
function BoxPaperIllustration(){
  return(
    <svg width="88" height="76" viewBox="0 0 88 76" fill="none">
      <path d="M8 32L44 18L80 32V64C80 66.2 78.2 68 76 68H12C9.8 68 8 66.2 8 64V32Z"
        stroke="#cbd5e1" strokeWidth="3" strokeLinejoin="round" fill="#f8fafc"/>
      <path d="M8 32L44 46L80 32" stroke="#cbd5e1" strokeWidth="3" strokeLinejoin="round"/>
      <path d="M44 46V68" stroke="#cbd5e1" strokeWidth="3"/>
      <rect x="32" y="2" width="26" height="32" rx="3" fill="#fff" stroke="#cbd5e1" strokeWidth="2.5" transform="rotate(-6 32 2)"/>
      <path d="M37 12h14M37 18h14M37 24h9" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" transform="rotate(-6 32 2)"/>
      <path d="M70 8l2 4 4 2-4 2-2 4-2-4-4-2 4-2 2-4Z" fill="#f59e0b"/>
    </svg>
  );
}
export function EmptyState({title,description,tip,variant="box-check"}:{
  title:string;description:string;tip?:string;variant?:"box-check"|"box-paper";
}){
  return(
    <div style={{textAlign:"center" as const,padding:"32px 16px"}}>
      <div style={{display:"flex",justifyContent:"center",marginBottom:14}}>
        {variant==="box-paper"?<BoxPaperIllustration/>:<BoxCheckIllustration/>}
      </div>
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

// ── CARD TOGGLE (2+ kartu pilihan, dipakai buat toggle BBMB/BBMU) ─────────────
export function CardToggle<T extends string>({options,value,onChange,color}:{
  options:{key:T;label:string;icon:string}[];value:T;onChange:(k:T)=>void;color:string;
}){
  return(
    <div style={{display:"flex",gap:8,marginBottom:14}}>
      {options.map(o=>{
        const active=value===o.key;
        return(
          <button key={o.key} onClick={()=>onChange(o.key)} style={{flex:1,display:"flex",alignItems:"center",
            gap:8,padding:"11px 12px",borderRadius:12,cursor:"pointer",fontFamily:"inherit",
            border:active?`2px solid ${color}`:"1.5px solid #e2e8f0",
            background:active?color+"10":"#fff",transition:"all .15s"}}>
            <span style={{fontSize:17,flexShrink:0}}>{o.icon}</span>
            <span style={{fontWeight:700,fontSize:12.5,color:active?color:"#64748b",textAlign:"left" as const}}>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
