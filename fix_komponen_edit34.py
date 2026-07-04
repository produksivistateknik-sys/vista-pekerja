import shutil
import sys

PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

OLD_3 = "                        {isQtyBased&&<th style={{...thS,minWidth:70}}>QTY PROSES</th>}\n                      </>\n                    )}\n                    <th style={{...thS,minWidth:70}}>PROGRESS</th>"

NEW_3 = "                        {isQtyBased&&<th style={{...thS,minWidth:70}}>QTY PROSES</th>}\n                        <th style={{...thS,minWidth:100}}>CREATE BY</th>\n                        <th style={{...thS,minWidth:100}}>CREATE ON</th>\n                        <th style={{...thS,minWidth:110}}>TARGET SELESAI</th>\n                        <th style={{...thS,minWidth:110}}>AKTUAL SELESAI</th>\n                      </>\n                    )}\n                    <th style={{...thS,minWidth:70}}>PROGRESS</th>"

OLD_4 = "                            <td style={{...td,textAlign:\"center\"}}>\n                              <span style={{fontWeight:800,fontFamily:\"'DM Mono',monospace\",color:r.qtyKomp===0?\"#fca5a5\":\"#475569\",\n                                background:r.qtyKomp===0?\"#fef2f2\":\"#f1f5f9\",borderRadius:6,padding:\"3px 8px\",fontSize:12}}>\n                                {r.qtyKomp} 🔒\n                              </span>\n                            </td>\n                          </>\n                        )}"

NEW_4 = "                            <td style={{...td,textAlign:\"center\"}}>\n                              <span style={{fontWeight:800,fontFamily:\"'DM Mono',monospace\",color:r.qtyKomp===0?\"#fca5a5\":\"#475569\",\n                                background:r.qtyKomp===0?\"#fef2f2\":\"#f1f5f9\",borderRadius:6,padding:\"3px 8px\",fontSize:12}}>\n                                {r.qtyKomp} 🔒\n                              </span>\n                            </td>\n                            {(()=>{\n                              const kInfo=komponenInfoMap[`${r.panelId}_${proses}_${r.kode}`]||{};\n                              const fmtDate=(d:string)=>d?new Date(d).toLocaleDateString(\"id-ID\",{day:\"numeric\",month:\"short\",year:\"numeric\"}):\"–\";\n                              return(\n                                <>\n                                  <td style={{...td,fontSize:10,color:\"#475569\"}}>{kInfo.createdBy||\"–\"}</td>\n                                  <td style={{...td,fontSize:10,color:\"#64748b\"}}>{fmtDate(kInfo.createdAt)}</td>\n                                  <td style={{...td,fontSize:10,fontWeight:600,color:\"#1d4ed8\"}}>{fmtDate(kInfo.targetSelesai)}</td>\n                                  <td style={{...td,fontSize:10,fontWeight:600,color:r.pct>=100?\"#16a34a\":\"#94a3b8\"}}>{r.pct>=100?fmtDate(new Date().toISOString()):\"–\"}</td>\n                                </>\n                              );\n                            })()}\n                          </>\n                        )}"

EDITS = [
    ("EDIT 3 (header kolom CREATE BY dll)", OLD_3, NEW_3),
    ("EDIT 4 (cell data CREATE BY dll)", OLD_4, NEW_4),
]

def main():
    shutil.copy(PATH, PATH + ".bak_edit34")
    print(f"[OK] Backup dibuat: {PATH}.bak_edit34")

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
    print("Selanjutnya jalankan: npm run build")

if __name__ == "__main__":
    main()
