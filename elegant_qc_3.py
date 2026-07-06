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

old1 = '''              <div>
                {QC_ITEMS.map((item)=>{
                  const savedData=cl[item.key]||{catatan:""};
                  const fotoSeksi=savedData.foto||[];
                  const uploadKey=`${p.id}_${item.key}`;
                  return(
                    <div key={item.key} style={{padding:"10px 14px",borderBottom:"1px solid #f8fafc"}}>
                      <div style={{fontSize:12.5,color:"#334155",fontWeight:600,marginBottom:6}}>{item.label}</div>
                      <input defaultValue={savedData.catatan||""} placeholder="Catatan (opsional)"
                        onBlur={(e:any)=>updateCatatanSeksi(p.id,item.key,e.target.value)}
                        style={{width:"100%",marginBottom:8,padding:"7px 10px",fontSize:11.5,borderRadius:6,border:"1px solid #e2e8f0",outline:"none",background:"#f8fafc",color:"#1e293b",boxSizing:"border-box" as const}}/>
                      <div>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                          <span style={{fontSize:10.5,fontWeight:600,color:"#64748b"}}>Foto {fotoSeksi.length}</span>
                          <label style={{display:"flex",alignItems:"center",gap:4,cursor:"pointer",color:"#2563eb",fontSize:10.5,fontWeight:600}}>
                            <i className={uploadingId===uploadKey?"ti ti-loader-2":"ti ti-plus"} style={{fontSize:12}}/>
                            Tambah
                            <input type="file" accept="image/*" capture="environment" style={{display:"none"}}
                              onChange={(e:any)=>{if(e.target.files?.[0])uploadFotoSeksi(p.id,item.key,e.target.files[0]);}}/>
                          </label>
                        </div>
                        {fotoSeksi.length>0&&(
                          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
                            {fotoSeksi.map((f:any,fi:number)=>(
                              <div key={fi}>
                                <div onClick={()=>setLightbox(f)} style={{position:"relative" as const,aspectRatio:"1",borderRadius:6,overflow:"hidden",cursor:"pointer",background:"#f1f5f9"}}>
                                  <img src={f.url} style={{width:"100%",height:"100%",objectFit:"cover" as const}}/>
                                  <button onClick={(e:any)=>{e.stopPropagation();hapusFotoSeksi(p.id,item.key,f.url);}}
                                    style={{position:"absolute" as const,top:3,right:3,width:16,height:16,borderRadius:99,background:"rgba(15,23,42,0.6)",color:"#fff",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                                    <i className="ti ti-x" style={{fontSize:9}}/>
                                  </button>
                                </div>
                                <div style={{fontSize:8.5,color:"#94a3b8",marginTop:2}}>{fmtTglQc(f.uploaded_at)}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>'''

new1 = '''              <div style={{padding:"10px 10px 4px",display:"flex",flexDirection:"column" as const,gap:8}}>
                {QC_ITEMS.map((item)=>{
                  const savedData=cl[item.key]||{catatan:""};
                  const fotoSeksi=savedData.foto||[];
                  const uploadKey=`${p.id}_${item.key}`;
                  return(
                    <div key={item.key} style={{padding:12,background:"#f8fafc",borderRadius:12,border:"1px solid #eef2f7"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                        <div style={{width:26,height:26,borderRadius:8,background:"#fff",border:"1px solid #e2e8f0",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                          <i className={item.icon} style={{fontSize:13,color:"#475569"}}/>
                        </div>
                        <span style={{fontSize:12.5,color:"#1e293b",fontWeight:700}}>{item.label}</span>
                      </div>
                      <input defaultValue={savedData.catatan||""} placeholder="Catatan (opsional)"
                        onBlur={(e:any)=>updateCatatanSeksi(p.id,item.key,e.target.value)}
                        style={{width:"100%",marginBottom:8,padding:"7px 10px",fontSize:11.5,borderRadius:6,border:"1px solid #e2e8f0",outline:"none",background:"#fff",color:"#1e293b",boxSizing:"border-box" as const}}/>
                      <div>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                          <span style={{fontSize:10.5,fontWeight:600,color:"#64748b"}}>Foto {fotoSeksi.length}</span>
                          <label style={{display:"flex",alignItems:"center",gap:4,cursor:"pointer",color:"#2563eb",fontSize:10.5,fontWeight:600}}>
                            <i className={uploadingId===uploadKey?"ti ti-loader-2":"ti ti-plus"} style={{fontSize:12}}/>
                            Tambah
                            <input type="file" accept="image/*" capture="environment" style={{display:"none"}}
                              onChange={(e:any)=>{if(e.target.files?.[0])uploadFotoSeksi(p.id,item.key,e.target.files[0]);}}/>
                          </label>
                        </div>
                        {fotoSeksi.length>0&&(
                          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
                            {fotoSeksi.map((f:any,fi:number)=>(
                              <div key={fi}>
                                <div onClick={()=>setLightbox(f)} style={{position:"relative" as const,aspectRatio:"1",borderRadius:8,overflow:"hidden",cursor:"pointer",background:"#f1f5f9",boxShadow:"0 1px 3px rgba(0,0,0,0.08)"}}>
                                  <img src={f.url} style={{width:"100%",height:"100%",objectFit:"cover" as const}}/>
                                  <button onClick={(e:any)=>{e.stopPropagation();hapusFotoSeksi(p.id,item.key,f.url);}}
                                    style={{position:"absolute" as const,top:3,right:3,width:16,height:16,borderRadius:99,background:"rgba(15,23,42,0.6)",color:"#fff",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                                    <i className="ti ti-x" style={{fontSize:9}}/>
                                  </button>
                                </div>
                                <div style={{fontSize:8.5,color:"#94a3b8",marginTop:2}}>{fmtTglQc(f.uploaded_at)}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>'''

content = apply_edit(content, old1, new1, "Edit 1: Redesign section jadi card dengan icon")

old2 = '''                  <button onClick={()=>{if(qcSemuaComplete)togglePacking(p.id,false);}} disabled={!qcSemuaComplete}
                    style={{width:"100%",height:42,borderRadius:8,border:"none",cursor:qcSemuaComplete?"pointer":"not-allowed",
                      fontSize:13,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:6,
                      background:qcSemuaComplete?"#2563eb":"#f1f5f9",color:qcSemuaComplete?"#fff":"#94a3b8"}}>
                    <i className={qcSemuaComplete?"ti ti-package":"ti ti-lock"} style={{fontSize:15}}/>
                    {qcSemuaComplete?"Tandai sudah packing":"Selesaikan QC dulu"}
                  </button>'''

new2 = '''                  <button onClick={()=>{if(qcSemuaComplete)togglePacking(p.id,false);}} disabled={!qcSemuaComplete}
                    style={{width:"100%",height:44,borderRadius:10,border:"none",cursor:qcSemuaComplete?"pointer":"not-allowed",
                      fontSize:13,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:6,
                      background:qcSemuaComplete?"linear-gradient(135deg,#3b82f6,#1d4ed8)":"#f1f5f9",color:qcSemuaComplete?"#fff":"#94a3b8",
                      boxShadow:qcSemuaComplete?"0 4px 12px #1d4ed84a":"none"}}>
                    <i className={qcSemuaComplete?"ti ti-package":"ti ti-lock"} style={{fontSize:16}}/>
                    {qcSemuaComplete?"Tandai sudah packing":"Selesaikan QC dulu"}
                  </button>'''

content = apply_edit(content, old2, new2, "Edit 2: Tombol packing gradient")

write_file(content)
print("\nSemua bagian berhasil! Lanjut npm run build.")
