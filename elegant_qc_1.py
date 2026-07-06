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
        print(f"GAGAL [{label}]: pattern tidak ditemukan.")
        print(repr(old))
        sys.exit(1)
    if count > 1:
        print(f"GAGAL [{label}]: ditemukan {count}x.")
        sys.exit(1)
    print(f"OK [{label}]")
    return content.replace(old, new)


backup_path = FILE_PATH + f".bak_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
shutil.copy2(FILE_PATH, backup_path)
print(f"Backup: {backup_path}\n")

content = read_file()

old1 = '''const QC_ITEMS=[
  {key:"fisik",label:"Pemeriksaan Fisik",desc:"Kelayakan kualitas fisik panel"},
  {key:"spesifikasi",label:"Verifikasi Spesifikasi Komponen",desc:"Sesuai partlist"},
  {key:"baut",label:"Pengecekan Kekencangan Baut",desc:""},
  {key:"test",label:"QC Test",desc:"Tes elektrikal standar"},
];'''

new1 = '''const QC_ITEMS=[
  {key:"fisik",label:"Pemeriksaan Fisik",desc:"Kelayakan kualitas fisik panel",icon:"ti ti-eye"},
  {key:"spesifikasi",label:"Verifikasi Spesifikasi Komponen",desc:"Sesuai partlist",icon:"ti ti-list-details"},
  {key:"baut",label:"Pengecekan Kekencangan Baut",desc:"",icon:"ti ti-tool"},
  {key:"test",label:"QC Test",desc:"Tes elektrikal standar",icon:"ti ti-bolt"},
];'''

content = apply_edit(content, old1, new1, "Edit 1: Tambah icon QC_ITEMS")

old2 = '''                    <div style={{width:34,height:34,borderRadius:8,background:allDone?"#f0fdf4":"#eff6ff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <i className={allDone?"ti ti-check":"ti ti-package"} style={{fontSize:16,color:allDone?"#16a34a":"#2563eb"}}/>
                    </div>'''

new2 = '''                    <div style={{width:38,height:38,borderRadius:10,background:allDone?"linear-gradient(135deg,#4ade80,#16a34a)":"linear-gradient(135deg,#60a5fa,#2563eb)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:allDone?"0 3px 8px #16a34a33":"0 3px 8px #2563eb33"}}>
                      <i className={allDone?"ti ti-check":"ti ti-package"} style={{fontSize:17,color:"#fff"}}/>
                    </div>'''

content = apply_edit(content, old2, new2, "Edit 2: Gradient icon project list")

write_file(content)
print("\nBagian 1 berhasil! Lanjut bagian 2.")
