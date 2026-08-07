import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { Card } from "./ui/Primitives";
import { FotoZoomViewerPekerja } from "./FotoZoomViewerPekerja";

// ─────────────────────────────────────────────────────────────────────────────
// ARSIP SEKSI - tab "Arsip" per divisi (Warehouse/QS/QC/Pasang Komponen), read-only browsing.
// Sumber: panel_seksi_archived - diisi OTOMATIS oleh trigger DB panels_auto_archive_seksi()
// begitu progress seksi itu 100%, TANPA aksi manual apapun dari operator/planner. Ini SALINAN
// (data live di panels TIDAK dihapus/berubah), jadi tab ini murni buat lihat riwayat foto yang
// udah selesai, dikelompokkan per WO. Unarchive (kalau progress kelirunya ke-set 100%) sengaja
// cuma bisa dari Vista Teknik (admin) - lihat ArsipSeksiSection di ArsipTab.tsx.
// Dipisah dari App.tsx (Sprint 7).
// ─────────────────────────────────────────────────────────────────────────────
export function ArsipSeksiView({seksi}:{seksi:string}){
  const[rows,setRows]=useState<any[]>([]);
  const[loading,setLoading]=useState(true);
  const[search,setSearch]=useState("");
  const[expandedWo,setExpandedWo]=useState<Record<string,boolean>>({});
  const[lightbox,setLightbox]=useState<{fotos:any[],startIndex:number,label:string}|null>(null);

  const fetchRows=async()=>{
    setLoading(true);
    const{data}=await supabase.from("panel_seksi_archived").select("*").eq("seksi",seksi).order("diarsipkan_pada",{ascending:false});
    setRows(data??[]);
    setLoading(false);
  };
  useEffect(()=>{
    fetchRows();
    const ch=supabase.channel("realtime-panel-seksi-archived-"+seksi)
      .on("postgres_changes",{event:"*",schema:"public",table:"panel_seksi_archived",filter:`seksi=eq.${seksi}`},()=>fetchRows())
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[seksi]);

  const fotoListOf=(row:any):any[]=>{
    if(row.seksi==="wiring_control")return row.data?.fotoPemasangan||[];
    if(row.seksi==="assembling_luar")return row.data?.pasang_komponen_photos||[];
    if(row.seksi==="pasang_komponen")return row.data?.fotoPemasangan||[];
    if(row.seksi==="qc"){
      let total:any[]=[];
      ["fisik","spesifikasi","baut","test"].forEach(k=>{total=total.concat(row.data?.[k]?.foto||[]);});
      return total;
    }
    return row.data?.photos||[];
  };

  const filtered=rows.filter((r:any)=>
    !search||r.panel_nama?.toLowerCase().includes(search.toLowerCase())||r.proyek_snapshot?.toLowerCase().includes(search.toLowerCase())||r.wo_number_snapshot?.toLowerCase().includes(search.toLowerCase())
  );

  const grouped=useMemo(()=>{
    const map:Record<string,{key:string,wo_number:string,proyek:string,rows:any[]}>={};
    filtered.forEach((r:any)=>{
      const key=String(r.wo_id??`noWo_${r.panel_nama}`);
      if(!map[key])map[key]={key,wo_number:r.wo_number_snapshot,proyek:r.proyek_snapshot,rows:[]};
      map[key].rows.push(r);
    });
    return Object.values(map).sort((a,b)=>{
      const latestA=Math.max(...a.rows.map((r:any)=>new Date(r.diarsipkan_pada).getTime()));
      const latestB=Math.max(...b.rows.map((r:any)=>new Date(r.diarsipkan_pada).getTime()));
      return latestB-latestA;
    });
  },[filtered]);

  const fmtTgl=(iso:string)=>iso?new Date(iso).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"})+" "+new Date(iso).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"}):"—";

  return(
    <div style={{padding:16}} className="fi">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap" as const,gap:8}}>
        <div>
          <div style={{fontWeight:800,fontSize:15,color:"#1e293b"}}>📦 Arsip</div>
          <div style={{fontSize:11,color:"#64748b"}}>Panel yang progress-nya sudah 100% - diarsipkan otomatis, dikelompokkan per WO</div>
        </div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Cari WO/proyek/panel..."
          style={{height:32,padding:"0 12px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:12,width:200,outline:"none",fontFamily:"inherit"}}/>
      </div>

      {loading?(
        <div style={{textAlign:"center",padding:40,color:"#94a3b8",fontSize:12}}>Memuat arsip...</div>
      ):grouped.length===0?(
        <div style={{textAlign:"center",padding:40,color:"#94a3b8",fontSize:12,background:"#fff",borderRadius:10,border:"1px solid #e2e8f0"}}>
          Belum ada yang diarsipkan.
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
          {grouped.map(g=>{
            const isExp=!!expandedWo[g.key];
            return(
              <Card key={g.key} style={{padding:0,overflow:"hidden"}}>
                <div onClick={()=>setExpandedWo(prev=>({...prev,[g.key]:!prev[g.key]}))}
                  style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",cursor:"pointer",background:isExp?"#f8faff":"#fff"}}>
                  <span style={{fontSize:12,color:"#94a3b8"}}>{isExp?"▼":"▶"}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:800,fontSize:13.5,color:"#0f172a"}}>WO {g.wo_number||"—"} — {g.proyek||"—"}</div>
                    <div style={{fontSize:11,color:"#64748b",marginTop:2}}>{g.rows.length} panel diarsipkan</div>
                  </div>
                </div>
                {isExp&&(
                  <div style={{borderTop:"1px solid #f1f5f9",display:"flex",flexDirection:"column" as const,gap:8,padding:"10px 14px"}}>
                    {g.rows.map((r:any)=>{
                      const fotoList=fotoListOf(r);
                      return(
                        <div key={r.id} style={{border:"1.5px solid #e2e8f0",borderRadius:8,padding:"8px 10px"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:6}}>
                            <div>
                              <div style={{fontSize:13.5,fontWeight:800,color:"#0f172a"}}>{r.panel_nama}</div>
                              {r.kode&&<div style={{fontSize:10,color:"#64748b"}}>{r.komponen_nama||r.kode}</div>}
                            </div>
                            <div style={{fontSize:9,color:"#94a3b8",textAlign:"right" as const,whiteSpace:"nowrap" as const}}>{fmtTgl(r.diarsipkan_pada)}</div>
                          </div>
                          {fotoList.length===0?(
                            <div style={{fontSize:11,color:"#cbd5e1",fontStyle:"italic" as const}}>Belum ada foto</div>
                          ):(
                            <div style={{display:"flex",flexWrap:"wrap" as const,gap:6}}>
                              {fotoList.map((f:any,fi:number)=>(
                                <img key={fi} src={f.url} loading="lazy" onClick={()=>setLightbox({fotos:fotoList,startIndex:fi,label:r.panel_nama})}
                                  style={{width:56,height:56,borderRadius:6,objectFit:"cover" as const,border:"1px solid #e2e8f0",cursor:"pointer"}}/>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {lightbox&&<FotoZoomViewerPekerja fotos={lightbox.fotos} startIndex={lightbox.startIndex} label={lightbox.label} onClose={()=>setLightbox(null)}/>}
    </div>
  );
}
