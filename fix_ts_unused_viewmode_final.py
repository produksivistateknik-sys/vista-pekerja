import shutil
from datetime import datetime

FILE_PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    content = f.read()

old = '''function OperatorView({user,viewMode}:any){
  const [viewDate,setViewDate]=useState(TODAY);'''
new = '''function OperatorView({user,viewMode}:any){
  void viewMode; // dipake nanti buat render mobile vs desktop
  const [viewDate,setViewDate]=useState(TODAY);'''

count = content.count(old)
print(f"Ditemukan: {count}x")

if count == 1:
    backup_path = FILE_PATH + f".bak_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    shutil.copy2(FILE_PATH, backup_path)
    print(f"Backup: {backup_path}")
    content = content.replace(old, new)
    with open(FILE_PATH, "w", encoding="utf-8") as f:
        f.write(content)
    print("BERHASIL! Lanjut npm run build.")
else:
    print("GAGAL - cek pattern")
