import shutil
import sys

PATH = r"C:\Users\User\vista-pekerja\src\index.css"

OLD = '''body {
  margin: 0;
}'''

NEW = '''body {
  margin: 0;
  width: 100%;
  overflow-x: hidden;
}'''

def main():
    shutil.copy(PATH, PATH + ".bak_overflowfix")
    print(f"[OK] Backup dibuat: {PATH}.bak_overflowfix")

    with open(PATH, "r", encoding="utf-8") as f:
        content = f.read()

    count = content.count(OLD)
    if count != 1:
        print(f"[FAIL] Pattern OLD ditemukan {count} kali (harus tepat 1). Tidak ada perubahan disimpan.")
        sys.exit(1)

    content = content.replace(OLD, NEW)

    with open(PATH, "w", encoding="utf-8") as f:
        f.write(content)

    print("[OK] Berhasil ditambahkan overflow-x:hidden di body")
    print("Ini menyembunyikan scroll horizontal kecil tanpa mempengaruhi layout/tampilan apapun")
    print("Selanjutnya jalankan: npm run build")

if __name__ == "__main__":
    main()
