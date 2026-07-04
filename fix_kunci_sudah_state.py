import shutil
import sys

PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

# EDIT 1: Tambah state pernahDikunci
OLD_1 = "  const [lockMsg,setLockMsg]=useState(false);"
NEW_1 = "  const [lockMsg,setLockMsg]=useState(false);\n  const [pernahDikunci,setPernahDikunci]=useState(false);"

# EDIT 2: Set pernahDikunci=true saat kunci berhasil
OLD_2 = "      setLockedCells(newLocked);\n      setLockMsg(true);\n      setTimeout(()=>setLockMsg(false),2500);"
NEW_2 = "      setLockedCells(newLocked);\n      setLockMsg(true);\n      setPernahDikunci(true);\n      setTimeout(()=>setLockMsg(false),2500);"

# EDIT 3: Reset pernahDikunci saat tanggal berubah (viewDate change)
OLD_3 = "  useEffect(()=>{\n    loadData();"
NEW_3 = "  useEffect(()=>{\n    setPernahDikunci(false);\n    loadData();"

# EDIT 4: Warna tombol pakai pernahDikunci
OLD_4 = "              background:lockMsg||Object.keys(lockedCells).some(k=>k.includes(`_${viewDate}_`))?"
NEW_4 = "              background:lockMsg||pernahDikunci?"

# EDIT 5: Teks tombol pakai pernahDikunci
OLD_5 = '            {lockMsg?"✅ Progress hari ini berhasil dikunci & tersimpan!":Object.keys(lockedCells).some(k=>k.includes(`_${viewDate}_`))?"✅ Sudah Dikunci — Kunci Ulang":"🔒 Kunci Progress Hari Ini"}'
NEW_5 = '            {lockMsg?"✅ Progress hari ini berhasil dikunci & tersimpan!":pernahDikunci?"✅ Sudah Dikunci — Kunci Ulang":"🔒 Kunci Progress Hari Ini"}'

EDITS = [
    ("EDIT 1 (state pernahDikunci)", OLD_1, NEW_1),
    ("EDIT 2 (set pernahDikunci saat kunci)", OLD_2, NEW_2),
    ("EDIT 3 (reset pernahDikunci saat viewDate berubah)", OLD_3, NEW_3),
    ("EDIT 4 (warna tombol pakai pernahDikunci)", OLD_4, NEW_4),
    ("EDIT 5 (teks tombol pakai pernahDikunci)", OLD_5, NEW_5),
]

def main():
    shutil.copy(PATH, PATH + ".bak_pernahdikunci")
    print(f"[OK] Backup dibuat: {PATH}.bak_pernahdikunci")

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
    print("Tombol kunci sekarang tetap hijau setelah dikunci, reset saat pindah tanggal")
    print("Selanjutnya jalankan: npm run build")

if __name__ == "__main__":
    main()
