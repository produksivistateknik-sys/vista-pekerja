import shutil
import sys

PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

def main():
    with open(PATH, "r", encoding="utf-8") as f:
        lines = f.readlines()

    target_idx = None
    for i, line in enumerate(lines):
        if "komponen:" in line and "Komponen" in line and 'icon:"package"' in line:
            target_idx = i
            break

    if target_idx is None:
        print("[FAIL] Baris dengan komponen + icon:\"package\" tidak ditemukan. Tidak ada perubahan disimpan.")
        sys.exit(1)

    print(f"[INFO] Baris ditemukan di nomor {target_idx+1}: {repr(lines[target_idx])}")

    shutil.copy(PATH, PATH + ".bak_iconpackagefix")
    print(f"[OK] Backup dibuat: {PATH}.bak_iconpackagefix")

    lines[target_idx] = lines[target_idx].replace('icon:"package"', 'icon:"\U0001F4E6"')

    with open(PATH, "w", encoding="utf-8") as f:
        f.writelines(lines)

    print(f"[OK] Baris {target_idx+1} berhasil diubah, icon:\"package\" -> emoji kotak")
    print("Selanjutnya jalankan: npm run build")

if __name__ == "__main__":
    main()
