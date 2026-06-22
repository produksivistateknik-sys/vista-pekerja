file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_render_op_click", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = '''                        {r.isFirst?(
                          <td style={{...td,verticalAlign:"middle"}} rowSpan={r.rowCount}>
                            {(()=>{
                              const workers=(r.task.pekerja||[])
                                .map((id:number)=>pekerjaList.find((p:any)=>p.id===id))
                                .filter(Boolean);
                              return workers.length>0?(
                                <div style={{display:"flex",flexDirection:"column",gap:3}}>
                                  {workers.map((w:any)=>(
                                    <div key={w.id} style={{display:"flex",alignItems:"center",gap:5,
                                      background:DIVISI_CONFIG[w.divisi]?.bg||"#f1f5f9",
                                      borderRadius:20,padding:"2px 8px",whiteSpace:"nowrap"}}>
                                      <span style={{fontSize:10}}>{DIVISI_CONFIG[w.divisi]?.icon}</span>
                                      <span style={{fontSize:10,fontWeight:700,color:DIVISI_CONFIG[w.divisi]?.color||"#64748b"}}>{w.nama}</span>
                                    </div>
                                  ))}
                                </div>
                              ):(
                                <span style={{fontSize:10,color:"#cbd5e1",fontStyle:"italic"}}>\u2014</span>
                              );
                            })()}
                          </td>
                        ):null}'''

NEW = '''                        {r.isFirst?(
                          <td style={{...td,verticalAlign:"middle",cursor:"pointer"}} rowSpan={r.rowCount}
                            onClick={()=>{setOperatorModal(r.task);setTempPekerjaIds(r.task.pekerja||[]);}}>
                            {(()=>{
                              const workers=(r.task.pekerja||[])
                                .map((id:number)=>pekerjaList.find((p:any)=>p.id===id))
                                .filter(Boolean);
                              return workers.length>0?(
                                <div style={{display:"flex",flexDirection:"column",gap:3}}>
                                  {workers.map((w:any)=>(
                                    <div key={w.id} style={{display:"flex",alignItems:"center",gap:5,
                                      background:DIVISI_CONFIG[w.divisi]?.bg||"#f1f5f9",
                                      borderRadius:20,padding:"2px 8px",whiteSpace:"nowrap"}}>
                                      <span style={{fontSize:10}}>{DIVISI_CONFIG[w.divisi]?.icon}</span>
                                      <span style={{fontSize:10,fontWeight:700,color:DIVISI_CONFIG[w.divisi]?.color||"#64748b"}}>{w.nama}</span>
                                    </div>
                                  ))}
                                </div>
                              ):(
                                <span style={{fontSize:10,color:"#94a3b8",fontWeight:600}}>+ Pilih Operator</span>
                              );
                            })()}
                          </td>
                        ):null}'''

count = content.count(OLD)
print(f"  PATTERN occurrences: {count}")

if count == 1:
    content = content.replace(OLD, NEW, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Kolom OPERATOR sekarang clickable, buka modal pilih operator")
    print("[INFO] Lanjut buat modal multi-select operator")
else:
    print(f"[FAIL] PATTERN occurrences = {count}, bukan 1. TIDAK menyimpan apapun")
