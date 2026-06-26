import shutil
import sys

PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

OLD_1 = '''  const handleFileSelect=(e:any)=>{
    const picked=Array.from(e.target.files||[]) as File[];
    setFiles(prev=>[...prev,...picked]);
  };

  const removeSelectedFile=(idx:number)=>{
    setFiles(prev=>prev.filter((_,i)=>i!==idx));
  };'''

NEW_1 = '''  const[filePreviewUrls,setFilePreviewUrls]=useState<string[]>([]);

  const handleFileSelect=(e:any)=>{
    const picked=Array.from(e.target.files||[]) as File[];
    setFiles(prev=>[...prev,...picked]);
    setFilePreviewUrls(prev=>[...prev,...picked.map(f=>URL.createObjectURL(f))]);
  };

  const removeSelectedFile=(idx:number)=>{
    setFiles(prev=>prev.filter((_,i)=>i!==idx));
    setFilePreviewUrls(prev=>{
      URL.revokeObjectURL(prev[idx]);
      return prev.filter((_,i)=>i!==idx);
    });
  };'''

OLD_2 = '''    setCatatan("");
    setFiles([]);
    setUploading(false);
    fetchRiwayat(selectedWoId);
  };'''

NEW_2 = '''    setCatatan("");
    filePreviewUrls.forEach(u=>URL.revokeObjectURL(u));
    setFiles([]);
    setFilePreviewUrls([]);
    setUploading(false);
    fetchRiwayat(selectedWoId);
  };'''

OLD_3 = '''      <div style={{marginBottom:12,display:"flex",alignItems:"center",gap:8,background:"#f0fdfa",border:"1px solid #99f6e4",borderRadius:8,padding:"8px 12px"}}>
        <span style={{fontSize:18}}>{subBagianIcon[subBagian]}</span>
        <div>
          <div style={{fontSize:10,color:"#0d9488",fontWeight:700,textTransform:"uppercase" as const,letterSpacing:.4}}>Sub-bagian Anda</div>
          <div style={{fontSize:14,fontWeight:700,color:"#0f766e"}}>{subBagian}</div>
        </div>
      </div>

      <div style={{marginBottom:12}}>
        <Lbl>Work Order</Lbl>
        <select value={selectedWoId??""} onChange={(e:any)=>setSelectedWoId(e.target.value?Number(e.target.value):null)}
          style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid #e2e8f0",fontSize:14,background:"#fff"}}>
          <option value="">Pilih Work Order...</option>
          {woList.map((w:any)=>(
            <option key={w.id} value={w.id}>{w.wo} — {w.proyek}</option>
          ))}
        </select>
      </div>

      {selectedWoId&&(
        <>
          <div style={{marginBottom:12}}>
            <Lbl>Catatan</Lbl>
            <textarea value={catatan} onChange={(e:any)=>setCatatan(e.target.value)}
              placeholder="Tulis catatan, misal: komponen lengkap, diserahkan ke assembling"
              style={{width:"100%",minHeight:60,padding:"10px 12px",borderRadius:10,border:"1.5px solid #e2e8f0",fontSize:14,fontFamily:"inherit",resize:"vertical" as const}}/>
          </div>

          {files.length>0&&(
            <div style={{display:"flex",flexWrap:"wrap" as const,gap:8,marginBottom:10}}>
              {files.map((f,idx)=>(
                <div key={idx} style={{display:"flex",alignItems:"center",gap:6,background:"#f1f5f9",borderRadius:6,padding:"5px 10px",fontSize:12}}>
                  <span>📷</span>
                  <span style={{maxWidth:120,overflow:"hidden",textOverflow:"ellipsis" as const,whiteSpace:"nowrap" as const}}>{f.name}</span>
                  <button onClick={()=>removeSelectedFile(idx)} style={{border:"none",background:"none",cursor:"pointer",color:"#dc2626",fontWeight:700,fontSize:13}}>×</button>
                </div>
              ))}
            </div>
          )}

          <div style={{display:"flex",gap:10,marginBottom:20}}>
            <label style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"12px",borderRadius:10,border:"1.5px solid #e2e8f0",background:"#f8fafc",cursor:"pointer",fontSize:13,fontWeight:700,color:"#475569"}}>
              📷 Ambil/Pilih Foto
              <input type="file" accept="image/*" multiple capture="environment" onChange={handleFileSelect} style={{display:"none"}}/>
            </label>
            <button onClick={submitTracking} disabled={uploading}
              style={{flex:1,padding:"12px",borderRadius:10,border:"none",background:uploading?"#94a3b8":"#0d9488",color:"#fff",fontSize:14,fontWeight:800,cursor:uploading?"default":"pointer",fontFamily:"inherit"}}>
              {uploading?"Mengunggah...":"Kirim"}
            </button>
          </div>'''

