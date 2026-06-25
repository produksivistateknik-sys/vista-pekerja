file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_redesign_attachment", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

results = {}

# Fix 1: Redesign total render section foto
OLD1 = '''              <div style={{padding:"12px 14px",borderBottom:"1px solid #f1f5f9"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                  <span style={{fontSize:11.5,fontWeight:600,color:"#475569"}}>Dokumentasi foto</span>
                  <span style={{fontSize:10.5,color:"#94a3b8"}}>{fotoList.length} foto</span>
                </div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap" as const}}>
                  {fotoList.map((f:any,fi:number)=>(
                    <div key={fi} style={{position:"relative" as const,width:52,height:52}}>
                      <img src={f.url} style={{width:52,height:52,objectFit:"cover" as const,borderRadius:6,border:"1px solid #e2e8f0"}}/>
                      <button onClick={()=>hapusFoto(p.id,f.url)}
                        style={{position:"absolute" as const,top:-6,right:-6,width:18,height:18,borderRadius:99,background:"#64748b",color:"#fff",border:"2px solid #fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                        <i className="ti ti-x" style={{fontSize:10}}/>
                      </button>
                    </div>
                  ))}
                  <label style={{width:52,height:52,border:"1px dashed #cbd5e1",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#94a3b8",background:"#f8fafc"}}>
                    <i className={uploadingId===p.id?"ti ti-loader-2":"ti ti-plus"} style={{fontSize:16}}/>
                    <input type="file" accept="image/*" capture="environment" style={{display:"none"}}
                      onChange={(e:any)=>{if(e.target.files?.[0])uploadFoto(p.id,e.target.files[0]);}}/>
                  </label>
                </div>
              </div>'''

NEW1 = '''              <div style={{padding:"12px 14px",borderBottom:"1px solid #f1f5f9"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                  <span style={{fontSize:11.5,fontWeight:600,color:"#475569"}}>Dokumentasi Foto \u00b7 {fotoList.length}</span>
                  <label style={{display:"flex",alignItems:"center",gap:4,cursor:"pointer",color:"#2563eb",fontSize:11,fontWeight:600}}>
                    <i className={uploadingId===p.id?"ti ti-loader-2":"ti ti-plus"} style={{fontSize:14}}/>
                    Tambah
                    <input type="file" accept="image/*" capture="environment" style={{display:"none"}}
                      onChange={(e:any)=>{if(e.target.files?.[0])uploadFoto(p.id,e.target.files[0]);}}/>
                  </label>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  {fotoList.map((f:any,fi:number)=>{
                    const tgl=f.uploaded_at?new Date(f.uploaded_at):null;
                    const tglLabel=tgl?tgl.toLocaleDateString("id-ID",{day:"numeric",month:"short"})+" "+tgl.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"}):"";
                    const initials=(f.uploaded_by||"?").trim().split(" ").map((w:string)=>w[0]).slice(0,2).join("").toUpperCase();
                    return(
                      <div key={fi}>
                        <div onClick={()=>setLightbox(f)} style={{position:"relative" as const,aspectRatio:"1",borderRadius:8,overflow:"hidden",cursor:"pointer",background:"#f1f5f9"}}>
                          <img src={f.url} style={{width:"100%",height:"100%",objectFit:"cover" as const}}/>
                          <button onClick={(e:any)=>{e.stopPropagation();hapusFoto(p.id,f.url);}}
                            style={{position:"absolute" as const,top:5,right:5,width:20,height:20,borderRadius:99,background:"rgba(15,23,42,0.6)",color:"#fff",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                            <i className="ti ti-x" style={{fontSize:11}}/>
                          </button>
                          <div style={{position:"absolute" as const,bottom:5,right:5,width:22,height:22,borderRadius:99,background:"#7c3aed",color:"#fff",fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",border:"2px solid #fff"}}>
                            {initials}
                          </div>
                        </div>
                        <div style={{fontSize:10.5,fontWeight:600,color:"#334155",marginTop:5,whiteSpace:"nowrap" as const,overflow:"hidden",textOverflow:"ellipsis"}}>{f.name||"Foto QC"}</div>
                        <div style={{fontSize:9.5,color:"#94a3b8"}}>{tglLabel}</div>
                      </div>
                    );
                  })}
                </div>
              </div>'''
results['REDESIGN_GRID'] = content.count(OLD1)

for k, v in results.items():
    print(f"  {k}: {v} occurrence(s)")

if all(v==1 for v in results.values()):
    content = content.replace(OLD1, NEW1, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Grid attachment ala ClickUp berhasil ditambah - nama file, tanggal, avatar inisial")
    print("[INFO] Lanjut tambah modal lightbox untuk lihat foto ukuran penuh")
else:
    print("[FAIL] Ada occurrence tidak sesuai (harus semua 1), TIDAK menyimpan apapun")
