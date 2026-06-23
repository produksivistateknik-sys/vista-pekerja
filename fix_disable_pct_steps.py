file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_disable_pct", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = '''                        {/* STEP checkmarks */}
                        {!isQtyBased&&PCT_STEPS.map(s=>{
                          const reached=r.pct>=s;
                          const isNext=!done&&s===PCT_STEPS.find(x=>x>r.pct);
                          const prevStep=PCT_STEPS[PCT_STEPS.indexOf(s)-1]||0;
                          return(
                            <td key={s} style={{...td,textAlign:"center",padding:"4px",
                              background:reached?pBg(s)+"cc":rBg}}>
                              <button
                                onClick={()=>updatePctManual(r.panelId,r.kode,proses,reached?prevStep:s)}
                                title={reached?`Batalkan ${s}%`:`Set ${s}%`}
                                style={{width:22,height:22,borderRadius:5,border:"none",cursor:"pointer",
                                  background:reached?pColor(s):isNext?"#eff6ff":"transparent",
                                  display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto",
                                  outline:isNext?`2px solid ${pc}`:"none",transition:"all .12s"}}>
                                {reached
                                  ?<span style={{color:"#fff",fontSize:12,fontWeight:700}}>\u2713</span>
                                  :isNext?<span style={{color:pc,fontSize:11,fontWeight:700}}>\u2192</span>
                                  :<span style={{color:"#e2e8f0",fontSize:11}}>\u00b7</span>
                                }
                              </button>
                            </td>
                          );
                        })}'''

NEW = '''                        {/* STEP checkmarks */}
                        {!isQtyBased&&(()=>{
                          const bisaEdit=canEditProgressKomponen(r.task,r.kode,r.panelId,proses);
                          return PCT_STEPS.map(s=>{
                          const reached=r.pct>=s;
                          const isNext=!done&&s===PCT_STEPS.find(x=>x>r.pct);
                          const prevStep=PCT_STEPS[PCT_STEPS.indexOf(s)-1]||0;
                          return(
                            <td key={s} style={{...td,textAlign:"center",padding:"4px",
                              background:reached?pBg(s)+"cc":rBg,opacity:bisaEdit?1:0.4}}>
                              <button disabled={!bisaEdit}
                                onClick={()=>{if(bisaEdit)updatePctManual(r.panelId,r.kode,proses,reached?prevStep:s);}}
                                title={!bisaEdit?"Pilih operator dan klik Mulai dulu":reached?`Batalkan ${s}%`:`Set ${s}%`}
                                style={{width:22,height:22,borderRadius:5,border:"none",cursor:bisaEdit?"pointer":"not-allowed",
                                  background:reached?pColor(s):isNext?"#eff6ff":"transparent",
                                  display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto",
                                  outline:isNext&&bisaEdit?`2px solid ${pc}`:"none",transition:"all .12s"}}>
                                {reached
                                  ?<span style={{color:"#fff",fontSize:12,fontWeight:700}}>\u2713</span>
                                  :isNext?<span style={{color:pc,fontSize:11,fontWeight:700}}>\u2192</span>
                                  :<span style={{color:"#e2e8f0",fontSize:11}}>\u00b7</span>
                                }
                              </button>
                            </td>
                          );
                          });
                        })()}'''

count = content.count(OLD)
print(f"  PATTERN occurrences: {count}")

if count == 1:
    content = content.replace(OLD, NEW, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Tombol progress sekarang disabled sampai operator pilih + klik Mulai")
    print("[INFO] Jalankan: npm run build")
else:
    print(f"[FAIL] PATTERN occurrences = {count}, bukan 1. TIDAK menyimpan apapun")
