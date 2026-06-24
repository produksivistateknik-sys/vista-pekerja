file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_sort_todaytasks", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = "  const todayTasks=useMemo(()=>renhar,[renhar]);"
NEW = '''  const todayTasks=useMemo(()=>{
    const urutanLevel:Record<string,number>={telat:0,mendesak:1,perhatian:2,normal:3};
    return [...renhar].sort((a:any,b:any)=>{
      const woIdA=a.wo_id||a.woId;const woIdB=b.wo_id||b.woId;
      const uA=getUrgensi(woIdA);const uB=getUrgensi(woIdB);
      const lvA=urutanLevel[uA.level]??3;const lvB=urutanLevel[uB.level]??3;
      if(lvA!==lvB)return lvA-lvB;
      if(uA.hari!==null&&uB.hari!==null)return uA.hari-uB.hari;
      return 0;
    });
  },[renhar,woTargetMap]);'''

count = content.count(OLD)
print(f"  PATTERN occurrences: {count}")

if count == 1:
    content = content.replace(OLD, NEW, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] todayTasks sekarang terurut otomatis - paling mendesak di atas")
    print("[INFO] Lanjut tambah badge urgensi visual di render")
else:
    print(f"[FAIL] PATTERN occurrences = {count}, bukan 1. TIDAK menyimpan apapun")
