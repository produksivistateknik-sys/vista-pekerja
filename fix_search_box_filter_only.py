file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_search_box_only", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = '''      <button onClick={()=>setSelectedWoId(null)}
        style={{display:"flex",alignItems:"center",gap:5,background:"none",border:"none",color:"#2563eb",fontWeight:600,fontSize:12.5,cursor:"pointer",marginBottom:14,padding:0}}>
        <i className="ti ti-chevron-left" style={{fontSize:15}}/> Daftar proyek
      </button>
      <div style={{fontWeight:700,fontSize:15,color:"#0f172a",marginBottom:2}}>{selectedProject?.wo?.proyek}</div>
      <div style={{fontSize:11.5,color:"#94a3b8",marginBottom:16}}>WO {selectedProject?.wo?.wo}</div>

      <div style={{display:"flex",flexDirection:"column" as const,gap:12}}>
        {(selectedProject?.panels||[]).map((p:any)=>{'''

NEW = '''      <button onClick={()=>{setSelectedWoId(null);setSearchPanel("");}}
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

count = content.count(OLD)
print(f"  PATTERN occurrences: {count}")

if count == 1:
    content = content.replace(OLD, NEW, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Search box dan filter panel berhasil ditambah")
    print("[INFO] Jalankan: npm run build")
else:
    print(f"[FAIL] PATTERN occurrences = {count}, bukan 1. TIDAK menyimpan apapun")
