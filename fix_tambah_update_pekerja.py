file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_update_pekerja", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = "  const updatePctManual=async(panelId:number,kode:string,proses:string,pct:number)=>{"

NEW = '''  const updatePekerjaTask=async(taskId:number,pekerjaIds:number[])=>{
    const{error}=await supabase.from("renhar").update({pekerja:pekerjaIds}).eq("id",taskId);
    if(!error){
      setRenhar(prev=>prev.map((t:any)=>t.id===taskId?{...t,pekerja:pekerjaIds}:t));
    }
  };

  const updatePctManual=async(panelId:number,kode:string,proses:string,pct:number)=>{'''

count = content.count(OLD)
print(f"  PATTERN occurrences: {count}")

if count == 1:
    content = content.replace(OLD, NEW, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Function updatePekerjaTask berhasil ditambah")
    print("[INFO] Lanjut update render kolom OPERATOR jadi editable (dropdown)")
else:
    print(f"[FAIL] PATTERN occurrences = {count}, bukan 1. TIDAK menyimpan apapun")
