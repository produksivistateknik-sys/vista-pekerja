import shutil
import sys

PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

# Cari teks yang unik di sekitar baris 1265 (di dalam OperatorView)
# Pakai konteks 2 baris sebelumnya supaya pattern unik
OLD = '''  const cfg=DIVISI_CONFIG[user.divisi];
  const isQtyBased=QTY_DIVISI.includes(user.divisi);
  const myProses:string[]=cfg.proses||[];'''

NEW = '''  const cfg=DIVISI_CONFIG[user.divisi];
  const isQtyBased=QTY_DIVISI.includes(user.divisi);
  const myProses:string[]=(user.sub_bagian&&cfg.subBagianProses?.[user.sub_bagian])||cfg.proses||[];'''

def main():
    shutil.copy(PATH, PATH + ".bak_myprosesoperator")
    print(f"[OK] Backup dibuat: {PATH}.bak_myprosesoperator")

    with open(PATH, "r", encoding="utf-8") as f:
        content = f.read()

    count = content.count(OLD)
    if count != 1:
        print(f"[FAIL] Pattern OLD ditemukan {count} kali (harus tepat 1). Tidak ada perubahan disimpan.")
        sys.exit(1)

    content = content.replace(OLD, NEW)

    with open(PATH, "w", encoding="utf-8") as f:
        f.write(content)

    print("[OK] myProses di OperatorView sekarang pakai subBagianProses kalau user login lewat sub-divisi")
    print("Operator Rendam akan lihat task RENDAM, Potong lihat POTONG, dst")
    print("Selanjutnya jalankan: npm run build")

if __name__ == "__main__":
    main()
