import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { SectionCard, EmptyState } from "./ui/Primitives";

// ─────────────────────────────────────────────────────────────────────────────
// WO DIGITAL (31 Agu 2026) - versi digital gambar teknik (construction drawing, sudah
// ber-watermark) menggantikan distribusi kertas cetak. READ-ONLY (operator cuma lihat/
// download, upload cuma dari Vista Teknik - lihat WoDigitalTab.tsx). Search-first sama pola
// ProyekLuarView/MomFatView, cuma tampilkan revisi yang is_current=true ("Berlaku") - operator
// gak perlu lihat riwayat revisi lama, cukup gambar terbaru.
// ─────────────────────────────────────────────────────────────────────────────
export function WoDigitalView(){
  const[loading,setLoading]=useState(true);
  const[woList,setWoList]=useState<any[]>([]);
  const[panelsAll,setPanelsAll]=useState<any[]>([]);
  const[wiList,setWiList]=useState<any[]>([]);
  const[revList,setRevList]=useState<any[]>([]);
  const[search,setSearch]=useState("");
  const[expandedWoId,setExpandedWoId]=useState<number|null>(null);

  const fetchAll=async()=>{
    setLoading(true);
    const[{data:wo},{data:panels},{data:wi},{data:rev}]=await Promise.all([
      supabase.from("work_orders").select("id,wo,proyek,is_archived").eq("is_archived",false),
      supabase.from("panels").select("id,wo_id,nama"),
      supabase.from("work_instructions" as any).select("*"),
      supabase.from("wi_revisions" as any).select("*").eq("is_current",true),
    ]);
    setWoList(wo||[]);
    setPanelsAll(panels||[]);
    setWiList(wi||[]);
    setRevList(rev||[]);
    setLoading(false);
  };
  useEffect(()=>{
    fetchAll();
    const ch=supabase.channel("realtime-wo-digital-pekerja")
      .on("postgres_changes",{event:"*",schema:"public",table:"work_instructions"},fetchAll)
      .on("postgres_changes",{event:"*",schema:"public",table:"wi_revisions"},fetchAll)
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);

  const q=search.trim().toLowerCase();
  const filteredWo=useMemo(()=>{
    if(!q)return[];
    return woList.filter(w=>(w.wo||"").toLowerCase().includes(q)||(w.proyek||"").toLowerCase().includes(q));
  },[woList,q]);

  const panelsOfWo=(woId:number)=>panelsAll.filter(p=>p.wo_id===woId);
  const currentRevOf=(woId:number,panelId:number|null)=>{
    const wi=wiList.find((w:any)=>w.wo_id===woId&&(w.panel_id||null)===(panelId||null));
    if(!wi)return null;
    return revList.find((r:any)=>r.work_instruction_id===wi.id)||null;
  };

  return(
    <div style={{padding:16}}>
      <SectionCard icon="📐" title="WO Digital" subtitle="Gambar teknik (construction drawing) versi digital">
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari nomor WO / proyek..."
          style={{width:"100%",padding:"9px 12px",borderRadius:10,border:"1.5px solid #e2e8f0",fontSize:13,fontFamily:"inherit",boxSizing:"border-box",marginBottom:12}}/>

        {!q?(
          <EmptyState title="Cari WO dulu" description="Ketik nomor WO atau nama proyek untuk menampilkan gambar teknik." variant="box-paper"/>
        ):loading?(
          <div style={{textAlign:"center",padding:20,color:"#94a3b8",fontSize:12}}>Memuat...</div>
        ):filteredWo.length===0?(
          <EmptyState title="Tidak ditemukan" description="Tidak ada WO yang cocok dengan pencarian." variant="box-paper"/>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {filteredWo.map(w=>{
              const isExp=expandedWoId===w.id;
              const panels=panelsOfWo(w.id);
              const woRev=currentRevOf(w.id,null);
              const panelRevs=panels.map(p=>({panel:p,rev:currentRevOf(w.id,p.id)})).filter(x=>x.rev);
              const totalDrawing=(woRev?1:0)+panelRevs.length;
              return(
                <div key={w.id} style={{border:"1px solid #f1f5f9",borderRadius:12,overflow:"hidden"}}>
                  <div onClick={()=>setExpandedWoId(isExp?null:w.id)} style={{padding:"12px 14px",cursor:"pointer",background:isExp?"#f8fafc":"#fff",
                    display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                    <div style={{minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>WO {w.wo} — {w.proyek}</div>
                      <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}><i className="ti ti-file-type-pdf" style={{fontSize:11}}/> {totalDrawing} gambar tersedia</div>
                    </div>
                    <span style={{fontSize:12,color:"#94a3b8"}}>{isExp?"▼":"▶"}</span>
                  </div>
                  {isExp&&(
                    <div style={{padding:"10px 14px",borderTop:"1px solid #f1f5f9",display:"flex",flexDirection:"column",gap:8}}>
                      {totalDrawing===0?(
                        <div style={{fontSize:12,color:"#94a3b8",fontStyle:"italic"}}>Belum ada gambar teknik untuk WO ini.</div>
                      ):(
                        <>
                          {woRev&&(
                            <a href={woRev.file_url} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,padding:"10px 12px",background:"#eff6ff",borderRadius:8,textDecoration:"none"}}>
                              <div>
                                <div style={{fontSize:12.5,fontWeight:700,color:"#1d4ed8"}}>Gambar Level WO (seluruh panel)</div>
                                <div style={{fontSize:10,color:"#64748b",marginTop:1}}>{woRev.rev_mark?woRev.rev_mark+" · ":""}{woRev.page_count?woRev.page_count+" halaman":""}</div>
                              </div>
                              <i className="ti ti-download" style={{fontSize:16,color:"#1d4ed8"}}/>
                            </a>
                          )}
                          {panelRevs.map(({panel,rev}:any)=>(
                            <a key={panel.id} href={rev.file_url} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,padding:"10px 12px",background:"#f8fafc",borderRadius:8,textDecoration:"none",border:"1px solid #e2e8f0"}}>
                              <div>
                                <div style={{fontSize:12.5,fontWeight:700,color:"#1e293b"}}>{panel.nama}</div>
                                <div style={{fontSize:10,color:"#64748b",marginTop:1}}>{rev.rev_mark?rev.rev_mark+" · ":""}{rev.page_count?rev.page_count+" halaman":""}</div>
                              </div>
                              <i className="ti ti-download" style={{fontSize:16,color:"#64748b"}}/>
                            </a>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
