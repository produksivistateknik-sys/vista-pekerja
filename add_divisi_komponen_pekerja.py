import shutil
import sys

PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

OLD_1 = '''  nameplate:  {label:"Nameplate",     icon:"🏷️", color:"#0891b2",bg:"#ecfeff",password:"nameplaate123",proses:null},
};'''

NEW_1 = '''  nameplate:  {label:"Nameplate",     icon:"🏷️", color:"#0891b2",bg:"#ecfeff",password:"nameplaate123",proses:null},
  komponen:   {label:"Komponen",       icon:"📦", color:"#0d9488",bg:"#f0fdfa",password:"komponen123",proses:null},
};'''

OLD_2 = '''          {user.divisi==="nameplate"?<NameplateView user={user}/>:user.divisi==="qc"?<QCChecklistTab user={user}/>:<OperatorView user={user}/>}'''

NEW_2 = '''          {user.divisi==="nameplate"?<NameplateView user={user}/>:user.divisi==="qc"?<QCChecklistTab user={user}/>:user.divisi==="komponen"?<TrackingKomponenView user={user}/>:<OperatorView user={user}/>}'''

EDITS = [
    ("EDIT 1 (tambah divisi komponen ke DIVISI_CONFIG)", OLD_1, NEW_1),
    ("EDIT 2 (render TrackingKomponenView saat divisi komponen)", OLD_2, NEW_2),
]

def main():
    shutil.copy(PATH, PATH + ".bak_divisikomponenpekerja")
    print(f"[OK] Backup dibuat: {PATH}.bak_divisikomponenpekerja")

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

    print("")
    print("[OK] SEMUA EDIT BERHASIL DITERAPKAN")
    print("Ringkasan:")
    print("  - Divisi 'komponen' ditambahkan ke DIVISI_CONFIG dengan password 'komponen123'")
    print("  - Saat login dengan divisi komponen, otomatis render TrackingKomponenView")
    print("Selanjutnya jalankan: npm run build")

if __name__ == "__main__":
    main()
