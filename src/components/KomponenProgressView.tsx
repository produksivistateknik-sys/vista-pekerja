import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "../lib/supabase";
import { TODAY } from "../lib/dateHelpers";
import { withRetry } from "../lib/koneksi";
import { fetchAllPanels } from "../lib/panelHelpers";
import { compressImageNp, hapusFotoDariStorage } from "../lib/fotoHelpers";
import { uploadToR2 } from "../lib/r2Client";
import { getUrgensiPanel, fmtTanggalDeadlineNp, STATUS_TUGAS_NP } from "../lib/progressHelpers";
import { FotoZoomViewerPekerja, type FotoViewerPekerja } from "./FotoZoomViewerPekerja";
import { MediaPickerSheet } from "./ui/MediaPickerSheet";

const STATUS_3_NP=[{key:"todo",label:"To Do",pct:0},{key:"progress",label:"In Progress",pct:50},{key:"done",label:"Done",pct:100}];

// ─────────────────────────────────────────────────────────────────────────────
// KOMPONEN PROGRESS VIEW - dipisah dari App.tsx (Sprint 7)
// Sama persis pola NameplateView, digenerikkan buat 1 tugas (Warehouse ATAU QS, bukan sepasang) -
// dipakai via prop `tugas` (TUGAS_WAREHOUSE/TUGAS_QS), termasuk nama bucket foto sendiri-sendiri.
// ─────────────────────────────────────────────────────────────────────────────
export function KomponenProgressView({user,tugas}:{user:any,tugas:{field:string,label:string,icon:string,color:string,progressField:string,fotoField:string,historyField:string,updatedByField:string,updatedAtField:string,bucket:string}}){
  const[panelsList,setPanelsList]=useState<any[]>([]);
  const[loading,setLoading]=useState(true);
  const[search,setSearch]=useState("");
  const[selectedWoId,setSelectedWoId]=useState<number|null>(null);
  const[expandedPanel,setExpandedPanel]=useState<Set<number>>(new Set());
  const togglePanel=(panelId:number)=>{
    setExpandedPanel(prev=>{
      const next=new Set(prev);
      if(next.has(panelId))next.delete(panelId);else next.add(panelId);
      return next;
    });
  };

  const[stagedFotos,setStagedFotos]=useState<Record<number,{file:File,previewUrl:string}[]>>({});
  const[savingKey,setSavingKey]=useState<number|null>(null);
  const[uploadProgress,setUploadProgress]=useState<{current:number,total:number}|null>(null);

  const[fotoViewer,setFotoViewer]=useState<{fotos:FotoViewerPekerja[],startIndex:number,label:string}|null>(null);

  const pilihFotoStaged=(panelId:number,fileList:FileList|null)=>{
    if(!fileList||fileList.length===0)return;
    const dipilih=Array.from(fileList).map(file=>({file,previewUrl:URL.createObjectURL(file)}));
    setStagedFotos(prev=>({...prev,[panelId]:[...(prev[panelId]||[]),...dipilih]}));
  };

  const batalkanFotoStaged=(panelId:number,idx:number)=>{
    setStagedFotos(prev=>{
      const arr=prev[panelId]||[];
      URL.revokeObjectURL(arr[idx]?.previewUrl);
      return{...prev,[panelId]:arr.filter((_,i)=>i!==idx)};
    });
  };

  // Hapus foto yang SUDAH tersimpan (bukan staged) - progress/pct/history sama sekali gak
  // disentuh, cuma field foto-nya.
  const hapusFotoTersimpan=async(panelId:number,fotoUrl:string)=>{
    if(!window.confirm("Hapus foto ini?"))return;
    const panel=panelsList.find((p:any)=>p.id===panelId);
    if(!panel)return;
    const newFoto=(panel[tugas.fotoField]||[]).filter((f:any)=>f.url!==fotoUrl);
    await hapusFotoDariStorage(tugas.bucket,fotoUrl);
    await supabase.from("panels").update({[tugas.fotoField]:newFoto}).eq("id",panelId);
    setPanelsList(prev=>prev.map((p:any)=>p.id===panelId?{...p,[tugas.fotoField]:newFoto}:p));
  };

  const simpanProgressPanel=async(p:any)=>{
    const staged=stagedFotos[p.id]||[];
    const pct=p[tugas.progressField]||0;
    const existingFoto=p[tugas.fotoField]||[];
    const hist=p[tugas.historyField]||[];
    const existIdx=hist.findIndex((h:any)=>h.tanggal===TODAY);
    const pctBerubah=existIdx<0||hist[existIdx].pct!==pct;
    if(!pctBerubah&&staged.length===0){alert("Tidak ada perubahan untuk disimpan");return;}
    setSavingKey(p.id);
    try{
      const fotoTerupload:any[]=[];
      for(let i=0;i<staged.length;i++){
        setUploadProgress({current:i+1,total:staged.length});
        const s=staged[i];
        const blob=await compressImageNp(s.file);
        const folderFoto=tugas.bucket.replace(/-photos$/,"");
        const objectKey=`${folderFoto}/${p.id}/${tugas.field}/${Date.now()}_${Math.random().toString(36).slice(2,8)}.jpg`;
        let publicUrl:string;
        try{
          publicUrl=await uploadToR2(blob,objectKey,"image/jpeg");
        }catch(upErr:any){alert(`Gagal upload salah satu foto: ${upErr.message}`);continue;}
        fotoTerupload.push({url:publicUrl,uploaded_by:user.nama,uploaded_at:new Date().toISOString()});
      }
      setUploadProgress(null);
      const newFoto=[...existingFoto,...fotoTerupload];
      const newHist=[...hist];
      if(existIdx>=0)newHist[existIdx]={...newHist[existIdx],pct,ts:new Date().toISOString()};
      else newHist.push({tanggal:TODAY,pct,oleh:user.nama,ts:new Date().toISOString()});
      const patch={
        [tugas.progressField]:pct,
        [tugas.updatedByField]:user.nama,
        [tugas.updatedAtField]:new Date().toISOString(),
        [tugas.historyField]:newHist,
        [tugas.fotoField]:newFoto,
      };
      await supabase.from("panels").update(patch).eq("id",p.id);
      dirtyProgressRef.current.delete(p.id);
      setPanelsList(prev=>prev.map((pp:any)=>pp.id===p.id?{...pp,...patch}:pp));
      staged.forEach(s=>URL.revokeObjectURL(s.previewUrl));
      setStagedFotos(prev=>{const next={...prev};delete next[p.id];return next;});
    }catch(err:any){
      alert("Terjadi kesalahan: "+err.message);
    }
    setUploadProgress(null);
    setSavingKey(null);
  };

  // Panel yang persentase-nya barusan diklik tapi belum "Simpan Progress" - dilindungi dari
  // ketiban fetchData() (realtime nyala buat SEMUA update tabel panels, bukan cuma punya sendiri,
  // jadi tanpa ini klik yang belum disimpan bisa ke-timpa balik pas ada panel lain yang berubah).
  const dirtyProgressRef=useRef<Set<number>>(new Set());

  const fetchData=async()=>{
    setLoading(true);
    const panels=await fetchAllPanels();
    const woIds=[...new Set((panels??[]).map((p:any)=>p.wo_id).filter(Boolean))];
    const{data:wos}=woIds.length>0?await supabase.from("work_orders").select("id,wo,proyek,target,is_archived").in("id",woIds):{data:[]};
    const woMap:Record<number,any>={};
    (wos??[]).forEach((w:any)=>{woMap[w.id]=w;});
    setPanelsList(prev=>{
      const prevMap:Record<number,any>={};
      prev.forEach((p:any)=>{prevMap[p.id]=p;});
      return(panels??[])
        .filter((p:any)=>!woMap[p.wo_id]?.is_archived)
        .map((p:any)=>{
          const merged={...p,_wo:woMap[p.wo_id]||{}};
          if(dirtyProgressRef.current.has(p.id)&&prevMap[p.id]){
            merged[tugas.progressField]=prevMap[p.id][tugas.progressField];
          }
          return merged;
        });
    });
    setLoading(false);
  };

  useEffect(()=>{
    fetchData();
    const ch=supabase.channel(`realtime-panels-${tugas.field}`)
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"panels"},()=>{fetchData();})
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"panels"},()=>{fetchData();})
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[tugas.field]);

  const[lockLoading,setLockLoading]=useState(false);

  const updateProgress=(panelId:number,val:number)=>{
    dirtyProgressRef.current.add(panelId);
    setPanelsList(prev=>prev.map((p:any)=>p.id===panelId?{...p,[tugas.progressField]:val}:p));
  };

  const kunciProgress=async(panelList:any[])=>{
    setLockLoading(true);
    let count=0;
    const gagal:string[]=[];
    for(const p of panelList){
      const hist=p[tugas.historyField]||[];
      const existIdx=hist.findIndex((h:any)=>h.tanggal===TODAY);
      const changed=existIdx<0||hist[existIdx].pct!==(p[tugas.progressField]||0);
      if(!changed)continue;
      const newHist=[...hist];
      if(existIdx>=0)newHist[existIdx]={...newHist[existIdx],pct:p[tugas.progressField]||0,ts:new Date().toISOString()};
      else newHist.push({tanggal:TODAY,pct:p[tugas.progressField]||0,oleh:user.nama,ts:new Date().toISOString()});
      // Retry singkat; dirtyProgressRef CUMA di-clear kalau beneran sukses, biar fetchData()
      // (dipanggil channel realtime kapan aja) tetap pertahanin nilai lokal yang belum ke-simpan.
      try{
        const{error}=await withRetry(()=>supabase.from("panels").update({
          [tugas.progressField]:p[tugas.progressField]||0,
          [tugas.updatedByField]:user.nama,
          [tugas.updatedAtField]:new Date().toISOString(),
          [tugas.historyField]:newHist,
        }).eq("id",p.id));
        if(error)throw error;
        dirtyProgressRef.current.delete(p.id);
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
    }
    fetchData();
  };

  const urutanLevelNp:Record<string,number>={telat:0,mendesak:1,perhatian:2,normal:3};
  // Beda dari Nameplate/Yellowmark: Warehouse/QS dianggap "Selesai" cukup dari persentase 100%,
  // gak wajib ada foto (foto tetap boleh dilampirkan, tapi bukan syarat status selesai).
  const hitungStatusKomponen=(pct:number)=>{
    if(pct>=100)return"selesai";
    if(pct>0)return"proses";
    return"belum";
  };

  const projectGroups=useMemo(()=>{
    const groups:Record<string,{wo:any,panels:any[]}>={};
    panelsList.forEach((p:any)=>{
      const woId=String(p.wo_id);
      if(!groups[woId])groups[woId]={wo:p._wo,panels:[]};
      groups[woId].panels.push(p);
    });
    return Object.entries(groups).map(([woId,g])=>{
      const totalPanel=g.panels.length;
      const selesai=g.panels.filter((p:any)=>hitungStatusKomponen(p[tugas.progressField]||0)==="selesai").length;
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
  },[panelsList,tugas]);

  const filteredProjects=projectGroups.filter((g:any)=>
    !search||g.wo?.proyek?.toLowerCase().includes(search.toLowerCase())||g.wo?.wo?.toLowerCase().includes(search.toLowerCase())
  );

  const selectedProject=projectGroups.find((g:any)=>g.woId===selectedWoId);

  const warnaUrgMap:Record<string,{bg:string,color:string}>={telat:{bg:"#fef2f2",color:"#dc2626"},mendesak:{bg:"#fff7ed",color:"#ea580c"},perhatian:{bg:"#fefce8",color:"#ca8a04"}};

  const STATUS_ICON_KP:Record<string,string>={belum:"ti-circle-dashed",proses:"ti-loader-2",selesai:"ti-circle-check-filled"};
  const STATUS_3_ICON:Record<string,string>={todo:"ti-circle-dashed",progress:"ti-loader-2",done:"ti-circle-check-filled"};

  if(!selectedWoId){
    const totalPanelSemua=projectGroups.reduce((s,g)=>s+g.totalPanel,0);
    const selesaiSemua=projectGroups.reduce((s,g)=>s+g.selesai,0);
    return(
      <div style={{padding:"14px 14px 28px",background:"#f8fafc",minHeight:"100%"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,padding:"14px 16px",borderRadius:16,
          background:`linear-gradient(135deg,${tugas.color},${tugas.color}cc)`,boxShadow:`0 6px 18px ${tugas.color}33`}}>
          <div style={{width:42,height:42,borderRadius:12,background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>
            {tugas.icon}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{color:"#fff",fontWeight:800,fontSize:15}}>{tugas.label}</div>
            <div style={{color:"rgba(255,255,255,0.85)",fontSize:11.5,marginTop:1}}>{selesaiSemua}/{totalPanelSemua} panel selesai · {projectGroups.length} proyek</div>
          </div>
        </div>

        <div style={{position:"relative" as const,marginBottom:14}}>
          <i className="ti ti-search" style={{position:"absolute" as const,left:13,top:"50%",transform:"translateY(-50%)",fontSize:16,color:"#94a3b8"}}/>
          <input value={search} onChange={(e:any)=>setSearch(e.target.value)} placeholder="Cari proyek atau WO..."
            style={{width:"100%",height:42,padding:"0 14px 0 38px",border:"1.5px solid #e2e8f0",borderRadius:12,fontSize:13.5,outline:"none",background:"#fff",boxSizing:"border-box" as const,color:"#1e293b"}}/>
        </div>

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
                  <div style={{position:"absolute" as const,left:0,top:0,bottom:0,width:4,background:allDone?"#16a34a":tugas.color}}/>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:10}}>
                    <div style={{minWidth:0,flex:1}}>
                      <div style={{fontWeight:800,fontSize:15,color:"#0f172a",whiteSpace:"nowrap" as const,overflow:"hidden",textOverflow:"ellipsis"}}>{g.wo?.proyek}</div>
                      <div style={{fontSize:11,fontWeight:600,color:"#64748b",marginTop:3}}>
                        WO {g.wo?.wo}{g.wo?.target?` · Deadline ${fmtTanggalDeadlineNp(g.wo.target)}`:""}
                      </div>
                    </div>
                    {urg.label&&urg.level!=="normal"&&w?(
                      <span style={{fontSize:9,fontWeight:800,background:w.bg,color:w.color,borderRadius:20,padding:"4px 9px",whiteSpace:"nowrap" as const,flexShrink:0}}>
                        {urg.level==="telat"?"⚠ ":"⏰ "}{urg.label}
                      </span>
                    ):(
                      <i className="ti ti-chevron-right" style={{fontSize:18,color:"#cbd5e1",flexShrink:0,marginTop:2}}/>
                    )}
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                    <span style={{fontSize:11,fontWeight:700,color:allDone?"#16a34a":"#64748b"}}>
                      {allDone?"✓ Semua selesai":`${g.selesai}/${g.totalPanel} panel selesai`}
                    </span>
                    <span style={{fontSize:11,fontWeight:800,color:allDone?"#16a34a":tugas.color}}>{pctWo}%</span>
                  </div>
                  <div style={{height:6,borderRadius:99,background:"#f1f5f9",overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${pctWo}%`,borderRadius:99,background:allDone?"#16a34a":tugas.color,transition:"width .35s ease"}}/>
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
        style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:tugas.color,fontWeight:700,fontSize:13,cursor:"pointer",marginBottom:12,padding:0}}>
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
          style={{display:"flex",alignItems:"center",gap:6,background:lockLoading?"#cbd5e1":tugas.color,color:"#fff",border:"none",borderRadius:10,padding:"9px 14px",
            fontSize:12,fontWeight:700,cursor:lockLoading?"not-allowed":"pointer",whiteSpace:"nowrap" as const,flexShrink:0,
            boxShadow:lockLoading?"none":`0 3px 10px ${tugas.color}40`}}>
          <i className={lockLoading?"ti ti-loader-2":"ti ti-lock"} style={{fontSize:14}}/>
          {lockLoading?"Mengunci...":"Kunci"}
        </button>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {(selectedProject?.panels||[]).map((p:any)=>{
          const pct=p[tugas.progressField]||0;
          const fotoArr=p[tugas.fotoField]||[];
          const status=hitungStatusKomponen(pct);
          const st=STATUS_TUGAS_NP[status];
          const expanded=expandedPanel.has(p.id);
          const staged=stagedFotos[p.id]||[];
          const saving=savingKey===p.id;
          return(
            <div key={p.id} style={{background:"#fff",borderRadius:14,border:"1.5px solid #eef0f3",overflow:"hidden",
              boxShadow:expanded?"0 6px 18px rgba(15,23,42,0.07)":"0 1px 2px rgba(15,23,42,0.03)",transition:"box-shadow .15s"}}>
              <div onClick={()=>togglePanel(p.id)}
                style={{display:"flex",alignItems:"center",gap:11,padding:"13px 15px",cursor:"pointer"}}>
                <div style={{width:38,height:38,borderRadius:11,background:st.bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <i className={`ti ${STATUS_ICON_KP[status]}`} style={{fontSize:18,color:st.color}}/>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:800,fontSize:14.5,color:"#0f172a",whiteSpace:"nowrap" as const,overflow:"hidden",textOverflow:"ellipsis"}}>{p.nama}</div>
                  <div style={{fontSize:10.5,fontWeight:600,color:st.color,marginTop:1}}>{st.label}</div>
                </div>
                <i className={`ti ti-chevron-down`} style={{fontSize:16,color:"#cbd5e1",flexShrink:0,transition:"transform .2s",transform:expanded?"rotate(180deg)":"none"}}/>
              </div>
              {expanded&&(
                <div style={{padding:"2px 15px 16px",borderTop:"1px solid #f1f5f9"}}>
                  <div style={{marginBottom:16,marginTop:14}}>
                    <div style={{display:"flex",alignItems:"center",gap:5,fontSize:10.5,fontWeight:700,color:"#94a3b8",marginBottom:8,letterSpacing:0.3}}>
                      <i className="ti ti-tool" style={{fontSize:12}}/> FABRIKASI
                    </div>
                    <div style={{display:"flex",gap:6}}>
                      {STATUS_3_NP.map(s=>{
                        const active=s.key==="todo"?pct===0:s.key==="done"?pct>=100:(pct>0&&pct<100);
                        return(
                          <button key={s.key} onClick={()=>updateProgress(p.id,s.pct)}
                            style={{flex:1,display:"flex",flexDirection:"column" as const,alignItems:"center",gap:4,padding:"10px 4px",borderRadius:11,
                              border:active?"none":"1.5px solid #eef0f3",cursor:"pointer",
                              background:active?tugas.color:"#fff",boxShadow:active?`0 4px 12px ${tugas.color}40`:"none",transition:"all .15s"}}>
                            <i className={`ti ${STATUS_3_ICON[s.key]}`} style={{fontSize:16,color:active?"#fff":"#94a3b8"}}/>
                            <span style={{fontSize:10,fontWeight:700,color:active?"#fff":"#64748b"}}>{s.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:5,fontSize:10.5,fontWeight:700,color:"#94a3b8",marginBottom:8,letterSpacing:0.3}}>
                      <i className="ti ti-camera" style={{fontSize:12}}/> PEMASANGAN (FOTO)
                    </div>
                    {fotoArr.length===0&&staged.length===0?(
                      <div style={{fontSize:11.5,color:"#cbd5e1",padding:"10px 0 12px",fontStyle:"italic" as const}}>Belum ada foto</div>
                    ):(
                      <div style={{display:"flex",flexWrap:"wrap" as const,gap:8,marginBottom:12}}>
                        {fotoArr.map((f:any,fi:number)=>(
                          <div key={`saved_${fi}`} style={{position:"relative" as const}}>
                            <img onClick={()=>setFotoViewer({fotos:fotoArr,startIndex:fi,label:`${tugas.label}_${p.nama}`})}
                              src={f.url} loading="lazy" style={{width:62,height:62,borderRadius:10,objectFit:"cover" as const,border:"1px solid #eef0f3",boxShadow:"0 1px 3px rgba(15,23,42,0.06)",cursor:"pointer"}}/>
                            <button onClick={(e:any)=>{e.stopPropagation();hapusFotoTersimpan(p.id,f.url);}}
                              style={{position:"absolute" as const,top:-6,right:-6,width:18,height:18,borderRadius:99,background:"#dc2626",color:"#fff",border:"2px solid #fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                              <i className="ti ti-trash" style={{fontSize:10}}/>
                            </button>
                            <div style={{fontSize:8,color:"#94a3b8",marginTop:3,textAlign:"center" as const}}>{f.uploaded_at?new Date(f.uploaded_at).toLocaleDateString("id-ID",{day:"numeric",month:"short"}):""}</div>
                          </div>
                        ))}
                        {staged.map((s,si)=>(
                          <div key={`staged_${si}`} style={{position:"relative" as const}}>
                            <img src={s.previewUrl} style={{width:62,height:62,borderRadius:10,objectFit:"cover" as const,border:`1.5px dashed ${tugas.color}`}}/>
                            <button onClick={()=>batalkanFotoStaged(p.id,si)}
                              style={{position:"absolute" as const,top:-6,right:-6,width:19,height:19,borderRadius:99,background:"#dc2626",color:"#fff",border:"2px solid #fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 1px 3px rgba(0,0,0,0.2)"}}>
                              <i className="ti ti-x" style={{fontSize:10}}/>
                            </button>
                            <div style={{fontSize:8,color:tugas.color,marginTop:3,textAlign:"center" as const,fontWeight:700}}>belum disimpan</div>
                          </div>
                        ))}
                      </div>
                    )}
                    <MediaPickerSheet disabled={saving}
                      triggerStyle={{display:"inline-flex",alignItems:"center",gap:5,fontSize:11.5,fontWeight:700,color:tugas.color,background:`${tugas.color}0f`,border:`1.5px dashed ${tugas.color}55`,borderRadius:10,padding:"9px 13px",
                        cursor:saving?"not-allowed":"pointer",opacity:saving?0.5:1,pointerEvents:saving?"none" as const:"auto" as const}}
                      onFiles={(files)=>pilihFotoStaged(p.id,files)}>
                      <i className="ti ti-camera-plus" style={{fontSize:14}}/> Tambah Foto
                    </MediaPickerSheet>
                    <button onClick={()=>simpanProgressPanel(p)} disabled={saving}
                      style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginTop:12,width:"100%",
                        background:saving?"#cbd5e1":tugas.color,color:"#fff",border:"none",borderRadius:11,padding:"11px 10px",fontSize:12.5,fontWeight:700,
                        cursor:saving?"not-allowed":"pointer",boxShadow:saving?"none":`0 4px 12px ${tugas.color}40`}}>
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
      {fotoViewer&&(
        <FotoZoomViewerPekerja fotos={fotoViewer.fotos} startIndex={fotoViewer.startIndex} label={fotoViewer.label} onClose={()=>setFotoViewer(null)}/>
      )}
    </div>
  );
}
