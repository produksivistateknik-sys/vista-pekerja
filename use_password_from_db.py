import shutil
import sys

PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

OLD_1 = '''  const isManualName=!!(DIVISI_CONFIG as any)[div]?.manualName;
  const subBagianOptions=(DIVISI_CONFIG as any)[div]?.subBagianPassword;
  const [subBagianTerpilih,setSubBagianTerpilih]=useState<string|null>(null);

  const go=async()=>{
    if(isManualName&&subBagianOptions){
      if(!subBagianTerpilih){setErr("Pilih sub-bagian dulu!");return;}
      if(!username.trim()){setErr("Tulis nama kamu!");return;}
      if(!pwd){setErr("Masukkan password!");return;}
      setLoading(true);
      const expectedPwd=subBagianOptions[subBagianTerpilih];
      if(pwd!==expectedPwd){setErr("Password salah!");setLoading(false);return;}
      setSuccess(true);
      setTimeout(()=>onLogin({id:0,nama:username.trim(),name:username.trim(),divisi:div,sub_bagian:subBagianTerpilih}),800);
      setLoading(false);
      return;
    }'''

NEW_1 = '''  const isManualName=!!(DIVISI_CONFIG as any)[div]?.manualName;
  const subBagianOptions=(DIVISI_CONFIG as any)[div]?.subBagianPassword;
  const [subBagianTerpilih,setSubBagianTerpilih]=useState<string|null>(null);

  const go=async()=>{
    if(isManualName&&subBagianOptions){
      if(!subBagianTerpilih){setErr("Pilih sub-bagian dulu!");return;}
      if(!username.trim()){setErr("Tulis nama kamu!");return;}
      if(!pwd){setErr("Masukkan password!");return;}
      setLoading(true);
      const{data:pwRow,error:pwErr}=await supabase.from("fcs_sub_bagian_password").select("password").eq("sub_bagian",subBagianTerpilih).single();
      const expectedPwd=pwErr?subBagianOptions[subBagianTerpilih]:pwRow?.password;
      if(pwd!==expectedPwd){setErr("Password salah!");setLoading(false);return;}
      setSuccess(true);
      setTimeout(()=>onLogin({id:0,nama:username.trim(),name:username.trim(),divisi:div,sub_bagian:subBagianTerpilih}),800);
      setLoading(false);
      return;
    }'''

EDITS = [
    ("EDIT 1 (cek password dari database, fallback ke hardcoded kalau tabel error)", OLD_1, NEW_1),
]

def main():
    shutil.copy(PATH, PATH + ".bak_pwdfromdb")
    print(f"[OK] Backup dibuat: {PATH}.bak_pwdfromdb")

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
    print("  - Password sekarang dicek dari tabel fcs_sub_bagian_password di database")
    print("  - Kalau tabel gagal diakses (misal error koneksi), fallback ke password hardcoded di DIVISI_CONFIG (sebagai safety net)")
    print("  - Admin bisa ubah password kapan saja lewat UI Vista Teknik (akan dibuat di langkah berikutnya) tanpa perlu deploy ulang")
    print("Selanjutnya jalankan: npm run build")

if __name__ == "__main__":
    main()
