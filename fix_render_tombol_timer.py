file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_render_timer", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = '''                        <td style={{...td,verticalAlign:"middle",cursor:"pointer"}}
                          onClick={()=>{setOperatorModal({taskId:r.task.id,kode:r.kode});setTempPekerjaIds((r.task.pekerja_per_komponen||{})[r.kode]||[]);}}>
                          {(()=>{
                            const idsKomp=(r.task.pekerja_per_komponen||{})[r.kode]||[];
                            const workers=idsKomp
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
                        </td>'''

NEW = '''                        <td style={{...td,verticalAlign:"middle"}}>
                          {(()=>{
                            const idsKomp=(r.task.pekerja_per_komponen||{})[r.kode]||[];
                            const workers=idsKomp
                              .map((id:number)=>pekerjaList.find((p:any)=>p.id===id))
                              .filter(Boolean);
                            return(
                              <div style={{display:"flex",flexDirection:"column",gap:3}}>
                                {workers.map((w:any)=>{
                                  const key=`${r.panelId}_${r.kode}_${proses}_${w.id}`;
                                  const timer=timerAktif[key];
                                  const loading=timerLoading===key;
                                  return(
                                    <div key={w.id} style={{display:"flex",alignItems:"center",gap:5,
                                      background:DIVISI_CONFIG[w.divisi]?.bg||"#f1f5f9",
                                      borderRadius:20,padding:"2px 6px 2px 8px",whiteSpace:"nowrap"}}>
                                      <span style={{fontSize:10}}>{DIVISI_CONFIG[w.divisi]?.icon}</span>
                                      <span style={{fontSize:10,fontWeight:700,color:DIVISI_CONFIG[w.divisi]?.color||"#64748b"}}>{w.nama}</span>
                                      <button disabled={loading}
                                        onClick={()=>timer?stopTimer(w.id,r.panelId,r.kode,proses):startTimer(w.id,r.panelId,r.kode,proses,viewDate)}
                                        style={{fontSize:8,fontWeight:700,border:"none",borderRadius:10,padding:"2px 6px",cursor:loading?"not-allowed":"pointer",
                                          background:timer?"#fef2f2":"#f0fdf4",color:timer?"#dc2626":"#16a34a"}}>
                                        {loading?"...":timer?"\u23f9 Selesai":"\u25b6 Mulai"}
                                      </button>
                                    </div>
                                  );
                                })}
                                <button onClick={()=>{setOperatorModal({taskId:r.task.id,kode:r.kode});setTempPekerjaIds(idsKomp);}}
                                  style={{fontSize:9,color:"#94a3b8",fontWeight:600,background:"none",border:"1px dashed #cbd5e1",borderRadius:8,padding:"2px 6px",cursor:"pointer"}}>
                                  {workers.length>0?"+ Edit":"+ Pilih Operator"}
                                </button>
                              </div>
                            );
                          })()}
                        </td>'''

count = content.count(OLD)
print(f"  PATTERN occurrences: {count}")

if count == 1:
    content = content.replace(OLD, NEW, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Tombol Mulai/Selesai per operator berhasil ditambah")
    print("[INFO] Jalankan: npm run build")
else:
    print(f"[FAIL] PATTERN occurrences = {count}, bukan 1. TIDAK menyimpan apapun")
