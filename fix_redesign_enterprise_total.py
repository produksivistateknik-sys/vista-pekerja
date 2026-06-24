file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_redesign_enterprise", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

start_marker = "function QCDivisiView({user}:any){"
end_marker = "function NameplateView({user}:any){"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print(f"[FAIL] Marker tidak ditemukan (start={start_idx}, end={end_idx}), TIDAK menyimpan apapun")
else:
    old_block = content[start_idx:end_idx]
    print(f"  Panjang blok lama (QCDivisiView + QCChecklistTab): {len(old_block)} karakter")

    new_block = '''function QCChecklistTab({user}:any){
  const[panelsList,setPanelsList]=useState<any[]>([]);
  const[loading,setLoading]=useState(true);
  const[search,setSearch]=useState("");
  const[selectedWoId,setSelectedWoId]=useState<number|null>(null);
  const[uploadingId,setUploadingId]=useState<number|null>(null);

  const fetchData=async()=>{
    setLoading(true);
    const{data:panels}=await supabase.from("panels").select("*");
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

  const updateChecklistItem=async(panelId:number,itemKey:string,status:string,catatan:string)=>{
    const panel=panelsList.find((p:any)=>p.id===panelId);
    const itemSebelumnya=panel?.qc_checklist?.[itemKey]?.status;
    const newChecklist={...(panel?.qc_checklist||{}),[itemKey]:{status,catatan,checked_by:user.nama,checked_at:new Date().toISOString()}};
    await supabase.from("panels").update({qc_checklist:newChecklist}).eq("id",panelId);
    setPanelsList(prev=>prev.map((p:any)=>p.id===panelId?{...p,qc_checklist:newChecklist}:p));

    if(status==="gagal"&&itemSebelumnya!=="gagal"){
      const itemLabel=QC_ITEMS.find(it=>it.key===itemKey)?.label||itemKey;
      await supabase.from("fcs_notifikasi").insert({
        tipe:"qc_gagal",pekerja_nama:user.nama,
        panel_id:panelId,panel_nama:panel?.nama||"",
        kode_komponen:itemKey,nama_komponen:itemLabel,
        proses:"QC TEST",catatan:catatan||"",
      });
    }
  };

  const uploadFoto=async(panelId:number,file:File)=>{
    setUploadingId(panelId);
    try{
      const fileName=`${panelId}_${Date.now()}_${file.name}`;
      const{error:upErr}=await supabase.storage.from("qc-photos").upload(fileName,file);
      if(upErr){alert("Gagal upload: "+upErr.message);setUploadingId(null);return;}
      const{data:urlData}=supabase.storage.from("qc-photos").getPublicUrl(fileName);
      const panel=panelsList.find((p:any)=>p.id===panelId);
      const newFoto=[...(panel?.qc_foto||[]),{url:urlData.publicUrl,uploaded_by:user.nama,uploaded_at:new Date().toISOString()}];
      await supabase.from("panels").update({qc_foto:newFoto}).eq("id",panelId);
      setPanelsList(prev=>prev.map((p:any)=>p.id===panelId?{...p,qc_foto:newFoto}:p));
    }catch(err:any){
      alert("Terjadi kesalahan: "+err.message);
    }
    setUploadingId(null);
  };

  const hapusFoto=async(panelId:number,fotoUrl:string)=>{
    const panel=panelsList.find((p:any)=>p.id===panelId);
    const newFoto=(panel?.qc_foto||[]).filter((f:any)=>f.url!==fotoUrl);
    await supabase.from("panels").update({qc_foto:newFoto}).eq("id",panelId);
    setPanelsList(prev=>prev.map((p:any)=>p.id===panelId?{...p,qc_foto:newFoto}:p));
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
    const cl=panel.qc_checklist||{};
    const statuses=QC_ITEMS.map(it=>cl[it.key]?.status||"belum");
    if(statuses.some(s=>s==="gagal"))return"gagal";
    if(statuses.every(s=>s==="lolos"))return"lolos";
    return"belum";
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
            style={{width:"100%",height:38,padding:"0 12px 0 34px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:13,outline:"none",background:"#fff",boxSizing:"border-box" as const}}/>
        </div>
        {loading?(
          <div style={{textAlign:"center",padding:32,color:"#94a3b8",fontSize:13}}>Memuat data\u2026</div>
        ):filteredProjects.length===0?(
          <div style={{textAlign:"center",padding:32,color:"#94a3b8",fontSize:13}}>Tidak ada proyek</div>
        ):(
          <div style={{display:"flex",flexDirection:"column" as const,gap:1,background:"#fff",borderRadius:10,border:"1px solid #e2e8f0",overflow:"hidden"}}>
            {filteredProjects.map((g:any,gi:number)=>{
              const allDone=g.selesai===g.totalPanel;
              const urg=getUrgensiPanel(g.wo?.target);
              const w=warnaUrgMap[urg.level];
              return(
                <div key={g.woId} onClick={()=>setSelectedWoId(g.woId)}
                  style={{padding:"13px 14px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",
                    borderTop:gi>0?"1px solid #f1f5f9":"none",background:"#fff"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0,flex:1}}>
                    <div style={{width:34,height:34,borderRadius:8,background:allDone?"#f0fdf4":"#eff6ff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <i className={allDone?"ti ti-check":"ti ti-package"} style={{fontSize:16,color:allDone?"#16a34a":"#2563eb"}}/>
                    </div>
                    <div style={{minWidth:0}}>
                      <div style={{fontWeight:600,fontSize:13.5,color:"#0f172a",whiteSpace:"nowrap" as const,overflow:"hidden",textOverflow:"ellipsis"}}>{g.wo?.proyek}</div>
                      <div style={{fontSize:11,color:"#94a3b8",marginTop:1}}>WO {g.wo?.wo} \u00b7 {g.selesai}/{g.totalPanel} packing selesai</div>
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
      <button onClick={()=>setSelectedWoId(null)}
        style={{display:"flex",alignItems:"center",gap:5,background:"none",border:"none",color:"#2563eb",fontWeight:600,fontSize:12.5,cursor:"pointer",marginBottom:14,padding:0}}>
        <i className="ti ti-chevron-left" style={{fontSize:15}}/> Daftar proyek
      </button>
      <div style={{fontWeight:700,fontSize:15,color:"#0f172a",marginBottom:2}}>{selectedProject?.wo?.proyek}</div>
      <div style={{fontSize:11.5,color:"#94a3b8",marginBottom:16}}>WO {selectedProject?.wo?.wo}</div>

      <div style={{display:"flex",flexDirection:"column" as const,gap:12}}>
        {(selectedProject?.panels||[]).map((p:any)=>{
          const cl=p.qc_checklist||{};
          const qcStatus=getQcStatus(p);
          const qcLolosSemua=qcStatus==="lolos";
          const fotoList=p.qc_foto||[];
          const statusBadge=qcStatus==="lolos"?{bg:"#f0fdf4",color:"#16a34a",label:"QC Lolos"}:qcStatus==="gagal"?{bg:"#fef2f2",color:"#dc2626",label:"QC Gagal"}:{bg:"#f1f5f9",color:"#64748b",label:"Belum dicek"};
          return(
            <div key={p.id} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:10,overflow:"hidden"}}>
              <div style={{padding:"12px 14px",borderBottom:"1px solid #f1f5f9",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontWeight:600,fontSize:13.5,color:"#0f172a"}}>{p.nama}</span>
                <span style={{fontSize:10,fontWeight:600,padding:"3px 9px",borderRadius:5,background:statusBadge.bg,color:statusBadge.color}}>
                  {statusBadge.label}
                </span>
              </div>

              <div>
                {QC_ITEMS.map((item,itemIdx)=>{
                  const itemData=cl[item.key]||{status:"belum",catatan:""};
                  return(
                    <div key={item.key} style={{padding:"10px 14px",borderBottom:"1px solid #f8fafc"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
                        <span style={{fontSize:12.5,color:"#334155",flex:1}}>{item.label}</span>
                        <div style={{display:"flex",border:"1px solid #e2e8f0",borderRadius:7,overflow:"hidden",flexShrink:0}}>
                          <button onClick={()=>updateChecklistItem(p.id,item.key,"lolos",itemData.catatan||"")}
                            style={{width:60,height:28,border:"none",cursor:"pointer",fontSize:11,fontWeight:600,
                              background:itemData.status==="lolos"?"#16a34a":"#fff",color:itemData.status==="lolos"?"#fff":"#94a3b8"}}>
                            Lolos
                          </button>
                          <button onClick={()=>updateChecklistItem(p.id,item.key,"gagal",itemData.catatan||"")}
                            style={{width:60,height:28,border:"none",borderLeft:"1px solid #e2e8f0",cursor:"pointer",fontSize:11,fontWeight:600,
                              background:itemData.status==="gagal"?"#dc2626":"#fff",color:itemData.status==="gagal"?"#fff":"#94a3b8"}}>
                            Gagal
                          </button>
                        </div>
                      </div>
                      {itemData.status==="gagal"&&(
                        <input placeholder="Catatan kegagalan" defaultValue={itemData.catatan}
                          onBlur={(e:any)=>updateChecklistItem(p.id,item.key,"gagal",e.target.value)}
                          style={{width:"100%",marginTop:8,padding:"7px 10px",fontSize:11.5,borderRadius:6,border:"1px solid #fecaca",outline:"none",background:"#fef2f2",boxSizing:"border-box" as const}}/>
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{padding:"12px 14px",borderBottom:"1px solid #f1f5f9"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                  <span style={{fontSize:11.5,fontWeight:600,color:"#475569"}}>Dokumentasi foto</span>
                  <span style={{fontSize:10.5,color:"#94a3b8"}}>{fotoList.length} foto</span>
                </div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap" as const}}>
                  {fotoList.map((f:any,fi:number)=>(
                    <div key={fi} style={{position:"relative" as const,width:52,height:52}}>
                      <img src={f.url} style={{width:52,height:52,objectFit:"cover" as const,borderRadius:6,border:"1px solid #e2e8f0"}}/>
                      <button onClick={()=>hapusFoto(p.id,f.url)}
                        style={{position:"absolute" as const,top:-6,right:-6,width:18,height:18,borderRadius:99,background:"#64748b",color:"#fff",border:"2px solid #fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                        <i className="ti ti-x" style={{fontSize:10}}/>
                      </button>
                    </div>
                  ))}
                  <label style={{width:52,height:52,border:"1px dashed #cbd5e1",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#94a3b8",background:"#f8fafc"}}>
                    <i className={uploadingId===p.id?"ti ti-loader-2":"ti ti-plus"} style={{fontSize:16}}/>
                    <input type="file" accept="image/*" capture="environment" style={{display:"none"}}
                      onChange={(e:any)=>{if(e.target.files?.[0])uploadFoto(p.id,e.target.files[0]);}}/>
                  </label>
                </div>
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
                  <button onClick={()=>{if(qcLolosSemua)togglePacking(p.id,false);}} disabled={!qcLolosSemua}
                    style={{width:"100%",height:42,borderRadius:8,border:"none",cursor:qcLolosSemua?"pointer":"not-allowed",
                      fontSize:13,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:6,
                      background:qcLolosSemua?"#2563eb":"#f1f5f9",color:qcLolosSemua?"#fff":"#94a3b8"}}>
                    <i className={qcLolosSemua?"ti ti-package":"ti ti-lock"} style={{fontSize:15}}/>
                    {qcLolosSemua?"Tandai sudah packing":"Selesaikan QC dulu"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NameplateView({user}:any){'''

    content = content[:start_idx] + new_block + content[end_idx:]
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] QCChecklistTab berhasil di-redesign total dengan gaya enterprise + tombol Packing sederhana")
    print("[INFO] Jalankan: npm run build")
