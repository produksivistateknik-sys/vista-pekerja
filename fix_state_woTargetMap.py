file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_state_wotarget", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = "  const [pekerjaList,setPekerjaList]=useState<any[]>([]);"
NEW = '''  const [pekerjaList,setPekerjaList]=useState<any[]>([]);
  const [woTargetMap,setWoTargetMap]=useState<Record<number,string>>({});

  const getUrgensi=(woId:number)=>{
    const target=woTargetMap[woId];
    if(!target)return{level:"normal",label:"",hari:null};
    const hari=Math.ceil((new Date(target).getTime()-new Date().getTime())/86400000);
    if(hari<0)return{level:"telat",label:`Telat ${Math.abs(hari)}hr`,hari};
    if(hari<=3)return{level:"mendesak",label:`H-${hari}`,hari};
    if(hari<=7)return{level:"perhatian",label:`H-${hari}`,hari};
    return{level:"normal",label:`H-${hari}`,hari};
  };'''

count = content.count(OLD)
print(f"  PATTERN occurrences: {count}")

if count == 1:
    content = content.replace(OLD, NEW, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] State woTargetMap dan helper getUrgensi berhasil ditambah")
    print("[INFO] Lanjut update sorting todayTasks dan render badge urgensi")
else:
    print(f"[FAIL] PATTERN occurrences = {count}, bukan 1. TIDAK menyimpan apapun")
