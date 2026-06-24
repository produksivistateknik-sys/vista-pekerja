file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_pending_konfirmasi", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

results = {}

# Fix 1: Tambah state pending setelah uploadingId
OLD1 = "  const[uploadingId,setUploadingId]=useState<number|null>(null);"
NEW1 = '''  const[uploadingId,setUploadingId]=useState<number|null>(null);
  const[pendingChecklist,setPendingChecklist]=useState<Record<string,{status:string,catatan:string}>>({});'''
results['STATE_PENDING'] = content.count(OLD1)

# Fix 2: Ganti render checklist item - tombol cuma pilih lokal, tambah tombol Simpan
OLD2 = '''              <div>
                {QC_ITEMS.map((item)=>{
                  const itemData=cl[item.key]||{status:"belum",catatan:""};
                  return(
                    <div key={item.key} style={{padding:"10px 14px",borderBottom:"1px solid #f8fafc"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
                        <span style={{fontSize:12.5,color:"#334155",flex:1}}>{item.label}</span>
                        <div style={{display:"flex",border:"1px solid #e2e8f0",borderRadius:7,overflow:"hidden",flexShrink:0}}>
                          <button onClick={()=>updateChecklistItem(p.id,item.key,"lolos",itemData.catatan||"")}
                            style={{width:60,height:28,border:"none",cursor:"pointer",fontSize:11,fontWeight:600,
                              background:itemData.status==="lolos"?"#16a34a":"#fff",color:itemData.status==="lolos"?"#fff":"#94a3b8"}}>
                            Lolos
                          </button>
                          <button onClick={()=>updateChecklistItem(p.id,item.key,"gagal",itemData.catatan||"")}
                            style={{width:60,height:28,border:"none",borderLeft:"1px solid #e2e8f0",cursor:"pointer",fontSize:11,fontWeight:600,
                              background:itemData.status==="gagal"?"#dc2626":"#fff",color:itemData.status==="gagal"?"#fff":"#94a3b8"}}>
                            Gagal
                          </button>
                        </div>
                      </div>
                      {itemData.status==="gagal"&&(
                        <input placeholder="Catatan kegagalan" defaultValue={itemData.catatan}
                          onBlur={(e:any)=>updateChecklistItem(p.id,item.key,"gagal",e.target.value)}
                          style={{width:"100%",marginTop:8,padding:"7px 10px",fontSize:11.5,borderRadius:6,border:"1px solid #fecaca",outline:"none",background:"#fef2f2",boxSizing:"border-box" as const}}/>
                      )}
                    </div>
                  );
                })}
              </div>'''

NEW2 = '''              <div>
                {QC_ITEMS.map((item)=>{
                  const savedData=cl[item.key]||{status:"belum",catatan:""};
                  const pendKey=`${p.id}_${item.key}`;
                  const pending=pendingChecklist[pendKey];
                  const displayStatus=pending?pending.status:savedData.status;
                  const isPending=!!pending&&pending.status!==savedData.status;
                  return(
                    <div key={item.key} style={{padding:"10px 14px",borderBottom:"1px solid #f8fafc"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
                        <span style={{fontSize:12.5,color:"#334155",flex:1}}>{item.label}</span>
                        <div style={{display:"flex",border:"1px solid #e2e8f0",borderRadius:7,overflow:"hidden",flexShrink:0}}>
                          <button onClick={()=>setPendingChecklist(prev=>({...prev,[pendKey]:{status:"lolos",catatan:""}}))}
                            style={{width:60,height:28,border:"none",cursor:"pointer",fontSize:11,fontWeight:600,
                              background:displayStatus==="lolos"?(isPending?"#86efac":"#16a34a"):"#fff",color:displayStatus==="lolos"?"#fff":"#94a3b8"}}>
                            Lolos
                          </button>
                          <button onClick={()=>setPendingChecklist(prev=>({...prev,[pendKey]:{status:"gagal",catatan:""}}))}
                            style={{width:60,height:28,border:"none",borderLeft:"1px solid #e2e8f0",cursor:"pointer",fontSize:11,fontWeight:600,
                              background:displayStatus==="gagal"?(isPending?"#fca5a5":"#dc2626"):"#fff",color:displayStatus==="gagal"?"#fff":"#94a3b8"}}>
                            Gagal
                          </button>
                        </div>
                      </div>
                      {isPending&&(
                        <div style={{marginTop:8}}>
                          {pending.status==="gagal"&&(
                            <input placeholder="Catatan kegagalan" autoFocus
                              onChange={(e:any)=>setPendingChecklist(prev=>({...prev,[pendKey]:{...prev[pendKey],catatan:e.target.value}}))}
                              style={{width:"100%",marginBottom:6,padding:"7px 10px",fontSize:11.5,borderRadius:6,border:"1px solid #fecaca",outline:"none",background:"#fef2f2",boxSizing:"border-box" as const}}/>
                          )}
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
                    </div>
                  );
                })}
              </div>'''

results['RENDER_PENDING'] = content.count(OLD2)

for k, v in results.items():
    print(f"  {k}: {v} occurrence(s)")

if all(v==1 for v in results.values()):
    content = content.replace(OLD1, NEW1, 1)
    content = content.replace(OLD2, NEW2, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Checklist sekarang 2 langkah: pilih (netral) -> Simpan (konfirmasi, baru tersimpan & kirim notif)")
    print("[INFO] Jalankan: npm run build")
else:
    print("[FAIL] Ada occurrence tidak sesuai (harus semua 1), TIDAK menyimpan apapun")
