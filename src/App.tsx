import { useState, useMemo, useEffect } from "react";
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
  "POTONG":"#f59e0b","BENDING":"#10b981","STEL":"#3b82f6","PAINTING":"#8b5cf6",
  "RAKIT":"#ec4899","PASANG KOMPONEN":"#f97316","BUSBAR":"#06b6d4",
  "WIRING CONTROL":"#6366f1","WIRING POWER":"#ef4444","QC TEST":"#14b8a6","PACKING":"#84cc16",
};

const PRIORITAS_COLOR: Record<string,string> = {"Tinggi":"#dc2626","Sedang":"#f59e0b","Rendah":"#22c55e"};

const DIVISI_CONFIG: Record<string,any> = {
  mekanik:    {label:"Mekanik",       icon:"🔧", color:"#d97706",bg:"#fffbeb",password:"mekanik123", proses:["POTONG","BENDING","STEL"]},
  painting:   {label:"Painting",      icon:"🎨", color:"#7c3aed",bg:"#f5f3ff",password:"painting123",proses:["PAINTING"]},
  assembling: {label:"Assembling",    icon:"⚙️", color:"#059669",bg:"#ecfdf5",password:"assembling123",proses:["RAKIT","PASANG KOMPONEN","BUSBAR"]},
  wiring_ctrl:{label:"Wiring Control",icon:"⚡", color:"#6366f1",bg:"#eef2ff",password:"wiring123",  proses:["WIRING CONTROL"]},
  wiring_pwr: {label:"Wiring Power",  icon:"🔌", color:"#be185d",bg:"#fdf2f8",password:"wiringp123", proses:["WIRING POWER"]},
  qc:         {label:"QC",            icon:"🔍", color:"#16a34a",bg:"#f0fdf4",password:"qc123",      proses:["QC TEST","PACKING"]},
};

const TODAY = new Date().toISOString().slice(0,10);

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
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
function addDays(s:string,n:number){ const d=new Date(s); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); }
function fmtDate(s:string){ return new Date(s).toLocaleDateString("id-ID",{weekday:"short",day:"numeric",month:"short",year:"numeric"}); }
function fmtShort(s:string){ return new Date(s).toLocaleDateString("id-ID",{day:"numeric",month:"short"}); }

