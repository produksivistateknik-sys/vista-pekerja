from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-pekerja\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

old = """      // simpan ke Supabase
      await supabase.from("panels").update({checklist:newChecklist}).eq("id",Number(panelId));
      setPanelsMap(prev=>({...prev,[panelId]:{...panel,checklist:newChecklist}}));"""

new = """      // simpan ke Supabase - termasuk busbar_progress
      const busbarTasks=relatedTasks.filter((t:any)=>t.proses==="BUSBAR");
      let busbarProgressUpdate:any=null;
      if(busbarTasks.length>0){
        const newBusbarProgress={...(panel.busbar_progress||{})};
        busbarTasks.forEach((t:any)=>{
          (t.komponen||[]).forEach((komp:string)=>{
            // Progress busbar disimpan di checklist dengan key nama komponen
            const cl=newChecklist[komp]||panel.checklist?.[komp];
            const pct=cl?.progress?.["BUSBAR"]||getProgressOnDate(cl,"BUSBAR",viewDate)||0;
            newBusbarProgress[komp]=pct;
          });
        });
        busbarProgressUpdate=newBusbarProgress;
      }
      await supabase.from("panels").update({
        checklist:newChecklist,
        ...(busbarProgressUpdate?{busbar_progress:busbarProgressUpdate}:{})
      }).eq("id",Number(panelId));
      setPanelsMap(prev=>({...prev,[panelId]:{...panel,checklist:newChecklist,
        ...(busbarProgressUpdate?{busbar_progress:busbarProgressUpdate}:{})}}));"""

if old in content:
    content = content.replace(old, new)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ Busbar progress save added to lockProgress!")
else:
    print("❌ Not found!")
