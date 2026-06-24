file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_redesign_qc", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = '''              <div style={{display:"flex",flexDirection:"column" as const,gap:8,marginBottom:12}}>
                {QC_ITEMS.map(item=>{
                  const itemData=cl[item.key]||{status:"belum",catatan:""};
                  return(
                    <div key={item.key} style={{background:"#f8fafc",borderRadius:8,padding:"8px 10px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                        <span style={{fontSize:11,fontWeight:600,color:"#1e293b"}}>{item.label}</span>
                      </div>
                      <div style={{display:"flex",gap:4}}>
                        <button onClick={()=>updateChecklistItem(p.id,item.key,"lolos",itemData.catatan||"")}
                          style={{flex:1,height:26,borderRadius:6,border:"none",cursor:"pointer",fontSize:10,fontWeight:700,
                            background:itemData.status==="lolos"?"#16a34a":"#fff",color:itemData.status==="lolos"?"#fff":"#94a3b8"}}>\u2713 Lolos</button>
                        <button onClick={()=>updateChecklistItem(p.id,item.key,"gagal",itemData.catatan||"")}
                          style={{flex:1,height:26,borderRadius:6,border:"none",cursor:"pointer",fontSize:10,fontWeight:700,
                            background:itemData.status==="gagal"?"#dc2626":"#fff",color:itemData.status==="gagal"?"#fff":"#94a3b8"}}>\u2717 Gagal</button>
                      </div>
                      {itemData.status==="gagal"&&(
                        <input placeholder="Catatan kegagalan..." defaultValue={itemData.catatan}
                          onBlur={(e:any)=>updateChecklistItem(p.id,item.key,"gagal",e.target.value)}
                          style={{width:"100%",marginTop:6,padding:"5px 8px",fontSize:10,borderRadius:5,border:"1px solid #fecaca",outline:"none"}}/>
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{borderTop:"1px solid #f1f5f9",paddingTop:10}}>
                <div style={{fontSize:11,fontWeight:600,color:"#1e293b",marginBottom:6}}>\U0001f4f7 Dokumentasi Foto</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap" as const,marginBottom:6}}>
                  {fotoList.map((f:any,fi:number)=>(
                    <div key={fi} style={{position:"relative" as const,width:64,height:64}}>
                      <img src={f.url} style={{width:64,height:64,objectFit:"cover" as const,borderRadius:6,border:"1px solid #e2e8f0"}}/>
                      <button onClick={()=>hapusFoto(p.id,f.url)}
                        style={{position:"absolute" as const,top:-6,right:-6,width:18,height:18,borderRadius:99,background:"#dc2626",color:"#fff",border:"none",fontSize:10,cursor:"pointer",lineHeight:"18px"}}>\u00d7</button>
                    </div>
                  ))}
                  <label style={{width:64,height:64,border:"1.5px dashed #cbd5e1",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#94a3b8",fontSize:20}}>
                    {uploadingId===p.id?"\u23f3":"+"}
                    <input type="file" accept="image/*" capture="environment" style={{display:"none"}}
                      onChange={(e:any)=>{if(e.target.files?.[0])uploadFoto(p.id,e.target.files[0]);}}/>
                  </label>
                </div>
              </div>'''

NEW = '''              <div style={{display:"flex",flexDirection:"column" as const,gap:10,marginBottom:16}}>
                {QC_ITEMS.map((item,itemIdx)=>{
                  const itemData=cl[item.key]||{status:"belum",catatan:""};
                  const itemIcons=["ti-clipboard-check","ti-list-check","ti-bolt","ti-bulb"];
                  return(
                    <div key={item.key} style={{background:itemData.status==="lolos"?"#f0fdf4":itemData.status==="gagal"?"#fef2f2":"#f8fafc",
                      borderRadius:12,padding:"12px 14px",border:`1px solid ${itemData.status==="lolos"?"#bbf7d0":itemData.status==="gagal"?"#fecaca":"#e2e8f0"}`}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                        <div style={{width:30,height:30,borderRadius:8,background:"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                          <i className={"ti "+itemIcons[itemIdx]} style={{fontSize:16,color:"#16a34a"}}/>
                        </div>
                        <span style={{fontSize:13,fontWeight:700,color:"#1e293b"}}>{item.label}</span>
                      </div>
                      <div style={{display:"flex",gap:8}}>
                        <button onClick={()=>updateChecklistItem(p.id,item.key,"lolos",itemData.catatan||"")}
                          style={{flex:1,height:44,borderRadius:10,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,
                            display:"flex",alignItems:"center",justifyContent:"center",gap:6,
                            background:itemData.status==="lolos"?"#16a34a":"#fff",color:itemData.status==="lolos"?"#fff":"#94a3b8"}}>
                          <i className="ti ti-check" style={{fontSize:16}}/> Lolos
                        </button>
                        <button onClick={()=>updateChecklistItem(p.id,item.key,"gagal",itemData.catatan||"")}
                          style={{flex:1,height:44,borderRadius:10,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,
                            display:"flex",alignItems:"center",justifyContent:"center",gap:6,
                            background:itemData.status==="gagal"?"#dc2626":"#fff",color:itemData.status==="gagal"?"#fff":"#94a3b8"}}>
                          <i className="ti ti-x" style={{fontSize:16}}/> Gagal
                        </button>
                      </div>
                      {itemData.status==="gagal"&&(
                        <input placeholder="Catatan kegagalan..." defaultValue={itemData.catatan}
                          onBlur={(e:any)=>updateChecklistItem(p.id,item.key,"gagal",e.target.value)}
                          style={{width:"100%",marginTop:8,padding:"10px 12px",fontSize:12,borderRadius:8,border:"1px solid #fecaca",outline:"none"}}/>
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{borderTop:"1px solid #f1f5f9",paddingTop:14}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
                  <i className="ti ti-camera" style={{fontSize:16,color:"#1e293b"}}/>
                  <span style={{fontSize:13,fontWeight:700,color:"#1e293b"}}>Dokumentasi Foto</span>
                  {fotoList.length>0&&<span style={{fontSize:11,color:"#94a3b8"}}>({fotoList.length})</span>}
                </div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap" as const}}>
                  {fotoList.map((f:any,fi:number)=>(
                    <div key={fi} style={{position:"relative" as const,width:76,height:76}}>
                      <img src={f.url} style={{width:76,height:76,objectFit:"cover" as const,borderRadius:10,border:"1px solid #e2e8f0"}}/>
                      <button onClick={()=>hapusFoto(p.id,f.url)}
                        style={{position:"absolute" as const,top:-8,right:-8,width:24,height:24,borderRadius:99,background:"#dc2626",color:"#fff",border:"2px solid #fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                        <i className="ti ti-x" style={{fontSize:13}}/>
                      </button>
                    </div>
                  ))}
                  <label style={{width:76,height:76,border:"2px dashed #16a34a",borderRadius:10,display:"flex",flexDirection:"column" as const,alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#16a34a",gap:2,background:"#f0fdf4"}}>
                    <i className={uploadingId===p.id?"ti ti-loader-2":"ti ti-camera-plus"} style={{fontSize:24}}/>
                    <span style={{fontSize:9,fontWeight:700}}>{uploadingId===p.id?"Upload...":"Ambil Foto"}</span>
                    <input type="file" accept="image/*" capture="environment" style={{display:"none"}}
                      onChange={(e:any)=>{if(e.target.files?.[0])uploadFoto(p.id,e.target.files[0]);}}/>
                  </label>
                </div>
              </div>'''

count = content.count(OLD)
print(f"  PATTERN occurrences: {count}")

if count == 1:
    content = content.replace(OLD, NEW, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] QCChecklistTab berhasil di-redesign jadi lebih app-like (tombol besar, ikon jelas)")
    print("[INFO] Jalankan: npm run build")
else:
    print(f"[FAIL] PATTERN occurrences = {count}, bukan 1. TIDAK menyimpan apapun")
