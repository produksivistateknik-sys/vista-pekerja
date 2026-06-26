import shutil
import sys

PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

OLD_1 = '''function TrackingKomponenView({user}:any){
  const namaOperator=user?.nama||user?.name||"Operator";
  const[subBagian,setSubBagian]=useState<string>("Warehouse");'''

NEW_1 = '''function TrackingKomponenView({user}:any){
  const namaOperator=user?.nama||user?.name||"Operator";
  const subBagian:string=user?.sub_bagian||"Warehouse";'''

OLD_2 = '''      <div style={{marginBottom:12}}>
        <Lbl>Sub-bagian</Lbl>
        <div style={{display:"flex",gap:8,flexWrap:"wrap" as const}}>
          {["Warehouse","Assembling","QS","QC"].map(sb=>(
            <button key={sb} onClick={()=>setSubBagian(sb)}
              style={{flex:1,minWidth:80,padding:"10px 8px",borderRadius:10,border:`2px solid ${subBagian===sb?"#0d9488":"#e2e8f0"}`,
                background:subBagian===sb?"#0d948818":"#f8fafc",color:subBagian===sb?"#0d9488":"#64748b",
                cursor:"pointer",fontWeight:700,fontSize:13,textAlign:"center" as const}}>
              {subBagianIcon[sb]} {sb}
            </button>
          ))}
        </div>
      </div>

      <div style={{marginBottom:12}}>
        <Lbl>Work Order</Lbl>'''

NEW_2 = '''      <div style={{marginBottom:12,display:"flex",alignItems:"center",gap:8,background:"#f0fdfa",border:"1px solid #99f6e4",borderRadius:8,padding:"8px 12px"}}>
        <span style={{fontSize:18}}>{subBagianIcon[subBagian]}</span>
        <div>
          <div style={{fontSize:10,color:"#0d9488",fontWeight:700,textTransform:"uppercase" as const,letterSpacing:.4}}>Sub-bagian Anda</div>
          <div style={{fontSize:14,fontWeight:700,color:"#0f766e"}}>{subBagian}</div>
        </div>
      </div>

      <div style={{marginBottom:12}}>
        <Lbl>Work Order</Lbl>'''

OLD_3 = '''                <div key={r.id} style={{background:"#fff",border:"1px solid #e2e8f0",borderLeft:"3px solid #0d9488",borderRadius:10,padding:"12px 14px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:4}}>
                    <span style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>{subBagianIcon[r.sub_bagian]} {r.sub_bagian}</span>
                    <span style={{fontSize:11,color:"#94a3b8"}}>{fmtDateTime(r.created_at)}</span>
                  </div>
                  <div style={{fontSize:12,color:"#64748b",marginBottom:6}}>oleh {r.operator_name}</div>
                  {r.catatan&&<div style={{fontSize:13,color:"#334155",marginBottom:8}}>{r.catatan}</div>}'''

NEW_3 = '''                <div key={r.id} style={{background:"#fff",border:"1px solid #e2e8f0",borderLeft:"3px solid #0d9488",borderRadius:10,padding:"14px 16px",textAlign:"left" as const}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:4}}>
                    <span style={{fontWeight:700,fontSize:14,color:"#1e293b",textAlign:"left" as const}}>{subBagianIcon[r.sub_bagian]} {r.sub_bagian}</span>
                    <span style={{fontSize:11,color:"#94a3b8"}}>{fmtDateTime(r.created_at)}</span>
                  </div>
                  <div style={{fontSize:12,color:"#64748b",marginBottom:8,textAlign:"left" as const}}>oleh {r.operator_name}</div>
                  {r.catatan&&<div style={{fontSize:14,color:"#1e293b",marginBottom:10,lineHeight:1.6,textAlign:"left" as const,whiteSpace:"pre-wrap" as const}}>{r.catatan}</div>}'''

EDITS = [
    ("EDIT 1 (sub-bagian terkunci dari user.sub_bagian)", OLD_1, NEW_1),
    ("EDIT 2 (hapus tombol pilih sub-bagian, tampilkan badge terkunci)", OLD_2, NEW_2),
    ("EDIT 3 (alignment rata kiri di riwayat)", OLD_3, NEW_3),
]

def main():
    shutil.copy(PATH, PATH + ".bak_tklocksubbagian")
    print(f"[OK] Backup dibuat: {PATH}.bak_tklocksubbagian")

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
    print("  - Sub-bagian sekarang terkunci sesuai login (badge info, bukan tombol pilihan)")
    print("  - Operator tidak bisa lagi ganti sub-bagian di dalam halaman")
    print("  - Teks 'oleh [nama]' dan catatan riwayat sekarang rata kiri, font lebih besar")
    print("Selanjutnya jalankan: npm run build")

if __name__ == "__main__":
    main()
