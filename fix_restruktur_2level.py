file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_restruktur_2level", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

# Cari batas fungsi NameplateView secara presisi
start_marker = "function NameplateView({user}:any){"
end_marker = "function OperatorView({user}:any){"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print("[FAIL] Marker tidak ditemukan, TIDAK menyimpan apapun")
else:
    old_full_function = content[start_idx:end_idx]
    print(f"  Panjang fungsi lama: {len(old_full_function)} karakter")
    
    new_function = '''function NameplateView({user}:any){
  const[panelsList,setPanelsList]=useState<any[]>([]);
  const[loading,setLoading]=useState(true);
  const[search,setSearch]=useState("");
  const[selectedWoId,setSelectedWoId]=useState<number|null>(null);

  const fetchData=async()=>{
    setLoading(true);
    const{data:panels}=await supabase.from("panels").select("*");
    const woIds=[...new Set((panels??[]).map((p:any)=>p.wo_id).filter(Boolean))];
    const{data:wos}=woIds.length>0?await supabase.from("work_orders").select("id,wo,proyek,target").in("id",woIds):{data:[]};
    const woMap:Record<number,any>={};
    (wos??[]).forEach((w:any)=>{woMap[w.id]=w;});
    const merged=(panels??[]).map((p:any)=>({...p,_wo:woMap[p.wo_id]||{}}));
    setPanelsList(merged);
    setLoading(false);
  };

  useEffect(()=>{fetchData();},[]);

  const updateProgress=async(panelId:number,field:"nameplate_progress"|"yellowmark_progress",val:number)=>{
    const updateByField=field==="nameplate_progress"?"nameplate_updated_by":"yellowmark_updated_by";
    const updateAtField=field==="nameplate_progress"?"nameplate_updated_at":"yellowmark_updated_at";
    await supabase.from("panels").update({
      [field]:val,[updateByField]:user.nama,[updateAtField]:new Date().toISOString()
    }).eq("id",panelId);
    setPanelsList(prev=>prev.map((p:any)=>p.id===panelId?{...p,[field]:val,[updateByField]:user.nama}:p));
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
      const selesai=g.panels.filter((p:any)=>(p.nameplate_progress||0)>=100&&(p.yellowmark_progress||0)>=100).length;
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
        <input value={search} onChange={(e:any)=>setSearch(e.target.value)} placeholder="\\u{1F50D} Cari proyek atau WO..."
          style={{width:"100%",height:36,padding:"0 12px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:13,marginBottom:12,outline:"none"}}/>
        {loading?(
          <div style={{textAlign:"center",padding:32,color:"#94a3b8"}}>Memuat data...</div>
        ):filteredProjects.length===0?(
          <div style={{textAlign:"center",padding:32,color:"#94a3b8"}}>Tidak ada proyek</div>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {filteredProjects.map((g:any)=>{
              const allDone=g.selesai===g.totalPanel;
              const urg=getUrgensiPanel(g.wo?.target);
              const w=warnaUrgMap[urg.level];
              return(
                <div key={g.woId} onClick={()=>setSelectedWoId(g.woId)}
                  style={{background:"#fff",border:`1px solid ${allDone?"#bbf7d0":"#e2e8f0"}`,borderRadius:10,padding:"14px 16px",cursor:"pointer",opacity:allDone?0.7:1,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:14,color:"#1e293b"}}>{g.wo?.proyek}</div>
                    <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>WO {g.wo?.wo} \\u00b7 {g.selesai}/{g.totalPanel} panel selesai</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    {urg.label&&urg.level!=="normal"&&w&&(
                      <span style={{fontSize:9,fontWeight:700,background:w.bg,color:w.color,borderRadius:6,padding:"3px 8px",whiteSpace:"nowrap" as const}}>{urg.level==="telat"?"\\u26a0\\ufe0f ":"\\u23f0 "}{urg.label}</span>
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
        style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:"#0891b2",fontWeight:700,fontSize:13,cursor:"pointer",marginBottom:12,padding:0}}>
        <i className="ti ti-arrow-left" style={{fontSize:16}}/> Kembali ke Daftar Proyek
      </button>
      <div style={{fontWeight:800,fontSize:15,color:"#1e293b",marginBottom:4}}>{selectedProject?.wo?.proyek}</div>
      <div style={{fontSize:11,color:"#94a3b8",marginBottom:14}}>WO {selectedProject?.wo?.wo}</div>

      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {(selectedProject?.panels||[]).map((p:any)=>{
          const npPct=p.nameplate_progress||0;
          const ymPct=p.yellowmark_progress||0;
          const done=npPct>=100&&ymPct>=100;
          return(
            <div key={p.id} style={{background:"#fff",border:`1px solid ${done?"#bbf7d0":"#e2e8f0"}`,borderRadius:10,padding:"12px 14px",opacity:done?0.7:1}}>
              <div style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>{p.nama}</div>
              <div style={{fontSize:11,color:"#94a3b8",marginBottom:10}}>WP / detail panel</div>

              <div style={{marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:11,fontWeight:600,color:"#0891b2"}}>\\u{1F3F7}\\ufe0f Nameplate</span>
                  <span style={{fontSize:11,fontWeight:700,color:npPct>=100?"#16a34a":"#64748b"}}>{npPct}%</span>
                </div>
                <div style={{display:"flex",gap:4}}>
                  {PROGRESS_STEPS_NP.map(s=>(
                    <button key={s} onClick={()=>updateProgress(p.id,"nameplate_progress",npPct>=s?s-25:s)}
                      style={{flex:1,height:28,borderRadius:6,border:"none",cursor:"pointer",fontSize:10,fontWeight:700,
                        background:npPct>=s?"#0891b2":"#f1f5f9",color:npPct>=s?"#fff":"#94a3b8"}}>{s}%</button>
                  ))}
                </div>
              </div>

              <div>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:11,fontWeight:600,color:"#ca8a04"}}>\\u{1F7E1} Yellowmark</span>
                  <span style={{fontSize:11,fontWeight:700,color:ymPct>=100?"#16a34a":"#64748b"}}>{ymPct}%</span>
                </div>
                <div style={{display:"flex",gap:4}}>
                  {PROGRESS_STEPS_NP.map(s=>(
                    <button key={s} onClick={()=>updateProgress(p.id,"yellowmark_progress",ymPct>=s?s-25:s)}
                      style={{flex:1,height:28,borderRadius:6,border:"none",cursor:"pointer",fontSize:10,fontWeight:700,
                        background:ymPct>=s?"#ca8a04":"#f1f5f9",color:ymPct>=s?"#fff":"#94a3b8"}}>{s}%</button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

'''
    
    content = content[:start_idx] + new_function + content[end_idx:]
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] NameplateView berhasil direstrukturisasi jadi 2 level (proyek -> panel)")
    print("[INFO] Jalankan: npm run build")
