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
        print(f"GAGAL [{label}]: pattern tidak ditemukan.")
        print(repr(old))
        sys.exit(1)
    if count > 1:
        print(f"GAGAL [{label}]: ditemukan {count}x.")
        sys.exit(1)
    print(f"OK [{label}]")
    return content.replace(old, new)


backup_path = FILE_PATH + f".bak_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
shutil.copy2(FILE_PATH, backup_path)
print(f"Backup: {backup_path}\n")

content = read_file()

old1 = '''      <div style={{marginBottom:16,display:"flex",alignItems:"center",gap:12,background:"#fff",border:"1px solid #cbd5e1",borderRadius:12,padding:"12px 14px"}}>
        <div style={{width:42,height:42,borderRadius:10,background:"#f0fdfa",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:22}}>
          {subBagianIcon[subBagian]}
        </div>
        <div>
          <div style={{fontSize:12,fontWeight:600,color:"#475569"}}>Sub-bagian Anda</div>
          <div style={{fontSize:16,fontWeight:800,color:"#0f172a"}}>{subBagian}</div>
        </div>
      </div>'''

new1 = '''      <div style={{marginBottom:16,display:"flex",alignItems:"center",gap:12,background:"#fff",border:"1px solid #e2e8f0",borderRadius:14,padding:"14px 16px",boxShadow:"0 2px 8px rgba(0,0,0,0.04)"}}>
        <div style={{width:46,height:46,borderRadius:12,background:"linear-gradient(135deg,#2dd4bf,#0d9488)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:22,boxShadow:"0 3px 10px #0d948844"}}>
          {subBagianIcon[subBagian]}
        </div>
        <div>
          <div style={{fontSize:11.5,fontWeight:600,color:"#94a3b8"}}>Sub-bagian Anda</div>
          <div style={{fontSize:16.5,fontWeight:800,color:"#0f172a"}}>{subBagian}</div>
        </div>
      </div>'''

content = apply_edit(content, old1, new1, "Edit 1: Kartu sub-bagian gradient")

old2 = '''          <button onClick={submitTracking} disabled={uploading}
            style={{width:"100%",padding:"15px",borderRadius:12,border:"none",background:uploading?"#94a3b8":"#0d9488",color:"#fff",fontSize:16,fontWeight:800,cursor:uploading?"default":"pointer",fontFamily:"inherit",marginBottom:24}}>
            {uploading?"Mengunggah...":"Kirim"}
          </button>'''

new2 = '''          <button onClick={submitTracking} disabled={uploading}
            style={{width:"100%",padding:"15px",borderRadius:12,border:"none",
              background:uploading?"#94a3b8":"linear-gradient(135deg,#2dd4bf,#0d9488)",
              color:"#fff",fontSize:16,fontWeight:800,cursor:uploading?"default":"pointer",fontFamily:"inherit",marginBottom:24,
              boxShadow:uploading?"none":"0 4px 14px #0d948844"}}>
            {uploading?"Mengunggah...":"Kirim"}
          </button>'''

content = apply_edit(content, old2, new2, "Edit 2: Tombol kirim gradient")

old3 = '''              {riwayat.map((r:any)=>(
                <div key={r.id} style={{background:"#fff",border:"1px solid #cbd5e1",borderLeft:"4px solid #0d9488",borderRadius:10,padding:"14px 16px",textAlign:"left" as const}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:4}}>
                    <span style={{fontWeight:800,fontSize:15,color:"#0f172a",textAlign:"left" as const}}>{subBagianIcon[r.sub_bagian]} {r.sub_bagian}</span>
                    <span style={{fontSize:12,fontWeight:600,color:"#64748b"}}>{fmtDateTime(r.created_at)}</span>
                  </div>
                  <div style={{fontSize:13,fontWeight:600,color:"#475569",marginBottom:8,textAlign:"left" as const}}>oleh {r.operator_name}</div>
                  {r.catatan&&<div style={{fontSize:15,fontWeight:500,color:"#1e293b",marginBottom:10,lineHeight:1.6,textAlign:"left" as const,whiteSpace:"pre-wrap" as const}}>{r.catatan}</div>}
                  {(fotoMap[r.id]||[]).length>0&&(
                    <div style={{display:"flex",flexWrap:"wrap" as const,gap:6}}>
                      {(fotoMap[r.id]||[]).map((foto:any)=>(
                        <a key={foto.id} href={foto.file_url} target="_blank" rel="noopener noreferrer">
                          <img src={foto.file_url} style={{width:64,height:64,objectFit:"cover" as const,borderRadius:6,border:"1px solid #e2e8f0"}}/>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}'''

new3 = '''              {riwayat.map((r:any)=>(
                <div key={r.id} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:"14px 16px",textAlign:"left" as const,boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                    <div style={{width:34,height:34,borderRadius:10,background:"linear-gradient(135deg,#2dd4bf,#0d9488)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:16}}>
                      {subBagianIcon[r.sub_bagian]}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:800,fontSize:14,color:"#0f172a"}}>{r.sub_bagian}</div>
                      <div style={{fontSize:11.5,color:"#94a3b8"}}>oleh {r.operator_name}</div>
                    </div>
                    <span style={{fontSize:10.5,fontWeight:600,color:"#94a3b8",whiteSpace:"nowrap" as const}}>{fmtDateTime(r.created_at)}</span>
                  </div>
                  {r.catatan&&<div style={{fontSize:14,fontWeight:500,color:"#1e293b",marginBottom:10,lineHeight:1.6,textAlign:"left" as const,whiteSpace:"pre-wrap" as const,background:"#f8fafc",borderRadius:8,padding:"8px 10px"}}>{r.catatan}</div>}
                  {(fotoMap[r.id]||[]).length>0&&(
                    <div style={{display:"flex",flexWrap:"wrap" as const,gap:6}}>
                      {(fotoMap[r.id]||[]).map((foto:any)=>(
                        <a key={foto.id} href={foto.file_url} target="_blank" rel="noopener noreferrer">
                          <img src={foto.file_url} style={{width:64,height:64,objectFit:"cover" as const,borderRadius:8,border:"1px solid #e2e8f0",boxShadow:"0 1px 3px rgba(0,0,0,0.08)"}}/>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}'''

content = apply_edit(content, old3, new3, "Edit 3: Kartu riwayat gradient icon")

write_file(content)
print("\nBerhasil! Lanjut npm run build.")
