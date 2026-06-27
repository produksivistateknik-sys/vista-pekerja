import shutil
import sys

PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

OLD_1 = '''      <div style={{marginBottom:16,display:"flex",alignItems:"center",gap:12,background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:"12px 14px"}}>
        <div style={{width:40,height:40,borderRadius:10,background:"#f0fdfa",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:20}}>
          {subBagianIcon[subBagian]}
        </div>
        <div>
          <div style={{fontSize:11,color:"#94a3b8"}}>Sub-bagian Anda</div>
          <div style={{fontSize:15,fontWeight:700,color:"#1e293b"}}>{subBagian}</div>
        </div>
      </div>'''

NEW_1 = '''      <div style={{marginBottom:16,display:"flex",alignItems:"center",gap:12,background:"#fff",border:"1px solid #cbd5e1",borderRadius:12,padding:"12px 14px"}}>
        <div style={{width:42,height:42,borderRadius:10,background:"#f0fdfa",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:22}}>
          {subBagianIcon[subBagian]}
        </div>
        <div>
          <div style={{fontSize:12,fontWeight:600,color:"#475569"}}>Sub-bagian Anda</div>
          <div style={{fontSize:16,fontWeight:800,color:"#0f172a"}}>{subBagian}</div>
        </div>
      </div>'''

OLD_2 = '''      <div style={{marginBottom:14}}>
        <Lbl>Work Order</Lbl>
        <select value={selectedWoId??""} onChange={(e:any)=>setSelectedWoId(e.target.value?Number(e.target.value):null)}
          style={{width:"100%",padding:"12px 14px",borderRadius:12,border:"1.5px solid #e2e8f0",fontSize:14,background:"#fff"}}>'''

NEW_2 = '''      <div style={{marginBottom:14}}>
        <Lbl>Work Order</Lbl>
        <select value={selectedWoId??""} onChange={(e:any)=>setSelectedWoId(e.target.value?Number(e.target.value):null)}
          style={{width:"100%",padding:"12px 14px",borderRadius:12,border:"1.5px solid #cbd5e1",fontSize:15,fontWeight:600,color:"#0f172a",background:"#fff"}}>'''

OLD_3 = '''          <select value={selectedPanelId??""} onChange={(e:any)=>setSelectedPanelId(e.target.value?Number(e.target.value):null)}
            style={{width:"100%",padding:"12px 14px",borderRadius:12,border:"1.5px solid #e2e8f0",fontSize:14,background:"#fff"}}>'''

NEW_3 = '''          <select value={selectedPanelId??""} onChange={(e:any)=>setSelectedPanelId(e.target.value?Number(e.target.value):null)}
            style={{width:"100%",padding:"12px 14px",borderRadius:12,border:"1.5px solid #cbd5e1",fontSize:15,fontWeight:600,color:"#0f172a",background:"#fff"}}>'''

OLD_4 = '''            <textarea value={catatan} onChange={(e:any)=>setCatatan(e.target.value)}
              placeholder="Tulis catatan, misal: komponen lengkap, diserahkan ke assembling"
              style={{width:"100%",minHeight:60,padding:"12px 14px",borderRadius:12,border:"1.5px solid #e2e8f0",fontSize:14,fontFamily:"inherit",resize:"vertical" as const}}/>'''

NEW_4 = '''            <textarea value={catatan} onChange={(e:any)=>setCatatan(e.target.value)}
              placeholder="Tulis catatan, misal: komponen lengkap, diserahkan ke assembling"
              style={{width:"100%",minHeight:60,padding:"12px 14px",borderRadius:12,border:"1.5px solid #cbd5e1",fontSize:15,fontWeight:500,color:"#0f172a",fontFamily:"inherit",resize:"vertical" as const}}/>'''

OLD_5 = '''          <button onClick={submitTracking} disabled={uploading}
            style={{width:"100%",padding:"14px",borderRadius:12,border:"none",background:uploading?"#94a3b8":"#0d9488",color:"#fff",fontSize:15,fontWeight:700,cursor:uploading?"default":"pointer",fontFamily:"inherit",marginBottom:24}}>'''

NEW_5 = '''          <button onClick={submitTracking} disabled={uploading}
            style={{width:"100%",padding:"15px",borderRadius:12,border:"none",background:uploading?"#94a3b8":"#0d9488",color:"#fff",fontSize:16,fontWeight:800,cursor:uploading?"default":"pointer",fontFamily:"inherit",marginBottom:24}}>'''

OLD_6 = '''          <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:8}}>Riwayat</div>'''

NEW_6 = '''          <div style={{fontSize:12,fontWeight:800,color:"#0f172a",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:8}}>Riwayat</div>'''

OLD_7 = '''                <div key={r.id} style={{background:"#fff",border:"1px solid #e2e8f0",borderLeft:"3px solid #0d9488",borderRadius:10,padding:"14px 16px",textAlign:"left" as const}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:4}}>
                    <span style={{fontWeight:700,fontSize:14,color:"#1e293b",textAlign:"left" as const}}>{subBagianIcon[r.sub_bagian]} {r.sub_bagian}</span>
                    <span style={{fontSize:11,color:"#94a3b8"}}>{fmtDateTime(r.created_at)}</span>
                  </div>
                  <div style={{fontSize:12,color:"#64748b",marginBottom:8,textAlign:"left" as const}}>oleh {r.operator_name}</div>
                  {r.catatan&&<div style={{fontSize:14,color:"#1e293b",marginBottom:10,lineHeight:1.6,textAlign:"left" as const,whiteSpace:"pre-wrap" as const}}>{r.catatan}</div>}'''

NEW_7 = '''                <div key={r.id} style={{background:"#fff",border:"1px solid #cbd5e1",borderLeft:"4px solid #0d9488",borderRadius:10,padding:"14px 16px",textAlign:"left" as const}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:4}}>
                    <span style={{fontWeight:800,fontSize:15,color:"#0f172a",textAlign:"left" as const}}>{subBagianIcon[r.sub_bagian]} {r.sub_bagian}</span>
                    <span style={{fontSize:12,fontWeight:600,color:"#64748b"}}>{fmtDateTime(r.created_at)}</span>
                  </div>
                  <div style={{fontSize:13,fontWeight:600,color:"#475569",marginBottom:8,textAlign:"left" as const}}>oleh {r.operator_name}</div>
                  {r.catatan&&<div style={{fontSize:15,fontWeight:500,color:"#1e293b",marginBottom:10,lineHeight:1.6,textAlign:"left" as const,whiteSpace:"pre-wrap" as const}}>{r.catatan}</div>}'''

EDITS = [
    ("EDIT 1 (badge sub-bagian)", OLD_1, NEW_1),
    ("EDIT 2 (dropdown WO)", OLD_2, NEW_2),
    ("EDIT 3 (dropdown Panel)", OLD_3, NEW_3),
    ("EDIT 4 (textarea catatan)", OLD_4, NEW_4),
    ("EDIT 5 (tombol Kirim)", OLD_5, NEW_5),
    ("EDIT 6 (label Riwayat)", OLD_6, NEW_6),
    ("EDIT 7 (card riwayat)", OLD_7, NEW_7),
]

def main():
    shutil.copy(PATH, PATH + ".bak_enterprisestyle")
    print(f"[OK] Backup dibuat: {PATH}.bak_enterprisestyle")

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
    print("Ringkasan: font-weight dinaikkan di seluruh teks, warna teks lebih gelap/pekat, border lebih tegas")
    print("Selanjutnya jalankan: npm run build")

if __name__ == "__main__":
    main()
