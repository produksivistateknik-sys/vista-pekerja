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
  {key:"fisik",label:"Pemeriksaan Fisik",desc:"Kelayakan kualitas fisik panel",icon:"ti ti-eye"},
  {key:"spesifikasi",label:"Verifikasi Spesifikasi Komponen",desc:"Sesuai partlist",icon:"ti ti-list-details"},
  {key:"baut",label:"Pengecekan Kekencangan Baut",desc:"",icon:"ti ti-tool"},
  {key:"test",label:"QC Test",desc:"Tes elektrikal standar",icon:"ti ti-bolt"},
];'''

new1 = '''const QC_ITEMS=[
  {key:"fisik",label:"Pemeriksaan Fisik",desc:"Kelayakan kualitas fisik panel",icon:"🔍"},
  {key:"spesifikasi",label:"Verifikasi Spesifikasi Komponen",desc:"Sesuai partlist",icon:"📋"},
  {key:"baut",label:"Pengecekan Kekencangan Baut",desc:"",icon:"🔧"},
  {key:"test",label:"QC Test",desc:"Tes elektrikal standar",icon:"⚡"},
];'''

content = apply_edit(content, old1, new1, "Edit 1: Ganti icon QC_ITEMS jadi emoji")

old2 = '''                        <div style={{width:26,height:26,borderRadius:8,background:"#fff",border:"1px solid #e2e8f0",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                          <i className={item.icon} style={{fontSize:13,color:"#475569"}}/>
                        </div>'''

new2 = '''                        <div style={{width:26,height:26,borderRadius:8,background:"#fff",border:"1px solid #e2e8f0",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:13}}>
                          {item.icon}
                        </div>'''

content = apply_edit(content, old2, new2, "Edit 2: Render icon sebagai emoji text")

write_file(content)
print("\nBerhasil! Lanjut npm run build.")
