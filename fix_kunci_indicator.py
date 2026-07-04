import shutil
import sys

PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

# Ganti timeout reset lockMsg - biarkan true, reset hanya saat ada update progress baru
OLD = '''              background:lockMsg?"#16a34a":"#1d4ed8",color:"#fff",'''

NEW = '''              background:lockMsg||Object.keys(lockedCells).some(k=>k.includes(`_${viewDate}_`))?"#16a34a":"#1d4ed8",color:"#fff",'''

OLD_2 = '''            {lockMsg?"✅ Progress hari ini berhasil dikunci & tersimpan!":"🔒 Kunci Progress Hari Ini"}'''

NEW_2 = '''            {lockMsg?"✅ Progress hari ini berhasil dikunci & tersimpan!":Object.keys(lockedCells).some(k=>k.includes(`_${viewDate}_`))?"✅ Sudah Dikunci — Kunci Ulang":"🔒 Kunci Progress Hari Ini"}'''

EDITS = [
    ("EDIT 1 (warna tombol hijau kalau ada lockedCells hari ini)", OLD, NEW),
    ("EDIT 2 (teks tombol sudah dikunci)", OLD_2, NEW_2),
]

def main():
    shutil.copy(PATH, PATH + ".bak_kunciindicator")
    print(f"[OK] Backup dibuat: {PATH}.bak_kunciindicator")

    with open(PATH, "r", encoding="utf-8") as f:
        content = f.read()

    failed = []
    for name, old, new in EDITS:
        count = content.count(old)
        if count != 1:
            failed.append((name, count))

    if failed:
        print("[FAIL] Ada pattern yang tidak ditemukan tepat 1 kali. Tidak ada perubahan disimpan.")
        for name, count in failed:
            print(f"  - {name}: ditemukan {count} kali")
        sys.exit(1)

    for name, old, new in EDITS:
        content = content.replace(old, new)
        print(f"[OK] {name} berhasil diterapkan")

    with open(PATH, "w", encoding="utf-8") as f:
        f.write(content)

    print("\n[OK] SEMUA EDIT BERHASIL")
    print("Tombol kunci sekarang tetap hijau selama ada lockedCells untuk hari ini")
    print("Bisa diklik lagi untuk kunci ulang progress yang berubah (tidak double-count)")
    print("Selanjutnya jalankan: npm run build")

if __name__ == "__main__":
    main()
