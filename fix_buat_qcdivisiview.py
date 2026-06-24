file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_buat_qcdivisiview", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = "function NameplateView({user}:any){"

NEW = '''const QC_ITEMS=[
  {key:"fisik",label:"Pemeriksaan Fisik",desc:"Kelayakan kualitas fisik panel"},
  {key:"spesifikasi",label:"Verifikasi Spesifikasi Komponen",desc:"Sesuai partlist"},
  {key:"baut",label:"Pengecekan Kekencangan Baut",desc:""},
  {key:"test",label:"QC Test",desc:"Tes elektrikal standar"},
];

function QCDivisiView({user}:any){
  const[qcTab,setQcTab]=useState<"checklist"|"packing">("checklist");
  return(
    <div style={{display:"flex",flexDirection:"column" as const,height:"100%"}}>
      <div style={{display:"flex",gap:8,padding:"10px 14px",borderBottom:"1px solid #e2e8f0",background:"#fff"}}>
        <button onClick={()=>setQcTab("checklist")}
          style={{flex:1,padding:"8px",borderRadius:8,border:"none",cursor:"pointer",fontWeight:700,fontSize:12,
            background:qcTab==="checklist"?"#16a34a":"#f1f5f9",color:qcTab==="checklist"?"#fff":"#64748b"}}>
          \u2705 Checklist QC
        </button>
        <button onClick={()=>setQcTab("packing")}
          style={{flex:1,padding:"8px",borderRadius:8,border:"none",cursor:"pointer",fontWeight:700,fontSize:12,
            background:qcTab==="packing"?"#16a34a":"#f1f5f9",color:qcTab==="packing"?"#fff":"#64748b"}}>
          \U0001f4e6 Packing
        </button>
      </div>
      <div style={{flex:1,overflowY:"auto" as const}}>
        {qcTab==="checklist"?<QCChecklistTab user={user}/>:<OperatorView user={user}/>}
      </div>
    </div>
  );
}

function QCChecklistTab({user}:any){
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
    const newChecklist={...(panel?.qc_checklist||{}),[itemKey]:{status,catatan,checked_by:user.nama,checked_at:new Date().toISOString()}};
    await supabase.from("panels").update({qc_checklist:newChecklist}).eq("id",panelId);
    setPanelsList(prev=>prev.map((p:any)=>p.id===panelId?{...p,qc_checklist:newChecklist}:p));
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
      const selesai=g.panels.filter((p:any)=>getQcStatus(p)==="lolos").length;
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
        <input value={search} onChange={(e:any)=>setSearch(e.target.value)} placeholder="\U0001f50d Cari proyek atau WO..."
          style={{width:"100%",height:36,padding:"0 12px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:13,marginBottom:12,outline:"none"}}/>
        {loading?(
          <div style={{textAlign:"center",padding:32,color:"#94a3b8"}}>Memuat data...</div>
        ):filteredProjects.length===0?(
          <div style={{textAlign:"center",padding:32,color:"#94a3b8"}}>Tidak ada proyek</div>
        ):(
          <div style={{display:"flex",flexDirection:"column" as const,gap:10}}>
            {filteredProjects.map((g:any)=>{
              const allDone=g.selesai===g.totalPanel;
              const urg=getUrgensiPanel(g.wo?.target);
              const w=warnaUrgMap[urg.level];
              return(
                <div key={g.woId} onClick={()=>setSelectedWoId(g.woId)}
                  style={{background:"#fff",border:`1px solid ${allDone?"#bbf7d0":"#e2e8f0"}`,borderRadius:10,padding:"14px 16px",cursor:"pointer",opacity:allDone?0.7:1,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:14,color:"#1e293b"}}>{g.wo?.proyek}</div>
                    <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>WO {g.wo?.wo} \u00b7 {g.selesai}/{g.totalPanel} panel lolos QC</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    {urg.label&&urg.level!=="normal"&&w&&(
                      <span style={{fontSize:9,fontWeight:700,background:w.bg,color:w.color,borderRadius:6,padding:"3px 8px",whiteSpace:"nowrap" as const}}>{urg.level==="telat"?"\u26a0\ufe0f ":"\u23f0 "}{urg.label}</span>
                    )}
                    <i className="ti ti-chevron-right" style={{fontSize:18,color:"#94a3b8"}}/>
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
    <div style={{padding:"12px 14px"}}>
      <button onClick={()=>setSelectedWoId(null)}
        style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:"#16a34a",fontWeight:700,fontSize:13,cursor:"pointer",marginBottom:12,padding:0}}>
        <i className="ti ti-arrow-left" style={{fontSize:16}}/> Kembali ke Daftar Proyek
      </button>
      <div style={{fontWeight:800,fontSize:15,color:"#1e293b",marginBottom:4}}>{selectedProject?.wo?.proyek}</div>
      <div style={{fontSize:11,color:"#94a3b8",marginBottom:14}}>WO {selectedProject?.wo?.wo}</div>

      <div style={{display:"flex",flexDirection:"column" as const,gap:12}}>
        {(selectedProject?.panels||[]).map((p:any)=>{
          const cl=p.qc_checklist||{};
          const qcStatus=getQcStatus(p);
          const fotoList=p.qc_foto||[];
          return(
            <div key={p.id} style={{background:"#fff",border:`1px solid ${qcStatus==="lolos"?"#bbf7d0":qcStatus==="gagal"?"#fecaca":"#e2e8f0"}`,borderRadius:10,padding:"14px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>{p.nama}</div>
                <span style={{fontSize:9,fontWeight:700,padding:"3px 8px",borderRadius:6,
                  background:qcStatus==="lolos"?"#f0fdf4":qcStatus==="gagal"?"#fef2f2":"#f1f5f9",
                  color:qcStatus==="lolos"?"#16a34a":qcStatus==="gagal"?"#dc2626":"#94a3b8"}}>
                  {qcStatus==="lolos"?"\u2705 LOLOS":qcStatus==="gagal"?"\u274c GAGAL":"\u23f3 BELUM"}
                </span>
              </div>

              <div style={{display:"flex",flexDirection:"column" as const,gap:8,marginBottom:12}}>
                {QC_ITEMS.map(item=>{
                  const itemData=cl[item.key]||{status:"belum",catatan:""};
                  return(
                    <div key={item.key} style={{background:"#f8fafc",borderRadius:8,padding:"8px 10px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                        <span style={{fontSize:11,fontWeight:600,color:"#1e293b"}}>{item.label}</span>
                      </div>
                      <div style={{display:"flex",gap:4}}>
                        <button onClick={()=>updateChecklistItem(p.id,item.key,"lolos",itemData.catatan||"")}
                          style={{flex:1,height:26,borderRadius:6,border:"none",cursor:"pointer",fontSize:10,fontWeight:700,
                            background:itemData.status==="lolos"?"#16a34a":"#fff",color:itemData.status==="lolos"?"#fff":"#94a3b8",border1:"1px solid #e2e8f0"}}>\u2713 Lolos</button>
                        <button onClick={()=>updateChecklistItem(p.id,item.key,"gagal",itemData.catatan||"")}
                          style={{flex:1,height:26,borderRadius:6,border:"none",cursor:"pointer",fontSize:10,fontWeight:700,
                            background:itemData.status==="gagal"?"#dc2626":"#fff",color:itemData.status==="gagal"?"#fff":"#94a3b8"}}>\u2717 Gagal</button>
                      </div>
                      {itemData.status==="gagal"&&(
                        <input placeholder="Catatan kegagalan..." defaultValue={itemData.catatan}
                          onBlur={(e:any)=>updateChecklistItem(p.id,item.key,"gagal",e.target.value)}
                          style={{width:"100%",marginTop:6,padding:"5px 8px",fontSize:10,borderRadius:5,border:"1px solid #fecaca",outline:"none"}}/>
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{borderTop:"1px solid #f1f5f9",paddingTop:10}}>
                <div style={{fontSize:11,fontWeight:600,color:"#1e293b",marginBottom:6}}>\U0001f4f7 Dokumentasi Foto</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap" as const,marginBottom:6}}>
                  {fotoList.map((f:any,fi:number)=>(
                    <div key={fi} style={{position:"relative" as const,width:64,height:64}}>
                      <img src={f.url} style={{width:64,height:64,objectFit:"cover" as const,borderRadius:6,border:"1px solid #e2e8f0"}}/>
                      <button onClick={()=>hapusFoto(p.id,f.url)}
                        style={{position:"absolute" as const,top:-6,right:-6,width:18,height:18,borderRadius:99,background:"#dc2626",color:"#fff",border:"none",fontSize:10,cursor:"pointer",lineHeight:"18px"}}>\u00d7</button>
                    </div>
                  ))}
                  <label style={{width:64,height:64,border:"1.5px dashed #cbd5e1",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#94a3b8",fontSize:20}}>
                    {uploadingId===p.id?"\u23f3":"+"}
                    <input type="file" accept="image/*" capture="environment" style={{display:"none"}}
                      onChange={(e:any)=>{if(e.target.files?.[0])uploadFoto(p.id,e.target.files[0]);}}/>
                  </label>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NameplateView({user}:any){'''

count = content.count(OLD)
print(f"  PATTERN occurrences: {count}")

if count == 1:
    content = content.replace(OLD, NEW, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] QCDivisiView dan QCChecklistTab berhasil ditambah")
    print("[INFO] Jalankan: npm run build")
else:
    print(f"[FAIL] PATTERN occurrences = {count}, bukan 1. TIDAK menyimpan apapun")
