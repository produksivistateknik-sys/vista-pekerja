import shutil
import sys

PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

OLD_1 = '''function TrackingKomponenView(){
  const[namaOperator,setNamaOperator]=useState<string>(()=>localStorage.getItem("vista_tk_nama")||"");
  const[subBagian,setSubBagian]=useState<string>("Warehouse");'''

NEW_1 = '''function TrackingKomponenView({user}:any){
  const namaOperator=user?.nama||user?.name||"Operator";
  const[subBagian,setSubBagian]=useState<string>("Warehouse");'''

OLD_2 = '''    if(!namaOperator.trim()){alert("Isi nama kamu dulu");return;}
    if(!selectedWoId){alert("Pilih Work Order dulu");return;}
    if(files.length===0&&!catatan.trim()){alert("Lampirkan foto atau tulis catatan minimal salah satu");return;}
    localStorage.setItem("vista_tk_nama",namaOperator.trim());
    setUploading(true);'''

NEW_2 = '''    if(!selectedWoId){alert("Pilih Work Order dulu");return;}
    if(files.length===0&&!catatan.trim()){alert("Lampirkan foto atau tulis catatan minimal salah satu");return;}
    setUploading(true);'''

OLD_3 = '''      operator_name:namaOperator.trim(),'''
NEW_3 = '''      operator_name:namaOperator,'''

OLD_4 = '''      <div style={{fontWeight:800,fontSize:17,color:"#1e293b",marginBottom:4}}>📦 Tracking Komponen</div>
      <div style={{fontSize:12,color:"#64748b",marginBottom:16}}>Dokumentasi serah terima komponen antar bagian</div>

      <div style={{marginBottom:12}}>
        <Lbl>Nama Kamu</Lbl>
        <Inp value={namaOperator} onChange={(e:any)=>setNamaOperator(e.target.value)} placeholder="Tulis nama kamu..."/>
      </div>

      <div style={{marginBottom:12}}>
        <Lbl>Sub-bagian</Lbl>'''

NEW_4 = '''      <div style={{fontWeight:800,fontSize:17,color:"#1e293b",marginBottom:4}}>📦 Tracking Komponen</div>
      <div style={{fontSize:12,color:"#64748b",marginBottom:16}}>Halo {namaOperator}, dokumentasi serah terima komponen antar bagian</div>

      <div style={{marginBottom:12}}>
        <Lbl>Sub-bagian</Lbl>'''

OLD_5 = '''<TrackingKomponenView/>'''
NEW_5 = '''<TrackingKomponenView user={user}/>'''

EDITS = [
    ("EDIT 1 (ganti namaOperator jadi dari user.nama)", OLD_1, NEW_1),
    ("EDIT 2 (hapus validasi & localStorage nama manual)", OLD_2, NEW_2),
    ("EDIT 3 (operator_name pakai namaOperator langsung)", OLD_3, NEW_3),
    ("EDIT 4 (hapus field input Nama Kamu dari JSX)", OLD_4, NEW_4),
    ("EDIT 5 (kembalikan prop user di pemanggilan)", OLD_5, NEW_5),
]

def main():
    shutil.copy(PATH, PATH + ".bak_tknamafromuser")
    print(f"[OK] Backup dibuat: {PATH}.bak_tknamafromuser")

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
    print("  - Nama operator sekarang otomatis dari hasil login (user.nama), tidak perlu input manual lagi")
    print("  - Sapaan 'Halo {nama}' ditambahkan di header halaman")
    print("Selanjutnya jalankan: npm run build")

if __name__ == "__main__":
    main()
