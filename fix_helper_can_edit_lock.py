file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_helper_canedit", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = '''  const startTimer=async(pekerjaId:number,panelId:number,kode:string,proses:string,tanggal:string)=>{'''

NEW = '''  const isWiringProses=(pr:string)=>pr==="WIRING CONTROL"||pr==="WIRING POWER";

  const canEditProgressKomponen=(task:any,kode:string,panelId:number,proses:string):boolean=>{
    if(!isWiringProses(proses))return true;
    const ids=(task?.pekerja_per_komponen||{})[kode]||[];
    if(ids.length===0)return false;
    return ids.some((pid:number)=>timerPernahMulai[`${panelId}_${kode}_${proses}_${pid}`]);
  };

  const canLockKomponen=(task:any,kode:string,panelId:number,proses:string):boolean=>{
    if(!isWiringProses(proses))return true;
    const ids=(task?.pekerja_per_komponen||{})[kode]||[];
    if(ids.length===0)return false;
    return ids.some((pid:number)=>timerSelesaiHariIni[`${panelId}_${kode}_${proses}_${pid}`]);
  };

  const startTimer=async(pekerjaId:number,panelId:number,kode:string,proses:string,tanggal:string)=>{'''

count = content.count(OLD)
print(f"  PATTERN occurrences: {count}")

if count == 1:
    content = content.replace(OLD, NEW, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Helper canEditProgressKomponen dan canLockKomponen berhasil ditambah")
    print("[INFO] Lanjut update render tombol PCT_STEPS supaya disable sesuai kondisi")
else:
    print(f"[FAIL] PATTERN occurrences = {count}, bukan 1. TIDAK menyimpan apapun")
