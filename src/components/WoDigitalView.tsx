import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { supabase } from "../lib/supabase";
import { SectionCard, EmptyState, Badge } from "./ui/Primitives";

const PdfViewerPekerja=lazy(()=>import("./PdfViewerPekerja").then(m=>({default:m.PdfViewerPekerja})));

// ─────────────────────────────────────────────────────────────────────────────
// WO DIGITAL (31 Agu 2026) - versi digital gambar teknik (construction drawing, sudah
// ber-watermark) menggantikan distribusi kertas cetak. READ-ONLY (upload cuma dari Vista
// Teknik, lihat WoDigitalTab.tsx). 1 WO = 1 dokumen (mencakup semua panel sekaligus, sama
// kayak PDF asli dari CAD - gak ada lagi pecahan per-panel, lihat WoDigitalTab.tsx).
//
// 2 tampilan: Aktif (work_orders.is_archived=false, langsung tampil semua tanpa perlu
// ketik) dan Arsip (is_archived=true, search-first - historis, sama pola ArsipQCView.tsx).
// Arsip personal per-operator DIBATALKAN (31 Agu 2026) - cukup 1 arsip resmi/bersama.
//
// REDESIGN (1 Sep 2026) - klik card WO (yang sudah ada dokumen) SWAP seluruh tampilan list
// jadi halaman viewer full (bukan modal overlay lagi) - state `viewing` + early-return,
// pola sama kayak NameplateView.tsx (list->detail->list, tombol "‹ Kembali").
// ─────────────────────────────────────────────────────────────────────────────
export function WoDigitalView(){
  const[loading,setLoading]=useState(true);
  const[woList,setWoList]=useState<any[]>([]);
  const[panelsAll,setPanelsAll]=useState<any[]>([]);
  const[wiList,setWiList]=useState<any[]>([]);
  const[revList,setRevList]=useState<any[]>([]);
  const[search,setSearch]=useState("");
  const[viewMode,setViewMode]=useState<"aktif"|"arsip">("aktif");
  const[viewing,setViewing]=useState<{url:string,title:string,subtitle?:string}|null>(null);

  const fetchAll=async()=>{
    setLoading(true);
    const[{data:wo},{data:panels},{data:wi},{data:rev}]=await Promise.all([
      supabase.from("work_orders").select("id,wo,proyek,is_archived"),
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
    if(viewMode==="arsip"&&!q)return[];
    return woList.filter(w=>{
      if(viewMode==="arsip"?!w.is_archived:!!w.is_archived)return false;
      if(q&&!(w.wo||"").toLowerCase().includes(q)&&!(w.proyek||"").toLowerCase().includes(q))return false;
      return true;
    });
  },[woList,q,viewMode]);

  const panelNamesOf=(woId:number)=>panelsAll.filter(p=>p.wo_id===woId).map(p=>p.nama);
  const currentRevOf=(woId:number)=>{
    const wi=wiList.find((w:any)=>w.wo_id===woId&&!w.panel_id);
    if(!wi)return null;
    return revList.find((r:any)=>r.work_instruction_id===wi.id)||null;
  };

  if(viewing){
    return(
      <div style={{padding:16}}>
        <Suspense fallback={<div style={{textAlign:"center",padding:40,color:"#94a3b8",fontSize:12}}>Memuat...</div>}>
          <PdfViewerPekerja url={viewing.url} title={viewing.title} subtitle={viewing.subtitle} onBack={()=>setViewing(null)}/>
        </Suspense>
      </div>
    );
  }

  return(
    <div style={{padding:16}}>
      <SectionCard icon="📐" title="WO Digital" subtitle="Gambar teknik (construction drawing) versi digital">
        <div style={{display:"flex",gap:6,marginBottom:10}}>
          <button onClick={()=>setViewMode("aktif")} style={{flex:1,padding:"9px 6px",borderRadius:9,border:"none",cursor:"pointer",
            fontSize:12,fontWeight:700,background:viewMode==="aktif"?"#1d4ed8":"#e2e8f0",color:viewMode==="aktif"?"#fff":"#64748b"}}>
            Aktif
          </button>
          <button onClick={()=>setViewMode("arsip")} style={{flex:1,padding:"9px 6px",borderRadius:9,border:"none",cursor:"pointer",
            fontSize:12,fontWeight:700,background:viewMode==="arsip"?"#1d4ed8":"#e2e8f0",color:viewMode==="arsip"?"#fff":"#64748b"}}>
            🗄️ Arsip
          </button>
        </div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari nomor WO / proyek..."
          style={{width:"100%",padding:"9px 12px",borderRadius:10,border:"1.5px solid #e2e8f0",fontSize:13,fontFamily:"inherit",boxSizing:"border-box",marginBottom:12}}/>

        {viewMode==="arsip"&&!q?(
          <EmptyState title="Cari WO dulu" description="Ketik nomor WO atau nama proyek untuk menampilkan arsip." variant="box-paper"/>
        ):loading?(
          <div style={{textAlign:"center",padding:20,color:"#94a3b8",fontSize:12}}>Memuat...</div>
        ):filteredWo.length===0?(
          <EmptyState title="Tidak ada" description="Tidak ada WO yang cocok." variant="box-paper"/>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {filteredWo.map(w=>{
              const panelNames=panelNamesOf(w.id);
              const rev=currentRevOf(w.id);
              return(
                <div key={w.id} onClick={()=>rev&&setViewing({url:rev.file_url,title:w.proyek||`WO ${w.wo}`,subtitle:`WO ${w.wo}`})}
                  style={{border:"1px solid #e2e8f0",borderRadius:12,padding:"16px 18px",display:"flex",alignItems:"center",gap:14,
                    cursor:rev?"pointer":"default"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                      <span style={{fontSize:10.5,color:"#94a3b8",fontWeight:700,letterSpacing:.3}}>WO {w.wo}</span>
                      {rev&&<Badge label="Berlaku" color="#16a34a" bg="#f0fdf4"/>}
                    </div>
                    <div style={{fontSize:15,fontWeight:700,color:"#0f172a",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{w.proyek}</div>
                    {panelNames.length>0&&(
                      <div style={{display:"flex",flexWrap:"wrap",gap:5,marginTop:8}}>
                        {panelNames.map(n=>(
                          <span key={n} style={{fontSize:11,color:"#64748b",background:"#f1f5f9",borderRadius:6,padding:"3px 9px"}}>{n}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  {rev?(
                    <div style={{width:40,height:40,borderRadius:10,background:"#eff6ff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <i className="ti ti-eye" style={{fontSize:18,color:"#1d4ed8"}}/>
                    </div>
                  ):(
                    <span style={{fontSize:10.5,color:"#cbd5e1",flexShrink:0,fontStyle:"italic"}}>Belum ada</span>
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
