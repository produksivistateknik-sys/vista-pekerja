import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { QC_ITEMS } from "../lib/panelTypes";
import { getUrgensiPanel } from "../lib/progressHelpers";
import { fetchAllPanels } from "../lib/panelHelpers";
import { hapusFotoDariStorage, compressImageNp } from "../lib/fotoHelpers";
import { FotoZoomViewerPekerja, type FotoViewerPekerja } from "./FotoZoomViewerPekerja";
import { MediaPickerSheet } from "./ui/MediaPickerSheet";
import { isVideoFoto, isGenericFoto } from "../lib/mediaThumb";

// ─────────────────────────────────────────────────────────────────────────────
// QC CHECKLIST TAB - dipisah dari App.tsx (Sprint 7)
// ─────────────────────────────────────────────────────────────────────────────
export function QCChecklistTab({user}:any){
  const[panelsList,setPanelsList]=useState<any[]>([]);
  const[loading,setLoading]=useState(true);
  const[search,setSearch]=useState("");
  const[selectedWoId,setSelectedWoId]=useState<number|null>(null);
  const[searchPanel,setSearchPanel]=useState("");
  const[uploadingId,setUploadingId]=useState<string|null>(null);
  const[fotoViewer,setFotoViewer]=useState<{fotos:FotoViewerPekerja[],startIndex:number,label:string}|null>(null);

  const fetchData=async()=>{
    setLoading(true);
    const panels=await fetchAllPanels();
    const woIds=[...new Set((panels??[]).map((p:any)=>p.wo_id).filter(Boolean))];
    const{data:wos}=woIds.length>0?await supabase.from("work_orders").select("id,wo,proyek,target,is_archived").in("id",woIds):{data:[]};
    const woMap:Record<number,any>={};
    (wos??[]).forEach((w:any)=>{woMap[w.id]=w;});
    const merged=(panels??[])
      .filter((p:any)=>!woMap[p.wo_id]?.is_archived)
      .map((p:any)=>({...p,_wo:woMap[p.wo_id]||{}}));
    setPanelsList(merged);
    setLoading(false);
  };

  useEffect(()=>{
    fetchData();
    const ch=supabase.channel("realtime-panels-qc")
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"panels"},()=>{fetchData();})
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"panels"},()=>{fetchData();})
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);

  const updateGlobalStatus=async(panelId:number,status:string)=>{
    const panel=panelsList.find((p:any)=>p.id===panelId);
    const prevGlobal=panel?.qc_checklist?._global||{};
    const now=new Date().toISOString();
    const newGlobal:any={...prevGlobal,status,updated_by:user.nama,updated_at:now};
    if(status==="to_do")newGlobal.todo_at=now;
    if(status==="complete")newGlobal.complete_at=now;
    const newChecklist={...(panel?.qc_checklist||{}),_global:newGlobal};
    await supabase.from("panels").update({qc_checklist:newChecklist}).eq("id",panelId);
    setPanelsList(prev=>prev.map((p:any)=>p.id===panelId?{...p,qc_checklist:newChecklist}:p));
  };

  const updateCatatanSeksi=async(panelId:number,itemKey:string,catatan:string)=>{
    const panel=panelsList.find((p:any)=>p.id===panelId);
    const prevData=panel?.qc_checklist?.[itemKey]||{};
    const newChecklist={...(panel?.qc_checklist||{}),[itemKey]:{...prevData,catatan}};
    await supabase.from("panels").update({qc_checklist:newChecklist}).eq("id",panelId);
    setPanelsList(prev=>prev.map((p:any)=>p.id===panelId?{...p,qc_checklist:newChecklist}:p));
  };

  const uploadFotoSeksi=async(panelId:number,itemKey:string,file:File)=>{
    const uploadKey=`${panelId}_${itemKey}`;
    setUploadingId(uploadKey);
    try{
      // BUG FIX (7 Agu 2026): jalur ini gak pernah kompres foto (upload file mentah) - foto
      // kamera HP 3-8MB bikin loading lambat pas ditampilin lagi. QC bisa upload video/file
      // apapun (allowVideo/allowAnyFile di MediaPickerSheet), jadi kompres CUMA kalau beneran
      // image - compressImageNp gak bisa proses video/file lain (decode-nya lewat <img>).
      const isImg=file.type.startsWith("image/");
      const uploadBlob:Blob=isImg?await compressImageNp(file):file;
      const fileName=isImg?`${panelId}_${itemKey}_${Date.now()}.jpg`:`${panelId}_${itemKey}_${Date.now()}_${file.name}`;
      const{error:upErr}=await supabase.storage.from("qc-photos").upload(fileName,uploadBlob,isImg?{contentType:"image/jpeg"}:undefined);
      if(upErr){alert("Gagal upload: "+upErr.message);setUploadingId(null);return;}
      const{data:urlData}=supabase.storage.from("qc-photos").getPublicUrl(fileName);
      const panel=panelsList.find((p:any)=>p.id===panelId);
      const prevData=panel?.qc_checklist?.[itemKey]||{status:"to_do",catatan:""};
      const newFoto=[...(prevData.foto||[]),{url:urlData.publicUrl,name:file.name,mime:file.type,uploaded_by:user.nama,uploaded_at:new Date().toISOString()}];
      const newChecklist={...(panel?.qc_checklist||{}),[itemKey]:{...prevData,foto:newFoto}};
      await supabase.from("panels").update({qc_checklist:newChecklist}).eq("id",panelId);
      setPanelsList(prev=>prev.map((p:any)=>p.id===panelId?{...p,qc_checklist:newChecklist}:p));
    }catch(err:any){
      alert("Terjadi kesalahan: "+err.message);
    }
    setUploadingId(null);
  };

  const hapusFotoSeksi=async(panelId:number,itemKey:string,fotoUrl:string)=>{
    if(!window.confirm("Hapus foto ini?"))return;
    const panel=panelsList.find((p:any)=>p.id===panelId);
    const prevData=panel?.qc_checklist?.[itemKey]||{status:"to_do",catatan:""};
    const newFoto=(prevData.foto||[]).filter((f:any)=>f.url!==fotoUrl);
    const newChecklist={...(panel?.qc_checklist||{}),[itemKey]:{...prevData,foto:newFoto}};
    // BUG FIX (6 Agu 2026): sebelumnya cuma hapus referensi di DB, file di Storage gak pernah
    // ikut kehapus - buang storage sia-sia. Sekarang hapus dua-duanya.
    await hapusFotoDariStorage("qc-photos",fotoUrl);
    await supabase.from("panels").update({qc_checklist:newChecklist}).eq("id",panelId);
    setPanelsList(prev=>prev.map((p:any)=>p.id===panelId?{...p,qc_checklist:newChecklist}:p));
  };

  const togglePacking=async(panelId:number,currentVal:boolean)=>{
    const newVal=!currentVal;
    await supabase.from("panels").update({
      packing_done:newVal,
      packing_done_by:newVal?user.nama:null,
      packing_done_at:newVal?new Date().toISOString():null,
    }).eq("id",panelId);
    setPanelsList(prev=>prev.map((p:any)=>p.id===panelId?{...p,packing_done:newVal,packing_done_by:newVal?user.nama:null}:p));
  };

  const getQcStatus=(panel:any)=>{
    return panel.qc_checklist?._global?.status||"to_do";
  };
  const fmtTglQc=(iso:string)=>{
    if(!iso)return"";
    const d=new Date(iso);
    return d.toLocaleDateString("id-ID",{day:"numeric",month:"short"})+" "+d.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"});
  };

  const urutanLevelNp:Record<string,number>={telat:0,mendesak:1,perhatian:2,normal:3};

  const projectGroups=useMemo(()=>{
    const groups:Record<string,{wo:any,panels:any[]}>={};
    panelsList.forEach((p:any)=>{
      const woId=String(p.wo_id);
      if(!groups[woId])groups[woId]={wo:p._wo,panels:[]};
      groups[woId].panels.push(p);
    });
    return Object.entries(groups).map(([woId,g])=>{
      const totalPanel=g.panels.length;
      const selesai=g.panels.filter((p:any)=>p.packing_done).length;
      return{woId:Number(woId),wo:g.wo,panels:g.panels,totalPanel,selesai};
    }).sort((a,b)=>{
      const aDone=a.selesai===a.totalPanel;
      const bDone=b.selesai===b.totalPanel;
      if(aDone!==bDone)return aDone?1:-1;
      const uA=getUrgensiPanel(a.wo?.target);const uB=getUrgensiPanel(b.wo?.target);
      const lvA=urutanLevelNp[uA.level]??3;const lvB=urutanLevelNp[uB.level]??3;
      if(lvA!==lvB)return lvA-lvB;
      if(uA.hari!==null&&uB.hari!==null)return uA.hari-uB.hari;
      return 0;
    });
  },[panelsList]);

  const filteredProjects=projectGroups.filter((g:any)=>
    !search||g.wo?.proyek?.toLowerCase().includes(search.toLowerCase())||g.wo?.wo?.toLowerCase().includes(search.toLowerCase())
  );

  const selectedProject=projectGroups.find((g:any)=>g.woId===selectedWoId);
  const warnaUrgMap:Record<string,{bg:string,color:string}>={telat:{bg:"#fef2f2",color:"#dc2626"},mendesak:{bg:"#fff7ed",color:"#ea580c"},perhatian:{bg:"#fefce8",color:"#ca8a04"}};

  if(!selectedWoId){
    return(
      <div style={{padding:"16px",background:"#f8fafc",minHeight:"100%"}}>
        <div style={{position:"relative" as const,marginBottom:14}}>
          <i className="ti ti-search" style={{position:"absolute" as const,left:12,top:11,fontSize:15,color:"#94a3b8"}}/>
          <input value={search} onChange={(e:any)=>setSearch(e.target.value)} placeholder="Cari proyek atau WO"
            style={{width:"100%",height:38,padding:"0 12px 0 34px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:13,outline:"none",background:"#fff",color:"#1e293b",boxSizing:"border-box" as const}}/>
        </div>
        {loading?(
          <div style={{textAlign:"center",padding:32,color:"#94a3b8",fontSize:13}}>Memuat data…</div>
        ):filteredProjects.length===0?(
          <div style={{textAlign:"center",padding:32,color:"#94a3b8",fontSize:13}}>Tidak ada proyek</div>
        ):(
          <div style={{display:"flex",flexDirection:"column" as const,gap:1,background:"#fff",borderRadius:10,border:"1.5px solid #e2e8f0",overflow:"hidden"}}>
            {filteredProjects.map((g:any,gi:number)=>{
              const allDone=g.selesai===g.totalPanel;
              const urg=getUrgensiPanel(g.wo?.target);
              const w=warnaUrgMap[urg.level];
              return(
                <div key={g.woId} onClick={()=>setSelectedWoId(g.woId)}
                  style={{padding:"13px 14px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",
                    borderTop:gi>0?"1px solid #f1f5f9":"none",background:"#fff"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0,flex:1}}>
                    <div style={{width:38,height:38,borderRadius:10,background:allDone?"linear-gradient(135deg,#4ade80,#16a34a)":"linear-gradient(135deg,#60a5fa,#2563eb)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:allDone?"0 3px 8px #16a34a33":"0 3px 8px #2563eb33"}}>
                      <i className={allDone?"ti ti-check":"ti ti-package"} style={{fontSize:17,color:"#fff"}}/>
                    </div>
                    <div style={{minWidth:0}}>
                      <div style={{fontWeight:800,fontSize:14,color:"#0f172a",whiteSpace:"nowrap" as const,overflow:"hidden",textOverflow:"ellipsis"}}>{g.wo?.proyek}</div>
                      <div style={{fontSize:11,fontWeight:600,color:"#64748b",marginTop:1}}>WO {g.wo?.wo} · {g.selesai}/{g.totalPanel} packing selesai</div>
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                    {urg.label&&urg.level!=="normal"&&w&&(
                      <span style={{fontSize:9,fontWeight:600,background:w.bg,color:w.color,borderRadius:5,padding:"3px 7px",whiteSpace:"nowrap" as const}}>{urg.label}</span>
                    )}
                    <i className="ti ti-chevron-right" style={{fontSize:16,color:"#cbd5e1"}}/>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return(
    <div style={{padding:"16px",background:"#f8fafc",minHeight:"100%"}}>
      <button onClick={()=>{setSelectedWoId(null);setSearchPanel("");}}
        style={{display:"flex",alignItems:"center",gap:5,background:"none",border:"none",color:"#2563eb",fontWeight:600,fontSize:12.5,cursor:"pointer",marginBottom:14,padding:0}}>
        <i className="ti ti-chevron-left" style={{fontSize:15}}/> Daftar proyek
      </button>
      <div style={{fontWeight:800,fontSize:16,color:"#0f172a",marginBottom:2}}>{selectedProject?.wo?.proyek}</div>
      <div style={{fontSize:11.5,fontWeight:600,color:"#64748b",marginBottom:12}}>WO {selectedProject?.wo?.wo}</div>

      <div style={{position:"relative" as const,marginBottom:14}}>
        <i className="ti ti-search" style={{position:"absolute" as const,left:12,top:11,fontSize:15,color:"#94a3b8"}}/>
        <input value={searchPanel} onChange={(e:any)=>setSearchPanel(e.target.value)} placeholder="Cari nama panel"
          style={{width:"100%",height:38,padding:"0 12px 0 34px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:13,outline:"none",background:"#fff",color:"#1e293b",boxSizing:"border-box" as const}}/>
      </div>

      <div style={{display:"flex",flexDirection:"column" as const,gap:12}}>
        {(selectedProject?.panels||[]).filter((p:any)=>!searchPanel||p.nama?.toLowerCase().includes(searchPanel.toLowerCase())).map((p:any)=>{
          const cl=p.qc_checklist||{};
          const qcStatus=getQcStatus(p);
          const qcSemuaComplete=qcStatus==="complete";
          const globalData=p.qc_checklist?._global||{};
          return(
            <div key={p.id} style={{background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:10,overflow:"hidden"}}>
              <div style={{padding:"14px 14px 12px",borderBottom:"1px solid #f1f5f9",background:"linear-gradient(180deg,#fafbfc,#fff)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <span style={{fontWeight:800,fontSize:16,color:"#0f172a"}}>{p.nama}</span>
                  {(globalData.todo_at||globalData.complete_at)&&(
                    <span style={{fontSize:9.5,color:"#94a3b8"}}>
                      {globalData.complete_at?("Selesai "+fmtTglQc(globalData.complete_at)):("Mulai "+fmtTglQc(globalData.todo_at))}
                    </span>
                  )}
                </div>
                <div style={{display:"flex",gap:6}}>
                  {[{k:"to_do",label:"To Do",icon:"ti ti-circle-dashed",color:"#64748b"},
                    {k:"in_progress",label:"Progress",icon:"ti ti-loader-2",color:"#ea580c"},
                    {k:"complete",label:"Complete",icon:"ti ti-circle-check",color:"#16a34a"}].map((s:any)=>{
                    const active=qcStatus===s.k;
                    return(
                      <button key={s.k} onClick={()=>updateGlobalStatus(p.id,s.k)}
                        style={{flex:1,display:"flex",flexDirection:"column" as const,alignItems:"center",gap:3,
                          padding:"9px 4px",borderRadius:10,border:active?"none":"1px solid #e2e8f0",
                          background:active?s.color:"#fff",cursor:"pointer",transition:"all .15s",
                          boxShadow:active?`0 3px 8px ${s.color}44`:"none"}}>
                        <i className={s.icon} style={{fontSize:16,color:active?"#fff":s.color}}/>
                        <span style={{fontSize:9,fontWeight:700,color:active?"#fff":"#94a3b8"}}>{s.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{padding:"10px 10px 4px",display:"flex",flexDirection:"column" as const,gap:8}}>
                {QC_ITEMS.map((item)=>{
                  const savedData=cl[item.key]||{catatan:""};
                  const fotoSeksi=savedData.foto||[];
                  const uploadKey=`${p.id}_${item.key}`;
                  return(
                    <div key={item.key} style={{padding:12,background:"#f8fafc",borderRadius:12,border:"1px solid #eef2f7"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                        <div style={{width:26,height:26,borderRadius:8,background:"#fff",border:"1px solid #e2e8f0",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:13}}>
                          {item.icon}
                        </div>
                        <span style={{fontSize:12.5,color:"#1e293b",fontWeight:700}}>{item.label}</span>
                      </div>
                      <input defaultValue={savedData.catatan||""} placeholder="Catatan (opsional)"
                        onBlur={(e:any)=>updateCatatanSeksi(p.id,item.key,e.target.value)}
                        style={{width:"100%",marginBottom:8,padding:"7px 10px",fontSize:11.5,borderRadius:6,border:"1px solid #e2e8f0",outline:"none",background:"#fff",color:"#1e293b",boxSizing:"border-box" as const}}/>
                      <div>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                          <span style={{fontSize:10.5,fontWeight:600,color:"#64748b"}}>Foto {fotoSeksi.length}</span>
                          <MediaPickerSheet allowVideo allowAnyFile
                            triggerStyle={{display:"flex",alignItems:"center",gap:4,cursor:"pointer",color:"#2563eb",fontSize:10.5,fontWeight:600}}
                            onFiles={(files)=>{(async()=>{for(const f of Array.from(files))await uploadFotoSeksi(p.id,item.key,f);})();}}>
                            <i className={uploadingId===uploadKey?"ti ti-loader-2":"ti ti-plus"} style={{fontSize:12}}/>
                            Tambah
                          </MediaPickerSheet>
                        </div>
                        {fotoSeksi.length>0&&(
                          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
                            {fotoSeksi.map((f:any,fi:number)=>{
                              const isVideo=isVideoFoto(f);
                              const isGeneric=isGenericFoto(f);
                              return(
                              <div key={fi}>
                                <div onClick={()=>{if(isGeneric)window.open(f.url,"_blank");else setFotoViewer({fotos:fotoSeksi,startIndex:fi,label:`${item.label}_${p.nama}`});}}
                                  style={{position:"relative" as const,aspectRatio:"1",borderRadius:8,overflow:"hidden",cursor:"pointer",background:"#f1f5f9",boxShadow:"0 1px 3px rgba(0,0,0,0.08)",display:isGeneric?"flex":undefined,alignItems:isGeneric?"center" as const:undefined,justifyContent:isGeneric?"center" as const:undefined}}>
                                  {isVideo?(
                                    <video src={f.url} muted style={{width:"100%",height:"100%",objectFit:"cover" as const}}/>
                                  ):isGeneric?(
                                    <div style={{textAlign:"center" as const,padding:4}}>
                                      <i className="ti ti-file-text" style={{fontSize:22,color:"#64748b",display:"block"}}/>
                                      <div style={{fontSize:7,color:"#64748b",marginTop:2,wordBreak:"break-all" as const}}>{f.name||"File"}</div>
                                    </div>
                                  ):(
                                    <img src={f.url} loading="lazy" style={{width:"100%",height:"100%",objectFit:"cover" as const}}/>
                                  )}
                                  {isVideo&&(
                                    <div style={{position:"absolute" as const,inset:0,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none" as const}}>
                                      <i className="ti ti-player-play-filled" style={{fontSize:20,color:"#fff",filter:"drop-shadow(0 1px 3px rgba(0,0,0,0.5))"}}/>
                                    </div>
                                  )}
                                  <button onClick={(e:any)=>{e.stopPropagation();hapusFotoSeksi(p.id,item.key,f.url);}}
                                    style={{position:"absolute" as const,top:3,right:3,width:16,height:16,borderRadius:99,background:"rgba(15,23,42,0.6)",color:"#fff",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                                    <i className="ti ti-x" style={{fontSize:9}}/>
                                  </button>
                                </div>
                                <div style={{fontSize:8.5,color:"#94a3b8",marginTop:2}}>{fmtTglQc(f.uploaded_at)}</div>
                              </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{padding:"12px 14px"}}>
                {p.packing_done?(
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 12px",background:"#f0fdf4",borderRadius:8}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <i className="ti ti-circle-check" style={{fontSize:18,color:"#16a34a"}}/>
                      <div>
                        <div style={{fontSize:12.5,fontWeight:600,color:"#16a34a"}}>Sudah packing</div>
                        <div style={{fontSize:10,color:"#86efac"}}>oleh {p.packing_done_by}</div>
                      </div>
                    </div>
                    <button onClick={()=>togglePacking(p.id,true)}
                      style={{fontSize:10.5,color:"#94a3b8",background:"none",border:"none",cursor:"pointer",textDecoration:"underline"}}>
                      Batalkan
                    </button>
                  </div>
                ):(
                  <button onClick={()=>{if(qcSemuaComplete)togglePacking(p.id,false);}} disabled={!qcSemuaComplete}
                    style={{width:"100%",height:44,borderRadius:10,border:"none",cursor:qcSemuaComplete?"pointer":"not-allowed",
                      fontSize:13,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:6,
                      background:qcSemuaComplete?"linear-gradient(135deg,#3b82f6,#1d4ed8)":"#f1f5f9",color:qcSemuaComplete?"#fff":"#94a3b8",
                      boxShadow:qcSemuaComplete?"0 4px 12px #1d4ed84a":"none"}}>
                    <i className={qcSemuaComplete?"ti ti-package":"ti ti-lock"} style={{fontSize:16}}/>
                    {qcSemuaComplete?"Tandai sudah packing":"Selesaikan QC dulu"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {fotoViewer&&(
        <FotoZoomViewerPekerja fotos={fotoViewer.fotos} startIndex={fotoViewer.startIndex} label={fotoViewer.label} onClose={()=>setFotoViewer(null)}/>
      )}
    </div>
  );
}
