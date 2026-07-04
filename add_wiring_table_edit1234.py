import shutil
import sys

PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

# EDIT 1: Tambah state wiringInfoMap
OLD_1 = "  const [woTargetMap,setWoTargetMap]=useState<Record<number,string>>({});"
NEW_1 = "  const [woTargetMap,setWoTargetMap]=useState<Record<number,string>>({});\n  const [wiringInfoMap,setWiringInfoMap]=useState<Record<string,any>>({});"

# EDIT 2: Fetch wiring info di loadData
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
      (fcsData||[]).forEach((row:any)=>{
        const key=`${row.panel_id}_${row.jenis_pekerjaan}`;
        if(!infoMap[key])infoMap[key]={bobot:row.kode_komponen,jumlahOrang:row.qty_total,createdBy:row.generated_by,createdAt:row.created_at,targetSelesai:null};
      });
      (rawData||[]).forEach((row:any)=>{
        const key=`${row.panel_id}_${row.proses}`;
        let lastTgl:string|null=null;
        Object.entries(row.schedule||{}).forEach(([tgl,entries]:any)=>{
          (entries||[]).forEach((e:any)=>{
            (e.komponen||[]).forEach((k:string)=>{
              if(k.startsWith("__wiring_")){if(!lastTgl||tgl>lastTgl)lastTgl=tgl;}
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

# EDIT 3: Flag isWiringProses
OLD_3 = "      const isDone=(r:any)=>r.pct===100;\n\n        return("
NEW_3 = """      const isDone=(r:any)=>r.pct===100;
      const isWiringProses=["WIRING CONTROL","WIRING POWER"].includes(proses);

        return("""

# EDIT 4: Header tabel wiring khusus
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
                        <th style={{...thS,minWidth:110}}>TARGET SELESAI</th>
                        <th style={{...thS,minWidth:110}}>AKTUAL SELESAI</th>
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

EDITS = [
    ("EDIT 1 (state wiringInfoMap)", OLD_1, NEW_1),
    ("EDIT 2 (fetch wiring info)", OLD_2, NEW_2),
    ("EDIT 3 (flag isWiringProses)", OLD_3, NEW_3),
    ("EDIT 4 (header tabel wiring)", OLD_4, NEW_4),
]

def main():
    shutil.copy(PATH, PATH + ".bak_edit1234")
    print(f"[OK] Backup dibuat: {PATH}.bak_edit1234")

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
    print("Selanjutnya jalankan: tsc -b && vite build")

if __name__ == "__main__":
    main()
