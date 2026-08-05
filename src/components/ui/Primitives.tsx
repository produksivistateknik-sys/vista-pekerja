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
  return <div style={{background:"#fff",borderRadius:12,border:"1px solid #e2e8f0",
    padding:16,boxShadow:"0 1px 3px #00000008",...style}}>{children}</div>;
}
export function Lbl({children}:any){
  return <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:5}}>{children}</div>;
}
export function Inp({style={},...p}:any){
  return <input style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #e2e8f0",
    background:"#f8fafc",color:"#1e293b",fontSize:13,...style}} {...p}/>;
}
// @ts-ignore
export function _Sel({style={},children,...p}:any){
  return <select style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #e2e8f0",
    background:"#f8fafc",color:"#1e293b",fontSize:13,...style}} {...p}>{children}</select>;
}
export function Btn({children,color="#2563eb",outline=false,style={},...p}:any){
  return <button style={{padding:"8px 18px",borderRadius:8,
    border:outline?`1.5px solid ${color}`:"none",cursor:"pointer",
    background:outline?"transparent":color,color:outline?color:"#fff",
    fontWeight:700,fontSize:13,...style}} {...p}>{children}</button>;
}
