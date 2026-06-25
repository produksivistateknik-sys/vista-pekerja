file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_search_panel", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

results = {}

# Fix 1: Tambah state searchPanel
OLD1 = "  const[selectedWoId,setSelectedWoId]=useState<number|null>(null);"
NEW1 = '''  const[selectedWoId,setSelectedWoId]=useState<number|null>(null);
  const[searchPanel,setSearchPanel]=useState("");'''
results['STATE_SEARCH'] = content.count(OLD1)

# Fix 2: Reset searchPanel saat kembali ke daftar proyek, tambah search box, filter panels
OLD2 = '''      <button onClick={()=>setSelectedWoId(null)}
        style={{display:"flex",alignItems:"center",gap:5,background:"none",border:"none",color:"#2563eb",fontWeight:600,fontSize:12.5,cursor:"pointer",marginBottom:14,padding:0}}>
        <i className="ti ti-chevron-left" style={{fontSize:15}}/> Daftar proyek
      </button>
      <div style={{fontWeight:700,fontSize:15,color:"#0f172a",marginBottom:2}}>{selectedProject?.wo?.proyek}</div>
      <div style={{fontSize:11.5,color:"#94a3b8",marginBottom:16}}>WO {selectedProject?.wo?.wo}</div>

      <div style={{display:"flex",flexDirection:"column" as const,gap:12}}>
        {(selectedProject?.panels||[]).map((p:any)=>{'''

NEW2 = '''      <button onClick={()=>{setSelectedWoId(null);setSearchPanel("");}}
        style={{display:"flex",alignItems:"center",gap:5,background:"none",border:"none",color:"#2563eb",fontWeight:600,fontSize:12.5,cursor:"pointer",marginBottom:14,padding:0}}>
        <i className="ti ti-chevron-left" style={{fontSize:15}}/> Daftar proyek
      </button>
      <div style={{fontWeight:700,fontSize:15,color:"#0f172a",marginBottom:2}}>{selectedProject?.wo?.proyek}</div>
      <div style={{fontSize:11.5,color:"#94a3b8",marginBottom:12}}>WO {selectedProject?.wo?.wo}</div>

      <div style={{position:"relative" as const,marginBottom:14}}>
        <i className="ti ti-search" style={{position:"absolute" as const,left:12,top:11,fontSize:15,color:"#94a3b8"}}/>
        <input value={searchPanel} onChange={(e:any)=>setSearchPanel(e.target.value)} placeholder="Cari nama panel"
          style={{width:"100%",height:38,padding:"0 12px 0 34px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:13,outline:"none",background:"#fff",color:"#1e293b",boxSizing:"border-box" as const}}/>
      </div>

      <div style={{display:"flex",flexDirection:"column" as const,gap:12}}>
        {(selectedProject?.panels||[]).filter((p:any)=>!searchPanel||p.nama?.toLowerCase().includes(searchPanel.toLowerCase())).map((p:any)=>{'''

results['SEARCH_BOX_FILTER'] = content.count(OLD2)

for k, v in results.items():
    print(f"  {k}: {v} occurrence(s)")

if all(v==1 for v in results.values()):
    content = content.replace(OLD1, NEW1, 1)
    content = content.replace(OLD2, NEW2, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Search panel di level 2 berhasil ditambah")
    print("[INFO] Jalankan: npm run build")
else:
    print("[FAIL] Ada occurrence tidak sesuai (harus semua 1), TIDAK menyimpan apapun")
