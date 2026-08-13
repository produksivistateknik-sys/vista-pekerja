import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

// ─────────────────────────────────────────────────────────────────────────────
// TAB RIWAYAT (dalam GudangHome) - histori aksi harian: submit/reject BBMB,
// set status BBMU, dan tarik (sudah_diambil). Filter by tanggal (berdasarkan
// updated_at item - tanggal aksi TERAKHIR dilakukan ke item itu).
// CATATAN KETERBATASAN: skema permintaan_item cuma nyimpen 1 updated_at/
// updated_by (bukan log multi-event) - kalau 1 item disentuh 2x di hari beda
// (mis. di-submit hari Senin, ditarik hari Rabu), yang kelihatan di sini cuma
// aksi TERAKHIR (Rabu: Tarik), bukan riwayat lengkap tiap tahap. Ini batasan
// skema yang sudah disepakati (gak ada tabel audit log terpisah), bukan bug.
// ─────────────────────────────────────────────────────────────────────────────

const DIVISI_LABEL:Record<string,string>={
  mekanik:"Mekanik",painting:"Painting",assembling:"Assembling",
  wiring_ctrl:"Wiring Control",wiring_pwr:"Wiring Power",
  qc:"QC",nameplate:"Nameplate",komponen:"Komponen",gudang:"Gudang",
};

const fetchAllPaged=async(build:(from:number,to:number)=>any):Promise<any[]>=>{
  let all:any[]=[];
  let from=0;
  const PAGE=1000;
  while(true){
    const{data,error}=await build(from,from+PAGE-1);
    if(error)throw error;
    all=all.concat(data??[]);
    if(!data||data.length<PAGE)break;
    from+=PAGE;
  }
  return all;
};

const fmtDateTime=(d:string)=>d?new Date(d).toLocaleString("id-ID",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):"-";

const aksiInfo=(perm:any,item:any):{label:string,color:string}=>{
  if(item.sudah_diambil)return{label:"✓ Sudah Diambil",color:"#0369a1"};
  if(perm?.jenis==="BBMB"){
    if(item.status==="submit")return{label:"✓ Disiapkan",color:"#16a34a"};
    if(item.status==="reject")return{label:"✕ Ditolak",color:"#dc2626"};
  }
  if(perm?.jenis==="BBMU"){
    if(item.status==="tersedia")return{label:"Tersedia",color:"#16a34a"};
    if(item.status==="belum_lengkap")return{label:"Belum Lengkap",color:"#f59e0b"};
    if(item.status==="belum_datang")return{label:"Belum Datang",color:"#dc2626"};
  }
  return{label:item.status,color:"#94a3b8"};
};

export function RiwayatGudangTab(){
  const[tanggal,setTanggal]=useState(new Date().toISOString().slice(0,10));
  const[loading,setLoading]=useState(true);
  const[rows,setRows]=useState<any[]>([]);

  const fetchData=async()=>{
    setLoading(true);
    const startIso=tanggal+"T00:00:00";
    const endIso=tanggal+"T23:59:59.999";
    // Item yang PERNAH disentuh (updated_at terisi) di tanggal ini - mencakup submit/reject
    // BBMB, status BBMU, maupun tarik (sudah_diambil, yang juga nulis updated_at).
    const items=await fetchAllPaged((from,to)=>
      supabase.from("permintaan_item").select("*").not("updated_at","is",null)
        .gte("updated_at",startIso).lte("updated_at",endIso)
        .order("updated_at",{ascending:false}).range(from,to));
    const permIds=[...new Set(items.map((it:any)=>it.permintaan_id))];
    if(permIds.length===0){setRows([]);setLoading(false);return;}
    const perms=await fetchAllPaged((from,to)=>supabase.from("permintaan").select("*").in("id",permIds).range(from,to));
    const permMap:Record<number,any>={};
    perms.forEach((p:any)=>{permMap[p.id]=p;});
    setRows(items.map((it:any)=>({...it,perm:permMap[it.permintaan_id]})).filter((r:any)=>r.perm));
    setLoading(false);
  };

  useEffect(()=>{
    fetchData();
    const ch=supabase.channel("realtime-gudang-riwayat")
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"permintaan_item"},fetchData)
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[tanggal]);

  return(
    <div style={{padding:16}} className="fi">
      <div style={{fontWeight:800,fontSize:16,color:"#1e293b",marginBottom:4}}>🕒 Riwayat Harian</div>
      <div style={{fontSize:12,color:"#64748b",marginBottom:14}}>Aksi submit/reject/status/tarik yang sudah diproses</div>

      <input type="date" value={tanggal} onChange={(e:any)=>setTanggal(e.target.value)}
        style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid #cbd5e1",fontSize:14,fontWeight:600,color:"#0f172a",fontFamily:"inherit",marginBottom:14}}/>

      {loading?(
        <div style={{textAlign:"center",padding:40,color:"#94a3b8",fontSize:13}}>Memuat...</div>
      ):rows.length===0?(
        <div style={{textAlign:"center",padding:40,color:"#94a3b8",fontSize:13}}>Belum ada aksi tercatat di tanggal ini.</div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {rows.map((r:any)=>{
            const aksi=aksiInfo(r.perm,r);
            return(
              <div key={r.id} style={{background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:12,padding:"11px 14px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:6}}>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:"#1e293b"}}>{r.nama_komponen} <span style={{color:"#64748b",fontWeight:500}}>×{r.qty}</span></div>
                    <div style={{fontSize:10.5,color:"#94a3b8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {r.perm.jenis} · {DIVISI_LABEL[r.perm.divisi]||r.perm.divisi} · {r.perm.operator_nama} · {r.perm.proyek||"-"}
                    </div>
                  </div>
                  <span style={{flexShrink:0,background:aksi.color+"18",color:aksi.color,borderRadius:20,padding:"3px 10px",fontSize:10.5,fontWeight:700,whiteSpace:"nowrap"}}>{aksi.label}</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:10.5,color:"#94a3b8"}}>
                  <span>oleh {r.updated_by||"-"}</span>
                  <span>{fmtDateTime(r.updated_at)}</span>
                </div>
                {r.status==="reject"&&r.catatan_reject&&<div style={{fontSize:11,color:"#dc2626",marginTop:6}}>⚠ {r.catatan_reject}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
