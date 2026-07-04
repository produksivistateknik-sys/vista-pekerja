import shutil
import sys

PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

OLD_1 = "  const [wiringInfoMap,setWiringInfoMap]=useState<Record<string,any>>({});"
NEW_1 = "  const [wiringInfoMap,setWiringInfoMap]=useState<Record<string,any>>({});\n  const [komponenInfoMap,setKomponenInfoMap]=useState<Record<string,any>>({});"

OLD_2 = "      setWiringInfoMap({});\n    }\n    setLoadingData(false);\n  };"
NEW_2 = """      setWiringInfoMap({});
    }

    // Ambil info komponen (CREATE BY, CREATE ON, TARGET SELESAI) untuk proses biasa
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
      (fcsDtNw||[]).forEach((row:any)=>{
        const key=`${row.panel_id}_${row.jenis_pekerjaan}_${row.kode_komponen}`;
        if(!kompMap[key])kompMap[key]={createdBy:row.generated_by,createdAt:row.created_at,targetSelesai:null};
      });
      (rawDtNw||[]).forEach((row:any)=>{
        Object.entries(row.schedule||{}).forEach(([tgl,entries]:any)=>{
          (entries||[]).forEach((e:any)=>{
            (e.komponen||[]).forEach((k:string)=>{
              if(k.startsWith("__wiring_"))return;
              const key=`${row.panel_id}_${row.proses}_${k}`;
              if(!kompMap[key])kompMap[key]={createdBy:null,createdAt:null,targetSelesai:null};
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

EDITS = [
    ("EDIT 1 (state komponenInfoMap)", OLD_1, NEW_1),
    ("EDIT 2 (fetch komponen info di loadData)", OLD_2, NEW_2),
]

def main():
    shutil.copy(PATH, PATH + ".bak_edit12only")
    print(f"[OK] Backup dibuat: {PATH}.bak_edit12only")

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
