file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_bersihkan_komp", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = '''      await supabase.from("panels").update({
        checklist:newChecklist,
        ...(busbarProgressUpdate?{busbar_progress:busbarProgressUpdate}:{})
      }).eq("id",Number(panelId));
      setPanelsMap(prev=>({...prev,[panelId]:{...panel,checklist:newChecklist,
        ...(busbarProgressUpdate?{busbar_progress:busbarProgressUpdate}:{})}}));
    }'''

NEW = '''      await supabase.from("panels").update({
        checklist:newChecklist,
        ...(busbarProgressUpdate?{busbar_progress:busbarProgressUpdate}:{})
      }).eq("id",Number(panelId));
      setPanelsMap(prev=>({...prev,[panelId]:{...panel,checklist:newChecklist,
        ...(busbarProgressUpdate?{busbar_progress:busbarProgressUpdate}:{})}}));

      // Bersihkan komponen yang sudah 100% selesai dari SEMUA tanggal di raw_schedule (khusus WIRING CONTROL/POWER)
      for(const proses of myProses){
        if(proses!=="WIRING CONTROL"&&proses!=="WIRING POWER")continue;
        const komponenSelesai=Object.keys(newChecklist).filter(kode=>
          (newChecklist[kode]?.progress?.[proses]||0)>=100
        );
        if(komponenSelesai.length===0)continue;
        const{data:rawRows}=await supabase.from("raw_schedule").select("id,schedule").eq("panel_id",Number(panelId)).eq("proses",proses);
        for(const row of rawRows||[]){
          let berubah=false;
          const newSchedule:any={};
          for(const[tglKey,entries] of Object.entries(row.schedule||{}) as [string,any[]][]){
            const newEntries=entries.map((entry:any)=>{
              const filteredKomp=(entry.komponen||[]).filter((k:string)=>!komponenSelesai.includes(k));
              if(filteredKomp.length!==(entry.komponen||[]).length)berubah=true;
              return{...entry,komponen:filteredKomp};
            }).filter((entry:any)=>(entry.komponen||[]).length>0);
            if(newEntries.length>0)newSchedule[tglKey]=newEntries;
          }
          if(berubah){
            await supabase.from("raw_schedule").update({schedule:newSchedule}).eq("id",row.id);
          }
        }
      }
    }'''

count = content.count(OLD)
print(f"  PATTERN occurrences: {count}")

if count == 1:
    content = content.replace(OLD, NEW, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Komponen yang 100% selesai sekarang DIHAPUS dari raw_schedule di SEMUA tanggal")
    print("[INFO] Jalankan: npm run build")
else:
    print(f"[FAIL] PATTERN occurrences = {count}, bukan 1. TIDAK menyimpan apapun")
