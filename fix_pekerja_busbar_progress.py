from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-pekerja\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Hapus kode busbar yang salah dan ganti dengan versi sederhana
old = """    // Update busbar_progress jika ada busbar tasks
    const busbarTasks=panelsToSave.filter((t:any)=>t.proses==="BUSBAR"&&String(t.panelId||t.panel_id)===String(panelId));
    let busbarProgressUpdate:any=null;
    if(busbarTasks.length>0){
      const existingBusbarProgress=panel?.busbar_progress||{};
      const newBusbarProgress={...existingBusbarProgress};
      busbarTasks.forEach((t:any)=>{
        (t.komponen||[]).forEach((komp:string)=>{
          const cl=newChecklist[komp]||{};
          newBusbarProgress[komp]=cl.progress?.["BUSBAR"]||0;
        });
      });
      busbarProgressUpdate=newBusbarProgress;
    }
    await supabase.from("panels").update({
      checklist:newChecklist,
      ...(busbarProgressUpdate?{busbar_progress:busbarProgressUpdate}:{})
    }).eq("id",Number(panelId));"""

new = """    await supabase.from("panels").update({checklist:newChecklist}).eq("id",Number(panelId));"""

if old in content:
    content = content.replace(old, new)
    print("✅ Reverted to simple save - busbar progress handled separately")
else:
    print("❌ Not found!")

APP_PATH.write_text(content, encoding="utf-8")
print("✅ Selesai!")
