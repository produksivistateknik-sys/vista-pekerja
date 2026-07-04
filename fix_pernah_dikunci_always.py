import shutil
import sys

PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

OLD = '''    // Hitung busbar tasks juga
    const busbarCount=todayTasks.filter((t:any)=>t.proses==="BUSBAR").length;
    if(count>0||busbarCount>0||Object.keys(catatan).some(k=>catatan[k]?.trim())){
      setLockedCells(newLocked);
      setLockMsg(true);
      setPernahDikunci(true);
      setTimeout(()=>setLockMsg(false),2500);
    }
  };'''

NEW = '''    // Hitung busbar tasks juga
    const busbarCount=todayTasks.filter((t:any)=>t.proses==="BUSBAR").length;
    if(count>0||busbarCount>0||Object.keys(catatan).some(k=>catatan[k]?.trim())){
      setLockedCells(newLocked);
      setLockMsg(true);
      setTimeout(()=>setLockMsg(false),2500);
    }
    // Selalu set pernahDikunci=true setiap kali tombol diklik (terlepas ada perubahan atau tidak)
    setPernahDikunci(true);
  };'''

def main():
    shutil.copy(PATH, PATH + ".bak_pernahdikunci2")
    print(f"[OK] Backup dibuat: {PATH}.bak_pernahdikunci2")

    with open(PATH, "r", encoding="utf-8") as f:
        content = f.read()

    count = content.count(OLD)
    if count != 1:
        print(f"[FAIL] Pattern OLD ditemukan {count} kali (harus tepat 1). Tidak ada perubahan disimpan.")
        sys.exit(1)

    content = content.replace(OLD, NEW)

    with open(PATH, "w", encoding="utf-8") as f:
        f.write(content)

    print("[OK] setPernahDikunci(true) sekarang selalu dipanggil saat tombol kunci diklik")
    print("Selanjutnya jalankan: npm run build")

if __name__ == "__main__":
    main()
