import shutil
import sys

PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

OLD_1 = '''  const fetchRiwayat=async(woId:number)=>{
    setLoadingRiwayat(true);
    const{data:tr}=await supabase.from("fcs_tracking_komponen").select("*").eq("wo_id",woId).order("created_at",{ascending:false});
    setRiwayat(tr??[]);'''

NEW_1 = '''  const fetchRiwayat=async(panelId:number)=>{
    setLoadingRiwayat(true);
    const{data:tr}=await supabase.from("fcs_tracking_komponen").select("*").eq("panel_id",panelId).order("created_at",{ascending:false});
    setRiwayat(tr??[]);'''

OLD_2 = '''  useEffect(()=>{
    setSelectedPanelId(null);
    if(selectedWoId){fetchPanelList(selectedWoId);fetchRiwayat(selectedWoId);}
    const ch=supabase.channel("realtime-tracking-komponen")
      .on("postgres_changes",{event:"*",schema:"public",table:"fcs_tracking_komponen"},()=>{if(selectedWoId)fetchRiwayat(selectedWoId);})
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[selectedWoId]);'''

NEW_2 = '''  useEffect(()=>{
    setSelectedPanelId(null);
    setRiwayat([]);
    if(selectedWoId){fetchPanelList(selectedWoId);}
  },[selectedWoId]);

  useEffect(()=>{
    if(!selectedPanelId){setRiwayat([]);return;}
    fetchRiwayat(selectedPanelId);
    const ch=supabase.channel("realtime-tracking-komponen")
      .on("postgres_changes",{event:"*",schema:"public",table:"fcs_tracking_komponen"},()=>{if(selectedPanelId)fetchRiwayat(selectedPanelId);})
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[selectedPanelId]);'''

OLD_3 = '''    setUploading(false);
    fetchRiwayat(selectedWoId);
  };'''

NEW_3 = '''    setUploading(false);
    fetchRiwayat(selectedPanelId);
  };'''

OLD_4 = '''            <div style={{textAlign:"center" as const,padding:30,color:"#94a3b8",fontSize:13}}>Belum ada riwayat untuk WO ini</div>'''

NEW_4 = '''            <div style={{textAlign:"center" as const,padding:30,color:"#94a3b8",fontSize:13}}>Belum ada riwayat untuk panel ini</div>'''

EDITS = [
    ("EDIT 1 (fetchRiwayat filter by panel_id)", OLD_1, NEW_1),
    ("EDIT 2 (useEffect dipisah: WO->panelList, panel->riwayat)", OLD_2, NEW_2),
    ("EDIT 3 (refresh riwayat setelah submit pakai panelId)", OLD_3, NEW_3),
    ("EDIT 4 (teks kosong riwayat per panel)", OLD_4, NEW_4),
]

def main():
    shutil.copy(PATH, PATH + ".bak_riwayatperpanel")
    print(f"[OK] Backup dibuat: {PATH}.bak_riwayatperpanel")

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

    print("")
    print("[OK] SEMUA EDIT BERHASIL DITERAPKAN")
    print("Ringkasan:")
    print("  - Riwayat sekarang difilter per PANEL (panel_id), bukan per WO")
    print("  - Pilih WO -> muncul daftar panel. Pilih panel -> baru riwayat panel itu muncul")
    print("  - Ganti panel -> riwayat otomatis refresh sesuai panel yang baru dipilih")
    print("Selanjutnya jalankan: npm run build")

if __name__ == "__main__":
    main()
