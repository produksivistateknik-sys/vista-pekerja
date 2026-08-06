import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Lbl } from "./ui/Primitives";

// ─────────────────────────────────────────────────────────────────────────────
// TRACKING KOMPONEN VIEW - dipisah dari App.tsx (Sprint 7)
// ─────────────────────────────────────────────────────────────────────────────
export function TrackingKomponenView({user}:any){
  const namaOperator=user?.nama||user?.name||"Operator";
  const subBagian:string=user?.sub_bagian||"Warehouse";
  const[woList,setWoList]=useState<any[]>([]);
  const[selectedWoId,setSelectedWoId]=useState<number|null>(null);
  const[catatan,setCatatan]=useState("");
  const[files,setFiles]=useState<File[]>([]);
  const[uploading,setUploading]=useState(false);
  const[riwayat,setRiwayat]=useState<any[]>([]);
  const[fotoMap,setFotoMap]=useState<Record<number,any[]>>({});
  const[loadingRiwayat,setLoadingRiwayat]=useState(true);

  const[panelList,setPanelList]=useState<any[]>([]);
  const[selectedPanelId,setSelectedPanelId]=useState<number|null>(null);

  const fetchWoList=async()=>{
    const{data}=await supabase.from("work_orders").select("id,wo,proyek").eq("is_archived",false).order("created_at",{ascending:false});
    setWoList(data??[]);
  };

  const fetchPanelList=async(woId:number)=>{
    const{data}=await supabase.from("panels").select("id,no_pnl,nama,tipe,komponen_status").eq("wo_id",woId).is("deleted_at",null).order("no_pnl",{ascending:true});
    setPanelList(data??[]);
  };

  const updateKomponenStatus=async(panelId:number,status:string)=>{
    const panel=panelList.find((p:any)=>p.id===panelId);
    const prevAll=panel?.komponen_status||{};
    const prevMine=prevAll[subBagian]||{};
    const now=new Date().toISOString();
    const newMine:any={...prevMine,status,updated_by:namaOperator,updated_at:now};
    if(status==="to_do")newMine.todo_at=now;
    if(status==="complete")newMine.complete_at=now;
    const newAll={...prevAll,[subBagian]:newMine};
    await supabase.from("panels").update({komponen_status:newAll}).eq("id",panelId);
    setPanelList(prev=>prev.map((p:any)=>p.id===panelId?{...p,komponen_status:newAll}:p));
  };

  const fetchRiwayat=async(panelId:number)=>{
    setLoadingRiwayat(true);
    const{data:tr}=await supabase.from("fcs_tracking_komponen").select("*").eq("panel_id",panelId).order("created_at",{ascending:false});
    setRiwayat(tr??[]);
    if(tr&&tr.length>0){
      const ids=tr.map((t:any)=>t.id);
      const{data:fotos}=await supabase.from("fcs_tracking_komponen_foto").select("*").in("tracking_id",ids);
      const map:Record<number,any[]>={};
      (fotos??[]).forEach((f:any)=>{
        if(!map[f.tracking_id])map[f.tracking_id]=[];
        map[f.tracking_id].push(f);
      });
      setFotoMap(map);
    } else {
      setFotoMap({});
    }
    setLoadingRiwayat(false);
  };

  useEffect(()=>{fetchWoList();},[]);

  useEffect(()=>{
    setSelectedPanelId(null);
    setRiwayat([]);
    if(selectedWoId){fetchPanelList(selectedWoId);}
  },[selectedWoId]);

  useEffect(()=>{
    if(!selectedPanelId){setRiwayat([]);return;}
    fetchRiwayat(selectedPanelId);
    const ch=supabase.channel("realtime-tracking-komponen")
      .on("postgres_changes",{event:"*",schema:"public",table:"fcs_tracking_komponen"},()=>{if(selectedPanelId)fetchRiwayat(selectedPanelId);})
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[selectedPanelId]);

  const[filePreviewUrls,setFilePreviewUrls]=useState<string[]>([]);

  const handleFileSelect=(e:any)=>{
    const picked=Array.from(e.target.files||[]) as File[];
    setFiles(prev=>[...prev,...picked]);
    setFilePreviewUrls(prev=>[...prev,...picked.map(f=>URL.createObjectURL(f))]);
  };

  const removeSelectedFile=(idx:number)=>{
    setFiles(prev=>prev.filter((_,i)=>i!==idx));
    setFilePreviewUrls(prev=>{
      URL.revokeObjectURL(prev[idx]);
      return prev.filter((_,i)=>i!==idx);
    });
  };

  const submitTracking=async()=>{
    if(!selectedWoId){alert("Pilih Work Order dulu");return;}
    if(!selectedPanelId){alert("Pilih Panel dulu");return;}
    if(files.length===0&&!catatan.trim()){alert("Lampirkan foto atau tulis catatan minimal salah satu");return;}
    setUploading(true);
    const{data:tr,error:trErr}=await supabase.from("fcs_tracking_komponen").insert({
      wo_id:selectedWoId,
      panel_id:selectedPanelId,
      sub_bagian:subBagian,
      operator_name:namaOperator,
      catatan:catatan.trim()||null,
    }).select().single();
    if(trErr||!tr){
      alert("Gagal menyimpan: "+(trErr?.message||"unknown error"));
      setUploading(false);
      return;
    }
    for(const file of files){
      const ext=file.name.split(".").pop();
      const safeName=`${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`;
      const path=`${tr.id}/${safeName}`;
      const{error:upErr}=await supabase.storage.from("tracking-komponen").upload(path,file);
      if(upErr){
        alert("Gagal upload foto "+file.name+": "+upErr.message);
        continue;
      }
      const{data:urlData}=supabase.storage.from("tracking-komponen").getPublicUrl(path);
      await supabase.from("fcs_tracking_komponen_foto").insert({
        tracking_id:tr.id,
        file_url:urlData.publicUrl,
      });
    }
    setCatatan("");
    filePreviewUrls.forEach(u=>URL.revokeObjectURL(u));
    setFiles([]);
    setFilePreviewUrls([]);
    setUploading(false);
    fetchRiwayat(selectedPanelId);
  };

  const fmtDateTime=(d:string)=>d?new Date(d).toLocaleString("id-ID",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):"-";

  const subBagianIcon:Record<string,string>={Warehouse:"📦",Assembling:"🔧",QS:"📋",QC:"🔍"};

  return(
    <div style={{padding:16}} className="fi">
      <div style={{fontWeight:800,fontSize:17,color:"#1e293b",marginBottom:4}}>📦 Tracking Komponen</div>
      <div style={{fontSize:12,color:"#64748b",marginBottom:16}}>Halo {namaOperator}, dokumentasi serah terima komponen antar bagian</div>

      <div style={{marginBottom:16,display:"flex",alignItems:"center",gap:12,background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:14,padding:"14px 16px",boxShadow:"0 2px 8px rgba(0,0,0,0.04)"}}>
        <div style={{width:46,height:46,borderRadius:12,background:"linear-gradient(135deg,#2dd4bf,#0d9488)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:22,boxShadow:"0 3px 10px #0d948844"}}>
          {subBagianIcon[subBagian]}
        </div>
        <div>
          <div style={{fontSize:11.5,fontWeight:600,color:"#94a3b8"}}>Sub-bagian Anda</div>
          <div style={{fontSize:16.5,fontWeight:800,color:"#0f172a"}}>{subBagian}</div>
        </div>
      </div>

      <div style={{marginBottom:14}}>
        <Lbl>Work Order</Lbl>
        <select value={selectedWoId??""} onChange={(e:any)=>setSelectedWoId(e.target.value?Number(e.target.value):null)}
          style={{width:"100%",padding:"12px 14px",borderRadius:12,border:"1.5px solid #cbd5e1",fontSize:15,fontWeight:600,color:"#0f172a",background:"#fff"}}>
          <option value="">Pilih Work Order...</option>
          {woList.map((w:any)=>(
            <option key={w.id} value={w.id}>{w.wo} — {w.proyek}</option>
          ))}
        </select>
      </div>

      {selectedWoId&&(
        <div style={{marginBottom:14}}>
          <Lbl>Panel</Lbl>
          <select value={selectedPanelId??""} onChange={(e:any)=>setSelectedPanelId(e.target.value?Number(e.target.value):null)}
            style={{width:"100%",padding:"12px 14px",borderRadius:12,border:"1.5px solid #cbd5e1",fontSize:15,fontWeight:600,color:"#0f172a",background:"#fff"}}>
            <option value="">Pilih Panel...</option>
            {panelList.map((p:any)=>(
              <option key={p.id} value={p.id}>#{p.no_pnl} {p.nama} ({p.tipe})</option>
            ))}
          </select>
          {panelList.length===0&&(
            <div style={{fontSize:12,color:"#94a3b8",marginTop:6}}>Belum ada panel untuk WO ini</div>
          )}
        </div>
      )}

      {selectedWoId&&selectedPanelId&&(()=>{
        const selectedPanelObj=panelList.find((p:any)=>p.id===selectedPanelId);
        const myStatus=selectedPanelObj?.komponen_status?.[subBagian]?.status||"to_do";
        const myData=selectedPanelObj?.komponen_status?.[subBagian]||{};
        return(
          <div style={{marginBottom:14,background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:14,padding:14,boxShadow:"0 2px 8px rgba(0,0,0,0.04)"}}>
            <div style={{fontSize:11.5,fontWeight:600,color:"#94a3b8",marginBottom:8}}>Status Komponen ({subBagian})</div>
            <div style={{display:"flex",gap:6}}>
              {[{k:"to_do",label:"To Do",icon:"⚪",color:"#64748b"},
                {k:"in_progress",label:"Progress",icon:"🟠",color:"#ea580c"},
                {k:"complete",label:"Complete",icon:"✅",color:"#16a34a"}].map((s:any)=>{
                const active=myStatus===s.k;
                return(
                  <button key={s.k} onClick={()=>updateKomponenStatus(selectedPanelId,s.k)}
                    style={{flex:1,display:"flex",flexDirection:"column" as const,alignItems:"center",gap:3,
                      padding:"9px 4px",borderRadius:10,border:active?"none":"1px solid #e2e8f0",
                      background:active?s.color:"#fff",cursor:"pointer",transition:"all .15s",
                      boxShadow:active?`0 3px 8px ${s.color}44`:"none"}}>
                    <span style={{fontSize:15}}>{s.icon}</span>
                    <span style={{fontSize:9,fontWeight:700,color:active?"#fff":"#94a3b8"}}>{s.label}</span>
                  </button>
                );
              })}
            </div>
            {(myData.todo_at||myData.complete_at)&&(
              <div style={{display:"flex",gap:10,fontSize:9.5,color:"#94a3b8",marginTop:8}}>
                {myData.todo_at&&<span>To Do: {fmtDateTime(myData.todo_at)}</span>}
                {myData.complete_at&&<span>Selesai: {fmtDateTime(myData.complete_at)}</span>}
              </div>
            )}
          </div>
        );
      })()}

      {selectedWoId&&selectedPanelId&&(
        <>
          <div style={{marginBottom:14}}>
            <Lbl>Catatan</Lbl>
            <textarea value={catatan} onChange={(e:any)=>setCatatan(e.target.value)}
              placeholder="Tulis catatan, misal: komponen lengkap, diserahkan ke assembling"
              style={{width:"100%",minHeight:60,padding:"12px 14px",borderRadius:12,border:"1.5px solid #cbd5e1",fontSize:15,fontWeight:500,color:"#0f172a",fontFamily:"inherit",resize:"vertical" as const}}/>
          </div>

          <div style={{marginBottom:16}}>
            <Lbl>Foto</Lbl>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
              {filePreviewUrls.map((url,idx)=>(
                <div key={idx} style={{position:"relative" as const,aspectRatio:"1",borderRadius:10,overflow:"hidden",background:"#f1f5f9"}}>
                  <img src={url} style={{width:"100%",height:"100%",objectFit:"cover" as const}}/>
                  <button onClick={()=>removeSelectedFile(idx)}
                    style={{position:"absolute" as const,top:4,right:4,width:22,height:22,borderRadius:"50%",background:"rgba(0,0,0,0.6)",border:"none",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
                </div>
              ))}
              <label style={{display:"flex",alignItems:"center",justifyContent:"center",aspectRatio:"1",borderRadius:10,border:"1.5px dashed #cbd5e1",background:"#f8fafc",cursor:"pointer"}}>
                <span style={{fontSize:24,color:"#94a3b8"}}>📷</span>
                <input type="file" accept="image/*" multiple capture="environment" onChange={handleFileSelect} style={{display:"none"}}/>
              </label>
            </div>
          </div>

          <button onClick={submitTracking} disabled={uploading}
            style={{width:"100%",padding:"15px",borderRadius:12,border:"none",
              background:uploading?"#94a3b8":"linear-gradient(135deg,#2dd4bf,#0d9488)",
              color:"#fff",fontSize:16,fontWeight:800,cursor:uploading?"default":"pointer",fontFamily:"inherit",marginBottom:24,
              boxShadow:uploading?"none":"0 4px 14px #0d948844"}}>
            {uploading?"Mengunggah...":"Kirim"}
          </button>

          <div style={{fontSize:12,fontWeight:800,color:"#0f172a",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:8}}>Riwayat</div>
          {loadingRiwayat?(
            <div style={{textAlign:"center" as const,padding:30,color:"#94a3b8",fontSize:13}}>Memuat...</div>
          ):riwayat.length===0?(
            <div style={{textAlign:"center" as const,padding:30,color:"#94a3b8",fontSize:13}}>Belum ada riwayat untuk panel ini</div>
          ):(
            <div style={{display:"flex",flexDirection:"column" as const,gap:10}}>
              {riwayat.map((r:any)=>(
                <div key={r.id} style={{background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:12,padding:"14px 16px",textAlign:"left" as const,boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                    <div style={{width:34,height:34,borderRadius:10,background:"linear-gradient(135deg,#2dd4bf,#0d9488)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:16}}>
                      {subBagianIcon[r.sub_bagian]}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:800,fontSize:14,color:"#0f172a"}}>{r.sub_bagian}</div>
                      <div style={{fontSize:11.5,color:"#94a3b8"}}>oleh {r.operator_name}</div>
                    </div>
                    <span style={{fontSize:10.5,fontWeight:600,color:"#94a3b8",whiteSpace:"nowrap" as const}}>{fmtDateTime(r.created_at)}</span>
                  </div>
                  {r.catatan&&<div style={{fontSize:14,fontWeight:500,color:"#1e293b",marginBottom:10,lineHeight:1.6,textAlign:"left" as const,whiteSpace:"pre-wrap" as const,background:"#f8fafc",borderRadius:8,padding:"8px 10px"}}>{r.catatan}</div>}
                  {(fotoMap[r.id]||[]).length>0&&(
                    <div style={{display:"flex",flexWrap:"wrap" as const,gap:6}}>
                      {(fotoMap[r.id]||[]).map((foto:any)=>(
                        <a key={foto.id} href={foto.file_url} target="_blank" rel="noopener noreferrer">
                          <img src={foto.file_url} style={{width:64,height:64,objectFit:"cover" as const,borderRadius:8,border:"1px solid #e2e8f0",boxShadow:"0 1px 3px rgba(0,0,0,0.08)"}}/>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
