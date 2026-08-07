import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { TODAY } from "../lib/dateHelpers";
import { withRetry } from "../lib/koneksi";
import { fetchAllPanels } from "../lib/panelHelpers";
import { compressImageNp, hapusFotoDariStorage } from "../lib/fotoHelpers";
import { getUrgensiPanel, fmtTanggalDeadlineNp, STATUS_TUGAS_NP } from "../lib/progressHelpers";
import { FotoZoomViewerPekerja, type FotoViewerPekerja } from "./FotoZoomViewerPekerja";
import { MediaPickerSheet } from "./ui/MediaPickerSheet";

const PROGRESS_STEPS_NP=[25,50,75,100];
const hitungStatusTugasNp=(pct:number,jumlahFoto:number)=>{
  if(pct>=100&&jumlahFoto>=1)return"selesai";
  if(pct>0||jumlahFoto>0)return"proses";
  return"belum";
};
const TUGAS_NP=[
  {field:"nameplate",label:"Nameplate",icon:"🏷️",color:"#0891b2",progressField:"nameplate_progress" as const,fotoField:"nameplate_photos",historyField:"nameplate_history",updatedByField:"nameplate_updated_by",updatedAtField:"nameplate_updated_at"},
  {field:"yellowmark",label:"Yellowmark",icon:"🟡",color:"#ca8a04",progressField:"yellowmark_progress" as const,fotoField:"yellowmark_photos",historyField:"yellowmark_history",updatedByField:"yellowmark_updated_by",updatedAtField:"yellowmark_updated_at"},
];

