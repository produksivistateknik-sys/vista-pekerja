import { useState, useEffect } from "react";
import { useKoneksiStatus } from "../../lib/koneksi";
import { isPushSupported, subscribeToPush, unsubscribeFromPush, getPushStatus, type PushStatus } from "../../lib/pushNotif";

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

// ── SEARCHABLE SELECT (text input + suggestion list, client-side filter) ─────
// Ganti native <select> buat daftar panjang (mis. 609 komponen BBMB) - operator
// gak perlu scroll manual. Filter murni di JS dari `options` yang sudah di-fetch
// sekali (bukan query server tiap ketikan). Gak pakai library luar (belum ada
// combobox/autocomplete di project ini) - custom kecil, cukup buat kasus ini.
export function SearchableSelect({options,value,onChange,placeholder,disabled,style={}}:{
  options:{id:string;label:string}[];value:string;onChange:(id:string,label:string)=>void;
  placeholder:string;disabled?:boolean;style?:any;
}){
  const[query,setQuery]=useState(()=>options.find(o=>o.id===value)?.label||"");
  const[open,setOpen]=useState(false);
  const[highlight,setHighlight]=useState(0);

  // Sinkronkan teks yang ditampilkan kalau `value` berubah dari luar (mis. form direset).
  useEffect(()=>{
    setQuery(options.find(o=>o.id===value)?.label||"");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[value]);

  // Pencocokan tanpa peduli spasi (fix 2 Sep 2026) - nama komponen kayak "BAUT 5X10 JP" gak
  // ketemu kalau operator ketik "5x10jp" nempel tanpa spasi (kejadian nyata dilaporkan), padahal
  // barangnya ADA. Bandingin versi tanpa-spasi supaya kedua cara ketik sama-sama cocok.
  const stripSpace=(s:string)=>s.replace(/\s+/g,"");
  const q=query.trim().toLowerCase();
  const qNoSpace=stripSpace(q);
  // Dulu dipotong .slice(0,10) - keluarga komponen kayak "BAUT" bisa 85 baris, kepotong 10 hasil
  // pertama urut abjad ("BAUT 10X..." dst) jadi varian yang dicari (mis. "BAUT 5X15...") kesilep
  // meski cocok, kelihatan kayak "hilang". Dropdown-nya sendiri sudah scrollable (maxHeight+overflowY
  // di bawah). Batas dinaikkan ke 150 (bukan dihapus total) - keluarga komponen terbesar yang ada
  // sekarang cuma ~103 baris (SKUN), jadi gak akan kesilep, tapi query super umum 1 huruf (bisa
  // cocok >1000 baris di kategori BBMU) tetap gak bikin render ratusan/ribuan tombol di HP.
  const filtered=q?options.filter(o=>{
    const label=o.label.toLowerCase();
    return label.includes(q)||stripSpace(label).includes(qNoSpace);
  }).slice(0,150):[];

  const pick=(opt:{id:string;label:string})=>{
    setQuery(opt.label);
    setOpen(false);
    onChange(opt.id,opt.label);
  };

  const onKeyDown=(e:any)=>{
    if(!open||filtered.length===0)return;
    if(e.key==="ArrowDown"){e.preventDefault();setHighlight(h=>Math.min(h+1,filtered.length-1));}
    else if(e.key==="ArrowUp"){e.preventDefault();setHighlight(h=>Math.max(h-1,0));}
    else if(e.key==="Enter"){e.preventDefault();pick(filtered[highlight]);}
    else if(e.key==="Escape"){setOpen(false);}
  };

  return(
    <div style={{position:"relative" as const}}>
      <input type="text" value={query} disabled={disabled} placeholder={placeholder}
        onChange={(e:any)=>{
          setQuery(e.target.value);
          setHighlight(0);
          setOpen(true);
          if(value)onChange("","");
        }}
        onFocus={()=>setOpen(true)}
        onBlur={()=>setOpen(false)}
        onKeyDown={onKeyDown}
        style={{width:"100%",padding:"9px 10px",borderRadius:10,border:"1.5px solid #cbd5e1",fontSize:13,
          fontWeight:600,color:"#0f172a",background:disabled?"#f1f5f9":"#fff",fontFamily:"inherit",...style}}/>
      {open&&q&&(
        <div style={{position:"absolute" as const,top:"calc(100% + 4px)",left:0,right:0,zIndex:50,
          background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:10,boxShadow:"0 8px 20px rgba(15,23,42,0.12)",
          maxHeight:240,overflowY:"auto" as const}}>
          {filtered.length===0?(
            <div style={{padding:"10px 12px",fontSize:12,color:"#94a3b8"}}>Komponen tidak ditemukan</div>
          ):filtered.map((o,i)=>(
            <button key={o.id} type="button" onMouseDown={(e:any)=>e.preventDefault()} onClick={()=>pick(o)}
              style={{display:"block",width:"100%",textAlign:"left" as const,padding:"9px 12px",border:"none",
                borderBottom:"1px solid #f1f5f9",background:i===highlight?"#eff6ff":"#fff",color:"#334155",
                fontSize:12.5,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
              {o.label}
            </button>
          ))}
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

// ── TOGGLE NOTIFIKASI PUSH (3 REVISI, 2 Sep 2026) ─────────────────────────────
// Pengaturan eksplisit aktifkan/nonaktifkan push notification per divisi/device - dulu cuma
// banner sekali-muncul (App.tsx showPushBanner) yang begitu ditutup ATAU disetujui gak bisa
// diubah lagi lewat UI (cuma lewat clear-data browser). Dipakai di AkunView (operator) & GudangHeader
// area (Gudang) - keduanya device/login SHARED per divisi, jadi toggle ini efeknya per-device yang
// device itu representasikan sebagai divisi X (bukan per-akun individual, gak ada akun individual).
const PUSH_STATUS_LABEL:Record<PushStatus,string>={active:"Aktif",denied:"Diblokir browser",inactive:"Nonaktif",unsupported:"Tidak didukung"};
export function NotifikasiPushToggle({divisi}:{divisi:string}){
  const[status,setStatus]=useState<PushStatus|"checking">("checking");
  const[loading,setLoading]=useState(false);

  const refresh=async()=>{if(isPushSupported())setStatus(await getPushStatus());else setStatus("unsupported");};
  useEffect(()=>{refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  if(status==="unsupported")return null; // browser gak dukung push sama sekali - gak usah tampilin apa2

  const toggle=async()=>{
    setLoading(true);
    if(status==="active"){
      const res=await unsubscribeFromPush();
      if(!res.success)alert("Gagal nonaktifkan notifikasi: "+(res.error||"unknown error"));
    } else {
      const res=await subscribeToPush(divisi);
      if(!res.success)alert("Gagal aktifkan notifikasi: "+(res.error||"unknown error"));
    }
    await refresh();
    setLoading(false);
  };

  const active=status==="active";
  const denied=status==="denied";

  return(
    <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:12,
      background:active?"#f0fdf4":"#f8fafc",border:`1px solid ${active?"#bbf7d0":"#e2e8f0"}`}}>
      <div style={{width:34,height:34,borderRadius:10,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",
        background:active?"#16a34a":"#e2e8f0",color:active?"#fff":"#94a3b8",fontSize:15}}>🔔</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:12.5,fontWeight:700,color:"#1e293b"}}>Notifikasi Push {status==="checking"?"...":PUSH_STATUS_LABEL[status]}</div>
        <div style={{fontSize:10.5,color:"#94a3b8"}}>
          {denied?"Diblokir di setting browser/HP - aktifkan manual, gak bisa lewat tombol ini":"Perangkat ini akan/tidak akan dapat notifikasi permintaan barang, dll"}
        </div>
      </div>
      {!denied&&status!=="checking"&&(
        <button onClick={toggle} disabled={loading} style={{flexShrink:0,padding:"7px 14px",borderRadius:8,border:"none",
          background:loading?"#94a3b8":(active?"#fef2f2":"#16a34a"),color:active?"#dc2626":"#fff",
          fontSize:11.5,fontWeight:700,cursor:loading?"default":"pointer",fontFamily:"inherit",whiteSpace:"nowrap" as const}}>
          {loading?"...":active?"Nonaktifkan":"Aktifkan"}
        </button>
      )}
    </div>
  );
}
