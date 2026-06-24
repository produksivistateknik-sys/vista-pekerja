file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_badge_urgensi", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = '''                        <td style={{...td,position:"sticky",left:40,zIndex:1,fontWeight:600,fontSize:11,color:"#475569",whiteSpace:"nowrap"}}>{r.task.proyek}</td>'''

NEW = '''                        <td style={{...td,position:"sticky",left:40,zIndex:1,fontWeight:600,fontSize:11,color:"#475569",whiteSpace:"nowrap"}}>
                          {(()=>{
                            const urg=getUrgensi(r.task.wo_id||r.task.woId);
                            const warnaMap:Record<string,{bg:string,color:string}>={
                              telat:{bg:"#fef2f2",color:"#dc2626"},
                              mendesak:{bg:"#fff7ed",color:"#ea580c"},
                              perhatian:{bg:"#fefce8",color:"#ca8a04"},
                              normal:{bg:"",color:""},
                            };
                            const w=warnaMap[urg.level];
                            return(
                              <div style={{display:"flex",flexDirection:"column",gap:2}}>
                                <span>{r.task.proyek}</span>
                                {urg.label&&urg.level!=="normal"&&(
                                  <span style={{fontSize:8,fontWeight:700,background:w.bg,color:w.color,borderRadius:4,padding:"1px 5px",width:"fit-content"}}>
                                    {urg.level==="telat"?"\u26a0\ufe0f ":"\u23f0 "}{urg.label}
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </td>'''

count = content.count(OLD)
print(f"  PATTERN occurrences: {count}")

if count == 1:
    content = content.replace(OLD, NEW, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Badge urgensi berhasil ditambah di kolom Proyek")
    print("[INFO] Jalankan: npm run build")
else:
    print(f"[FAIL] PATTERN occurrences = {count}, bukan 1. TIDAK menyimpan apapun")
