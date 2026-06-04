from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-pekerja\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Tambah realtime listener untuk panels setelah loadData function
old = """  const todayTasks=useMemo(()=>renhar,[renhar]);"""

new = """  // ── Realtime listener untuk panels (qty update dari Vista Teknik) ──
  useEffect(()=>{
    const panelIds=Object.keys(panelsMap).map(Number).filter(Boolean);
    if(!panelIds.length) return;

    const channel=supabase.channel('realtime-panels-pekerja')
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'panels'},
        (payload:any)=>{
          const updated=payload.new;
          if(!panelIds.includes(updated.id)) return;
          setPanelsMap(prev=>{
            const oldPanel=prev[updated.id];
            if(!oldPanel) return {...prev,[updated.id]:updated};
            // Recalculate progress jika qty berubah
            const oldChecklist=oldPanel.checklist||{};
            const newChecklist={...updated.checklist};
            Object.keys(newChecklist).forEach(kode=>{
              const oldQty=oldChecklist[kode]?.qty||1;
              const newQty=newChecklist[kode]?.qty||1;
              if(newQty!==oldQty && oldQty>0 && newQty>0){
                const ratio=oldQty/newQty;
                const newProgress:any={};
                Object.keys(newChecklist[kode]?.progress||{}).forEach(pr=>{
                  const old=newChecklist[kode].progress[pr]||0;
                  newProgress[pr]=Math.min(100,Math.round(old*ratio));
                });
                newChecklist[kode]={...newChecklist[kode],progress:newProgress};
              }
            });
            return{...prev,[updated.id]:{...updated,checklist:newChecklist}};
          });
        }
      )
      .subscribe();
    return()=>{supabase.removeChannel(channel);};
  },[panelsMap]);

  const todayTasks=useMemo(()=>renhar,[renhar]);"""

if old in content:
    content = content.replace(old, new)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ Realtime panels listener added to Vista Pekerja!")
else:
    print("❌ Not found!")
