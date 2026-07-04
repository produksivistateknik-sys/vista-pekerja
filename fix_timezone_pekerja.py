import shutil
import sys
from datetime import datetime

FILE_PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

def read_file():
    with open(FILE_PATH, "r", encoding="utf-8") as f:
        return f.read()

def write_file(content):
    with open(FILE_PATH, "w", encoding="utf-8") as f:
        f.write(content)

def apply_edit(content, old, new, label):
    count = content.count(old)
    if count == 0:
        print(f"❌ GAGAL [{label}]: pattern tidak ditemukan. Tidak ada perubahan disimpan.")
        print("---- Pattern yang dicari ----")
        print(old)
        sys.exit(1)
    if count > 1:
        print(f"❌ GAGAL [{label}]: pattern ditemukan {count}x (harus unik/1x). Tidak ada perubahan disimpan.")
        sys.exit(1)
    print(f"✅ [{label}] pattern ditemukan 1x, mengganti...")
    return content.replace(old, new)


backup_path = FILE_PATH + f".bak_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
shutil.copy2(FILE_PATH, backup_path)
print(f"📦 Backup dibuat: {backup_path}\n")

content = read_file()

# ── EDIT 1: Tambah helper getLocalDateStr + fix TODAY constant ──
old1 = '''const TODAY = new Date().toISOString().slice(0,10);'''

new1 = '''function getLocalDateStr(d:Date=new Date()){
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,"0");
  const day=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
const TODAY = getLocalDateStr();'''

content = apply_edit(content, old1, new1, "Edit 1: Fix TODAY constant + tambah helper")

# ── EDIT 2: Fix hariIni di notifikasi (pakai new Date() langsung, buggy pas dini hari) ──
old2 = '''    const hariIni=new Date().toISOString().slice(0,10);'''
new2 = '''    const hariIni=getLocalDateStr();'''

content = apply_edit(content, old2, new2, "Edit 2: Fix hariIni notifikasi")

write_file(content)
print("\n🎉 Fix bug timezone berhasil diterapkan!")
print(f"   Backup asli ada di: {backup_path}")
print("   Catatan: fungsi addDays() TIDAK diubah karena sudah aman (round-trip dari tanggal existing).")
print("   Lanjut: npm run build.")
