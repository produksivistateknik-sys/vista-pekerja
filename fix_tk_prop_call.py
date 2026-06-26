import shutil
import sys

PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

OLD = '''<TrackingKomponenView user={user}/>'''
NEW = '''<TrackingKomponenView/>'''

def main():
    shutil.copy(PATH, PATH + ".bak_tkpropfix")
    print(f"[OK] Backup dibuat: {PATH}.bak_tkpropfix")

    with open(PATH, "r", encoding="utf-8") as f:
        content = f.read()

    count = content.count(OLD)
    if count != 1:
        print(f"[FAIL] Pattern OLD ditemukan {count} kali (harus tepat 1). Tidak ada perubahan disimpan.")
        sys.exit(1)

    content = content.replace(OLD, NEW)

    with open(PATH, "w", encoding="utf-8") as f:
        f.write(content)

    print("[OK] Prop user={user} dihapus dari pemanggilan TrackingKomponenView")
    print("Selanjutnya jalankan: npm run build")

if __name__ == "__main__":
    main()
