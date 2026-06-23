file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_durasi_warning", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = '''                                  const key=`${r.panelId}_${r.kode}_${proses}_${w.id}`;
                                  const timer=timerAktif[key];
                                  const loading=timerLoading===key;
                                  return(
                                    <div key={w.id} style={{display:"flex",alignItems:"center",gap:5,
                                      background:DIVISI_CONFIG[w.divisi]?.bg||"#f1f5f9",
                                      borderRadius:20,padding:"2px 6px 2px 8px",whiteSpace:"nowrap"}}>
                                      <span style={{fontSize:10}}>{DIVISI_CONFIG[w.divisi]?.icon}</span>
                                      <span style={{fontSize:10,fontWeight:700,color:DIVISI_CONFIG[w.divisi]?.color||"#64748b"}}>{w.nama}</span>
                                      <button disabled={loading}
                                        onClick={()=>timer?stopTimer(w.id,r.panelId,r.kode,proses):startTimer(w.id,r.panelId,r.kode,proses,viewDate)}
                                        style={{fontSize:8,fontWeight:700,border:"none",borderRadius:10,padding:"2px 6px",cursor:loading?"not-allowed":"pointer",
                                          background:timer?"#fef2f2":"#f0fdf4",color:timer?"#dc2626":"#16a34a"}}>
                                        {loading?"...":timer?"\u23f9 Selesai":"\u25b6 Mulai"}
                                      </button>
                                    </div>
                                  );'''

NEW = '''                                  const key=`${r.panelId}_${r.kode}_${proses}_${w.id}`;
                                  const timer=timerAktif[key];
                                  const loading=timerLoading===key;
                                  let durasiLabel="";
                                  let isLama=false;
                                  if(timer){
                                    const menitBerjalan=(Date.now()-new Date(timer.mulai).getTime())/60000;
                                    isLama=menitBerjalan>600;
                                    const jam=Math.floor(menitBerjalan/60);
                                    const menit=Math.round(menitBerjalan%60);
                                    durasiLabel=jam>0?`${jam}j ${menit}m`:`${menit}m`;
                                  }
                                  return(
                                    <div key={w.id} style={{display:"flex",flexDirection:"column",gap:2}}>
                                      <div style={{display:"flex",alignItems:"center",gap:5,
                                        background:isLama?"#fef3c7":DIVISI_CONFIG[w.divisi]?.bg||"#f1f5f9",
                                        borderRadius:20,padding:"2px 6px 2px 8px",whiteSpace:"nowrap"}}>
                                        <span style={{fontSize:10}}>{isLama?"\u26a0\ufe0f":DIVISI_CONFIG[w.divisi]?.icon}</span>
                                        <span style={{fontSize:10,fontWeight:700,color:DIVISI_CONFIG[w.divisi]?.color||"#64748b"}}>{w.nama}</span>
                                        <button disabled={loading}
                                          onClick={()=>timer?stopTimer(w.id,r.panelId,r.kode,proses):startTimer(w.id,r.panelId,r.kode,proses,viewDate)}
                                          style={{fontSize:8,fontWeight:700,border:"none",borderRadius:10,padding:"2px 6px",cursor:loading?"not-allowed":"pointer",
                                            background:timer?"#fef2f2":"#f0fdf4",color:timer?"#dc2626":"#16a34a"}}>
                                          {loading?"...":timer?`\u23f9 ${durasiLabel}`:"\u25b6 Mulai"}
                                        </button>
                                      </div>
                                      {isLama&&(
                                        <span style={{fontSize:8,color:"#d97706",fontWeight:600,paddingLeft:8}}>Sudah {durasiLabel}, lupa tutup?</span>
                                      )}
                                    </div>
                                  );'''

count = content.count(OLD)
print(f"  PATTERN occurrences: {count}")

if count == 1:
    content = content.replace(OLD, NEW, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Durasi berjalan dan warning sesi lama berhasil ditambah")
    print("[INFO] Jalankan: npm run build")
else:
    print(f"[FAIL] PATTERN occurrences = {count}, bukan 1. TIDAK menyimpan apapun")
