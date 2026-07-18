# -*- coding: utf-8 -*-
"""
Script: apply_qty_kosong_bukan_nol.py
Tujuan: Input qty (baik di kartu mobile maupun tabel desktop) sekarang mulai
        KOSONG kalau nilainya 0, bukan nampilin angka "0" - biar gak
        membingungkan (sama polanya kayak yang udah dipake di form Manajemen
        WO).

Cara pakai:
    python apply_qty_kosong_bukan_nol.py
"""
import shutil
import datetime
import sys

FILE_PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

def fail(msg):
    print("\n❌ GAGAL:", msg)
    print("Tidak ada perubahan yang disimpan. File asli aman.")
    sys.exit(1)

def main():
    try:
        with open(FILE_PATH, "r", encoding="utf-8") as f:
            content = f.read()
    except FileNotFoundError:
        fail(f"File tidak ditemukan di {FILE_PATH}")

    if 'value={r.qtyProses===0?"":r.qtyProses}' in content:
        fail("Perubahan sepertinya sudah pernah diterapkan.")

    old = 'value={r.qtyProses}'
    new = 'value={r.qtyProses===0?"":r.qtyProses}'

    count = content.count(old)
    if count == 0:
        fail("Tidak ketemu 'value={r.qtyProses}'. Struktur mungkin sudah berubah - kirim ulang dump terbaru.")
    if count != 2:
        fail(f"Ketemu {count} kali (dugaan saya harusnya 2 - mobile & desktop) - perlu dicek manual dulu biar gak salah ganti.")

    new_content = content.replace(old, new)

    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = FILE_PATH + f".bak_{ts}"
    shutil.copy2(FILE_PATH, backup_path)
    print(f"✅ Backup dibuat: {backup_path}")

    with open(FILE_PATH, "w", encoding="utf-8") as f:
        f.write(new_content)

    print(f"✅ Berhasil diubah {count} titik: input qty sekarang kosong kalau nilainya 0.")
    print("\nLangkah selanjutnya:")
    print("   npm run build")

if __name__ == "__main__":
    main()
