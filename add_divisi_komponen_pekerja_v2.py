import shutil
import sys

PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

def main():
    with open(PATH, "r", encoding="utf-8") as f:
        lines = f.readlines()

    target_idx = None
    for i, line in enumerate(lines):
        if "nameplate:" in line and "Nameplate" in line and "password" in line:
            target_idx = i
            break

    if target_idx is None:
        print("[FAIL] Baris nameplate dengan password tidak ditemukan. Tidak ada perubahan disimpan.")
        sys.exit(1)

    print(f"[INFO] Baris nameplate ditemukan di nomor {target_idx+1}: {repr(lines[target_idx])}")

    next_line = lines[target_idx+1]
    if next_line.strip() != "};":
        print(f"[FAIL] Baris setelah nameplate bukan '}};' melainkan: {repr(next_line)}. Tidak ada perubahan disimpan, periksa manual.")
        sys.exit(1)

    already_has_komponen = any("komponen:" in l and "Komponen" in l and "password" in l for l in lines)
    if already_has_komponen:
        print("[INFO] Baris 'komponen' SUDAH ADA sebelumnya di DIVISI_CONFIG. Skip penambahan baris ini.")
    else:
        new_line_komponen = '  komponen:   {label:"Komponen",       icon:"package", color:"#0d9488",bg:"#f0fdfa",password:"komponen123",proses:null},\n'
        lines.insert(target_idx+1, new_line_komponen)
        print("[OK] Baris baru 'komponen' ditambahkan setelah nameplate")

    content = "".join(lines)

    OLD_2 = '''          {user.divisi==="nameplate"?<NameplateView user={user}/>:user.divisi==="qc"?<QCChecklistTab user={user}/>:<OperatorView user={user}/>}'''
    NEW_2 = '''          {user.divisi==="nameplate"?<NameplateView user={user}/>:user.divisi==="qc"?<QCChecklistTab user={user}/>:user.divisi==="komponen"?<TrackingKomponenView user={user}/>:<OperatorView user={user}/>}'''

    if NEW_2 in content:
        print("[INFO] Render TrackingKomponenView SUDAH ADA sebelumnya. Skip.")
    else:
        count_2 = content.count(OLD_2)
        if count_2 != 1:
            print(f"[FAIL] Pattern render OperatorView ditemukan {count_2} kali (harus tepat 1).")
            with open(PATH, "w", encoding="utf-8") as f:
                f.write(content)
            print("[OK] (Perubahan baris komponen di DIVISI_CONFIG tetap disimpan)")
            sys.exit(1)
        content = content.replace(OLD_2, NEW_2)
        print("[OK] Render TrackingKomponenView ditambahkan untuk divisi komponen")

    shutil.copy(PATH, PATH + ".bak_divisikomponenpekerja2")
    print(f"[OK] Backup dibuat: {PATH}.bak_divisikomponenpekerja2")

    with open(PATH, "w", encoding="utf-8") as f:
        f.write(content)

    print("")
    print("[OK] SELESAI")
    print("Selanjutnya jalankan: npm run build")

if __name__ == "__main__":
    main()
