import shutil
import sys

PATH = r"C:\Users\User\vista-pekerja\src\index.css"

OLD = '''#root {
  width: 1126px;
  max-width: 100%;
  margin: 0 auto;
  text-align: center;
  border-inline: 1px solid var(--border);
  min-height: 100svh;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}'''

NEW = '''#root {
  width: 100%;
  min-height: 100svh;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}'''

def main():
    shutil.copy(PATH, PATH + ".bak_rootfix")
    print(f"[OK] Backup dibuat: {PATH}.bak_rootfix")

    with open(PATH, "r", encoding="utf-8") as f:
        content = f.read()

    count = content.count(OLD)
    if count != 1:
        print(f"[FAIL] Pattern OLD ditemukan {count} kali (harus tepat 1). Tidak ada perubahan disimpan.")
        sys.exit(1)

    content = content.replace(OLD, NEW)

    with open(PATH, "w", encoding="utf-8") as f:
        f.write(content)

    print("[OK] Berhasil diubah:")
    print("  - #root sekarang full-width (width:100%), tidak dibatasi 1126px lagi")
    print("  - border-inline (garis pembatas kiri-kanan) dihapus")
    print("  - text-align:center dihapus (sisa template, tidak relevan untuk aplikasi kita)")
    print("Selanjutnya jalankan: npm run build")

if __name__ == "__main__":
    main()
