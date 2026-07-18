# -*- coding: utf-8 -*-
"""
Script: apply_potong_rendam_painting_qty.py
Tujuan: POTONG, RENDAM, PAINTING sekarang pakai mode qty (isi angka pcs,
        otomatis kehitung persentasenya) kayak Bending/Stel - bukan lagi
        mode batch (step 25/50/75/100%).

Cara pakai:
    python apply_potong_rendam_painting_qty.py
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

    old = "    POTONG:'batch',RENDAM:'batch',PAINTING:'batch',\n"
    new = "    POTONG:'qty',RENDAM:'qty',PAINTING:'qty',\n"

    count = content.count(old)
    if count == 0:
        fail("Tidak ketemu baris PROSES_CARD_MODE POTONG/RENDAM/PAINTING. Struktur mungkin sudah berubah - kirim ulang dump terbaru.")
    if count > 1:
        fail(f"Baris itu muncul {count} kali (harusnya cuma 1) - perlu dicek manual dulu.")

    new_content = content.replace(old, new)

    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = FILE_PATH + f".bak_{ts}"
    shutil.copy2(FILE_PATH, backup_path)
    print(f"✅ Backup dibuat: {backup_path}")

    with open(FILE_PATH, "w", encoding="utf-8") as f:
        f.write(new_content)

    print("✅ Berhasil diubah: POTONG, RENDAM, PAINTING sekarang mode qty (bukan batch/step %).")
    print("\nLangkah selanjutnya:")
    print("   npm run build")

if __name__ == "__main__":
    main()
