import shutil
import sys

PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

OLD = '''                        <td style={{...td,textAlign:"center"}}>
                          {r.wpDef&&<span style={{background:r.wpDef.color+"18",color:r.wpDef.color,border:`1px solid ${r.wpDef.color}33`,borderRadius:4,padding:"1px 6px",fontSize:10,fontWeight:700}}>{r.wpDef.wp}</span>}
                        </td>
                        <td style={{...td,fontWeight:600,color:"#374151",whiteSpace:"nowrap"}}>{r.item.nama}</td>
                        <td style={{...td,textAlign:"center",fontFamily:"\'DM Mono\',monospace",fontSize:10,color:"#94a3b8"}}>{r.kode}</td>
                        <td style={{...td,textAlign:"center"}}>
                          <Badge label={r.task.prioritas||"Sedang"} color={r.priColor}/>
                        </td>
                        <td style={{...td,textAlign:"center"}}>
                          <span style={{fontWeight:800,fontFamily:"\'DM Mono\',monospace",color:r.qtyKomp===0?"#fca5a5":"#475569",
                            background:r.qtyKomp===0?"#fef2f2":"#f1f5f9",borderRadius:6,padding:"3px 8px",fontSize:12}}>
                            {r.qtyKomp} 🔒
                          </span>
                        </td>'''

NEW = '''                        {isWiringProses?(()=>{
                          const wInfo=wiringInfoMap[`${r.panelId}_${proses}`]||{};
                          const BOBOT_COLOR:any={EASY:"#16a34a",MEDIUM:"#d97706",HARD:"#dc2626",VERY_HARD:"#7c3aed"};
                          const bc=BOBOT_COLOR[wInfo.bobot]||"#6366f1";
                          const fmtDate=(d:string)=>d?new Date(d).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"}):"-";
                          return(
                            <>
                              <td style={{...td,textAlign:"center"}}>
                                <span style={{background:bc+"18",color:bc,border:`1px solid ${bc}33`,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700}}>
                                  {(wInfo.bobot||"–").replace("_"," ")}
                                </span>
                              </td>
                              <td style={{...td,textAlign:"center",fontWeight:700,color:"#475569"}}>{wInfo.jumlahOrang||"–"} org</td>
                              <td style={{...td,fontSize:10,color:"#475569"}}>{wInfo.createdBy||"–"}</td>
                              <td style={{...td,fontSize:10,color:"#64748b"}}>{fmtDate(wInfo.createdAt)}</td>
                              <td style={{...td,fontSize:10,fontWeight:600,color:"#1d4ed8"}}>{fmtDate(wInfo.targetSelesai)}</td>
                              <td style={{...td,fontSize:10,fontWeight:600,color:r.pct>=100?"#16a34a":"#94a3b8"}}>{r.pct>=100?fmtDate(new Date().toISOString()):"-"}</td>
                            </>
                          );
                        })():(
                          <>
                            <td style={{...td,textAlign:"center"}}>
                              {r.wpDef&&<span style={{background:r.wpDef.color+"18",color:r.wpDef.color,border:`1px solid ${r.wpDef.color}33`,borderRadius:4,padding:"1px 6px",fontSize:10,fontWeight:700}}>{r.wpDef.wp}</span>}
                            </td>
                            <td style={{...td,fontWeight:600,color:"#374151",whiteSpace:"nowrap"}}>{r.item.nama}</td>
                            <td style={{...td,textAlign:"center",fontFamily:"\'DM Mono\',monospace",fontSize:10,color:"#94a3b8"}}>{r.kode}</td>
                            <td style={{...td,textAlign:"center"}}>
                              <Badge label={r.task.prioritas||"Sedang"} color={r.priColor}/>
                            </td>
                            <td style={{...td,textAlign:"center"}}>
                              <span style={{fontWeight:800,fontFamily:"\'DM Mono\',monospace",color:r.qtyKomp===0?"#fca5a5":"#475569",
                                background:r.qtyKomp===0?"#fef2f2":"#f1f5f9",borderRadius:6,padding:"3px 8px",fontSize:12}}>
                                {r.qtyKomp} 🔒
                              </span>
                            </td>
                          </>
                        )}'''

def main():
    shutil.copy(PATH, PATH + ".bak_edit5")
    print(f"[OK] Backup dibuat: {PATH}.bak_edit5")

    with open(PATH, "r", encoding="utf-8") as f:
        content = f.read()

    count = content.count(OLD)
    if count != 1:
        print(f"[FAIL] Pattern OLD ditemukan {count} kali (harus tepat 1). Tidak ada perubahan disimpan.")
        sys.exit(1)

    content = content.replace(OLD, NEW)

    with open(PATH, "w", encoding="utf-8") as f:
        f.write(content)

    print("[OK] EDIT 5 berhasil - cell wiring khusus dengan kolom BOBOT, ORANG, CREATE BY, dll")
    print("Selanjutnya jalankan: tsc -b && vite build")

if __name__ == "__main__":
    main()
