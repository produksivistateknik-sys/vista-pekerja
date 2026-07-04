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

old1 = '''  const [wiringInfoMap,setWiringInfoMap]=useState<Record<string,any>>({});
  const [komponenInfoMap,setKomponenInfoMap]=useState<Record<string,any>>({});'''

new1 = '''  const [wiringInfoMap,setWiringInfoMap]=useState<Record<string,any>>({});'''

content = apply_edit(content, old1, new1, "Hapus declaration komponenInfoMap")

write_file(content)
print("\n🎉 Berhasil! Lanjut: npm run build lagi.")
