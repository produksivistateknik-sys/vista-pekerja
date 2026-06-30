import shutil
import sys

PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

OLD = '''  const myProses:string[]=cfg.proses||[];'''

NEW = '''  const myProses:string[]=(user.sub_bagian&&cfg.subBagianProses?.[user.sub_bagian])||cfg.proses||[];'''

def main():
    shutil.copy(PATH, PATH + ".bak_myproses")
    print(f"[OK] Backup dibuat: {PATH}.bak_myproses")

    with open(PATH, "r", encoding="utf-8") as f:
        content = f.read()

    count = content.count(OLD)
    if count != 1:
        print(f"[FAIL] Pattern OLD ditemukan {count} kali (harus tepat 1). Tidak ada perubahan disimpan.")
        sys.exit(1)

    content = content.replace(OLD, NEW)

    with open(PATH, "w", encoding="utf-8") as f:
        f.write(content)

    print("[OK] myProses sekarang prioritaskan subBagianProses (kalau user login lewat sub-divisi)")
    print("Operator yang login sebagai 'Potong' cuma akan lihat task POTONG, bukan semua proses Mekanik")
    print("Divisi lain (Wiring Control, QC, dst yang TIDAK pakai sub-divisi) tetap berfungsi normal seperti biasa")
    print("Selanjutnya jalankan: npm run build")

if __name__ == "__main__":
    main()