// ─────────────────────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────────────────────
const GCss=`
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
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
function Sel({style={},children,...p}:any){
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
// LANDING PAGE
// ─────────────────────────────────────────────────────────────────────────────
function LandingPage({onEnter}:any){
  return(
    <div style={{minHeight:"100vh",background:"#f8fafc",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
      <style>{GCss}</style>
      <style>{`
        @keyframes float1{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-12px) rotate(-2deg)}}
        @keyframes float2{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @keyframes float3{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
        @keyframes landIn{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        .land-in{animation:landIn .6s cubic-bezier(.22,1,.36,1) forwards}
        .land-in-2{animation:landIn .6s .15s cubic-bezier(.22,1,.36,1) both}
        .land-in-3{animation:landIn .6s .3s cubic-bezier(.22,1,.36,1) both}
        .land-in-4{animation:landIn .6s .45s cubic-bezier(.22,1,.36,1) both}
        .cta-btn:hover{background:#1d4ed8!important;transform:translateY(-1px);box-shadow:0 8px 28px #2563eb44!important}
        .cta-btn{transition:all .18s!important}
        .nav-link{color:#475569;font-size:13px;font-weight:600;cursor:pointer;padding:6px 4px;border-bottom:2px solid transparent;transition:all .15s}
        .nav-link:hover{color:#1d4ed8;border-bottom-color:#1d4ed8}
      `}</style>
      <nav style={{background:"#fff",borderBottom:"1px solid #e2e8f0",padding:"0 48px",height:64,
        display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100,
        boxShadow:"0 1px 8px #00000008"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:32,height:32,background:"linear-gradient(135deg,#f97316,#ea580c)",borderRadius:8,
            display:"flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{color:"#fff",fontWeight:900,fontSize:15,letterSpacing:-1}}>V</span>
          </div>
          <div>
            <div style={{fontWeight:900,fontSize:15,color:"#1e293b",letterSpacing:.5,lineHeight:1}}>
              <span style={{color:"#ea580c"}}>VISTA</span> TEKNIK
            </div>
            <div style={{fontSize:8,color:"#94a3b8",fontWeight:600,letterSpacing:.8,textTransform:"uppercase"}}>Solusi Produksi Panel Listrik</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:28}}>
          {["Beranda","Produksi","Material","QC / Testing","Laporan"].map(l=>(
            <span key={l} className="nav-link">{l}</span>
          ))}
        </div>
        <div style={{width:32,height:32,borderRadius:"50%",background:"#eff6ff",display:"flex",
          alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"#1d4ed8"}}>AD</div>
      </nav>
      <div style={{maxWidth:1280,margin:"0 auto",padding:"72px 48px 80px",display:"grid",
        gridTemplateColumns:"1fr 1fr",gap:60,alignItems:"center"}}>
        <div>
          <div className="land-in" style={{display:"inline-flex",alignItems:"center",gap:8,
            background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:20,padding:"5px 14px",
            fontSize:12,fontWeight:700,color:"#1d4ed8",marginBottom:24}}>
            <span style={{width:7,height:7,borderRadius:"50%",background:"#3b82f6",display:"inline-block"}}/>
            Sistem Terintegrasi
          </div>
          <h1 className="land-in-2" style={{fontSize:52,fontWeight:900,lineHeight:1.1,color:"#0f172a",marginBottom:16}}>
            Your Electrical<br/><span style={{color:"#1d4ed8"}}>Safety Is Our Priority</span>
          </h1>
          <p className="land-in-3" style={{fontSize:15,color:"#64748b",lineHeight:1.8,marginBottom:36,maxWidth:400}}>
            Solusi lengkap untuk produksi panel listrik yang lebih cepat, akurat, dan terorganisir.
          </p>
          <div className="land-in-4" style={{display:"flex",gap:14,alignItems:"center"}}>
            <button className="cta-btn" onClick={onEnter}
              style={{background:"#2563eb",color:"#fff",fontWeight:800,fontSize:15,padding:"14px 32px",
                borderRadius:12,border:"none",cursor:"pointer",boxShadow:"0 4px 18px #2563eb33",
                display:"flex",alignItems:"center",gap:8}}>
              Masuk ke Aplikasi <span style={{fontSize:18}}>›</span>
            </button>
          </div>
        </div>
        <div style={{position:"relative",height:420,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{position:"absolute",width:380,height:380,borderRadius:"50%",
            background:"linear-gradient(135deg,#eff6ff 0%,#e0f2fe 100%)",zIndex:0}}/>
          <div style={{position:"relative",zIndex:1,animation:"float1 4s ease-in-out infinite"}}>
            <svg width="220" height="300" viewBox="0 0 220 300" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="20" y="10" width="180" height="280" rx="6" fill="#d1d5db" stroke="#9ca3af" strokeWidth="1.5"/>
              <rect x="26" y="16" width="168" height="268" rx="4" fill="#e5e7eb"/>
              <rect x="34" y="24" width="152" height="80" rx="3" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="1"/>
              <rect x="40" y="30" width="60" height="16" rx="2" fill="#9ca3af"/>
              <rect x="108" y="30" width="70" height="16" rx="2" fill="#9ca3af"/>
              <rect x="40" y="52" width="40" height="10" rx="2" fill="#6b7280"/>
              <rect x="86" y="52" width="40" height="10" rx="2" fill="#6b7280"/>
              <rect x="132" y="52" width="40" height="10" rx="2" fill="#6b7280"/>
              <rect x="40" y="68" width="140" height="28" rx="2" fill="#374151" stroke="#1f2937" strokeWidth="1"/>
              <rect x="46" y="74" width="8" height="16" rx="1" fill="#f59e0b"/>
              <rect x="58" y="74" width="8" height="16" rx="1" fill="#f59e0b"/>
              <rect x="70" y="74" width="8" height="16" rx="1" fill="#ef4444"/>
              <rect x="82" y="74" width="8" height="16" rx="1" fill="#22c55e"/>
              <rect x="34" y="112" width="152" height="120" rx="3" fill="#f9fafb" stroke="#d1d5db" strokeWidth="1"/>
              <rect x="42" y="120" width="60" height="8" rx="1" fill="#d1d5db"/>
              <circle cx="152" cy="128" r="10" fill="#dc2626" stroke="#b91c1c" strokeWidth="1"/>
              <circle cx="172" cy="128" r="10" fill="#f59e0b" stroke="#d97706" strokeWidth="1"/>
              <circle cx="152" cy="152" r="10" fill="#22c55e" stroke="#16a34a" strokeWidth="1"/>
              <circle cx="172" cy="152" r="10" fill="#3b82f6" stroke="#2563eb" strokeWidth="1"/>
              <rect x="34" y="240" width="152" height="30" rx="3" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="1"/>
              <rect x="40" y="248" width="50" height="14" rx="2" fill="#374151"/>
              <rect x="96" y="248" width="50" height="14" rx="2" fill="#374151"/>
              <polygon points="110,205 120,222 100,222" fill="#f59e0b"/>
              <text x="110" y="219" textAnchor="middle" fontSize="9" fill="#fff" fontWeight="bold">!</text>
            </svg>
          </div>
          <div style={{position:"absolute",top:30,left:-10,animation:"float2 3.5s ease-in-out infinite",
            background:"#fff",borderRadius:14,padding:"14px 18px",boxShadow:"0 8px 32px #00000018",minWidth:170,zIndex:2}}>
            <div style={{fontSize:11,color:"#64748b",fontWeight:600,marginBottom:4}}>Progress Produksi</div>
            <div style={{fontSize:28,fontWeight:900,color:"#2563eb",lineHeight:1}}>75%</div>
            <div style={{margin:"8px 0 6px",height:5,background:"#e2e8f0",borderRadius:99}}>
              <div style={{width:"75%",height:"100%",background:"#2563eb",borderRadius:99}}/>
            </div>
            <div style={{fontSize:10,color:"#22c55e",fontWeight:700}}>● On Progress</div>
          </div>
          <div style={{position:"absolute",top:60,right:-20,animation:"float3 4.2s ease-in-out infinite",
            background:"#fff",borderRadius:14,padding:"14px 18px",boxShadow:"0 8px 32px #00000018",minWidth:140,zIndex:2}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
              <div style={{width:28,height:28,background:"#eff6ff",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>📋</div>
              <div style={{fontSize:11,color:"#64748b",fontWeight:600}}>Order Aktif</div>
            </div>
            <div style={{fontSize:32,fontWeight:900,color:"#1d4ed8",lineHeight:1}}>12</div>
            <div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>Pesanan berjalan</div>
          </div>
          <div style={{position:"absolute",bottom:40,left:-10,animation:"float2 3.8s 1s ease-in-out infinite",
            background:"#fff",borderRadius:14,padding:"14px 18px",boxShadow:"0 8px 32px #00000018",minWidth:160,zIndex:2}}>
            <div style={{fontSize:11,color:"#64748b",fontWeight:600,marginBottom:4}}>QC Pass Rate</div>
            <div style={{display:"flex",alignItems:"baseline",gap:8}}>
              <div style={{fontSize:28,fontWeight:900,color:"#1d4ed8",lineHeight:1}}>98%</div>
              <div style={{fontSize:11,color:"#22c55e",fontWeight:700}}>↑ 4%</div>
            </div>
            <svg width="100" height="28" viewBox="0 0 100 28" fill="none" style={{marginTop:6}}>
              <polyline points="0,22 20,18 40,20 60,12 80,8 100,4" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" fill="none"/>
              <circle cx="100" cy="4" r="3" fill="#2563eb"/>
            </svg>
          </div>
        </div>
      </div>
      <div style={{background:"#fff",borderTop:"1px solid #f1f5f9",borderBottom:"1px solid #f1f5f9",padding:"32px 48px"}}>
        <div style={{maxWidth:1280,margin:"0 auto",display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:32}}>
          {[
            {icon:"🔧",title:"Produksi",sub:"Kelola proses produksi"},
            {icon:"📦",title:"Material",sub:"Stok & BOM"},
            {icon:"📋",title:"QC / Testing",sub:"Kontrol kualitas"},
            {icon:"📊",title:"Laporan",sub:"Data & laporan"},
          ].map(f=>(
            <div key={f.title} style={{display:"flex",alignItems:"center",gap:14,
              padding:"16px 20px",borderRadius:12,border:"1px solid #f1f5f9",cursor:"pointer"}}>
              <div style={{width:44,height:44,background:"#eff6ff",borderRadius:12,display:"flex",
                alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{f.icon}</div>
              <div>
                <div style={{fontWeight:800,fontSize:14,color:"#1e293b"}}>{f.title}</div>
                <div style={{fontSize:12,color:"#94a3b8",marginTop:2}}>{f.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{textAlign:"center",padding:"24px",fontSize:12,color:"#94a3b8"}}>
        © 2025 <span style={{color:"#ea580c",fontWeight:700}}>Vista Teknik</span>. All rights reserved.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────────────────────
function Login({onLogin}:any){
  const [div,setDiv]=useState("mekanik");
  const [namaList,setNamaList]=useState<any[]>([]);
  const [selNama,setSelNama]=useState("");
  const [pwd,setPwd]=useState("");
  const [err,setErr]=useState("");
  const [show,setShow]=useState(false);
  const [loading,setLoading]=useState(false);

  useEffect(()=>{
    if(div){
      supabase.from("pekerja").select("id,nama").eq("divisi",div).then(({data})=>{
        setNamaList(data??[]);
        setSelNama("");
      });
    }
  },[div]);

  const go=async()=>{
    if(!selNama){setErr("Pilih nama!");return;}
    if(pwd!==DIVISI_CONFIG[div].password){setErr("Password salah!");return;}
    setLoading(true);
    const found=namaList.find(p=>p.nama===selNama);
    if(!found){setErr("Nama tidak ditemukan!");setLoading(false);return;}
    onLogin({...found,divisi:div});
    setLoading(false);
  };

  const cfg=DIVISI_CONFIG[div];

  return(
    <div style={{minHeight:"100vh",display:"flex"}}>
      <style>{GCss}</style>
      <div style={{flex:1,background:"linear-gradient(145deg,#1e3a8a,#1d4ed8 60%,#3b82f6)",
        display:"flex",flexDirection:"column",justifyContent:"center",padding:"60px 72px",color:"#fff"}}>
        <div style={{fontSize:44,marginBottom:10}}>⚡</div>
        <div style={{fontSize:32,fontWeight:800,lineHeight:1.2,marginBottom:14}}>Monitoring<br/>Proses Produksi</div>
        <div style={{fontSize:14,opacity:.75,lineHeight:1.8,maxWidth:320}}>Platform terpadu monitoring progress produksi panel listrik secara real-time.</div>
        <div style={{marginTop:36,display:"flex",flexDirection:"column",gap:10}}>
          {["Tabel produksi harian lengkap","Shift & PIC per komponen","Prioritas dari Raw Schedule","Status H-7 Mendesak"].map(f=>(
            <div key={f} style={{display:"flex",alignItems:"center",gap:10,fontSize:13,opacity:.85}}>
              <span style={{width:18,height:18,borderRadius:"50%",background:"#ffffff25",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10}}>✓</span>{f}
            </div>
          ))}
        </div>
      </div>
      <div style={{width:440,display:"flex",alignItems:"center",justifyContent:"center",padding:40,background:"#fff"}}>
        <div style={{width:"100%",maxWidth:340}} className="fi">
          <div style={{fontWeight:800,fontSize:22,color:"#1e293b",marginBottom:4}}>Selamat Datang 👋</div>
          <div style={{fontSize:13,color:"#64748b",marginBottom:28}}>Masuk ke akun Anda</div>
          <div style={{marginBottom:12}}><Lbl>Divisi</Lbl>
            <Sel value={div} onChange={(e:any)=>{setDiv(e.target.value);setErr("");}}>
              {Object.entries(DIVISI_CONFIG).map(([k,v]:any)=><option key={k} value={k}>{v.icon} {v.label}</option>)}
            </Sel>
          </div>
          <div style={{marginBottom:12}}><Lbl>Nama</Lbl>
            <Sel value={selNama} onChange={(e:any)=>setSelNama(e.target.value)}>
              <option value="">-- Pilih Nama --</option>
              {namaList.map(p=><option key={p.id} value={p.nama}>{p.nama}</option>)}
            </Sel>
          </div>
          <div style={{marginBottom:20}}><Lbl>Password</Lbl>
            <div style={{position:"relative"}}>
              <Inp type={show?"text":"password"} value={pwd}
                onChange={(e:any)=>{setPwd(e.target.value);setErr("");}}
                onKeyDown={(e:any)=>e.key==="Enter"&&go()}
                placeholder="Masukkan password..."
                style={{border:`1.5px solid ${err?"#fca5a5":"#e2e8f0"}`,paddingRight:40}}/>
              <button onClick={()=>setShow(!show)} style={{position:"absolute",right:10,top:"50%",
                transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#94a3b8",fontSize:15}}>
                {show?"🙈":"👁"}
              </button>
            </div>
            {err&&<div style={{fontSize:11,color:"#dc2626",marginTop:5}}>{err}</div>}
          </div>
          <Btn color="#1d4ed8" style={{width:"100%",padding:13,fontSize:15,boxShadow:"0 4px 14px #2563eb33"}} onClick={go}>
            {loading?"Memuat...":"Masuk →"}
          </Btn>
          <div style={{marginTop:16,padding:"8px 12px",background:"#f8fafc",borderRadius:8,fontSize:11,color:"#94a3b8"}}>
            💡 Demo: <span style={{fontFamily:"'DM Mono',monospace",color:"#475569"}}>{cfg.password}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OPERATOR VIEW — tabel besar per proses (connect ke Supabase)
// ─────────────────────────────────────────────────────────────────────────────
function OperatorView({user}:any){
  const [viewDate,setViewDate]=useState(TODAY);
  const [shift,setShift]=useState("1");
  const [shiftSet,setShiftSet]=useState(false);
  const [catatan,setCatatan]=useState<Record<string,string>>({});
  const [savedNote,setSavedNote]=useState<Record<string,boolean>>({});
  const [lockMsg,setLockMsg]=useState(false);
  const [lockedCells,setLockedCells]=useState<Record<string,boolean>>({});
  const [fProyek,setFProyek]=useState("ALL");
  const [fPanel,setFPanel]=useState("ALL");
  const [renhar,setRenhar]=useState<any[]>([]);
  const [panelsMap,setPanelsMap]=useState<Record<number,any>>({});
  const [loadingData,setLoadingData]=useState(false);
  const [pekerjaList,setPekerjaList]=useState<any[]>([]);

  const cfg=DIVISI_CONFIG[user.divisi];
  const isQtyBased=QTY_DIVISI.includes(user.divisi);
  const myProses:string[]=cfg.proses||[];

  // Load data dari Supabase
  useEffect(()=>{
    loadData();
    // load semua pekerja untuk kolom OPERATOR
    supabase.from("pekerja").select("id,nama,divisi").then(({data})=>setPekerjaList(data??[]));
  },[viewDate,user.divisi]);

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
    setLoadingData(false);
  };

  const todayTasks=useMemo(()=>renhar,[renhar]);
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

  // Update qty proses ke local state + Supabase
  const updateQtyProses=async(panelId:number,kode:string,proses:string,val:number)=>{
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
    // update local
    setPanelsMap(prev=>({...prev,[panelId]:{...panel,checklist:newChecklist}}));
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
  };

  // Kunci progress — simpan ke Supabase
  const lockProgress=async()=>{
    let count=0;
    const newLocked={...lockedCells};

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
            const pct=getProgressOnDate(cl,pr,viewDate);
            if(pct===0)return;
            const prevHist=cl.history?.[pr]||[];
            const existIdx=prevHist.findIndex((h:any)=>h.tanggal===viewDate&&String(h.shift)===String(shift));
            if(existIdx>=0){
              if(prevHist[existIdx].pct!==pct){
                const updatedHist=[...prevHist];
                updatedHist[existIdx]={...updatedHist[existIdx],pct,ts:new Date().toISOString()};
                newChecklist[kode]={...cl,history:{...(cl.history||{}),[pr]:updatedHist}};
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
          });
        });
      });

      // simpan ke Supabase
      await supabase.from("panels").update({checklist:newChecklist}).eq("id",Number(panelId));
      setPanelsMap(prev=>({...prev,[panelId]:{...panel,checklist:newChecklist}}));
    }

    // simpan catatan ke renhar
    for(const task of todayTasks){
      const proses=task.proses;
      if(catatan[proses]?.trim()){
        await supabase.from("renhar").update({catatan:catatan[proses]}).eq("id",task.id);
      }
    }

    if(count>0||Object.keys(catatan).some(k=>catatan[k]?.trim())){
      setLockedCells(newLocked);
      setLockMsg(true);
      setTimeout(()=>setLockMsg(false),2500);
    }
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
        tasks.forEach((task:any)=>{
          const panelId=task.panel_id||task.panelId;
          const panel=panelsMap[panelId];
          if(!panel)return;
          const panelCfg=PANEL_TYPES[panel.tipe];
          if(!panelCfg)return;
          const allItems=panelCfg.wps.flatMap((w:any)=>w.items);
          const priColor=PRIORITAS_COLOR[task.prioritas||"Sedang"]||"#64748b";

          (task.komponen||[]).forEach((kode:string,ki:number)=>{
            const item=allItems.find((it:any)=>it.kode===kode);
            if(!item)return;
            const cl=panel.checklist?.[kode]||{qty:0,qtyProses:{},progress:{},progressByDate:{},qtyProsesByDate:{}};
            const qtyKomp=cl.qty||0;
            const qtyProses=cl.qtyProsesByDate?.[proses]?.[viewDate]??cl.qtyProses?.[proses]??0;
            const pct=getProgressOnDate(cl,proses,viewDate);
            const wpDef=panelCfg.wps.find((w:any)=>w.items.some((it:any)=>it.kode===kode));
            rows.push({task,panel,panelId,item,kode,qtyKomp,qtyProses,pct,priColor,ki,wpDef,
              isFirst:ki===0,rowCount:(task.komponen||[]).length});
          });
        });

        const isDone=(r:any)=>r.pct===100;

        return(
          <Card key={proses} style={{marginBottom:20,padding:0,overflow:"hidden"}}>
            <div style={{background:pc,padding:"10px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontWeight:800,fontSize:14,color:"#fff"}}>{proses}</div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <span style={{fontSize:12,color:"#ffffff99"}}>Shift {shift}</span>
                <span style={{background:"#ffffff22",color:"#fff",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>
                  {rows.filter((r:any)=>isDone(r)).length}/{rows.length} selesai
                </span>
              </div>
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead>
                  <tr>
                    <th style={{...thS,textAlign:"left",minWidth:40,position:"sticky",left:0,zIndex:4}}>NO</th>
                    <th style={{...thS,textAlign:"left",minWidth:100,position:"sticky",left:40,zIndex:4}}>PROYEK</th>
                    <th style={{...thS,textAlign:"left",minWidth:160,position:"sticky",left:140,zIndex:4}}>NAMA PANEL</th>
                    <th style={{...thS,minWidth:50}}>WP</th>
                    <th style={{...thS,textAlign:"left",minWidth:160}}>KOMPONEN</th>
                    <th style={{...thS,minWidth:50}}>KODE</th>
                    <th style={{...thS,minWidth:70}}>PRIORITAS</th>
                    <th style={{...thS,minWidth:60}}>QTY KOMP</th>
                    {isQtyBased&&<th style={{...thS,minWidth:70}}>QTY PROSES</th>}
                    <th style={{...thS,minWidth:70}}>PROGRESS</th>
                    <th style={{...thS,textAlign:"left",minWidth:140}}>OPERATOR</th>
                    {!isQtyBased&&PCT_STEPS.map(s=>(
                      <th key={s} style={{...thS,minWidth:50,borderBottom:`2px solid ${pc}`}}>{s}%</th>
                    ))}
                    <th style={{...thS,minWidth:80}}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r:any,ri:number)=>{
                    const done=isDone(r);
                    const rBg=done?"#f0fdf4":ri%2===0?"#fff":"#f8fafc";
                    const td:any={padding:"6px 8px",borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",
                      background:rBg,verticalAlign:"middle"};
                    return(
                      <tr key={`${r.task.id}-${r.kode}`}>
                        <td style={{...td,position:"sticky",left:0,zIndex:1,textAlign:"center",fontFamily:"'DM Mono',monospace",color:"#94a3b8",fontWeight:700}}>{ri+1}</td>
                        <td style={{...td,position:"sticky",left:40,zIndex:1,fontWeight:600,fontSize:11,color:"#475569",whiteSpace:"nowrap"}}>{r.task.proyek}</td>
                        <td style={{...td,position:"sticky",left:140,zIndex:1,fontWeight:600,fontSize:11,color:"#1e293b",whiteSpace:"nowrap"}}>
                          <span style={{fontSize:10,color:"#94a3b8",marginRight:4}}>#{r.panel.no_pnl||r.panel.noPnl}</span>{r.panel.nama}
                          {r.task.carryOver&&r.isFirst&&(
                            <span style={{marginLeft:6,background:"#fef9c3",border:"1px solid #fde047",color:"#92400e",
                              borderRadius:4,padding:"1px 6px",fontSize:9,fontWeight:700}}>↩ Lanjutan</span>
                          )}
                        </td>
                        <td style={{...td,textAlign:"center"}}>
                          {r.wpDef&&<span style={{background:r.wpDef.color+"18",color:r.wpDef.color,border:`1px solid ${r.wpDef.color}33`,borderRadius:4,padding:"1px 6px",fontSize:10,fontWeight:700}}>{r.wpDef.wp}</span>}
                        </td>
                        <td style={{...td,fontWeight:600,color:"#374151",whiteSpace:"nowrap"}}>{r.item.nama}</td>
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
                        {isQtyBased&&(()=>{
                          const locked=isCellLocked(r.panelId,r.kode,proses);
                          const floor=getLockedFloor(r.panelId,r.kode,proses);
                          return(
                            <td style={{...td,textAlign:"center"}}>
                              {locked?(
                                <span style={{width:60,padding:"4px 6px",borderRadius:7,border:"1.5px solid #16a34a",
                                  background:"#f0fdf4",fontSize:12,textAlign:"center",fontWeight:700,
                                  fontFamily:"'DM Mono',monospace",color:"#16a34a",display:"inline-block"}}>
                                  {r.qtyProses} 🔒
                                </span>
                              ):(
                                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                                  <input type="number" min={floor} max={r.qtyKomp} value={r.qtyProses}
                                    onChange={e=>updateQtyProses(r.panelId,r.kode,proses,Number(e.target.value))}
                                    disabled={r.qtyKomp===0}
                                    style={{width:60,padding:"4px 6px",borderRadius:7,
                                      border:`1.5px solid ${r.qtyKomp===0?"#e2e8f0":floor>0?"#f59e0b":"#2563eb"}`,
                                      background:r.qtyKomp===0?"#f8fafc":floor>0?"#fffbeb":"#eff6ff",
                                      fontSize:12,textAlign:"center",fontWeight:700,
                                      fontFamily:"'DM Mono',monospace",
                                      color:r.qtyKomp===0?"#cbd5e1":floor>0?"#b45309":"#1d4ed8"}}/>
                                  {floor>0&&<span style={{fontSize:9,color:"#f59e0b",fontWeight:700}}>min {floor} 🔒</span>}
                                </div>
                              )}
                            </td>
                          );
                        })()}
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
                        {r.isFirst?(
                          <td style={{...td,verticalAlign:"middle"}} rowSpan={r.rowCount}>
                            {(()=>{
                              const workers=(r.task.pekerja||[])
                                .map((id:number)=>pekerjaList.find((p:any)=>p.id===id))
                                .filter(Boolean);
                              return workers.length>0?(
                                <div style={{display:"flex",flexDirection:"column",gap:3}}>
                                  {workers.map((w:any)=>(
                                    <div key={w.id} style={{display:"flex",alignItems:"center",gap:5,
                                      background:DIVISI_CONFIG[w.divisi]?.bg||"#f1f5f9",
                                      borderRadius:20,padding:"2px 8px",whiteSpace:"nowrap"}}>
                                      <span style={{fontSize:10}}>{DIVISI_CONFIG[w.divisi]?.icon}</span>
                                      <span style={{fontSize:10,fontWeight:700,color:DIVISI_CONFIG[w.divisi]?.color||"#64748b"}}>{w.nama}</span>
                                    </div>
                                  ))}
                                </div>
                              ):(
                                <span style={{fontSize:10,color:"#cbd5e1",fontStyle:"italic"}}>—</span>
                              );
                            })()}
                          </td>
                        ):null}
                        {/* STEP checkmarks */}
                        {!isQtyBased&&PCT_STEPS.map(s=>{
                          const reached=r.pct>=s;
                          const isNext=!done&&s===PCT_STEPS.find(x=>x>r.pct);
                          const prevStep=PCT_STEPS[PCT_STEPS.indexOf(s)-1]||0;
                          return(
                            <td key={s} style={{...td,textAlign:"center",padding:"4px",
                              background:reached?pBg(s)+"cc":rBg}}>
                              <button
                                onClick={()=>updatePctManual(r.panelId,r.kode,proses,reached?prevStep:s)}
                                title={reached?`Batalkan ${s}%`:`Set ${s}%`}
                                style={{width:22,height:22,borderRadius:5,border:"none",cursor:"pointer",
                                  background:reached?pColor(s):isNext?"#eff6ff":"transparent",
                                  display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto",
                                  outline:isNext?`2px solid ${pc}`:"none",transition:"all .12s"}}>
                                {reached
                                  ?<span style={{color:"#fff",fontSize:12,fontWeight:700}}>✓</span>
                                  :isNext?<span style={{color:pc,fontSize:11,fontWeight:700}}>→</span>
                                  :<span style={{color:"#e2e8f0",fontSize:11}}>·</span>
                                }
                              </button>
                            </td>
                          );
                        })}
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
              background:lockMsg?"#16a34a":"#1d4ed8",color:"#fff",
              boxShadow:"0 4px 14px #2563eb33",transition:"all .2s",
              display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            {lockMsg?"✅ Progress hari ini berhasil dikunci & tersimpan!":"🔒 Kunci Progress Hari Ini"}
          </button>
          <div style={{fontSize:11,color:"#94a3b8",textAlign:"center",marginTop:8,lineHeight:1.5}}>
            Klik di akhir shift untuk menyimpan progress hari ini sebagai catatan permanen.<br/>
            Bisa diklik lagi jika ada update di shift berikutnya (tersimpan terpisah).
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
export default function App(){
  const [page,setPage]=useState("landing");
  const [user,setUser]=useState<any>(null);

  const cfg=user?DIVISI_CONFIG[user.divisi]:null;

  if(page==="landing") return <LandingPage onEnter={()=>setPage("login")}/>;
  if(!user) return <Login onLogin={(u:any)=>{setUser(u);setPage("app");}}/>;

  return(
    <div style={{minHeight:"100vh",background:"#f1f5f9"}}>
      <style>{GCss}</style>
      <div style={{display:"flex",flexDirection:"column",minHeight:"100vh"}}>
        <div style={{background:"#fff",borderBottom:"1.5px solid #e2e8f0",padding:"0 16px",
          height:52,display:"flex",alignItems:"center",justifyContent:"space-between",
          position:"sticky",top:0,zIndex:100,boxShadow:"0 1px 4px #00000008"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:18}}>⚡</span>
            <span style={{fontWeight:800,fontSize:14,color:"#1e293b"}}>PROSES PRODUKSI</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{background:cfg?.bg,color:cfg?.color,border:`1px solid ${cfg?.color}30`,
              borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>{cfg?.icon} {cfg?.label}</span>
            <button onClick={()=>{setUser(null);setPage("landing");}}
              style={{background:"#f8fafc",border:"1px solid #e2e8f0",color:"#64748b",
                borderRadius:8,padding:"4px 10px",cursor:"pointer",fontSize:11,fontWeight:600}}>Keluar</button>
          </div>
        </div>
        <div style={{flex:1,overflowY:"auto"}}>
          <OperatorView user={user}/>
        </div>
        <div style={{position:"sticky",bottom:0,background:"#fff",borderTop:"1.5px solid #e2e8f0",
          display:"flex",height:52,zIndex:100,boxShadow:"0 -2px 10px #00000010"}}>
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

