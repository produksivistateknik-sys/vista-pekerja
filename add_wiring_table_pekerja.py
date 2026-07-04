import shutil
import sys

PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

# EDIT 1: Tambah state wiringInfoMap
OLD_1 = "  const [woTargetMap,setWoTargetMap]=useState<Record<number,string>>({});"

NEW_1 = "  const [woTargetMap,setWoTargetMap]=useState<Record<number,string>>({});\n  const [wiringInfoMap,setWiringInfoMap]=useState<Record<string,any>>({});"

# EDIT 2: Fetch wiring info di loadData setelah fetch panels
OLD_2 = "    setLoadingData(false);\n  };"

NEW_2 = """    // Ambil info wiring (CREATE BY, CREATE ON, TARGET SELESAI) dari fcs_schedule dan raw_schedule
    const wiringProses=["WIRING CONTROL","WIRING POWER"];
    const wiringTasks=tasks.filter((t:any)=>wiringProses.includes(t.proses));
    if(wiringTasks.length>0){
      const wiringPanelIds=[...new Set(wiringTasks.map((t:any)=>t.panel_id||t.panelId).filter(Boolean))];
      const wiringProsesNames=[...new Set(wiringTasks.map((t:any)=>t.proses))];
      const[{data:fcsData},{data:rawData}]=await Promise.all([
        supabase.from("fcs_schedule").select("panel_id,jenis_pekerjaan,kode_komponen,qty_total,generated_by,created_at")
          .in("panel_id",wiringPanelIds as any).in("jenis_pekerjaan",wiringProsesNames),
        supabase.from("raw_schedule").select("panel_id,proses,schedule")
          .in("panel_id",wiringPanelIds as any).in("proses",wiringProsesNames),
      ]);
      const infoMap:Record<string,any>={};
      // Dari fcs_schedule: ambil bobot, orang, create by, create on
      (fcsData||[]).forEach((row:any)=>{
        const key=`${row.panel_id}_${row.jenis_pekerjaan}`;
        if(!infoMap[key])infoMap[key]={bobot:row.kode_komponen,jumlahOrang:row.qty_total,createdBy:row.generated_by,createdAt:row.created_at,targetSelesai:null,aktualSelesai:null};
      });
      // Dari raw_schedule: cari tanggal terakhir token wiring
      (rawData||[]).forEach((row:any)=>{
        const key=`${row.panel_id}_${row.proses}`;
        let lastTgl:string|null=null;
        Object.entries(row.schedule||{}).forEach(([tgl,entries]:any)=>{
          (entries||[]).forEach((e:any)=>{
            (e.komponen||[]).forEach((k:string)=>{
              if(k.startsWith("__wiring_")){
                if(!lastTgl||tgl>lastTgl)lastTgl=tgl;
              }
            });
          });
        });
        if(lastTgl&&infoMap[key])infoMap[key].targetSelesai=lastTgl;
      });
      setWiringInfoMap(infoMap);
    } else {
      setWiringInfoMap({});
    }
    setLoadingData(false);
  };"""

# EDIT 3: Render tabel wiring khusus - ganti tabel biasa untuk proses wiring
OLD_3 = "      const isDone=(r:any)=>r.pct===100;\n\n        return("

NEW_3 = """      const isDone=(r:any)=>r.pct===100;
      const isWiringProses=["WIRING CONTROL","WIRING POWER"].includes(proses);

        return("""

# EDIT 4: Ganti header tabel untuk wiring
OLD_4 = """                <thead>
                  <tr>
                    <th style={{...thS,textAlign:"left",minWidth:40,position:"sticky",left:0,zIndex:4}}>NO</th>
                    <th style={{...thS,textAlign:"left",minWidth:100,position:"sticky",left:40,zIndex:4}}>PROYEK</th>
                    <th style={{...thS,textAlign:"left",minWidth:160,position:"sticky",left:140,zIndex:4}}>NAMA PANEL</th>
                    <th style={{...thS,minWidth:50}}>WP</th>
                    <th style={{...thS,textAlign:"left",minWidth:160}}>KOMPONEN</th>
                    <th style={{...thS,minWidth:50}}>KODE</th>
                    <th style={{...thS,minWidth:70}}>PRIORITAS</th>
                    <th style={{...thS,minWidth:60}}>QTY KOMP</th>
                    {isQtyBased&&<th style={{...thS,minWidth:70}}>QTY PROSES</th>}
                    <th style={{...thS,minWidth:70}}>PROGRESS</th>
                    <th style={{...thS,textAlign:"left",minWidth:140}}>OPERATOR</th>
                    {!isQtyBased&&PCT_STEPS.map(s=>(
                      <th key={s} style={{...thS,minWidth:50,borderBottom:`2px solid ${pc}`}}>{s}%</th>
                    ))}
                    <th style={{...thS,minWidth:80}}>STATUS</th>
                  </tr>
                </thead>"""

