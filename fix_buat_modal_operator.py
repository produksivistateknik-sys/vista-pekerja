file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_modal_operator", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = '''            Bisa diklik lagi jika ada update di shift berikutnya (tersimpan terpisah).
          </div>
        </div>
      )}
    </div>
  );
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// MAIN APP
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500'''

count = content.count(OLD)
print(f"  PATTERN occurrences: {count}")

if count != 1:
    print(f"[FAIL] PATTERN tidak ketemu, TIDAK menyimpan apapun")
else:
    NEW_MODAL = '''            Bisa diklik lagi jika ada update di shift berikutnya (tersimpan terpisah).
          </div>
        </div>
      )}

      {operatorModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:200,
          display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
          onClick={()=>setOperatorModal(null)}>
          <div style={{background:"#fff",borderRadius:14,padding:20,width:"100%",maxWidth:380,maxHeight:"80vh",overflowY:"auto"}}
            onClick={(e:any)=>e.stopPropagation()}>
            <div style={{fontWeight:800,fontSize:14,color:"#1e293b",marginBottom:4}}>Pilih Operator</div>
            <div style={{fontSize:11,color:"#94a3b8",marginBottom:14}}>Bisa pilih lebih dari satu orang</div>
            <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:16}}>
              {pekerjaList.filter((p:any)=>p.divisi===user.divisi).map((p:any)=>{
                const checked=tempPekerjaIds.includes(p.id);
                return(
                  <label key={p.id} style={{display:"flex",alignItems:"center",gap:10,border:`1.5px solid ${checked?"#2563eb":"#e2e8f0"}`,
                    borderRadius:10,padding:"10px 12px",cursor:"pointer",background:checked?"#eff6ff":"#fff"}}>
                    <input type="checkbox" checked={checked}
                      onChange={()=>setTempPekerjaIds(prev=>checked?prev.filter(id=>id!==p.id):[...prev,p.id])}/>
                    <span style={{fontSize:13,fontWeight:600,color:"#1e293b"}}>{p.nama}</span>
                  </label>
                );
              })}
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setOperatorModal(null)}
                style={{flex:1,padding:"10px",borderRadius:10,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#64748b",fontWeight:700,fontSize:13,cursor:"pointer"}}>Batal</button>
              <button onClick={async()=>{await updatePekerjaTask(operatorModal.id,tempPekerjaIds);setOperatorModal(null);}}
                style={{flex:1,padding:"10px",borderRadius:10,border:"none",background:"#2563eb",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// MAIN APP
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500'''
    content = content.replace(OLD, NEW_MODAL, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Modal pilih operator multi-select berhasil ditambah")
    print("[INFO] Jalankan: npm run build")
