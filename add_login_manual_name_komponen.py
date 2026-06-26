import shutil
import sys

PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

OLD_1 = '''  komponen:   {label:"Komponen",       icon:"package", color:"#0d9488",bg:"#f0fdfa",password:"komponen123",proses:null},'''

NEW_1 = '''  komponen:   {label:"Komponen",       icon:"package", color:"#0d9488",bg:"#f0fdfa",password:"komponen123",proses:null,manualName:true},'''

OLD_2 = '''  const go=async()=>{
    if(!username){setErr("Pilih nama!");return;}
    if(!pwd){setErr("Masukkan password!");return;}
    setLoading(true);
    const{data,error}=await supabase.from("operator_users").select("*")
      .eq("username",username).eq("password",pwd).eq("is_active",true).single();
    if(error||!data){setErr("Password salah!");setLoading(false);return;}
    await supabase.from("operator_users").update({last_login:new Date().toISOString()}).eq("id",data.id);
    setSuccess(true);
    setTimeout(()=>onLogin({...data,name:data.nama}),800);
    setLoading(false);
  };'''

NEW_2 = '''  const isManualName=!!(DIVISI_CONFIG as any)[div]?.manualName;

  const go=async()=>{
    if(isManualName){
      if(!username.trim()){setErr("Tulis nama kamu!");return;}
      if(!pwd){setErr("Masukkan password!");return;}
      setLoading(true);
      const expectedPwd=(DIVISI_CONFIG as any)[div]?.password;
      if(pwd!==expectedPwd){setErr("Password salah!");setLoading(false);return;}
      setSuccess(true);
      setTimeout(()=>onLogin({id:0,nama:username.trim(),name:username.trim(),divisi:div}),800);
      setLoading(false);
      return;
    }
    if(!username){setErr("Pilih nama!");return;}
    if(!pwd){setErr("Masukkan password!");return;}
    setLoading(true);
    const{data,error}=await supabase.from("operator_users").select("*")
      .eq("username",username).eq("password",pwd).eq("is_active",true).single();
    if(error||!data){setErr("Password salah!");setLoading(false);return;}
    await supabase.from("operator_users").update({last_login:new Date().toISOString()}).eq("id",data.id);
    setSuccess(true);
    setTimeout(()=>onLogin({...data,name:data.nama}),800);
    setLoading(false);
  };'''

OLD_3 = '''          <div style={{marginBottom:12}}>
            <div className="lg-label">Nama</div>
            <div style={{position:"relative"}}>
              <span className="lg-icon">👤</span>
              <select className="lg-sel" value={username} onChange={(e:any)=>{setUsername(e.target.value);setErr("");}}>
                <option value="">-- Pilih Nama --</option>
                {userList.map((u:any)=><option key={u.id} value={u.username}>{u.nama}</option>)}
              </select>
              <span style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",fontSize:11,color:"#94a3b8",pointerEvents:"none"}}>▼</span>
            </div>'''

NEW_3 = '''          <div style={{marginBottom:12}}>
            <div className="lg-label">Nama</div>
            <div style={{position:"relative"}}>
              <span className="lg-icon">👤</span>
              {isManualName?(
                <input className="lg-sel" value={username} onChange={(e:any)=>{setUsername(e.target.value);setErr("");}}
                  placeholder="Tulis nama kamu..."/>
              ):(
                <>
                  <select className="lg-sel" value={username} onChange={(e:any)=>{setUsername(e.target.value);setErr("");}}>
                    <option value="">-- Pilih Nama --</option>
                    {userList.map((u:any)=><option key={u.id} value={u.username}>{u.nama}</option>)}
                  </select>
                  <span style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",fontSize:11,color:"#94a3b8",pointerEvents:"none"}}>▼</span>
                </>
              )}
            </div>'''

EDITS = [
    ("EDIT 1 (tambah manualName flag ke divisi komponen)", OLD_1, NEW_1),
    ("EDIT 2 (logic go() dengan cabang manual name)", OLD_2, NEW_2),
    ("EDIT 3 (JSX input nama manual vs dropdown)", OLD_3, NEW_3),
]

def main():
    shutil.copy(PATH, PATH + ".bak_loginkomponenmanual")
    print(f"[OK] Backup dibuat: {PATH}.bak_loginkomponenmanual")

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
    print("  - Divisi Komponen sekarang punya flag manualName:true di DIVISI_CONFIG")
    print("  - Saat divisi manualName dipilih: field Nama jadi input teks bebas (bukan dropdown)")
    print("  - Password dicek dari DIVISI_CONFIG[div].password, BUKAN dari tabel operator_users")
    print("  - Divisi lain (mekanik, painting, dst) TIDAK terpengaruh, tetap pakai operator_users seperti biasa")
    print("Selanjutnya jalankan: npm run build")

if __name__ == "__main__":
    main()