NEW_4 = """                <thead>
                  <tr>
                    <th style={{...thS,textAlign:"left",minWidth:40,position:"sticky",left:0,zIndex:4}}>NO</th>
                    <th style={{...thS,textAlign:"left",minWidth:100,position:"sticky",left:40,zIndex:4}}>PROYEK</th>
                    <th style={{...thS,textAlign:"left",minWidth:160,position:"sticky",left:140,zIndex:4}}>NAMA PANEL</th>
                    {isWiringProses?(
                      <>
                        <th style={{...thS,minWidth:80}}>BOBOT</th>
                        <th style={{...thS,minWidth:60}}>ORANG</th>
                        <th style={{...thS,minWidth:100}}>CREATE BY</th>
                        <th style={{...thS,minWidth:100}}>CREATE ON</th>
                        <th style={{...thS,minWidth:100}}>TARGET SELESAI</th>
                        <th style={{...thS,minWidth:100}}>AKTUAL SELESAI</th>
                      </>
                    ):(
                      <>
                        <th style={{...thS,minWidth:50}}>WP</th>
                        <th style={{...thS,textAlign:"left",minWidth:160}}>KOMPONEN</th>
                        <th style={{...thS,minWidth:50}}>KODE</th>
                        <th style={{...thS,minWidth:70}}>PRIORITAS</th>
                        <th style={{...thS,minWidth:60}}>QTY KOMP</th>
                        {isQtyBased&&<th style={{...thS,minWidth:70}}>QTY PROSES</th>}
                      </>
                    )}
                    <th style={{...thS,minWidth:70}}>PROGRESS</th>
                    <th style={{...thS,textAlign:"left",minWidth:140}}>OPERATOR</th>
                    {!isWiringProses&&!isQtyBased&&PCT_STEPS.map(s=>(
                      <th key={s} style={{...thS,minWidth:50,borderBottom:`2px solid ${pc}`}}>{s}%</th>
                    ))}
                    {isWiringProses&&PCT_STEPS.map(s=>(
                      <th key={s} style={{...thS,minWidth:50,borderBottom:`2px solid ${pc}`}}>{s}%</th>
                    ))}
                    <th style={{...thS,minWidth:80}}>STATUS</th>
                  </tr>
                </thead>"""

# EDIT 5: Ganti cell WP, KOMPONEN, KODE, PRIORITAS, QTY untuk wiring
OLD_5 = """                        <td style={{...td,textAlign:"center"}}>
                          {r.wpDef&&<span style={{background:r.wpDef.color+"18",color:r.wpDef.color,border:`1px solid ${r.wpDef.color}33`,borderRadius:4,padding:"1px 6px",fontSize:10,fontWeight:700}}
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
                        </td>"""

NEW_5 = """                        {isWiringProses?(()=>{
                          const wInfo=wiringInfoMap[`${r.panelId}_${proses}`]||{};
                          const BOBOT_COLOR:any={EASY:"#16a34a",MEDIUM:"#d97706",HARD:"#dc2626",VERY_HARD:"#7c3aed"};
                          const bc=BOBOT_COLOR[wInfo.bobot]||"#6366f1";
                          const fmtDate=(d:string)=>d?new Date(d).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"}):"-";
                          const fmtDateTime=(d:string)=>d?new Date(d).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"}):"–";
                          return(
                            <>
                              <td style={{...td,textAlign:"center"}}>
                                <span style={{background:bc+"18",color:bc,border:`1px solid ${bc}33`,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700}}>
                                  {(wInfo.bobot||"–").replace("_"," ")}
                                </span>
                              </td>
                              <td style={{...td,textAlign:"center",fontWeight:700,color:"#475569"}}>{wInfo.jumlahOrang||"–"} org</td>
                              <td style={{...td,fontSize:10,color:"#475569"}}>{wInfo.createdBy||"–"}</td>
                              <td style={{...td,fontSize:10,color:"#64748b"}}>{fmtDateTime(wInfo.createdAt)}</td>
                              <td style={{...td,fontSize:10,fontWeight:600,color:"#1d4ed8"}}>{fmtDate(wInfo.targetSelesai)}</td>
                              <td style={{...td,fontSize:10,fontWeight:600,color:r.pct>=100?"#16a34a":"#94a3b8"}}>{r.pct>=100?fmtDate(new Date().toISOString()):"-"}</td>
                            </>
                          );
                        })():(
                          <>
                            <td style={{...td,textAlign:"center"}}>
                              {r.wpDef&&<span style={{background:r.wpDef.color+"18",color:r.wpDef.color,border:`1px solid ${r.wpDef.color}33`,borderRadius:4,padding:"1px 6px",fontSize:10,fontWeight:700}}
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
                        )}"""

EDITS = [
    ("EDIT 1 (state wiringInfoMap)", OLD_1, NEW_1),
    ("EDIT 2 (fetch wiring info di loadData)", OLD_2, NEW_2),
    ("EDIT 3 (flag isWiringProses)", OLD_3, NEW_3),
    ("EDIT 4 (header tabel wiring khusus)", OLD_4, NEW_4),
    ("EDIT 5 (cell wiring khusus)", OLD_5, NEW_5),
]

def main():
    shutil.copy(PATH, PATH + ".bak_wiringtable")
    print(f"[OK] Backup dibuat: {PATH}.bak_wiringtable")

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
    print("Tabel wiring sekarang punya kolom: BOBOT, ORANG, CREATE BY, CREATE ON, TARGET SELESAI, AKTUAL SELESAI")
    print("Selanjutnya jalankan: tsc -b && vite build")

if __name__ == "__main__":
    main()
