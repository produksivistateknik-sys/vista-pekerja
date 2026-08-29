import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { SectionCard, EmptyState, Badge } from "./ui/Primitives";
import { fmtDate } from "../lib/dateHelpers";

// ─────────────────────────────────────────────────────────────────────────────
// JADWAL PENGIRIMAN (29 Agu 2026) - tampilan read-only work_orders + panel di
// dalamnya untuk operator, tab bottom-nav "Jadwal Pengiriman". BARU dibangun
// (bukan reuse) - investigasi konfirmasi belum ada komponen serupa di manapun,
// termasuk di Vista Teknik. MURNI SELECT, tidak ada mutasi/insert/update/delete
// sama sekali di file ini. Semua WO ditampilkan (tidak difilter per divisi).
// ─────────────────────────────────────────────────────────────────────────────
export function JadwalPengirimanView(){
  const[loading,setLoading]=useState(true);
  const[woList,setWoList]=useState<any[]>([]);
  const[expandedWo,setExpandedWo]=useState<Record<number,boolean>>({});
  const[search,setSearch]=useState("");

  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      setLoading(true);
      // Paginasi eksplisit by .range() - Supabase/PostgREST default mentok 1000 baris tanpa ini
      // (sama kelas bug yang ketemu di renharService/rawScheduleService/workOrderService).
      let all:any[]=[];
      let from=0;
      const pageSize=1000;
      for(;;){
        const{data,error}=await supabase.from("work_orders")
          .select("id,wo,proyek,target,panels(id,no_pnl,nama,tipe,qty)")
          .eq("is_archived",false)
          .order("target",{ascending:true})
          .range(from,from+pageSize-1);
        if(error||!data)break;
        all=all.concat(data);
        if(data.length<pageSize)break;
        from+=pageSize;
      }
      if(!cancelled){setWoList(all);setLoading(false);}
    })();
    return()=>{cancelled=true;};
  },[]);

  const filtered=woList.filter(w=>{
    const q=search.trim().toLowerCase();
    if(!q)return true;
    return(w.wo||"").toLowerCase().includes(q)||(w.proyek||"").toLowerCase().includes(q);
  });

  return(
    <div style={{padding:16}}>
      <SectionCard icon="🚚" title="Jadwal Pengiriman" subtitle={loading?"Memuat...":`${filtered.length} work order`}>
        <input placeholder="Cari WO/proyek..." value={search} onChange={e=>setSearch(e.target.value)}
          style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid #e2e8f0",
            fontSize:13,marginBottom:12,fontFamily:"inherit",boxSizing:"border-box"}}/>
        {loading?(
          <div style={{textAlign:"center",padding:20,color:"#94a3b8",fontSize:12}}>Memuat...</div>
        ):filtered.length===0?(
          <EmptyState title="Tidak ada jadwal" description="Belum ada work order yang cocok."/>
        ):filtered.map(wo=>{
          const isExp=!!expandedWo[wo.id];
          const panels=wo.panels||[];
          return(
            <div key={wo.id} style={{border:"1px solid #f1f5f9",borderRadius:12,marginBottom:8,overflow:"hidden"}}>
              <div onClick={()=>setExpandedWo(p=>({...p,[wo.id]:!p[wo.id]}))}
                style={{padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",
                  cursor:"pointer",background:isExp?"#f8fafc":"#fff"}}>
                <div style={{minWidth:0}}>
                  <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                    <span style={{fontWeight:800,fontSize:13,fontFamily:"'DM Mono',monospace",color:"#1d4ed8"}}>WO {wo.wo}</span>
                    <span style={{fontWeight:700,fontSize:12.5,color:"#1e293b"}}>{wo.proyek}</span>
                  </div>
                  <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>📅 Target: {fmtDate(wo.target)} · {panels.length} panel</div>
                </div>
                <span style={{fontSize:12,color:"#94a3b8",flexShrink:0}}>{isExp?"▼":"▶"}</span>
              </div>
              {isExp&&(
                <div style={{borderTop:"1px solid #f1f5f9"}}>
                  {panels.length===0?(
                    <div style={{padding:"10px 14px",fontSize:11.5,color:"#94a3b8"}}>Belum ada panel di WO ini</div>
                  ):[...panels].sort((a:any,b:any)=>(Number(a.no_pnl)||0)-(Number(b.no_pnl)||0)).map((p:any)=>(
                    <div key={p.id} style={{padding:"9px 14px",borderBottom:"1px solid #f8fafc",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                      <span style={{fontSize:11,fontWeight:700,color:"#94a3b8",minWidth:24}}>#{p.no_pnl}</span>
                      <span style={{fontSize:12.5,fontWeight:600,color:"#1e293b",flex:1,minWidth:100}}>{p.nama}</span>
                      <Badge label={p.tipe} color="#64748b"/>
                      <Badge label={`Qty ${p.qty}`} color="#0891b2"/>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </SectionCard>
    </div>
  );
}
