import shutil
import sys
import os

PATH = r"C:\Users\User\vista-pekerja\src\index.css"
BACKUP_PATH = PATH + ".bak_rootfix"

def main():
    if not os.path.exists(BACKUP_PATH):
        print(f"[FAIL] Backup tidak ditemukan di {BACKUP_PATH}")
        print("Tidak bisa restore otomatis. Periksa manual.")
        sys.exit(1)

    shutil.copy(PATH, PATH + ".bak_beforerestore")
    print(f"[OK] Backup kondisi saat ini dibuat: {PATH}.bak_beforerestore")

    shutil.copy(BACKUP_PATH, PATH)
    print(f"[OK] index.css dikembalikan ke kondisi sebelum perubahan #root kemarin")
    print("Selanjutnya jalankan: npm run build")

if __name__ == "__main__":
    main()
