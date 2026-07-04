import shutil
import sys

PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

# EDIT 1: Tambah state komponenInfoMap
OLD_1 = "  const [wiringInfoMap,setWiringInfoMap]=useState<Record<string,any>>({});"
NEW_1 = "  const [wiringInfoMap,setWiringInfoMap]=useState<Record<string,any>>({});\n  const [komponenInfoMap,setKomponenInfoMap]=useState<Record<string,any>>({});"

# EDIT 2: Fetch data untuk proses biasa di loadData (sebelum setLoadingData(false))
OLD_2 = "      setWiringInfoMap({});\n    }\n    setLoadingData(false);\n  };"
NEW_2 = """      setWiringInfoMap({});
    }

    // Ambil info komponen (CREATE BY, CREATE ON, TARGET SELESAI) untuk proses biasa (non-wiring)
    const nonWiringProses=["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","BUSBAR"];
    const nonWiringTasks=tasks.filter((t:any)=>nonWiringProses.includes(t.proses));
    if(nonWiringTasks.length>0){
      const nwPanelIds=[...new Set(nonWiringTasks.map((t:any)=>t.panel_id||t.panelId).filter(Boolean))];
      const nwProsesNames=[...new Set(nonWiringTasks.map((t:any)=>t.proses))];
      const[{data:fcsDtNw},{data:rawDtNw}]=await Promise.all([
        supabase.from("fcs_schedule").select("panel_id,jenis_pekerjaan,kode_komponen,generated_by,created_at")
          .in("panel_id",nwPanelIds as any).in("jenis_pekerjaan",nwProsesNames),
        supabase.from("raw_schedule").select("panel_id,proses,schedule")
          .in("panel_id",nwPanelIds as any).in("proses",nwProsesNames),
      ]);
      const kompMap:Record<string,any>={};
      // CREATE BY dan CREATE ON per panel+proses+kode_komponen
      (fcsDtNw||[]).forEach((row:any)=>{
        const key=`${row.panel_id}_${row.jenis_pekerjaan}_${row.kode_komponen}`;
        if(!kompMap[key])kompMap[key]={createdBy:row.generated_by,createdAt:row.created_at,targetSelesai:null,aktualSelesai:null};
      });
      // TARGET SELESAI: tanggal terakhir komponen muncul di raw_schedule
      (rawDtNw||[]).forEach((row:any)=>{
        Object.entries(row.schedule||{}).forEach(([tgl,entries]:any)=>{
          (entries||[]).forEach((e:any)=>{
            (e.komponen||[]).forEach((k:string)=>{
              if(k.startsWith("__wiring_"))return;
              const key=`${row.panel_id}_${row.proses}_${k}`;
              if(!kompMap[key])kompMap[key]={createdBy:null,createdAt:null,targetSelesai:null,aktualSelesai:null};
              if(!kompMap[key].targetSelesai||tgl>kompMap[key].targetSelesai)kompMap[key].targetSelesai=tgl;
            });
          });
        });
      });
      setKomponenInfoMap(kompMap);
    } else {
      setKomponenInfoMap({});
    }
    setLoadingData(false);
  };"""

# EDIT 3: Tambah kolom header untuk proses biasa
OLD_3 = """                        <th style={{...thS,minWidth:50}}>KODE</th>
                    <th style={{...thS,minWidth:70}}>PRIORITAS</th>
                    <th style={{...thS,minWidth:60}}>QTY KOMP</th>
                        {isQtyBased&&<th style={{...thS,minWidth:70}}>QTY PROSES</th>}
                      </>
                    )}
                    <th style={{...thS,minWidth:70}}>PROGRESS</th>"""

NEW_3 = """                        <th style={{...thS,minWidth:50}}>KODE</th>
                    <th style={{...thS,minWidth:70}}>PRIORITAS</th>
                    <th style={{...thS,minWidth:60}}>QTY KOMP</th>
                        {isQtyBased&&<th style={{...thS,minWidth:70}}>QTY PROSES</th>}
                        <th style={{...thS,minWidth:100}}>CREATE BY</th>
                        <th style={{...thS,minWidth:100}}>CREATE ON</th>
                        <th style={{...thS,minWidth:110}}>TARGET SELESAI</th>
                        <th style={{...thS,minWidth:110}}>AKTUAL SELESAI</th>
                      </>
                    )}
                    <th style={{...thS,minWidth:70}}>PROGRESS</th>"""

# EDIT 4: Tambah cell data untuk proses biasa (setelah cell QTY KOMP)
OLD_4 = """                            <td style={{...td,textAlign:"center"}}>
                              <span style={{fontWeight:800,fontFamily:"\'DM Mono\',monospace",color:r.qtyKomp===0?"#fca5a5":"#475569",
                                background:r.qtyKomp===0?"#fef2f2":"#f1f5f9",borderRadius:6,padding:"3px 8px",fontSize:12}}>
                                {r.qtyKomp} 🔒
                              </span>
                            </td>
                          </>
                        )}"""

NEW_4 = """                            <td style={{...td,textAlign:"center"}}>
                              <span style={{fontWeight:800,fontFamily:"\'DM Mono\',monospace",color:r.qtyKomp===0?"#fca5a5":"#475569",
                                background:r.qtyKomp===0?"#fef2f2":"#f1f5f9",borderRadius:6,padding:"3px 8px",fontSize:12}}>
                                {r.qtyKomp} 🔒
                              </span>
                            </td>
                            {(()=>{
                              const kInfo=komponenInfoMap[`${r.panelId}_${proses}_${r.kode}`]||{};
                              const fmtDate=(d:string)=>d?new Date(d).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"}):"-";
                              return(
                                <>
                                  <td style={{...td,fontSize:10,color:"#475569"}}>{kInfo.createdBy||"-"}</td>
                                  <td style={{...td,fontSize:10,color:"#64748b"}}>{fmtDate(kInfo.createdAt)}</td>
                                  <td style={{...td,fontSize:10,fontWeight:600,color:"#1d4ed8"}}>{fmtDate(kInfo.targetSelesai)}</td>
                                  <td style={{...td,fontSize:10,fontWeight:600,color:r.pct>=100?"#16a34a":"#94a3b8"}}>{r.pct>=100?fmtDate(new Date().toISOString()):"-"}</td>
                                </>
                              );
                            })()}
                          </>
                        )}"""

EDITS = [
    ("EDIT 1 (state komponenInfoMap)", OLD_1, NEW_1),
    ("EDIT 2 (fetch komponen info di loadData)", OLD_2, NEW_2),
    ("EDIT 3 (header kolom CREATE BY dll untuk proses biasa)", OLD_3, NEW_3),
    ("EDIT 4 (cell data CREATE BY dll untuk proses biasa)", OLD_4, NEW_4),
]

def main():
    shutil.copy(PATH, PATH + ".bak_komponeninfo")
    print(f"[OK] Backup dibuat: {PATH}.bak_komponeninfo")

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
    print("Tabel proses biasa sekarang punya kolom CREATE BY, CREATE ON, TARGET SELESAI, AKTUAL SELESAI")
    print("Selanjutnya jalankan: npm run build")

if __name__ == "__main__":
    main()
