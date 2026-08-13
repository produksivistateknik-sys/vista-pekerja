import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

// ─────────────────────────────────────────────────────────────────────────────
// TAB TARIK (dalam GudangHome) - antrian fisik: item BBMB yang sudah di-Submit
// atau item BBMU yang sudah "Tersedia" tapi belum diambil fisik oleh operator
// peminta. Tombol "Sudah Diambil" set permintaan_item.sudah_diambil=true - item
// hilang dari antrian ini begitu ditandai (masuk Riwayat, bukan dihapus).
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

export function TarikGudangTab({user}:{user:any}){
  const adminName=user?.nama||user?.name||"Gudang";
  const[loading,setLoading]=useState(true);
  const[rows,setRows]=useState<any[]>([]); // item + permintaan header digabung flat
  const[processingId,setProcessingId]=useState<number|null>(null);

  const fetchData=async()=>{
    setLoading(true);
    // Item BBMB yang udah "submit" ATAU BBMU yang udah "tersedia", DAN belum diambil fisik -
    // 2 query terpisah (OR lintas kolom status yang beda arti per jenis lebih aman/jelas
    // daripada satu filter .in() yang nyampur makna BBMB/BBMU).
    const submitBbmb=await fetchAllPaged((from,to)=>supabase.from("permintaan_item").select("*").eq("status","submit").eq("sudah_diambil",false).range(from,to));
    const tersediaBbmu=await fetchAllPaged((from,to)=>supabase.from("permintaan_item").select("*").eq("status","tersedia").eq("sudah_diambil",false).range(from,to));
    const items=[...submitBbmb,...tersediaBbmu];
    const permIds=[...new Set(items.map((it:any)=>it.permintaan_id))];
    if(permIds.length===0){setRows([]);setLoading(false);return;}
    const perms=await fetchAllPaged((from,to)=>supabase.from("permintaan").select("*").in("id",permIds).range(from,to));
    const permMap:Record<number,any>={};
    perms.forEach((p:any)=>{permMap[p.id]=p;});
    const merged=items
      .map((it:any)=>({...it,perm:permMap[it.permintaan_id]}))
      .filter((r:any)=>r.perm) // jaga-jaga kalau header udah gak ada
      .sort((a:any,b:any)=>(a.perm.created_at||"").localeCompare(b.perm.created_at||"")); // FIFO - antre paling lama duluan
    setRows(merged);
    setLoading(false);
  };

  useEffect(()=>{
    fetchData();
    const ch=supabase.channel("realtime-gudang-tarik")
      .on("postgres_changes",{event:"*",schema:"public",table:"permintaan_item"},fetchData)
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  const tandaiDiambil=async(itemId:number)=>{
    setProcessingId(itemId);
    await supabase.from("permintaan_item").update({sudah_diambil:true,updated_by:adminName,updated_at:new Date().toISOString()}).eq("id",itemId);
    setProcessingId(null);
    fetchData();
  };

  return(
    <div style={{padding:16}} className="fi">
      <div style={{fontWeight:800,fontSize:16,color:"#1e293b",marginBottom:4}}>📦 Tarik Komponen</div>
      <div style={{fontSize:12,color:"#64748b",marginBottom:14}}>Antrian barang yang sudah disiapkan, menunggu diambil fisik</div>

      {loading?(
        <div style={{textAlign:"center",padding:40,color:"#94a3b8",fontSize:13}}>Memuat...</div>
      ):rows.length===0?(
        <div style={{textAlign:"center",padding:40,color:"#94a3b8",fontSize:13}}>✅ Tidak ada barang yang menunggu diambil.</div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {rows.map((r:any)=>(
            <div key={r.id} style={{background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:14,padding:"12px 14px",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8,gap:8}}>
                <div style={{minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                    <span style={{background:r.perm.jenis==="BBMB"?"#eff6ff":"#faf5ff",color:r.perm.jenis==="BBMB"?"#1d4ed8":"#7c3aed",
                      borderRadius:5,padding:"1px 7px",fontSize:9.5,fontWeight:800}}>{r.perm.jenis}</span>
                    <span style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>{r.perm.operator_nama}</span>
                  </div>
                  <div style={{fontSize:11,color:"#64748b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {DIVISI_LABEL[r.perm.divisi]||r.perm.divisi} · {r.perm.proyek||"-"} · {r.perm.panel_nama||"-"}
                  </div>
                </div>
                <div style={{fontSize:10,color:"#94a3b8",whiteSpace:"nowrap",flexShrink:0}}>{fmtDateTime(r.perm.created_at)}</div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8,background:"#f8fafc",borderRadius:9,padding:"9px 10px"}}>
                <span style={{flex:1,minWidth:0,fontSize:13,fontWeight:700,color:"#334155"}}>{r.nama_komponen} <span style={{color:"#64748b",fontWeight:500}}>×{r.qty}</span></span>
                <button onClick={()=>tandaiDiambil(r.id)} disabled={processingId===r.id}
                  style={{flexShrink:0,padding:"8px 14px",borderRadius:9,border:"none",
                    background:processingId===r.id?"#94a3b8":"#16a34a",color:"#fff",fontWeight:700,fontSize:12,
                    cursor:processingId===r.id?"default":"pointer",fontFamily:"inherit"}}>
                  {processingId===r.id?"...":"✓ Sudah Diambil"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