// ─────────────────────────────────────────────────────────────────────────────
// NAMEPLATE VIEW - dipisah dari App.tsx (Sprint 7)
// ─────────────────────────────────────────────────────────────────────────────
export function NameplateView({user}:any){
  const[panelsList,setPanelsList]=useState<any[]>([]);
  const[loading,setLoading]=useState(true);
  const[search,setSearch]=useState("");
  const[selectedWoId,setSelectedWoId]=useState<number|null>(null);
  const[expandedTugas,setExpandedTugas]=useState<Set<string>>(new Set());
  const toggleTugas=(panelId:number,field:string)=>{
    const key=`${panelId}_${field}`;
    setExpandedTugas(prev=>{
      const next=new Set(prev);
      if(next.has(key))next.delete(key);else next.add(key);
      return next;
    });
  };

  // Foto yang baru dipilih tapi BELUM disimpan permanen (staging lokal saja, belum ada
  // di Supabase Storage/DB) - operator masih bisa Batalkan sebelum tekan Simpan Progress.
  const[stagedFotos,setStagedFotos]=useState<Record<string,{file:File,previewUrl:string}[]>>({});
  const[savingKey,setSavingKey]=useState<string|null>(null);
  const[uploadProgress,setUploadProgress]=useState<{current:number,total:number}|null>(null);

  const[fotoViewer,setFotoViewer]=useState<{fotos:FotoViewerPekerja[],startIndex:number,label:string}|null>(null);

  const pilihFotoStaged=(panelId:number,field:string,fileList:FileList|null)=>{
    if(!fileList||fileList.length===0)return;
    const key=`${panelId}_${field}`;
    const dipilih=Array.from(fileList).map(file=>({file,previewUrl:URL.createObjectURL(file)}));
    setStagedFotos(prev=>({...prev,[key]:[...(prev[key]||[]),...dipilih]}));
  };

  const batalkanFotoStaged=(panelId:number,field:string,idx:number)=>{
    const key=`${panelId}_${field}`;
    setStagedFotos(prev=>{
      const arr=prev[key]||[];
      URL.revokeObjectURL(arr[idx]?.previewUrl);
      return{...prev,[key]:arr.filter((_,i)=>i!==idx)};
    });
  };

  // Hapus foto yang SUDAH tersimpan (bukan staged) - progress/pct/history sama sekali gak
  // disentuh, cuma field foto-nya. Kalau ini bikin foto jadi kosong, operator otomatis kelihatan
  // "Belum ada foto" lagi pas render ulang - gak perlu state tambahan.
  const hapusFotoTersimpan=async(panelId:number,t:typeof TUGAS_NP[number],fotoUrl:string)=>{
    if(!window.confirm("Hapus foto ini?"))return;
    const panel=panelsList.find((p:any)=>p.id===panelId);
    if(!panel)return;
    const newFoto=(panel[t.fotoField]||[]).filter((f:any)=>f.url!==fotoUrl);
    await hapusFotoDariStorage("nameplate-photos",fotoUrl);
    await supabase.from("panels").update({[t.fotoField]:newFoto}).eq("id",panelId);
    setPanelsList(prev=>prev.map((p:any)=>p.id===panelId?{...p,[t.fotoField]:newFoto}:p));
  };

  const simpanProgressTugas=async(p:any,t:typeof TUGAS_NP[number])=>{
    const key=`${p.id}_${t.field}`;
    const staged=stagedFotos[key]||[];
    const pct=p[t.progressField]||0;
    const existingFoto=p[t.fotoField]||[];
    const hist=p[t.historyField]||[];
    const existIdx=hist.findIndex((h:any)=>h.tanggal===TODAY);
    const pctBerubah=existIdx<0||hist[existIdx].pct!==pct;
    if(!pctBerubah&&staged.length===0){alert("Tidak ada perubahan untuk disimpan");return;}
    setSavingKey(key);
    try{
      const fotoTerupload:any[]=[];
      for(let i=0;i<staged.length;i++){
        setUploadProgress({current:i+1,total:staged.length});
        const s=staged[i];
        const blob=await compressImageNp(s.file);
        const path=`${p.id}/${t.field}/${Date.now()}_${Math.random().toString(36).slice(2,8)}.jpg`;
        const{error:upErr}=await supabase.storage.from("nameplate-photos").upload(path,blob,{contentType:"image/jpeg"});
        if(upErr){alert(`Gagal upload salah satu foto: ${upErr.message}`);continue;}
        const{data:urlData}=supabase.storage.from("nameplate-photos").getPublicUrl(path);
        fotoTerupload.push({url:urlData.publicUrl,uploaded_by:user.nama,uploaded_at:new Date().toISOString()});
      }
      setUploadProgress(null);
      const newFoto=[...existingFoto,...fotoTerupload];
      const newHist=[...hist];
      if(existIdx>=0)newHist[existIdx]={...newHist[existIdx],pct,ts:new Date().toISOString()};
      else newHist.push({tanggal:TODAY,pct,oleh:user.nama,ts:new Date().toISOString()});
      const patch={
        [t.progressField]:pct,
        [t.updatedByField]:user.nama,
        [t.updatedAtField]:new Date().toISOString(),
        [t.historyField]:newHist,
        [t.fotoField]:newFoto,
      };
      await supabase.from("panels").update(patch).eq("id",p.id);
      setPanelsList(prev=>prev.map((pp:any)=>pp.id===p.id?{...pp,...patch}:pp));
      staged.forEach(s=>URL.revokeObjectURL(s.previewUrl));
      setStagedFotos(prev=>{const next={...prev};delete next[key];return next;});
    }catch(err:any){
      alert("Terjadi kesalahan: "+err.message);
    }
    setUploadProgress(null);
    setSavingKey(null);
  };

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
    const ch=supabase.channel("realtime-panels-nameplate")
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"panels"},()=>{fetchData();})
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"panels"},()=>{fetchData();})
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);

  const[lockLoading,setLockLoading]=useState(false);

  const updateProgress=(panelId:number,field:"nameplate_progress"|"yellowmark_progress",val:number)=>{
    setPanelsList(prev=>prev.map((p:any)=>p.id===panelId?{...p,[field]:val}:p));
  };

  const kunciProgress=async(panelList:any[])=>{
    setLockLoading(true);
    let count=0;
    const gagal:string[]=[];
    for(const p of panelList){
      const npHist=p.nameplate_history||[];
      const ymHist=p.yellowmark_history||[];
      const npExistIdx=npHist.findIndex((h:any)=>h.tanggal===TODAY);
      const ymExistIdx=ymHist.findIndex((h:any)=>h.tanggal===TODAY);
      const npChanged=npExistIdx<0||npHist[npExistIdx].pct!==(p.nameplate_progress||0);
      const ymChanged=ymExistIdx<0||ymHist[ymExistIdx].pct!==(p.yellowmark_progress||0);
      if(!npChanged&&!ymChanged)continue;
      const newNpHist=[...npHist];
      if(npExistIdx>=0)newNpHist[npExistIdx]={...newNpHist[npExistIdx],pct:p.nameplate_progress||0,ts:new Date().toISOString()};
      else newNpHist.push({tanggal:TODAY,pct:p.nameplate_progress||0,oleh:user.nama,ts:new Date().toISOString()});
      const newYmHist=[...ymHist];
      if(ymExistIdx>=0)newYmHist[ymExistIdx]={...newYmHist[ymExistIdx],pct:p.yellowmark_progress||0,ts:new Date().toISOString()};
      else newYmHist.push({tanggal:TODAY,pct:p.yellowmark_progress||0,oleh:user.nama,ts:new Date().toISOString()});
      // Retry singkat + gak langsung refetch kalau ada yang gagal - biar angka yang udah diketik
      // user gak ketiban timpa data lama dari server (fetchData() cuma dipanggil kalau SEMUA sukses).
      try{
        const{error}=await withRetry(()=>supabase.from("panels").update({
          nameplate_progress:p.nameplate_progress||0,nameplate_updated_by:user.nama,nameplate_updated_at:new Date().toISOString(),nameplate_history:newNpHist,
          yellowmark_progress:p.yellowmark_progress||0,yellowmark_updated_by:user.nama,yellowmark_updated_at:new Date().toISOString(),yellowmark_history:newYmHist,
        }).eq("id",p.id));
        if(error)throw error;
        count++;
      }catch{
        gagal.push(p.nama||("Panel #"+p.id));
      }
    }
    setLockLoading(false);
    if(gagal.length>0){
      alert(count+" panel berhasil dikunci.\n\nGAGAL simpan "+gagal.length+" panel (koneksi lambat/putus): "+gagal.join(", ")+" - data yang sudah diketik TETAP ADA, coba tombol Kunci Progress lagi.");
    }else{
      alert(count>0?`${count} panel berhasil dikunci`:"Tidak ada perubahan untuk dikunci");
      fetchData();
    }
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
      const selesai=g.panels.filter((p:any)=>
        hitungStatusTugasNp(p.nameplate_progress||0,(p.nameplate_photos||[]).length)==="selesai"&&
        hitungStatusTugasNp(p.yellowmark_progress||0,(p.yellowmark_photos||[]).length)==="selesai"
      ).length;
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
      <div style={{padding:"12px 14px"}}>
        <input value={search} onChange={(e:any)=>setSearch(e.target.value)} placeholder="🔍 Cari proyek atau WO..."
          style={{width:"100%",height:36,padding:"0 12px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:13,marginBottom:12,outline:"none"}}/>
        {loading?(
          <div style={{textAlign:"center",padding:40,color:"#94a3b8"}}>
            <i className="ti ti-loader-2" style={{fontSize:26,display:"block",marginBottom:8}}/>
            Memuat data...
          </div>
        ):filteredProjects.length===0?(
          <div style={{textAlign:"center",padding:40,color:"#94a3b8"}}>
            <i className="ti ti-folder-x" style={{fontSize:32,display:"block",marginBottom:8}}/>
            Tidak ada proyek
          </div>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {filteredProjects.map((g:any)=>{
              const allDone=g.selesai===g.totalPanel;
              const pctWo=g.totalPanel>0?Math.round((g.selesai/g.totalPanel)*100):0;
              const urg=getUrgensiPanel(g.wo?.target);
              const w=warnaUrgMap[urg.level];
              return(
                <div key={g.woId} onClick={()=>setSelectedWoId(g.woId)}
                  style={{position:"relative" as const,background:"#fff",borderRadius:16,padding:"14px 16px 14px 20px",cursor:"pointer",
                    opacity:allDone?0.72:1,border:"1.5px solid #eef0f3",boxShadow:"0 1px 3px rgba(15,23,42,0.05)",overflow:"hidden"}}>
                  <div style={{position:"absolute" as const,left:0,top:0,bottom:0,width:4,background:allDone?"#16a34a":"#0891b2"}}/>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:10}}>
                    <div style={{minWidth:0,flex:1}}>
                      <div style={{fontWeight:800,fontSize:15,color:"#0f172a",whiteSpace:"nowrap" as const,overflow:"hidden",textOverflow:"ellipsis"}}>{g.wo?.proyek}</div>
                      <div style={{fontSize:11,fontWeight:600,color:"#64748b",marginTop:3}}>
                        WO {g.wo?.wo}{g.wo?.target?` · Deadline ${fmtTanggalDeadlineNp(g.wo.target)}`:""}
                      </div>
                    </div>
                    {urg.label&&urg.level!=="normal"&&w?(
                      <span style={{fontSize:9,fontWeight:800,background:w.bg,color:w.color,borderRadius:20,padding:"4px 9px",whiteSpace:"nowrap" as const,flexShrink:0}}>{urg.level==="telat"?"\u26a0 ":"\u23f0 "}{urg.label}</span>
                    ):(
                      <i className="ti ti-chevron-right" style={{fontSize:18,color:"#cbd5e1",flexShrink:0,marginTop:2}}/>
                    )}
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                    <span style={{fontSize:11,fontWeight:700,color:allDone?"#16a34a":"#64748b"}}>
                      {allDone?"\u2713 Semua selesai":`${g.selesai}/${g.totalPanel} panel selesai`}
                    </span>
                    <span style={{fontSize:11,fontWeight:800,color:allDone?"#16a34a":"#0891b2"}}>{pctWo}%</span>
                  </div>
                  <div style={{height:6,borderRadius:99,background:"#f1f5f9",overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${pctWo}%`,borderRadius:99,background:allDone?"#16a34a":"#0891b2",transition:"width .35s ease"}}/>
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
    <div style={{padding:"14px 14px 28px",background:"#f8fafc",minHeight:"100%"}}>
      <button onClick={()=>setSelectedWoId(null)}
        style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:"#0891b2",fontWeight:700,fontSize:13,cursor:"pointer",marginBottom:12,padding:0}}>
        <i className="ti ti-arrow-left" style={{fontSize:16}}/> Kembali ke Daftar Proyek
      </button>

      <div style={{background:"#fff",borderRadius:16,padding:16,marginBottom:14,border:"1.5px solid #eef0f3",boxShadow:"0 1px 3px rgba(15,23,42,0.05)",
        display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
        <div style={{minWidth:0}}>
          <div style={{fontWeight:800,fontSize:16.5,color:"#0f172a"}}>{selectedProject?.wo?.proyek}</div>
          <div style={{fontSize:11.5,fontWeight:600,color:"#64748b",marginTop:3}}>
            WO {selectedProject?.wo?.wo}{selectedProject?.wo?.target?` · Deadline ${fmtTanggalDeadlineNp(selectedProject.wo.target)}`:""}
          </div>
        </div>
        <button onClick={()=>kunciProgress(selectedProject?.panels||[])} disabled={lockLoading}
          style={{display:"flex",alignItems:"center",gap:6,background:lockLoading?"#cbd5e1":"#0891b2",color:"#fff",border:"none",borderRadius:10,padding:"9px 14px",
            fontSize:12,fontWeight:700,cursor:lockLoading?"not-allowed":"pointer",whiteSpace:"nowrap" as const,flexShrink:0,
            boxShadow:lockLoading?"none":"0 3px 10px #0891b240"}}>
          <i className={lockLoading?"ti ti-loader-2":"ti ti-lock"} style={{fontSize:14}}/>
          {lockLoading?"Mengunci...":"Kunci"}
        </button>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {(selectedProject?.panels||[]).map((p:any)=>{
          const statusPerTugas=TUGAS_NP.map(t=>hitungStatusTugasNp(p[t.progressField]||0,(p[t.fotoField]||[]).length));
          const done=statusPerTugas.every(s=>s==="selesai");
          return(
            <div key={p.id} style={{background:"#fff",borderRadius:14,border:"1.5px solid #eef0f3",overflow:"hidden",
              boxShadow:done?"0 1px 2px rgba(15,23,42,0.03)":"0 1px 3px rgba(15,23,42,0.05)",opacity:done?0.85:1}}>
              <div style={{padding:"12px 15px 8px",display:"flex",alignItems:"center",gap:8}}>
                <div style={{fontWeight:800,fontSize:14.5,color:"#0f172a",flex:1,minWidth:0,whiteSpace:"nowrap" as const,overflow:"hidden",textOverflow:"ellipsis"}}>{p.nama}</div>
                {done&&<i className="ti ti-circle-check-filled" style={{fontSize:16,color:"#16a34a",flexShrink:0}}/>}
              </div>

              <div style={{display:"flex",flexDirection:"column",gap:8,padding:"0 10px 10px"}}>
                {TUGAS_NP.map((t,ti)=>{
                  const pct=p[t.progressField]||0;
                  const fotoArr=p[t.fotoField]||[];
                  const status=statusPerTugas[ti];
                  const st=STATUS_TUGAS_NP[status];
                  const key=`${p.id}_${t.field}`;
                  const expanded=expandedTugas.has(key);
                  const staged=stagedFotos[key]||[];
                  const saving=savingKey===key;
                  return(
                    <div key={t.field} style={{border:"1px solid #f1f5f9",borderRadius:12,overflow:"hidden",background:"#fafbfc"}}>
                      <div onClick={()=>toggleTugas(p.id,t.field)}
                        style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",cursor:"pointer"}}>
                        <div style={{width:32,height:32,borderRadius:9,background:st.bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:15}}>
                          {t.icon}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:12.5,fontWeight:700,color:"#1e293b"}}>{t.label}</div>
                          <div style={{fontSize:10,fontWeight:600,color:st.color,marginTop:1}}>{st.label}</div>
                        </div>
                        <i className="ti ti-chevron-down" style={{fontSize:15,color:"#cbd5e1",flexShrink:0,transition:"transform .2s",transform:expanded?"rotate(180deg)":"none"}}/>
                      </div>
                      {expanded&&(
                        <div style={{padding:"2px 12px 14px",borderTop:"1px solid #f1f5f9"}}>
                          <div style={{marginBottom:14,marginTop:12}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                              <span style={{fontSize:10.5,fontWeight:700,color:"#94a3b8",letterSpacing:.3}}>FABRIKASI</span>
                              <span style={{fontSize:11,fontWeight:800,color:pct>=100?"#16a34a":t.color}}>{pct}%</span>
                            </div>
                            <div style={{display:"flex",gap:4}}>
                              {PROGRESS_STEPS_NP.map(s=>(
                                <button key={s} onClick={()=>updateProgress(p.id,t.progressField,pct>=s?s-25:s)}
                                  style={{flex:1,height:30,borderRadius:8,border:"none",cursor:"pointer",fontSize:10,fontWeight:700,
                                    background:pct>=s?t.color:"#f1f5f9",color:pct>=s?"#fff":"#94a3b8"}}>{s}%</button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <div style={{fontSize:10.5,fontWeight:700,color:"#94a3b8",marginBottom:8,letterSpacing:.3}}>PEMASANGAN (FOTO)</div>
                            {fotoArr.length===0&&staged.length===0?(
                              <div style={{fontSize:11.5,color:"#cbd5e1",padding:"6px 0 10px",fontStyle:"italic" as const}}>Belum ada foto</div>
                            ):(
                              <div style={{display:"flex",flexWrap:"wrap" as const,gap:8,marginBottom:10}}>
                                {fotoArr.map((f:any,fi:number)=>(
                                  <div key={`saved_${fi}`} style={{position:"relative" as const}}>
                                    <img onClick={()=>setFotoViewer({fotos:fotoArr,startIndex:fi,label:`${t.label}_${p.nama}`})}
                                      src={f.url} loading="lazy" style={{width:60,height:60,borderRadius:10,objectFit:"cover" as const,border:"1px solid #eef0f3",boxShadow:"0 1px 3px rgba(15,23,42,0.06)",cursor:"pointer"}}/>
                                    <button onClick={(e:any)=>{e.stopPropagation();hapusFotoTersimpan(p.id,t,f.url);}}
                                      style={{position:"absolute" as const,top:-6,right:-6,width:18,height:18,borderRadius:99,background:"#dc2626",color:"#fff",border:"2px solid #fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                                      <i className="ti ti-trash" style={{fontSize:10}}/>
                                    </button>
                                    <div style={{fontSize:8,color:"#94a3b8",marginTop:3,textAlign:"center" as const}}>{f.uploaded_at?new Date(f.uploaded_at).toLocaleDateString("id-ID",{day:"numeric",month:"short"}):""}</div>
                                  </div>
                                ))}
                                {staged.map((s,si)=>(
                                  <div key={`staged_${si}`} style={{position:"relative" as const}}>
                                    <img src={s.previewUrl} style={{width:60,height:60,borderRadius:10,objectFit:"cover" as const,border:`1.5px dashed ${t.color}`}}/>
                                    <button onClick={()=>batalkanFotoStaged(p.id,t.field,si)}
                                      style={{position:"absolute" as const,top:-6,right:-6,width:18,height:18,borderRadius:99,background:"#dc2626",color:"#fff",border:"2px solid #fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 1px 3px rgba(0,0,0,0.2)"}}>
                                      <i className="ti ti-x" style={{fontSize:10}}/>
                                    </button>
                                    <div style={{fontSize:8,color:t.color,marginTop:3,textAlign:"center" as const,fontWeight:700}}>belum disimpan</div>
                                  </div>
                                ))}
                              </div>
                            )}
                            <MediaPickerSheet disabled={saving}
                              triggerStyle={{display:"inline-flex",alignItems:"center",gap:5,fontSize:11.5,fontWeight:700,color:t.color,background:`${t.color}0f`,border:`1.5px dashed ${t.color}55`,borderRadius:10,padding:"9px 13px",
                                cursor:saving?"not-allowed":"pointer",opacity:saving?0.5:1,pointerEvents:saving?"none" as const:"auto" as const}}
                              onFiles={(files)=>pilihFotoStaged(p.id,t.field,files)}>
                              <i className="ti ti-camera-plus" style={{fontSize:14}}/> Tambah Foto
                            </MediaPickerSheet>
                            <button onClick={()=>simpanProgressTugas(p,t)} disabled={saving}
                              style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginTop:12,width:"100%",
                                background:saving?"#cbd5e1":t.color,color:"#fff",border:"none",borderRadius:11,padding:"11px 10px",fontSize:12.5,fontWeight:700,
                                cursor:saving?"not-allowed":"pointer",boxShadow:saving?"none":`0 4px 12px ${t.color}40`}}>
                              <i className={saving?"ti ti-loader-2":"ti ti-device-floppy"} style={{fontSize:15}}/>
                              {saving?(uploadProgress?`Upload foto ${uploadProgress.current}/${uploadProgress.total}...`:"Menyimpan..."):"Simpan Progress"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
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
