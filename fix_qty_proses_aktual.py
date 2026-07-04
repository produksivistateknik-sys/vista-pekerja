import shutil
import sys

PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

# EDIT 1: Hapus header AKTUAL SELESAI untuk proses biasa
OLD_1 = "                        <th style={{...thS,minWidth:100}}>CREATE BY</th>\n                        <th style={{...thS,minWidth:100}}>CREATE ON</th>\n                        <th style={{...thS,minWidth:110}}>TARGET SELESAI</th>\n                        <th style={{...thS,minWidth:110}}>AKTUAL SELESAI</th>\n                      </>\n                    )}\n                    <th style={{...thS,minWidth:70}}>PROGRESS</th>"

NEW_1 = "                        <th style={{...thS,minWidth:70}}>QTY PROSES</th>\n                        <th style={{...thS,minWidth:100}}>CREATE BY</th>\n                        <th style={{...thS,minWidth:100}}>CREATE ON</th>\n                        <th style={{...thS,minWidth:110}}>TARGET SELESAI</th>\n                      </>\n                    )}\n                    <th style={{...thS,minWidth:70}}>PROGRESS</th>"

# EDIT 2: Hapus {isQtyBased&&<th QTY PROSES} dari header karena sudah dipindah
OLD_2 = "                        {isQtyBased&&<th style={{...thS,minWidth:70}}>QTY PROSES</th>}\n                        <th style={{...thS,minWidth:100}}>CREATE BY</th>"

NEW_2 = "                        <th style={{...thS,minWidth:100}}>CREATE BY</th>"

# EDIT 3: Hapus cell AKTUAL SELESAI dari tbody, tambah cell QTY PROSES sebelum CREATE BY
OLD_3 = '''                            {(()=>{
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

NEW_3 = '''                            {(()=>{
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
                                </>
                              );
                            })()}
                          </>
                        )}'''

EDITS = [
    ("EDIT 1 (header: hapus AKTUAL SELESAI, tambah QTY PROSES sebelum CREATE BY)", OLD_1, NEW_1),
    ("EDIT 2 (hapus isQtyBased QTY PROSES dari header lama)", OLD_2, NEW_2),
    ("EDIT 3 (cell: pindah QTY PROSES sebelum CREATE BY, hapus AKTUAL SELESAI)", OLD_3, NEW_3),
]

def main():
    shutil.copy(PATH, PATH + ".bak_qtyproses_fix")
    print(f"[OK] Backup dibuat: {PATH}.bak_qtyproses_fix")

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

    print("\n[OK] SEMUA EDIT BERHASIL")
    print("QTY PROSES sekarang di samping QTY KOMP, AKTUAL SELESAI dihapus")
    print("Selanjutnya jalankan: npm run build")

if __name__ == "__main__":
    main()
