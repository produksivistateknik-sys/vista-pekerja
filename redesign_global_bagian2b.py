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

oldF = '''                {QC_ITEMS.map((item)=>{
                  const savedData=cl[item.key]||{status:"to_do",catatan:""};
                  const pendKey=`${p.id}_${item.key}`;
                  const pending=pendingChecklist[pendKey];
                  const displayStatus=pending?pending.status:savedData.status;
                  const isPending=!!pending&&pending.status!==savedData.status;
                  const fotoSeksi=savedData.foto||[];
                  const uploadKey=`${p.id}_${item.key}`;
                  const fmtTgl=(iso:string)=>{
                    if(!iso)return"";
                    const d=new Date(iso);
                    return d.toLocaleDateString("id-ID",{day:"numeric",month:"short"})+" "+d.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"});
                  };
                  return(
                    <div key={item.key} style={{padding:"10px 14px",borderBottom:"1px solid #f8fafc"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:6}}>
                        <span style={{fontSize:12.5,color:"#334155",flex:1}}>{item.label}</span>
                        <div style={{display:"flex",border:"1px solid #e2e8f0",borderRadius:7,overflow:"hidden",flexShrink:0}}>
                          <button onClick={()=>setPendingChecklist(prev=>({...prev,[pendKey]:{status:"to_do",catatan:""}}))}
                            style={{width:48,height:28,border:"none",cursor:"pointer",fontSize:9.5,fontWeight:600,
                              background:displayStatus==="to_do"?(isPending?"#cbd5e1":"#64748b"):"#fff",color:displayStatus==="to_do"?"#fff":"#94a3b8"}}>
                            To Do
                          </button>
                          <button onClick={()=>setPendingChecklist(prev=>({...prev,[pendKey]:{status:"in_progress",catatan:""}}))}
                            style={{width:68,height:28,border:"none",borderLeft:"1px solid #e2e8f0",cursor:"pointer",fontSize:9.5,fontWeight:600,
                              background:displayStatus==="in_progress"?(isPending?"#fdba74":"#ea580c"):"#fff",color:displayStatus==="in_progress"?"#fff":"#94a3b8"}}>
                            Progress
                          </button>
                          <button onClick={()=>setPendingChecklist(prev=>({...prev,[pendKey]:{status:"complete",catatan:""}}))}
                            style={{width:62,height:28,border:"none",borderLeft:"1px solid #e2e8f0",cursor:"pointer",fontSize:9.5,fontWeight:600,
                              background:displayStatus==="complete"?(isPending?"#86efac":"#16a34a"):"#fff",color:displayStatus==="complete"?"#fff":"#94a3b8"}}>
                            Complete
                          </button>
                        </div>
                      </div>
                      {(savedData.todo_at||savedData.complete_at)&&(
                        <div style={{display:"flex",gap:10,fontSize:9.5,color:"#94a3b8",marginBottom:8}}>
                          {savedData.todo_at&&<span>To Do: {fmtTgl(savedData.todo_at)}</span>}
                          {savedData.complete_at&&<span>Selesai: {fmtTgl(savedData.complete_at)}</span>}
                        </div>
                      )}
                      {isPending&&(
                        <div style={{marginTop:8}}>
                          <div style={{display:"flex",gap:6}}>
                            <button onClick={()=>{
                                updateChecklistItem(p.id,item.key,pending.status,pending.catatan||"");
                                setPendingChecklist(prev=>{const n={...prev};delete n[pendKey];return n;});
                              }}
                              style={{flex:1,height:30,borderRadius:6,border:"none",cursor:"pointer",fontSize:11,fontWeight:600,background:"#2563eb",color:"#fff"}}>
                              Simpan
                            </button>
                            <button onClick={()=>setPendingChecklist(prev=>{const n={...prev};delete n[pendKey];return n;})}
                              style={{flex:1,height:30,borderRadius:6,border:"1px solid #e2e8f0",cursor:"pointer",fontSize:11,fontWeight:600,background:"#fff",color:"#94a3b8"}}>
                              Batal
                            </button>
                          </div>
                        </div>
                      )}
                      <div style={{marginTop:8}}>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                          <span style={{fontSize:10.5,fontWeight:600,color:"#64748b"}}>Foto · {fotoSeksi.length}</span>
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
                                <div style={{fontSize:8.5,color:"#94a3b8",marginTop:2}}>{fmtTgl(f.uploaded_at)}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}'''

newF = '''                {QC_ITEMS.map((item)=>{
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
                })}'''

content = apply_edit(content, oldF, newF, "Edit F: Isi section jadi catatan dan foto")

write_file(content)
print("\nSemua edit berhasil! Lanjut npm run build.")
