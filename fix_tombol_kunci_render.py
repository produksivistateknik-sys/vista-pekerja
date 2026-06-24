file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_tombol_kunci", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = '''      <div style={{fontWeight:800,fontSize:15,color:"#1e293b",marginBottom:4}}>{selectedProject?.wo?.proyek}</div>
      <div style={{fontSize:11,color:"#94a3b8",marginBottom:14}}>WO {selectedProject?.wo?.wo}</div>

      <div style={{display:"flex",flexDirection:"column",gap:10}}>'''

NEW = '''      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
        <div>
          <div style={{fontWeight:800,fontSize:15,color:"#1e293b",marginBottom:4}}>{selectedProject?.wo?.proyek}</div>
          <div style={{fontSize:11,color:"#94a3b8"}}>WO {selectedProject?.wo?.wo}</div>
        </div>
        <button onClick={()=>kunciProgress(selectedProject?.panels||[])} disabled={lockLoading}
          style={{background:lockLoading?"#94a3b8":"#0891b2",color:"#fff",border:"none",borderRadius:8,padding:"8px 14px",fontSize:12,fontWeight:700,cursor:lockLoading?"not-allowed":"pointer",whiteSpace:"nowrap" as const}}>
          {lockLoading?"\u23f3 Mengunci...":"\U0001f512 Kunci Progress"}
        </button>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:10}}>'''

count = content.count(OLD)
print(f"  PATTERN occurrences: {count}")

if count == 1:
    content = content.replace(OLD, NEW, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Tombol Kunci Progress berhasil ditambah")
    print("[INFO] Jalankan: npm run build")
else:
    print(f"[FAIL] PATTERN occurrences = {count}, bukan 1. TIDAK menyimpan apapun")
