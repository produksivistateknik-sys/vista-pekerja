# -*- coding: utf-8 -*-
"""
Script: apply_realtime_progress.py
Tujuan: updateQtyProses() dan updatePctManual() sekarang LANGSUNG nulis ke
        Supabase (tabel panels) tiap kali operator update progress - gak
        nunggu tombol Kunci/Simpan Progress lagi. Data langsung realtime
        kelihatan di Vista Teknik.

Cara pakai:
    python apply_realtime_progress.py
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

    if "// update local + realtime ke Supabase" in content:
        fail("Perubahan sepertinya sudah pernah diterapkan.")

    old_qty = '''    // update local
    setPanelsMap(prev=>({...prev,[panelId]:{...panel,checklist:newChecklist}}));
  };
'''
    new_qty = '''    // update local + realtime ke Supabase
    setPanelsMap(prev=>({...prev,[panelId]:{...panel,checklist:newChecklist}}));
    await supabase.from("panels").update({checklist:newChecklist}).eq("id",panelId);
  };
'''
    count_qty = content.count(old_qty)
    if count_qty == 0:
        fail("Tidak ketemu blok penutup updateQtyProses persis seperti yang diharapkan. Struktur mungkin sudah berubah - kirim ulang dump terbaru.")
    if count_qty > 1:
        fail(f"Blok itu muncul {count_qty} kali (harusnya cuma 1) - perlu dicek manual dulu.")
    content = content.replace(old_qty, new_qty)

    old_pct = '''    setPanelsMap(prev=>({...prev,[panelId]:{...panel,checklist:newChecklist}}));
  };

  // Kunci progress — simpan ke Supabase'''
    new_pct = '''    setPanelsMap(prev=>({...prev,[panelId]:{...panel,checklist:newChecklist}}));
    await supabase.from("panels").update({checklist:newChecklist}).eq("id",panelId);
  };

  // Kunci progress — simpan ke Supabase'''
    count_pct = content.count(old_pct)
    if count_pct == 0:
        fail("Tidak ketemu blok penutup updatePctManual persis seperti yang diharapkan. Struktur mungkin sudah berubah - kirim ulang dump terbaru.")
    if count_pct > 1:
        fail(f"Blok itu muncul {count_pct} kali (harusnya cuma 1) - perlu dicek manual dulu.")
    content = content.replace(old_pct, new_pct)

    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = FILE_PATH + f".bak_{ts}"
    shutil.copy2(FILE_PATH, backup_path)
    print(f"✅ Backup dibuat: {backup_path}")

    with open(FILE_PATH, "w", encoding="utf-8") as f:
        f.write(content)

    print("✅ Berhasil diubah: updateQtyProses & updatePctManual sekarang langsung nulis ke Supabase")
    print("   (panels.checklist) setiap kali dipanggil - realtime, gak nunggu Kunci/Simpan Progress.")
    print("\nLangkah selanjutnya:")
    print("   npm run build")

if __name__ == "__main__":
    main()
