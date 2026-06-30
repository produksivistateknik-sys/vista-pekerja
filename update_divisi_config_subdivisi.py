import shutil
import sys

PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

OLD = '''  mekanik:    {label:"Mekanik",       icon:"🔧", color:"#d97706",bg:"#fffbeb",password:"mekanik123", proses:["POTONG","BENDING","STEL"]},
  painting:   {label:"Painting",      icon:"🎨", color:"#7c3aed",bg:"#f5f3ff",password:"painting123",proses:["PAINTING"]},
  assembling: {label:"Assembling",    icon:"⚙️", color:"#059669",bg:"#ecfdf5",password:"assemblling123",proses:["RAKIT","PASANG KOMPONEN","BUSBAR"]},'''

NEW = '''  mekanik:    {label:"Mekanik",       icon:"🔧", color:"#d97706",bg:"#fffbeb",proses:null,manualName:true,
    subBagianPassword:{Potong:"potong123",Bending:"bending123",Stel:"stel123"},
    subBagianProses:{Potong:["POTONG"],Bending:["BENDING"],Stel:["STEL"]}},
  painting:   {label:"Painting",      icon:"🎨", color:"#7c3aed",bg:"#f5f3ff",proses:null,manualName:true,
    subBagianPassword:{Rendam:"rendam123",Painting:"painting123"},
    subBagianProses:{Rendam:["RENDAM"],Painting:["PAINTING"]}},
  assembling: {label:"Assembling",    icon:"⚙️", color:"#059669",bg:"#ecfdf5",proses:null,manualName:true,
    subBagianPassword:{"Assembling Luar":"asmluar123","Assembling Dalam":"asmdalam123"},
    subBagianProses:{"Assembling Luar":["RAKIT","PASANG KOMPONEN"],"Assembling Dalam":["BUSBAR"]}},'''

def main():
    shutil.copy(PATH, PATH + ".bak_subdivisiconfig")
    print(f"[OK] Backup dibuat: {PATH}.bak_subdivisiconfig")

    with open(PATH, "r", encoding="utf-8") as f:
        content = f.read()

    count = content.count(OLD)
    if count != 1:
        print(f"[FAIL] Pattern OLD ditemukan {count} kali (harus tepat 1). Tidak ada perubahan disimpan.")
        sys.exit(1)

    content = content.replace(OLD, NEW)

    with open(PATH, "w", encoding="utf-8") as f:
        f.write(content)

    print("[OK] DIVISI_CONFIG mekanik/painting/assembling sekarang punya struktur sub-divisi")
    print("Mengikuti pola yang sama dengan divisi Komponen (manualName + subBagianPassword)")
    print("Selanjutnya jalankan: npm run build")

if __name__ == "__main__":
    main()
