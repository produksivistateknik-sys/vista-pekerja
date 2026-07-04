import shutil
import sys

PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

# Pindahkan cell QTY PROSES dari setelah AKTUAL SELESAI ke setelah QTY KOMP (sebelum CREATE BY)
# Caranya: hapus block isQtyBased dari posisi lama, sisipkan di dalam block kInfo sebelum CREATE BY

OLD = '''                            <td style={{...td,textAlign:"center"}}>
                              <span style={{fontWeight:800,fontFamily:"\'DM Mono\',monospace",color:r.qtyKomp===0?"#fca5a5":"#475569",
                                background:r.qtyKomp===0?"#fef2f2":"#f1f5f9",borderRadius:6,padding:"3px 8px",fontSize:12}}>
                                {r.qtyKomp} 🔒
                              </span>
                            </td>
                            {(()=>{
                              const kInfo=komponenInfoMap[`${r.panelId}_${proses}_${r.kode}`]||{};
                              const fmtDate=(d:string)=>d?new Date(d).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"}):"–";
                              return(
                                <>
                                  <td style={{...td,fontSize:10,color:"#475569"}}>{kInfo.createdBy||"–"}</td>
                                  <td style={{...td,fontSize:10,color:"#64748b"}}>{fmtDate(kInfo.createdAt)}</td>
                                  <td style={{...td,fontSize:10,fontWeight:600,color:"#1d4ed8"}}>{fmtDate(kInfo.targetSelesai)}</td>
                                  <td style={{...td,fontSize:10,fontWeight:600,color:r.pct>=100?"#16a34a":"#94a3b8"}}>{r.pct>=100?fmtDate(new Date().toISOString()):"–"}</td>
                                </>
                              );
                            })()}
                          </>
                        )}
                        {isQtyBased&&(()=>{
                          const locked=isCellLocked(r.panelId,r.kode,proses);
                          const floor=getLockedFloor(r.panelId,r.kode,proses);
                          return(
                            <td style={{...td,textAlign:"center"}}>
                              {locked?(
                                <span style={{width:60,padding:"4px 6px",borderRadius:7,border:"1.5px solid #16a34a",
                                  background:"#f0fdf4",fontSize:12,textAlign:"center",fontWeight:700,
                                  fontFamily:"\'DM Mono\',monospace",color:"#16a34a",display:"inline-block"}}>
                                  {r.qtyProses} 🔒
                                </span>
                              ):(
                                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                                  <input type="number" min={floor} max={r.qtyKomp} value={r.qtyProses}
                                    onChange={e=>updateQtyProses(r.panelId,r.kode,proses,Number(e.target.value))}
                                    disabled={r.qtyKomp===0}
                                    style={{width:60,padding:"4px 6px",borderRadius:7,
                                      border:`1.5px solid ${r.qtyKomp===0?"#e2e8f0":floor>0?"#f59e0b":"#2563eb"}`,
                                      background:r.qtyKomp===0?"#f8fafc":floor>0?"#fffbeb":"#eff6ff",
                                      fontSize:12,textAlign:"center",fontWeight:700,
                                      fontFamily:"\'DM Mono\',monospace",
                                      color:r.qtyKomp===0?"#cbd5e1":floor>0?"#b45309":"#1d4ed8"}}/>
                                  {floor>0&&<span style={{fontSize:9,color:"#f59e0b",fontWeight:700}}>min {floor} 🔒</span>}
                                </div>
                              )}
                            </td>
                          );
                        })()}'''

NEW = '''                            <td style={{...td,textAlign:"center"}}>
                              <span style={{fontWeight:800,fontFamily:"\'DM Mono\',monospace",color:r.qtyKomp===0?"#fca5a5":"#475569",
                                background:r.qtyKomp===0?"#fef2f2":"#f1f5f9",borderRadius:6,padding:"3px 8px",fontSize:12}}>
                                {r.qtyKomp} 🔒
                              </span>
                            </td>
                            {(()=>{
                              const kInfo=komponenInfoMap[`${r.panelId}_${proses}_${r.kode}`]||{};
                              const fmtDate=(d:string)=>d?new Date(d).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"}):"–";
                              const locked=isCellLocked(r.panelId,r.kode,proses);
                              const floor=getLockedFloor(r.panelId,r.kode,proses);
                              return(
                                <>
                                  <td style={{...td,textAlign:"center"}}>
                                    {locked?(
                                      <span style={{width:60,padding:"4px 6px",borderRadius:7,border:"1.5px solid #16a34a",
                                        background:"#f0fdf4",fontSize:12,textAlign:"center",fontWeight:700,
                                        fontFamily:"\'DM Mono\',monospace",color:"#16a34a",display:"inline-block"}}>
                                        {r.qtyProses} 🔒
                                      </span>
                                    ):(
                                      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                                        <input type="number" min={floor} max={r.qtyKomp} value={r.qtyProses}
                                          onChange={e=>updateQtyProses(r.panelId,r.kode,proses,Number(e.target.value))}
                                          disabled={r.qtyKomp===0}
                                          style={{width:60,padding:"4px 6px",borderRadius:7,
                                            border:`1.5px solid ${r.qtyKomp===0?"#e2e8f0":floor>0?"#f59e0b":"#2563eb"}`,
                                            background:r.qtyKomp===0?"#f8fafc":floor>0?"#fffbeb":"#eff6ff",
                                            fontSize:12,textAlign:"center",fontWeight:700,
                                            fontFamily:"\'DM Mono\',monospace",
                                            color:r.qtyKomp===0?"#cbd5e1":floor>0?"#b45309":"#1d4ed8"}}/>
                                        {floor>0&&<span style={{fontSize:9,color:"#f59e0b",fontWeight:700}}>min {floor} 🔒</span>}
                                      </div>
                                    )}
                                  </td>
                                  <td style={{...td,fontSize:10,color:"#475569"}}>{kInfo.createdBy||"–"}</td>
                                  <td style={{...td,fontSize:10,color:"#64748b"}}>{fmtDate(kInfo.createdAt)}</td>
                                  <td style={{...td,fontSize:10,fontWeight:600,color:"#1d4ed8"}}>{fmtDate(kInfo.targetSelesai)}</td>
                                  <td style={{...td,fontSize:10,fontWeight:600,color:r.pct>=100?"#16a34a":"#94a3b8"}}>{r.pct>=100?fmtDate(new Date().toISOString()):"–"}</td>
                                </>
                              );
                            })()}
                          </>
                        )}'''

def main():
    shutil.copy(PATH, PATH + ".bak_qtypos")
    print(f"[OK] Backup dibuat: {PATH}.bak_qtypos")

    with open(PATH, "r", encoding="utf-8") as f:
        content = f.read()

    count = content.count(OLD)
    if count != 1:
        print(f"[FAIL] Pattern OLD ditemukan {count} kali (harus tepat 1). Tidak ada perubahan disimpan.")
        sys.exit(1)

    content = content.replace(OLD, NEW)

    with open(PATH, "w", encoding="utf-8") as f:
        f.write(content)

    print("[OK] Cell QTY PROSES dipindah ke setelah QTY KOMP, sebelum CREATE BY")
    print("Urutan: QTY KOMP | QTY PROSES | CREATE BY | CREATE ON | TARGET SELESAI | AKTUAL SELESAI")
    print("Selanjutnya jalankan: npm run build")

if __name__ == "__main__":
    main()
