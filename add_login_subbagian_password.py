import shutil
import sys

PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

OLD_1 = '''  komponen:   {label:"Komponen",       icon:"package", color:"#0d9488",bg:"#f0fdfa",password:"komponen123",proses:null,manualName:true},'''

NEW_1 = '''  komponen:   {label:"Komponen",       icon:"package", color:"#0d9488",bg:"#f0fdfa",proses:null,manualName:true,
    subBagianPassword:{Warehouse:"warehouse123",Assembling:"assemblingkomp123",QS:"qs123",QC:"qckomp123"}},'''

OLD_2 = '''  const isManualName=!!(DIVISI_CONFIG as any)[div]?.manualName;

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
    }'''

NEW_2 = '''  const isManualName=!!(DIVISI_CONFIG as any)[div]?.manualName;
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
    }
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
    }'''

OLD_3 = '''  useEffect(()=>{
    if(div){
      supabase.from("operator_users").select("id,nama,username").eq("divisi",div).eq("is_active",true)
        .then(({data})=>{setUserList(data??[]);setUsername("");});
    }
  },[div]);'''

NEW_3 = '''  useEffect(()=>{
    if(div){
      supabase.from("operator_users").select("id,nama,username").eq("divisi",div).eq("is_active",true)
        .then(({data})=>{setUserList(data??[]);setUsername("");});
      setSubBagianTerpilih(null);
    }
  },[div]);'''

OLD_4 = '''          <div style={{height:1,background:"#f1f5f9",marginBottom:16}}/>
          {/* Nama */}
          <div style={{marginBottom:12}}>
            <div className="lg-label">Nama</div>'''

NEW_4 = '''          <div style={{height:1,background:"#f1f5f9",marginBottom:16}}/>
          {subBagianOptions&&(
            <div style={{marginBottom:16}}>
              <div className="lg-label">Sub-bagian</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap" as const}}>
                {Object.keys(subBagianOptions).map((sb:string)=>(
                  <button key={sb} type="button" onClick={()=>{setSubBagianTerpilih(sb);setErr("");}}
                    style={{flex:1,minWidth:90,padding:"9px 8px",borderRadius:8,
                      border:`1.5px solid ${subBagianTerpilih===sb?"#0d9488":"#e2e8f0"}`,
                      background:subBagianTerpilih===sb?"#0d948818":"#f8fafc",
                      color:subBagianTerpilih===sb?"#0d9488":"#64748b",
                      cursor:"pointer",fontWeight:700,fontSize:12}}>
                    {sb}
                  </button>
                ))}
              </div>
            </div>
          )}
          {/* Nama */}
          <div style={{marginBottom:12}}>
            <div className="lg-label">Nama</div>'''

EDITS = [
    ("EDIT 1 (4 password per sub-bagian)", OLD_1, NEW_1),
    ("EDIT 2 (logic go() pakai password sub-bagian)", OLD_2, NEW_2),
    ("EDIT 3 (reset subBagianTerpilih saat ganti divisi)", OLD_3, NEW_3),
    ("EDIT 4 (JSX pilihan sub-bagian saat login)", OLD_4, NEW_4),
]

def main():
    shutil.copy(PATH, PATH + ".bak_loginsubbagian")
    print(f"[OK] Backup dibuat: {PATH}.bak_loginsubbagian")

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
    print("  - Divisi Komponen sekarang: pilih sub-bagian dulu (Warehouse/Assembling/QS/QC), masing-masing password sendiri")
    print("  - Password: Warehouse=warehouse123, Assembling=assemblingkomp123, QS=qs123, QC=qckomp123")
    print("  - user object sekarang punya field sub_bagian yang terkunci sesuai password yang dipakai")
    print("Selanjutnya jalankan: npm run build")
    print("PERINGATAN: TrackingKomponenView BELUM diupdate untuk pakai user.sub_bagian - akan ada langkah lanjutan setelah ini")

if __name__ == "__main__":
    main()
