import shutil
import sys

PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

OLD = '''            <span style={{background:cfg?.bg,color:cfg?.color,border:`1px solid ${cfg?.color}30`,
              borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>{cfg?.icon} {cfg?.label}</span>'''

NEW = '''            <span style={{background:cfg?.bg,color:cfg?.color,border:`1px solid ${cfg?.color}30`,
              borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>{cfg?.icon} {user.sub_bagian||cfg?.label}</span>'''

def main():
    shutil.copy(PATH, PATH + ".bak_badgesubdivisi")
    print(f"[OK] Backup dibuat: {PATH}.bak_badgesubdivisi")

    with open(PATH, "r", encoding="utf-8") as f:
        content = f.read()

    count = content.count(OLD)
    if count != 1:
        print(f"[FAIL] Pattern OLD ditemukan {count} kali (harus tepat 1). Tidak ada perubahan disimpan.")
        sys.exit(1)

    content = content.replace(OLD, NEW)

    with open(PATH, "w", encoding="utf-8") as f:
        f.write(content)

    print("[OK] Badge header sekarang menampilkan nama sub-divisi (misal 'Rendam') kalau user login lewat sub-divisi")
    print("Kalau tidak ada sub-divisi (Wiring Control, QC, dst), tetap tampil label divisi seperti biasa")
    print("Selanjutnya jalankan: npm run build")

if __name__ == "__main__":
    main()
