file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_warna_teks_input", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

results = {}

# Fix 1: Input catatan kegagalan di alur pending (yang baru ditambah)
OLD1 = '''                            <input placeholder="Catatan kegagalan" autoFocus
                              onChange={(e:any)=>setPendingChecklist(prev=>({...prev,[pendKey]:{...prev[pendKey],catatan:e.target.value}}))}
                              style={{width:"100%",marginBottom:6,padding:"7px 10px",fontSize:11.5,borderRadius:6,border:"1px solid #fecaca",outline:"none",background:"#fef2f2",boxSizing:"border-box" as const}}/>'''
NEW1 = '''                            <input placeholder="Catatan kegagalan" autoFocus
                              onChange={(e:any)=>setPendingChecklist(prev=>({...prev,[pendKey]:{...prev[pendKey],catatan:e.target.value}}))}
                              style={{width:"100%",marginBottom:6,padding:"7px 10px",fontSize:11.5,borderRadius:6,border:"1px solid #fecaca",outline:"none",background:"#fef2f2",color:"#1e293b",boxSizing:"border-box" as const}}/>'''
results['INPUT_CATATAN_PENDING'] = content.count(OLD1)

# Fix 2: Input search di QCChecklistTab (jaga-jaga juga belum punya color)
OLD2 = '''          <input value={search} onChange={(e:any)=>setSearch(e.target.value)} placeholder="Cari proyek atau WO"
            style={{width:"100%",height:38,padding:"0 12px 0 34px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:13,outline:"none",background:"#fff",boxSizing:"border-box" as const}}/>'''
NEW2 = '''          <input value={search} onChange={(e:any)=>setSearch(e.target.value)} placeholder="Cari proyek atau WO"
            style={{width:"100%",height:38,padding:"0 12px 0 34px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:13,outline:"none",background:"#fff",color:"#1e293b",boxSizing:"border-box" as const}}/>'''
results['INPUT_SEARCH_QC'] = content.count(OLD2)

for k, v in results.items():
    print(f"  {k}: {v} occurrence(s)")

applied=0
if results['INPUT_CATATAN_PENDING']==1:
    content = content.replace(OLD1, NEW1, 1)
    applied+=1
if results['INPUT_SEARCH_QC']==1:
    content = content.replace(OLD2, NEW2, 1)
    applied+=1

if applied>0:
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print(f"[OK] {applied} input berhasil diperbaiki dengan color eksplisit")
    print("[INFO] Jalankan: npm run build")
else:
    print("[FAIL] Tidak ada pattern yang cocok, TIDAK menyimpan apapun")
