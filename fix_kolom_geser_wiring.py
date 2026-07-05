import shutil
import sys
from datetime import datetime

FILE_PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

def read_file():
    with open(FILE_PATH, "r", encoding="utf-8") as f:
        return f.read()

def write_file(content):
    with open(FILE_PATH, "w", encoding="utf-8") as f:
        f.write(content)

def apply_edit(content, old, new, label):
    count = content.count(old)
    if count == 0:
        print(f"❌ GAGAL [{label}]: pattern tidak ditemukan. Tidak ada perubahan disimpan.")
        print("---- Pattern yang dicari ----")
        print(old)
        sys.exit(1)
    if count > 1:
        print(f"❌ GAGAL [{label}]: pattern ditemukan {count}x (harus unik/1x). Tidak ada perubahan disimpan.")
        sys.exit(1)
    print(f"✅ [{label}] pattern ditemukan 1x, mengganti...")
    return content.replace(old, new)


backup_path = FILE_PATH + f".bak_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
shutil.copy2(FILE_PATH, backup_path)
print(f"📦 Backup dibuat: {backup_path}\n")

content = read_file()

old1 = '''                                <>
                                  <td style={{...td,textAlign:"center"}}>
                                    {locked?(
                                      <span style={{width:60,padding:"4px 6px",borderRadius:7,border:"1.5px solid #16a34a",
                                        background:"#f0fdf4",fontSize:12,textAlign:"center",fontWeight:700,
                                        fontFamily:"'DM Mono',monospace",color:"#16a34a",display:"inline-block"}}>
                                        {r.qtyProses} 🔒
                                      </span>
                                    ):(
                                      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                                        <input type="number" min={floor} max={r.qtyKomp} value={r.qtyProses}
                                          onChange={e=>updateQtyProses(r.panelId,r.kode,proses,Number(e.target.value))}
                                          disabled={r.qtyKomp===0}
                                          style={{width:60,padding:"4px 6px",borderRadius:7,
                                            border:`1.5px solid ${r.qtyKomp===0?"#e2e8f0":floor>0?"#f59e0b":"#2563eb"}`,
                                            background:r.qtyKomp===0?"#f8fafc":floor>0?"#fffbeb":"#eff6ff",
                                            fontSize:12,textAlign:"center",fontWeight:700,
                                            fontFamily:"'DM Mono',monospace",
                                            color:r.qtyKomp===0?"#cbd5e1":floor>0?"#b45309":"#1d4ed8"}}/>
                                        {floor>0&&<span style={{fontSize:9,color:"#f59e0b",fontWeight:700}}>min {floor} 🔒</span>}
                                      </div>
                                    )}
                                  </td>
                                  <td style={{...td,fontSize:10,color:"#475569"}}>{kInfo.createdBy||"–"}</td>'''

new1 = '''                                <>
                                  {isQtyBased&&(
                                    <td style={{...td,textAlign:"center"}}>
                                      {locked?(
                                        <span style={{width:60,padding:"4px 6px",borderRadius:7,border:"1.5px solid #16a34a",
                                          background:"#f0fdf4",fontSize:12,textAlign:"center",fontWeight:700,
                                          fontFamily:"'DM Mono',monospace",color:"#16a34a",display:"inline-block"}}>
                                          {r.qtyProses} 🔒
                                        </span>
                                      ):(
                                        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                                          <input type="number" min={floor} max={r.qtyKomp} value={r.qtyProses}
                                            onChange={e=>updateQtyProses(r.panelId,r.kode,proses,Number(e.target.value))}
                                            disabled={r.qtyKomp===0}
                                            style={{width:60,padding:"4px 6px",borderRadius:7,
                                              border:`1.5px solid ${r.qtyKomp===0?"#e2e8f0":floor>0?"#f59e0b":"#2563eb"}`,
                                              background:r.qtyKomp===0?"#f8fafc":floor>0?"#fffbeb":"#eff6ff",
                                              fontSize:12,textAlign:"center",fontWeight:700,
                                              fontFamily:"'DM Mono',monospace",
                                              color:r.qtyKomp===0?"#cbd5e1":floor>0?"#b45309":"#1d4ed8"}}/>
                                          {floor>0&&<span style={{fontSize:9,color:"#f59e0b",fontWeight:700}}>min {floor} 🔒</span>}
                                        </div>
                                      )}
                                    </td>
                                  )}
                                  <td style={{...td,fontSize:10,color:"#475569"}}>{kInfo.createdBy||"–"}</td>'''

content = apply_edit(content, old1, new1, "Fix: bungkus td QTY PROSES dengan isQtyBased")

write_file(content)
print("\n🎉 Fix berhasil diterapkan!")
print(f"   Backup asli ada di: {backup_path}")
print("   Sekarang kolom cuma render kalau isQtyBased true, match sama header - gak ada geser lagi.")
print("   Lanjut: npm run build.")
