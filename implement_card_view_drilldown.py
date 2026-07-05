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

# ── EDIT 1: Deklarasi isDrilldownProses ──
old1 = '''        const isDone=(r:any)=>r.pct===100;'''

new1 = '''        const isDone=(r:any)=>r.pct===100;
        const isDrilldownProses=["WIRING CONTROL","WIRING POWER","BUSBAR"].includes(proses);'''

content = apply_edit(content, old1, new1, "Edit 1: Deklarasi isDrilldownProses")

# ── EDIT 2: Bungkus pembuka div+table ──
old2 = '''            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>'''

new2 = '''            {!isDrilldownProses&&(<div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>'''

content = apply_edit(content, old2, new2, "Edit 2: Bungkus pembuka div+table")

# ── EDIT 3: Tutup ')}' setelah div table + sisipin card view drilldown ──
old3 = '''                </tbody>
              </table>
            </div>
            {/* catatan per proses */}'''

new3 = '''                </tbody>
              </table>
            </div>)}
            {isDrilldownProses&&(
              <div style={{padding:"8px 16px 4px"}}>
                {(()=>{
                  const panelGroups:any[]=[];
                  const seenPanel=new Set();
                  rows.forEach((r:any)=>{
                    if(!seenPanel.has(r.panelId)){
                      seenPanel.add(r.panelId);
                      panelGroups.push({panelId:r.panelId,panel:r.panel,proyek:r.task.proyek,items:rows.filter((x:any)=>x.panelId===r.panelId)});
                    }
                  });
                  return panelGroups.map((pg:any)=>{
                    const panelKey=`${proses}_${pg.panelId}`;
                    const expanded=!!expandedPanel[panelKey];
                    const doneCount=pg.items.filter((x:any)=>isDone(x)).length;
                    const allDone=pg.items.length>0&&doneCount===pg.items.length;
                    return(
                      <div key={panelKey} style={{marginBottom:8,background:"#fff",border:"1px solid #e2e8f0",borderRadius:10,overflow:"hidden"}}>
                        <div onClick={()=>setExpandedPanel(prev=>({...prev,[panelKey]:!prev[panelKey]}))}
                          style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",cursor:"pointer",background:"#eef2ff"}}>
                          <div style={{display:"flex",flexDirection:"column",gap:1}}>
                            <span style={{fontSize:10,color:"#94a3b8"}}>{pg.proyek}</span>
                            <span style={{fontSize:13,fontWeight:700,color:"#1e293b"}}>{pg.panel.nama}</span>
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <span style={{fontSize:11,fontWeight:700,background:allDone?"#dcfce7":"#fef3c7",
                              color:allDone?"#16a34a":"#b45309",borderRadius:20,padding:"3px 10px"}}>
                              {doneCount}/{pg.items.length} selesai
                            </span>
                            <span style={{fontSize:14,color:"#64748b"}}>{expanded?"▲":"▼"}</span>
                          </div>
                        </div>
                        {expanded&&(
                          <div style={{padding:"8px 12px",display:"flex",flexDirection:"column",gap:8}}>
                            {pg.items.map((r:any)=>{
                              const kInfo=r.wiringBadge||komponenInfoMap[`${r.panelId}_${proses}_${r.kode}`]||{};
                              const fmtDate=(d:string)=>d?new Date(d).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"}):"–";
                              const bisaEdit=canEditProgressKomponen(r.task,r.kode,r.panelId,proses);
                              const idsKomp=(r.task.pekerja_per_komponen||{})[r.kode]||[];
                              const workers=idsKomp.map((id:number)=>pekerjaList.find((p:any)=>p.id===id)).filter(Boolean);
                              const BOBOT_COLOR:any={EASY:"#16a34a",MEDIUM:"#d97706",HARD:"#dc2626",VERY_HARD:"#7c3aed"};
                              const bc=r.wiringBadge?(BOBOT_COLOR[r.wiringBadge.bobot]||"#6366f1"):null;
                              const doneKomp=isDone(r);
                              return(
                                <div key={`${r.task.id}-${r.kode}`} style={{border:"1px solid #f1f5f9",borderRadius:8,padding:"10px 12px",background:doneKomp?"#f0fdf4":"#f8fafc"}}>
                                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6,flexWrap:"wrap",gap:4}}>
                                    <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                                      {r.wpDef&&<span style={{background:r.wpDef.color+"18",color:r.wpDef.color,border:`1px solid ${r.wpDef.color}33`,borderRadius:4,padding:"1px 6px",fontSize:10,fontWeight:700}}>{r.wpDef.wp}</span>}
                                      <span style={{fontWeight:600,fontSize:13,color:"#374151"}}>{r.item.nama}</span>
                                      {r.wiringBadge&&(
                                        <span style={{background:bc+"18",color:bc,border:`1px solid ${bc}33`,borderRadius:6,padding:"1px 6px",fontSize:9,fontWeight:700}}>
                                          ⚡ {(r.wiringBadge.bobot||"").replace("_"," ")} · {r.wiringBadge.jumlahOrang||"–"}org
                                        </span>
                                      )}
                                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#94a3b8"}}>{r.kode}</span>
                                    </div>
                                    {r.pct===100
                                      ?<Badge label="TERCAPAI" color="#16a34a" bg="#dcfce7"/>
                                      :r.pct===0
                                      ?<Badge label="BELUM MULAI" color="#94a3b8" bg="#f1f5f9"/>
                                      :<Badge label="ON PROGRESS" color="#2563eb" bg="#dbeafe"/>
                                    }
                                  </div>
                                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
                                    <Badge label={r.task.prioritas||"Sedang"} color={r.priColor}/>
                                    <span style={{fontWeight:800,fontFamily:"'DM Mono',monospace",color:r.qtyKomp===0?"#fca5a5":"#475569",
                                      background:r.qtyKomp===0?"#fef2f2":"#f1f5f9",borderRadius:6,padding:"2px 7px",fontSize:11}}>
                                      {r.qtyKomp} 🔒
                                    </span>
                                  </div>
                                  <div style={{display:"flex",gap:12,flexWrap:"wrap",fontSize:10,color:"#64748b",marginBottom:8}}>
                                    <span>By: <b style={{color:"#475569"}}>{kInfo.createdBy||"–"}</b></span>
                                    <span>Dibuat: <b style={{color:"#475569"}}>{fmtDate(kInfo.createdAt)}</b></span>
                                    <span>Target: <b style={{color:"#1d4ed8"}}>{fmtDate(kInfo.targetSelesai)}</b></span>
                                    <span>Aktual: <b style={{color:r.pct>=100?"#16a34a":"#94a3b8"}}>{r.pct>=100?fmtDate(r.aktualSelesai):"-"}</b></span>
                                  </div>
                                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,flexWrap:"wrap"}}>
                                    <div style={{width:60,background:"#e2e8f0",borderRadius:99,height:6,overflow:"hidden"}}>
                                      <div style={{width:`${r.pct}%`,height:"100%",background:pColor(r.pct),borderRadius:99}}/>
                                    </div>
                                    <span style={{fontWeight:800,color:pColor(r.pct),fontFamily:"'DM Mono',monospace",fontSize:12}}>{r.pct}%</span>
                                    <div style={{display:"flex",gap:4,marginLeft:"auto"}}>
                                      {PCT_STEPS.map((s:number)=>{
                                        const reached=r.pct>=s;
                                        const isNext=!doneKomp&&s===PCT_STEPS.find((x:number)=>x>r.pct);
                                        const prevStep=PCT_STEPS[PCT_STEPS.indexOf(s)-1]||0;
                                        return(
                                          <button key={s} disabled={!bisaEdit}
                                            onClick={()=>{if(bisaEdit)updatePctManual(r.panelId,r.kode,proses,reached?prevStep:s);}}
                                            title={!bisaEdit?(proses==="PACKING"?"QC checklist belum lolos semua":"Pilih operator dan klik Mulai dulu"):reached?`Batalkan ${s}%`:`Set ${s}%`}
                                            style={{width:26,height:26,borderRadius:6,border:"none",cursor:bisaEdit?"pointer":"not-allowed",
                                              background:reached?pColor(s):isNext?"#eff6ff":"#f1f5f9",
                                              display:"flex",alignItems:"center",justifyContent:"center",
                                              outline:isNext&&bisaEdit?`2px solid ${pc}`:"none",transition:"all .12s"}}>
                                            {reached
                                              ?<span style={{color:"#fff",fontSize:11,fontWeight:700}}>✓</span>
                                              :<span style={{color:isNext?pc:"#cbd5e1",fontSize:9,fontWeight:700}}>{s}</span>
                                            }
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                  <div style={{display:"flex",flexDirection:"column",gap:4}}>
                                    {workers.map((w:any)=>{
                                      const key=`${r.panelId}_${r.kode}_${proses}_${w.id}`;
                                      const timer=timerAktif[key];
                                      const loading=timerLoading===key;
                                      let durasiLabel="";
                                      if(timer){
                                        const menitBerjalan=(Date.now()-new Date(timer.mulai).getTime())/60000;
                                        const jam=Math.floor(menitBerjalan/60);
                                        const menit=Math.round(menitBerjalan%60);
                                        durasiLabel=jam>0?`${jam}j ${menit}m`:`${menit}m`;
                                      }
                                      return(
                                        <div key={w.id} style={{display:"flex",alignItems:"center",gap:6,
                                          background:DIVISI_CONFIG[w.divisi]?.bg||"#f1f5f9",
                                          borderRadius:20,padding:"3px 8px 3px 10px",width:"fit-content"}}>
                                          <span style={{fontSize:11}}>{DIVISI_CONFIG[w.divisi]?.icon}</span>
                                          <span style={{fontSize:11,fontWeight:700,color:DIVISI_CONFIG[w.divisi]?.color||"#64748b"}}>{w.nama}</span>
                                          <button disabled={loading}
                                            onClick={()=>timer?stopTimer(w.id,r.panelId,r.kode,proses):startTimer(w.id,r.panelId,r.kode,proses,viewDate)}
                                            style={{fontSize:9,fontWeight:700,border:"none",borderRadius:10,padding:"3px 8px",cursor:loading?"not-allowed":"pointer",
                                              background:timer?"#fef2f2":"#f0fdf4",color:timer?"#dc2626":"#16a34a"}}>
                                            {loading?"...":timer?`⏹ ${durasiLabel}`:"▶ Mulai"}
                                          </button>
                                        </div>
                                      );
                                    })}
                                    <button onClick={()=>{setOperatorModal({taskId:r.task.id,kode:r.kode});setTempPekerjaIds(idsKomp);}}
                                      style={{fontSize:10,color:"#94a3b8",fontWeight:600,background:"none",border:"1px dashed #cbd5e1",borderRadius:8,padding:"4px 10px",cursor:"pointer",width:"fit-content"}}>
                                      {workers.length>0?"+ Edit Operator":"+ Pilih Operator"}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            )}
            {/* catatan per proses */}'''

content = apply_edit(content, old3, new3, "Edit 3: Sisipin card view drilldown")

write_file(content)
print("\n🎉 Semua edit berhasil diterapkan!")
print(f"   Backup asli ada di: {backup_path}")
print("   Behavior: WIRING CONTROL/POWER/BUSBAR sekarang pakai card accordion (bukan tabel).")
print("   Proses lain (RAKIT, POTONG, dll) TIDAK berubah - tetap tabel flat seperti biasa.")
print("   Lanjut: npm run build.")
