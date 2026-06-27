import shutil
import sys

PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

OLD = '''  useEffect(()=>{
    if(selectedWoId)fetchRiwayat(selectedWoId);
    const ch=supabase.channel("realtime-tracking-komponen")
      .on("postgres_changes",{event:"*",schema:"public",table:"fcs_tracking_komponen"},()=>{if(selectedWoId)fetchRiwayat(selectedWoId);})
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[selectedWoId]);'''

NEW = '''  useEffect(()=>{
    setSelectedPanelId(null);
    if(selectedWoId){fetchPanelList(selectedWoId);fetchRiwayat(selectedWoId);}
    const ch=supabase.channel("realtime-tracking-komponen")
      .on("postgres_changes",{event:"*",schema:"public",table:"fcs_tracking_komponen"},()=>{if(selectedWoId)fetchRiwayat(selectedWoId);})
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[selectedWoId]);'''

def main():
    shutil.copy(PATH, PATH + ".bak_panelselect2")
    print(f"[OK] Backup dibuat: {PATH}.bak_panelselect2")

    with open(PATH, "r", encoding="utf-8") as f:
        content = f.read()

    count = content.count(OLD)
    if count != 1:
        print(f"[FAIL] Pattern OLD ditemukan {count} kali (harus tepat 1). Tidak ada perubahan disimpan.")
        sys.exit(1)

    content = content.replace(OLD, NEW)

    with open(PATH, "w", encoding="utf-8") as f:
        f.write(content)

    print("[OK] EDIT 2 (reset panel & fetch panel list saat WO berubah) berhasil diterapkan")
    print("Catatan: EDIT 1, 3, 4 dari script sebelumnya seharusnya sudah diterapkan (cek pesan [OK] sebelumnya)")
    print("Selanjutnya jalankan: npm run build")

if __name__ == "__main__":
    main()
