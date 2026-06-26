import shutil
import sys

PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

OLD = '''function TrackingKomponenView({user}:any){'''
NEW = '''function TrackingKomponenView(){'''

def main():
    shutil.copy(PATH, PATH + ".bak_tkuserfix")
    print(f"[OK] Backup dibuat: {PATH}.bak_tkuserfix")

    with open(PATH, "r", encoding="utf-8") as f:
        content = f.read()

    count = content.count(OLD)
    if count != 1:
        print(f"[FAIL] Pattern OLD ditemukan {count} kali (harus tepat 1). Tidak ada perubahan disimpan.")
        sys.exit(1)

    content = content.replace(OLD, NEW)

    with open(PATH, "w", encoding="utf-8") as f:
        f.write(content)

    print("[OK] Parameter 'user' yang tidak terpakai dihapus dari TrackingKomponenView")
    print("Catatan: prop user={user} yang dikirim saat render tetap aman diabaikan oleh komponen, tidak perlu diubah di sisi pemanggilan")
    print("Selanjutnya jalankan: npm run build")

if __name__ == "__main__":
    main()
