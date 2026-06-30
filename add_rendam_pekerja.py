import shutil
import sys

PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

OLD = '''  "POTONG":"#f59e0b","BENDING":"#10b981","STEL":"#3b82f6","PAINTING":"#8b5cf6",'''

NEW = '''  "POTONG":"#f59e0b","BENDING":"#10b981","STEL":"#3b82f6","RENDAM":"#0ea5e9","PAINTING":"#8b5cf6",'''

def main():
    shutil.copy(PATH, PATH + ".bak_rendam")
    print(f"[OK] Backup dibuat: {PATH}.bak_rendam")

    with open(PATH, "r", encoding="utf-8") as f:
        content = f.read()

    count = content.count(OLD)
    if count != 1:
        print(f"[FAIL] Pattern OLD ditemukan {count} kali (harus tepat 1). Tidak ada perubahan disimpan.")
        sys.exit(1)

    content = content.replace(OLD, NEW)

    with open(PATH, "w", encoding="utf-8") as f:
        f.write(content)

    print("[OK] PROSES_COLOR berhasil ditambahkan RENDAM (#0ea5e9, biru langit - sama dengan Vista Teknik)")
    print("Catatan: konfigurasi divisi mekanik/painting/assembling BELUM diubah - akan diurus di Bagian 2 (sub-divisi)")
    print("Selanjutnya jalankan: npm run build")

if __name__ == "__main__":
    main()