NEW_3 = '''      <div style={{marginBottom:16,display:"flex",alignItems:"center",gap:12,background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:"12px 14px"}}>
        <div style={{width:40,height:40,borderRadius:10,background:"#f0fdfa",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:20}}>
          {subBagianIcon[subBagian]}
        </div>
        <div>
          <div style={{fontSize:11,color:"#94a3b8"}}>Sub-bagian Anda</div>
          <div style={{fontSize:15,fontWeight:700,color:"#1e293b"}}>{subBagian}</div>
        </div>
      </div>

      <div style={{marginBottom:14}}>
        <Lbl>Work Order</Lbl>
        <select value={selectedWoId??""} onChange={(e:any)=>setSelectedWoId(e.target.value?Number(e.target.value):null)}
          style={{width:"100%",padding:"12px 14px",borderRadius:12,border:"1.5px solid #e2e8f0",fontSize:14,background:"#fff"}}>
          <option value="">Pilih Work Order...</option>
          {woList.map((w:any)=>(
            <option key={w.id} value={w.id}>{w.wo} — {w.proyek}</option>
          ))}
        </select>
      </div>

      {selectedWoId&&(
        <>
          <div style={{marginBottom:14}}>
            <Lbl>Catatan</Lbl>
            <textarea value={catatan} onChange={(e:any)=>setCatatan(e.target.value)}
              placeholder="Tulis catatan, misal: komponen lengkap, diserahkan ke assembling"
              style={{width:"100%",minHeight:60,padding:"12px 14px",borderRadius:12,border:"1.5px solid #e2e8f0",fontSize:14,fontFamily:"inherit",resize:"vertical" as const}}/>
          </div>

          <div style={{marginBottom:16}}>
            <Lbl>Foto</Lbl>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
              {filePreviewUrls.map((url,idx)=>(
                <div key={idx} style={{position:"relative" as const,aspectRatio:"1",borderRadius:10,overflow:"hidden",background:"#f1f5f9"}}>
                  <img src={url} style={{width:"100%",height:"100%",objectFit:"cover" as const}}/>
                  <button onClick={()=>removeSelectedFile(idx)}
                    style={{position:"absolute" as const,top:4,right:4,width:22,height:22,borderRadius:"50%",background:"rgba(0,0,0,0.6)",border:"none",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
                </div>
              ))}
              <label style={{display:"flex",alignItems:"center",justifyContent:"center",aspectRatio:"1",borderRadius:10,border:"1.5px dashed #cbd5e1",background:"#f8fafc",cursor:"pointer"}}>
                <span style={{fontSize:24,color:"#94a3b8"}}>📷</span>
                <input type="file" accept="image/*" multiple capture="environment" onChange={handleFileSelect} style={{display:"none"}}/>
              </label>
            </div>
          </div>

          <button onClick={submitTracking} disabled={uploading}
            style={{width:"100%",padding:"14px",borderRadius:12,border:"none",background:uploading?"#94a3b8":"#0d9488",color:"#fff",fontSize:15,fontWeight:700,cursor:uploading?"default":"pointer",fontFamily:"inherit",marginBottom:24}}>
            {uploading?"Mengunggah...":"Kirim"}
          </button>'''

EDITS = [
    ("EDIT 1 (state preview URL + handler)", OLD_1, NEW_1),
    ("EDIT 2 (cleanup preview URL setelah submit)", OLD_2, NEW_2),
    ("EDIT 3 (redesign JSX: badge sub-bagian, grid foto thumbnail, tombol kirim full-width)", OLD_3, NEW_3),
]

def main():
    shutil.copy(PATH, PATH + ".bak_tkredesign")
    print(f"[OK] Backup dibuat: {PATH}.bak_tkredesign")

    with open(PATH, "r", encoding="utf-8") as f:
        content = f.read()

    failed = []
    for name, old, new in EDITS:
        count = content.count(old)
        if count != 1:
            failed.append((name, count))

    if failed:
        print("[FAIL] Ada pattern yang tidak ditemukan tepat 1 kali. Tidak ada perubahan disimpan.")
        for name, count in failed:
            print(f"  - {name}: ditemukan {count} kali")
        sys.exit(1)

    for name, old, new in EDITS:
        content = content.replace(old, new)
        print(f"[OK] {name} berhasil diterapkan")

    with open(PATH, "w", encoding="utf-8") as f:
        f.write(content)

    print("")
    print("[OK] SEMUA EDIT BERHASIL DITERAPKAN")
    print("Ringkasan:")
    print("  - Foto yang dipilih sekarang tampil sebagai THUMBNAIL grid 3 kolom, bisa direview sebelum kirim")
    print("  - Tombol hapus (x) di pojok tiap foto")
    print("  - Tombol Kirim sekarang full-width di bawah grid foto")
    print("  - Badge sub-bagian & card lain dirapikan (radius lebih besar, spacing lebih lega)")
    print("Selanjutnya jalankan: npm run build")

if __name__ == "__main__":
    main()
