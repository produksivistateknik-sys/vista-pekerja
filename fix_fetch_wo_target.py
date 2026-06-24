file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_fetch_wo_target", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = '''    // ambil panels
    const panelIds=[...new Set(tasks.map((t:any)=>t.panel_id||t.panelId).filter(Boolean))];
    if(panelIds.length>0){
      const {data:panels}=await supabase.from("panels").select("*").in("id",panelIds as any);
      const map:Record<number,any>={};
      (panels??[]).forEach((p:any)=>{map[p.id]=p;});
      setPanelsMap(map);
    } else {
      setPanelsMap({});
    }
    setLoadingData(false);
  };'''

NEW = '''    // ambil panels
    const panelIds=[...new Set(tasks.map((t:any)=>t.panel_id||t.panelId).filter(Boolean))];
    if(panelIds.length>0){
      const {data:panels}=await supabase.from("panels").select("*").in("id",panelIds as any);
      const map:Record<number,any>={};
      (panels??[]).forEach((p:any)=>{map[p.id]=p;});
      setPanelsMap(map);
    } else {
      setPanelsMap({});
    }

    // ambil target tanggal WO untuk hitung urgensi/deadline
    const woIds=[...new Set(tasks.map((t:any)=>t.wo_id||t.woId).filter(Boolean))];
    if(woIds.length>0){
      const{data:wos}=await supabase.from("work_orders").select("id,target").in("id",woIds as any);
      const targetMap:Record<number,string>={};
      (wos??[]).forEach((w:any)=>{targetMap[w.id]=w.target;});
      setWoTargetMap(targetMap);
    } else {
      setWoTargetMap({});
    }
    setLoadingData(false);
  };'''

count = content.count(OLD)
print(f"  PATTERN occurrences: {count}")

if count == 1:
    content = content.replace(OLD, NEW, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Fetch target WO berhasil ditambah")
    print("[INFO] Lanjut tambah state woTargetMap dan helper urgensi")
else:
    print(f"[FAIL] PATTERN occurrences = {count}, bukan 1. TIDAK menyimpan apapun")
