import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { SectionCard, EmptyState, Badge } from "./ui/Primitives";

// ─────────────────────────────────────────────────────────────────────────────
// WO DIGITAL (31 Agu 2026) - versi digital gambar teknik (construction drawing, sudah
// ber-watermark) menggantikan distribusi kertas cetak. READ-ONLY soal isi dokumen (upload
// cuma dari Vista Teknik, lihat WoDigitalTab.tsx) - cuma "Arsip Saya" yang operator bisa
// atur sendiri.
//
// 3 tampilan:
// - Aktif: WO yang is_archived=false (global, admin) DAN belum diarsip personal - langsung
//   tampil semua tanpa perlu ketik (search cuma mempersempit).
// - Arsip: WO yang is_archived=true (arsip RESMI dari admin) - search-first (historis, bisa
//   banyak, sama pola ArsipQCView.tsx).
// - Arsip Saya: PERSONAL per operator (wo_digital_arsip_personal, scope pekerja_id) - cuma
//   nyembunyiin dari tampilan Aktif operator itu sendiri, TIDAK ubah status WO global, TIDAK
//   pengaruh operator lain atau Vista Teknik sama sekali. Toggle lewat insert/delete row
//   (unique pekerja_id+wo_id).
// ─────────────────────────────────────────────────────────────────────────────
export function WoDigitalView({user}:{user:any}){
  const[loading,setLoading]=useState(true);
  const[woList,setWoList]=useState<any[]>([]);
  const[panelsAll,setPanelsAll]=useState<any[]>([]);
  const[wiList,setWiList]=useState<any[]>([]);
  const[revList,setRevList]=useState<any[]>([]);
  const[arsipPersonal,setArsipPersonal]=useState<any[]>([]);
  const[search,setSearch]=useState("");
  const[viewMode,setViewMode]=useState<"aktif"|"arsip"|"arsip_saya">("aktif");
  const[expandedWoId,setExpandedWoId]=useState<number|null>(null);
  const[togglingArsip,setTogglingArsip]=useState<number|null>(null);

  const fetchAll=async()=>{
    setLoading(true);
    const[{data:wo},{data:panels},{data:wi},{data:rev},{data:arsip}]=await Promise.all([
      supabase.from("work_orders").select("id,wo,proyek,is_archived"),
      supabase.from("panels").select("id,wo_id,nama"),
      supabase.from("work_instructions" as any).select("*"),
      supabase.from("wi_revisions" as any).select("*").eq("is_current",true),
      supabase.from("wo_digital_arsip_personal" as any).select("*").eq("pekerja_id",user.id),
    ]);
    setWoList(wo||[]);
    setPanelsAll(panels||[]);
    setWiList(wi||[]);
    setRevList(rev||[]);
    setArsipPersonal(arsip||[]);
    setLoading(false);
  };
  useEffect(()=>{
    fetchAll();
    const ch=supabase.channel("realtime-wo-digital-pekerja-"+user.id)
      .on("postgres_changes",{event:"*",schema:"public",table:"work_instructions"},fetchAll)
      .on("postgres_changes",{event:"*",schema:"public",table:"wi_revisions"},fetchAll)
      .on("postgres_changes",{event:"*",schema:"public",table:"wo_digital_arsip_personal",filter:"pekerja_id=eq."+user.id},fetchAll)
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[user.id]);

  const personalArsipSet=useMemo(()=>new Set(arsipPersonal.map((a:any)=>a.wo_id)),[arsipPersonal]);

  const q=search.trim().toLowerCase();
  const filteredWo=useMemo(()=>{
    if(viewMode==="arsip"&&!q)return[];
    return woList.filter(w=>{
      if(viewMode==="arsip"){
        if(!w.is_archived)return false;
      } else {
        if(w.is_archived)return false;
        const isPersonalArsip=personalArsipSet.has(w.id);
        if(viewMode==="arsip_saya"&&!isPersonalArsip)return false;
        if(viewMode==="aktif"&&isPersonalArsip)return false;
      }
      if(q&&!(w.wo||"").toLowerCase().includes(q)&&!(w.proyek||"").toLowerCase().includes(q))return false;
      return true;
    });
  },[woList,q,viewMode,personalArsipSet]);

  const panelsOfWo=(woId:number)=>panelsAll.filter(p=>p.wo_id===woId);
  const currentRevOf=(woId:number,panelId:number|null)=>{
    const wi=wiList.find((w:any)=>w.wo_id===woId&&(w.panel_id||null)===(panelId||null));
    if(!wi)return null;
    return revList.find((r:any)=>r.work_instruction_id===wi.id)||null;
  };
  const statsOfWo=(woId:number)=>{
    const woRev=currentRevOf(woId,null);
    const panelRevs=panelsOfWo(woId).map(p=>currentRevOf(woId,p.id)).filter(Boolean) as any[];
    const all=woRev?[woRev,...panelRevs]:panelRevs;
    const totalPages=all.reduce((s,r)=>s+(r.page_count||0),0);
    const lastUpload=all.reduce((latest,r)=>r.uploaded_at>latest?r.uploaded_at:latest,"");
    return{docCount:all.length,totalPages,lastUpload};
  };

  const toggleArsipPersonal=async(woId:number)=>{
    setTogglingArsip(woId);
    if(personalArsipSet.has(woId)){
      await supabase.from("wo_digital_arsip_personal" as any).delete().eq("pekerja_id",user.id).eq("wo_id",woId);
    } else {
      await supabase.from("wo_digital_arsip_personal" as any).insert({pekerja_id:user.id,wo_id:woId});
    }
    setTogglingArsip(null);
    fetchAll();
  };

  const fmtTgl=(iso:string)=>iso?new Date(iso).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"}):"—";

  return(
    <div style={{padding:16}}>
      <SectionCard icon="📐" title="WO Digital" subtitle="Gambar teknik (construction drawing) versi digital">
        <div style={{display:"flex",gap:6,marginBottom:10}}>
          {(["aktif","arsip_saya","arsip"] as const).map(vm=>(
            <button key={vm} onClick={()=>setViewMode(vm)} style={{flex:1,padding:"9px 6px",borderRadius:9,border:"none",cursor:"pointer",
              fontSize:11.5,fontWeight:700,background:viewMode===vm?"#1d4ed8":"#e2e8f0",color:viewMode===vm?"#fff":"#64748b"}}>
              {vm==="aktif"?"Aktif":vm==="arsip_saya"?"Arsip Saya":"🗄️ Arsip"}
            </button>
          ))}
        </div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari nomor WO / proyek..."
          style={{width:"100%",padding:"9px 12px",borderRadius:10,border:"1.5px solid #e2e8f0",fontSize:13,fontFamily:"inherit",boxSizing:"border-box",marginBottom:12}}/>

        {viewMode==="arsip"&&!q?(
          <EmptyState title="Cari WO dulu" description="Ketik nomor WO atau nama proyek untuk menampilkan arsip resmi." variant="box-paper"/>
        ):loading?(
          <div style={{textAlign:"center",padding:20,color:"#94a3b8",fontSize:12}}>Memuat...</div>
        ):filteredWo.length===0?(
          <EmptyState title="Tidak ada" description={viewMode==="arsip_saya"?"Belum ada WO yang Anda arsipkan.":"Tidak ada WO yang cocok."} variant="box-paper"/>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {filteredWo.map(w=>{
              const isExp=expandedWoId===w.id;
              const panels=panelsOfWo(w.id);
              const woRev=currentRevOf(w.id,null);
              const panelRevs=panels.map(p=>({panel:p,rev:currentRevOf(w.id,p.id)})).filter(x=>x.rev);
              const stats=statsOfWo(w.id);
              const isPersonalArsip=personalArsipSet.has(w.id);
              return(
                <div key={w.id} style={{border:"1px solid #e2e8f0",borderRadius:12,overflow:"hidden"}}>
                  <div onClick={()=>setExpandedWoId(isExp?null:w.id)} style={{padding:"13px 14px",cursor:"pointer",background:isExp?"#f8fafc":"#fff",
                    display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
                    <div style={{display:"flex",alignItems:"center",gap:12,minWidth:0,flex:1}}>
                      <div style={{width:38,height:38,borderRadius:8,background:"#f1f5f9",border:"1px solid #e2e8f0",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        <i className="ti ti-folder" style={{fontSize:17,color:"#475569"}}/>
                      </div>
                      <div style={{minWidth:0,flex:1}}>
                        <div style={{fontSize:9.5,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:.4}}>WO {w.wo}</div>
                        <div style={{fontWeight:800,fontSize:13.5,color:"#0f172a",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{w.proyek}</div>
                        <div style={{fontSize:10.5,color:"#94a3b8",marginTop:2}}>{stats.docCount} dokumen{stats.totalPages>0?` · ${stats.totalPages} hal.`:""}{stats.lastUpload?` · ${fmtTgl(stats.lastUpload)}`:""}</div>
                      </div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                      {stats.docCount>0&&<Badge label="Berlaku" color="#16a34a" bg="#f0fdf4"/>}
                      <span style={{fontSize:12,color:"#94a3b8"}}>{isExp?"▼":"▶"}</span>
                    </div>
                  </div>
                  {isExp&&(
                    <div style={{padding:"10px 14px",borderTop:"1px solid #f1f5f9",display:"flex",flexDirection:"column",gap:8}}>
                      {stats.docCount===0?(
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
                      {viewMode!=="arsip"&&(
                        <button onClick={(e)=>{e.stopPropagation();toggleArsipPersonal(w.id);}} disabled={togglingArsip===w.id}
                          style={{alignSelf:"flex-start",fontSize:11,fontWeight:700,color:"#64748b",background:"#f8fafc",
                            border:"1px solid #e2e8f0",borderRadius:8,padding:"6px 12px",cursor:togglingArsip===w.id?"default":"pointer"}}>
                          {togglingArsip===w.id?"Memproses...":isPersonalArsip?"Batalkan Arsip Saya":"Arsipkan (Personal)"}
                        </button>
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
