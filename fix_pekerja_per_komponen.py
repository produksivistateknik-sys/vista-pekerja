file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_pekerja_per_komp", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

results = {}

# Fix 1: Update function updatePekerjaTask jadi per komponen
OLD1 = '''  const updatePekerjaTask=async(taskId:number,pekerjaIds:number[])=>{
    const{error}=await supabase.from("renhar").update({pekerja:pekerjaIds}).eq("id",taskId);
    if(!error){
      setRenhar(prev=>prev.map((t:any)=>t.id===taskId?{...t,pekerja:pekerjaIds}:t));
    }
  };'''

NEW1 = '''  const updatePekerjaPerKomponen=async(taskId:number,kode:string,pekerjaIds:number[])=>{
    const task=renhar.find((t:any)=>t.id===taskId);
    if(!task)return;
    const newMap={...(task.pekerja_per_komponen||{}),[kode]:pekerjaIds};
    const{error}=await supabase.from("renhar").update({pekerja_per_komponen:newMap}).eq("id",taskId);
    if(!error){
      setRenhar(prev=>prev.map((t:any)=>t.id===taskId?{...t,pekerja_per_komponen:newMap}:t));
    }
  };'''

results['UPDATE_FUNCTION'] = content.count(OLD1)

# Fix 2: Ubah render kolom OPERATOR jadi per-baris (hapus rowSpan, isFirst check)
OLD2 = '''                        {r.isFirst?(
                          <td style={{...td,verticalAlign:"middle",cursor:"pointer"}} rowSpan={r.rowCount}
                            onClick={()=>{setOperatorModal(r.task);setTempPekerjaIds(r.task.pekerja||[]);}}>
                            {(()=>{
                              const workers=(r.task.pekerja||[])
                                .map((id:number)=>pekerjaList.find((p:any)=>p.id===id))
                                .filter(Boolean);
                              return workers.length>0?(
                                <div style={{display:"flex",flexDirection:"column",gap:3}}>
                                  {workers.map((w:any)=>(
                                    <div key={w.id} style={{display:"flex",alignItems:"center",gap:5,
                                      background:DIVISI_CONFIG[w.divisi]?.bg||"#f1f5f9",
                                      borderRadius:20,padding:"2px 8px",whiteSpace:"nowrap"}}>
                                      <span style={{fontSize:10}}>{DIVISI_CONFIG[w.divisi]?.icon}</span>
                                      <span style={{fontSize:10,fontWeight:700,color:DIVISI_CONFIG[w.divisi]?.color||"#64748b"}}>{w.nama}</span>
                                    </div>
                                  ))}
                                </div>
                              ):(
                                <span style={{fontSize:10,color:"#94a3b8",fontWeight:600}}>+ Pilih Operator</span>
                              );
                            })()}
                          </td>
                        ):null}'''

NEW2 = '''                        <td style={{...td,verticalAlign:"middle",cursor:"pointer"}}
                          onClick={()=>{setOperatorModal({taskId:r.task.id,kode:r.kode});setTempPekerjaIds((r.task.pekerja_per_komponen||{})[r.kode]||[]);}}>
                          {(()=>{
                            const idsKomp=(r.task.pekerja_per_komponen||{})[r.kode]||[];
                            const workers=idsKomp
                              .map((id:number)=>pekerjaList.find((p:any)=>p.id===id))
                              .filter(Boolean);
                            return workers.length>0?(
                              <div style={{display:"flex",flexDirection:"column",gap:3}}>
                                {workers.map((w:any)=>(
                                  <div key={w.id} style={{display:"flex",alignItems:"center",gap:5,
                                    background:DIVISI_CONFIG[w.divisi]?.bg||"#f1f5f9",
                                    borderRadius:20,padding:"2px 8px",whiteSpace:"nowrap"}}>
                                    <span style={{fontSize:10}}>{DIVISI_CONFIG[w.divisi]?.icon}</span>
                                    <span style={{fontSize:10,fontWeight:700,color:DIVISI_CONFIG[w.divisi]?.color||"#64748b"}}>{w.nama}</span>
                                  </div>
                                ))}
                              </div>
                            ):(
                              <span style={{fontSize:10,color:"#94a3b8",fontWeight:600}}>+ Pilih Operator</span>
                            );
                          })()}
                        </td>'''

results['RENDER_PER_BARIS'] = content.count(OLD2)

# Fix 3: Update tombol Simpan di modal supaya pakai updatePekerjaPerKomponen
OLD3 = '''              <button onClick={async()=>{await updatePekerjaTask(operatorModal.id,tempPekerjaIds);setOperatorModal(null);}}'''
NEW3 = '''              <button onClick={async()=>{await updatePekerjaPerKomponen(operatorModal.taskId,operatorModal.kode,tempPekerjaIds);setOperatorModal(null);}}'''
results['TOMBOL_SIMPAN'] = content.count(OLD3)

for k, v in results.items():
    print(f"  {k}: {v} occurrence(s)")

if all(v==1 for v in results.values()):
    content = content.replace(OLD1, NEW1, 1)
    content = content.replace(OLD2, NEW2, 1)
    content = content.replace(OLD3, NEW3, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Operator sekarang per komponen individual, tidak di-merge lagi")
    print("[INFO] Jalankan: npm run build")
else:
    print("[FAIL] Ada occurrence tidak sesuai (harus semua 1), TIDAK menyimpan apapun")
