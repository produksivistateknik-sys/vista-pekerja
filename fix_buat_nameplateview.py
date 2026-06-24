file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_nameplateview", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = "function OperatorView({user}:any){"

NEW = '''const PROGRESS_STEPS_NP=[25,50,75,100];

function NameplateView({user}:any){
  const[panelsList,setPanelsList]=useState<any[]>([]);
  const[loading,setLoading]=useState(true);
  const[search,setSearch]=useState("");

  const fetchData=async()=>{
    setLoading(true);
    const{data:panels}=await supabase.from("panels").select("*");
    const woIds=[...new Set((panels??[]).map((p:any)=>p.wo_id).filter(Boolean))];
    const{data:wos}=woIds.length>0?await supabase.from("work_orders").select("id,wo,proyek").in("id",woIds):{data:[]};
    const woMap:Record<number,any>={};
    (wos??[]).forEach((w:any)=>{woMap[w.id]=w;});
    const merged=(panels??[]).map((p:any)=>({...p,_wo:woMap[p.wo_id]||{}}));
    merged.sort((a:any,b:any)=>{
      const aDone=(a.nameplate_progress||0)>=100&&(a.yellowmark_progress||0)>=100;
      const bDone=(b.nameplate_progress||0)>=100&&(b.yellowmark_progress||0)>=100;
      if(aDone!==bDone)return aDone?1:-1;
      return 0;
    });
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

  const filtered=panelsList.filter((p:any)=>
    !search||p.nama?.toLowerCase().includes(search.toLowerCase())||p._wo?.proyek?.toLowerCase().includes(search.toLowerCase())
  );

  return(
    <div style={{padding:"12px 14px"}}>
      <input value={search} onChange={(e:any)=>setSearch(e.target.value)} placeholder="\U0001f50d Cari panel atau proyek..."
        style={{width:"100%",height:36,padding:"0 12px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:13,marginBottom:12,outline:"none"}}/>

      {loading?(
        <div style={{textAlign:"center",padding:32,color:"#94a3b8"}}>Memuat data...</div>
      ):filtered.length===0?(
        <div style={{textAlign:"center",padding:32,color:"#94a3b8"}}>Tidak ada panel</div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {filtered.map((p:any)=>{
            const npPct=p.nameplate_progress||0;
            const ymPct=p.yellowmark_progress||0;
            const done=npPct>=100&&ymPct>=100;
            return(
              <div key={p.id} style={{background:"#fff",border:`1px solid ${done?"#bbf7d0":"#e2e8f0"}`,borderRadius:10,padding:"12px 14px",opacity:done?0.7:1}}>
                <div style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>{p.nama}</div>
                <div style={{fontSize:11,color:"#94a3b8",marginBottom:10}}>{p._wo?.proyek} \u00b7 WO {p._wo?.wo}</div>

                <div style={{marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontSize:11,fontWeight:600,color:"#0891b2"}}>\U0001f3f7\ufe0f Nameplate</span>
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
                    <span style={{fontSize:11,fontWeight:600,color:"#ca8a04"}}>\U0001f7e1 Yellowmark</span>
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
      )}
    </div>
  );
}

function OperatorView({user}:any){'''

count = content.count(OLD)
print(f"  PATTERN occurrences: {count}")

if count == 1:
    content = content.replace(OLD, NEW, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Komponen NameplateView berhasil ditambah")
    print("[INFO] Jalankan: npm run build")
else:
    print(f"[FAIL] PATTERN occurrences = {count}, bukan 1. TIDAK menyimpan apapun")
