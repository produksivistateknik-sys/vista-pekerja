# -*- coding: utf-8 -*-
"""
Script: apply_kartu_per_panel.py
Tujuan: 
  1. Tampilan mobile card dikelompokkan per PANEL (accordion - klik buka/tutup).
  2. Tombol assign operator SEKARANG CUMA ASSIGN (gak auto-start timer semua).
     Operator klik tombol Mulai manual satu-satu per komponen seperti biasa.
  Proses kumpul komponen lintas panel (tombol "+ Pilih Komponen" per panel)
  TETAP SAMA seperti sekarang, gak diubah.

Cara pakai:
    python apply_kartu_per_panel.py
"""
import shutil
import datetime
import sys

FILE_PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

def fail(msg):
    print("\n❌ GAGAL:", msg)
    print("Tidak ada perubahan yang disimpan. File asli aman.")
    sys.exit(1)

def indent_of(line):
    return line[:len(line) - len(line.lstrip(" "))]

def find_line(lines, target, start=0):
    for i in range(start, len(lines)):
        if lines[i].strip() == target:
            return i
    return None

def main():
    try:
        with open(FILE_PATH, "r", encoding="utf-8") as f:
            lines = f.readlines()
    except FileNotFoundError:
        fail(f"File tidak ditemukan di {FILE_PATH}")

    joined = "".join(lines)
    if "expandedPanel" in joined:
        fail("expandedPanel sudah ada di file ini — sepertinya script ini sudah pernah dijalankan.")

    # ---------- ANCHOR 1: tambah state baru, taruh setelah bulkAssignProses ----------
    anchor1 = "const [bulkAssignProses,setBulkAssignProses]=useState<string|null>(null);"
    idx1 = find_line(lines, anchor1)
    if idx1 is None:
        fail("Tidak ketemu baris state 'bulkAssignProses'. Struktur mungkin sudah berubah.")
    ind1 = indent_of(lines[idx1])
    lines.insert(idx1 + 1,
        f"{ind1}const [expandedPanel,setExpandedPanel]=useState<Record<string,number|null>>({{}});\n"
        f"{ind1}const [bulkAssignPanelId,setBulkAssignPanelId]=useState<number|null>(null);\n"
    )

    # ---------- ANCHOR 2: buang loop auto-start timer di bulkAssignAndStart ----------
    old_fn = (
        "    const bulkAssignAndStart=async(proses:string,rowsToAssign:any[],pekerjaIds:number[])=>{\n"
        "      for(const r of rowsToAssign){\n"
        "        await updatePekerjaPerKomponen(r.task.id,r.kode,pekerjaIds);\n"
        "      }\n"
        "      for(const r of rowsToAssign){\n"
        "        for(const pid of pekerjaIds){\n"
        "          await startTimer(pid,r.panelId,r.kode,proses,viewDate);\n"
        "        }\n"
        "      }\n"
        "    };\n"
    )
    new_fn = (
        "    const bulkAssignAndStart=async(proses:string,rowsToAssign:any[],pekerjaIds:number[])=>{\n"
        "      // Cuma assign operator, TIDAK auto-start timer.\n"
        "      // Operator klik tombol Mulai manual satu-satu per komponen.\n"
        "      for(const r of rowsToAssign){\n"
        "        await updatePekerjaPerKomponen(r.task.id,r.kode,pekerjaIds);\n"
        "      }\n"
        "    };\n"
    )
    if joined.count(old_fn) == 0:
        fail("Tidak ketemu fungsi 'bulkAssignAndStart' persis seperti yang diharapkan. Struktur mungkin sudah berubah.")
    if joined.count(old_fn) > 1:
        fail("Fungsi 'bulkAssignAndStart' muncul lebih dari sekali — perlu dicek manual.")

    content_now = "".join(lines)
    content_now = content_now.replace(old_fn, new_fn)
    lines = content_now.splitlines(keepends=True)

    # ---------- ANCHOR 3: ganti seluruh isi blok mobile jadi accordion per panel ----------
    start_marker = '<div style={{display:"flex",flexDirection:"column",gap:14,padding:"4px 2px"}}>'
    start_idx = find_line(lines, start_marker)
    if start_idx is None:
        fail("Tidak ketemu baris pembuka blok mobile (flexDirection column gap 14). Struktur mungkin sudah berubah.")

    end_idx = None
    for i in range(start_idx + 1, len(lines) - 2):
        if lines[i].strip() == "</div>" and lines[i + 1].strip() == "):(":
            if lines[i + 2].strip().startswith('<div style={{overflowX:"auto"}}>'):
                end_idx = i
                break
    if end_idx is None:
        fail("Tidak ketemu penutup blok mobile yang sesuai. Struktur mungkin sudah berubah.")

    ind = indent_of(lines[start_idx])

    new_block = ind + '''<div style={{display:"flex",flexDirection:"column",gap:10,padding:"4px 2px"}}>
  {(()=>{
    const panelGroups:Record<string,{panelId:number,panelNama:string,proyek:string,rows:any[]}> = {};
    visibleRows.forEach((r:any)=>{
      const pid=r.panelId;
      if(!panelGroups[pid])panelGroups[pid]={panelId:pid,panelNama:r.panel?.nama||"",proyek:r.task?.proyek||"",rows:[]};
      panelGroups[pid].rows.push(r);
    });
    const groups=Object.values(panelGroups);
    if(groups.length===0){
      return(
        <div style={{textAlign:"center",padding:"24px 10px",color:"#94a3b8",fontSize:12}}>
          Belum ada komponen dikumpulkan.<br/>Tap panel di atas untuk pilih komponen.
        </div>
      );
    }
    return groups.map(group=>{
      const isOpen=expandedPanel[proses]===group.panelId;
      const activeRows=group.rows.filter((r:any)=>((r.task.pekerja_per_komponen||{}))[r.kode]?.length>0);
      const pendingRows=group.rows.filter((r:any)=>!(((r.task.pekerja_per_komponen||{}))[r.kode]?.length>0));
      return(
        <div key={group.panelId} style={{background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:14,overflow:"hidden"}}>
          <div onClick={()=>setExpandedPanel(prev=>({...prev,[proses]:isOpen?null:group.panelId}))}
            style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",cursor:"pointer",background:isOpen?"#eff6ff":"#fff"}}>
            <div style={{display:"flex",flexDirection:"column",gap:2}}>
              <span style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>{group.panelNama}</span>
              <span style={{fontSize:10,color:"#94a3b8"}}>{group.proyek} · {group.rows.length} komponen{pendingRows.length>0?` · ${pendingRows.length} belum ada operator`:""}</span>
            </div>
            <span style={{fontSize:14,color:"#94a3b8",transition:"transform .15s",transform:isOpen?"rotate(180deg)":"none"}}>▾</span>
          </div>
          {isOpen&&(
            <div style={{padding:"0 14px 14px 14px",display:"flex",flexDirection:"column",gap:10}}>
              {pendingRows.length>0&&(
                <div style={{background:"#fffbeb",border:"1.5px dashed #fcd34d",borderRadius:12,padding:"10px 12px",display:"flex",flexDirection:"column",gap:8}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#92400e"}}>BELUM ADA OPERATOR ({pendingRows.length})</div>
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {pendingRows.map((r:any)=>(
                      <div key={`${r.task.id}-${r.kode}-pending`} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,fontSize:12}}>
                        <span style={{fontWeight:600,color:"#374151"}}>{r.item.nama}</span>
                        <span style={{fontSize:10,color:"#94a3b8",fontFamily:"'DM Mono',monospace"}}>QTY {r.qtyKomp}</span>
                      </div>
                    ))}
                  </div>
                  <button onClick={()=>{setBulkAssignProses(proses);setBulkAssignPanelId(group.panelId);setTempBulkPekerjaIds([]);}}
                    style={{padding:"10px",borderRadius:10,border:"none",background:"#2563eb",color:"#fff",fontWeight:700,fontSize:12,cursor:"pointer"}}>
                    Pilih Operator ({pendingRows.length})
                  </button>
                  {bulkAssignProses===proses&&bulkAssignPanelId===group.panelId&&(
                    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
                      onClick={()=>{setBulkAssignProses(null);setBulkAssignPanelId(null);}}>
                      <div style={{background:"#fff",borderRadius:14,padding:20,width:"100%",maxWidth:380,maxHeight:"80vh",overflowY:"auto"}}
                        onClick={(e:any)=>e.stopPropagation()}>
                        <div style={{fontWeight:800,fontSize:14,color:"#1e293b",marginBottom:4}}>Pilih Operator</div>
                        <div style={{fontSize:11,color:"#94a3b8",marginBottom:14}}>Operator akan di-assign untuk {pendingRows.length} komponen di {group.panelNama}. Timer tetap perlu diklik manual per komponen.</div>
                        <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:16}}>
                          {pekerjaList.filter((p:any)=>p.divisi===user.divisi).map((p:any)=>{
                            const checked=tempBulkPekerjaIds.includes(p.id);
                            return(
                              <label key={p.id} style={{display:"flex",alignItems:"center",gap:10,border:`1.5px solid ${checked?"#2563eb":"#e2e8f0"}`,borderRadius:10,padding:"10px 12px",cursor:"pointer",background:checked?"#eff6ff":"#fff"}}>
                                <input type="checkbox" checked={checked}
                                  onChange={()=>setTempBulkPekerjaIds((prev:number[])=>checked?prev.filter((id:number)=>id!==p.id):[...prev,p.id])}/>
                                <span style={{fontSize:13,fontWeight:600,color:"#1e293b"}}>{p.nama}</span>
                              </label>
                            );
                          })}
                        </div>
                        <div style={{display:"flex",gap:8}}>
                          <button onClick={()=>{setBulkAssignProses(null);setBulkAssignPanelId(null);}}
                            style={{flex:1,padding:"10px",borderRadius:10,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#64748b",fontWeight:700,fontSize:13,cursor:"pointer"}}>Batal</button>
                          <button disabled={tempBulkPekerjaIds.length===0}
                            onClick={async()=>{
                              await bulkAssignAndStart(proses,pendingRows,tempBulkPekerjaIds);
                              setBulkAssignProses(null);
                              setBulkAssignPanelId(null);
                            }}
                            style={{flex:1,padding:"10px",borderRadius:10,border:"none",
                              background:tempBulkPekerjaIds.length===0?"#94a3b8":"#16a34a",color:"#fff",fontWeight:700,fontSize:13,
                              cursor:tempBulkPekerjaIds.length===0?"not-allowed":"pointer"}}>
                            Simpan ({tempBulkPekerjaIds.length})
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {activeRows.map((r:any)=>{
                const done=isDone(r);
                const bisaEdit=canEditProgressKomponen(r.task,r.kode,r.panelId,proses);
                const kInfo=r.wiringBadge||komponenInfoMap[`${r.panelId}_${proses}_${r.kode}`]||{};
                const fmtD=(d:string)=>d?new Date(d).toLocaleDateString("id-ID",{day:"numeric",month:"short"}):"–";
                const idsKomp=(r.task.pekerja_per_komponen||{})[r.kode]||[];
                const workers=idsKomp.map((id:number)=>pekerjaList.find((p:any)=>p.id===id)).filter(Boolean);
                return(
                  <div key={`${r.task.id}-${r.kode}-m`} style={{background:done?"#f0fdf4":"#fff",
                    border:`1.5px solid ${done?"#bbf7d0":"#e2e8f0"}`,borderRadius:14,padding:"12px 14px",
                    display:"flex",flexDirection:"column",gap:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                      <div style={{display:"flex",flexDirection:"column",gap:3}}>
                        <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                          {r.wpDef&&<span style={{background:r.wpDef.color+"18",color:r.wpDef.color,border:`1px solid ${r.wpDef.color}33`,borderRadius:4,padding:"1px 6px",fontSize:10,fontWeight:700}}>{r.wpDef.wp}</span>}
                          <span style={{fontWeight:700,fontSize:13,color:"#374151"}}>{r.item.nama}</span>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                          <span style={{fontSize:10,color:"#94a3b8",fontFamily:"'DM Mono',monospace"}}>{r.kode}</span>
                          <Badge label={r.task.prioritas||"Sedang"} color={r.priColor}/>
                          {cardMode==='timer'&&r.wiringBadge&&(
                            <span style={{background:"#eef2ff",color:"#4f46e5",borderRadius:6,padding:"1px 6px",fontSize:9,fontWeight:700}}>
                              ⚡ {(r.wiringBadge.bobot||"").replace("_"," ")} · {r.wiringBadge.jumlahOrang||"–"}org
                            </span>
                          )}
                        </div>
                      </div>
                      {r.pct===100
                        ?<Badge label="TERCAPAI" color="#16a34a" bg="#dcfce7"/>
                        :r.pct===0
                        ?<Badge label="BELUM MULAI" color="#94a3b8" bg="#f1f5f9"/>
                        :<Badge label="ON PROGRESS" color="#2563eb" bg="#dbeafe"/>
                      }
                    </div>

                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,fontSize:10,color:"#64748b"}}>
                      <div>QTY KOMP: <b style={{color:"#475569"}}>{r.qtyKomp} 🔒</b></div>
                      <div>CREATE BY: <b style={{color:"#475569"}}>{kInfo.createdBy||"–"}</b></div>
                      <div>TARGET: <b style={{color:"#1d4ed8"}}>{fmtD(kInfo.targetSelesai)}</b></div>
                      <div>AKTUAL: <b style={{color:r.pct>=100?"#16a34a":"#94a3b8"}}>{r.pct>=100?fmtD(r.aktualSelesai):"–"}</b></div>
                    </div>

                    {cardMode==='qty'?(()=>{
                      const locked=isCellLocked(r.panelId,r.kode,proses);
                      const floor=getLockedFloor(r.panelId,r.kode,proses);
                      return(
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          {locked?(
                            <span style={{padding:"7px 10px",borderRadius:8,border:"1.5px solid #16a34a",background:"#f0fdf4",fontSize:13,fontWeight:700,color:"#16a34a"}}>{r.qtyProses} 🔒</span>
                          ):(
                            <input type="number" min={floor} max={r.qtyKomp} value={r.qtyProses}
                              onChange={(e:any)=>updateQtyProses(r.panelId,r.kode,proses,Number(e.target.value))}
                              disabled={r.qtyKomp===0}
                              style={{width:70,padding:"8px",borderRadius:8,
                                border:`1.5px solid ${r.qtyKomp===0?"#e2e8f0":floor>0?"#f59e0b":"#2563eb"}`,
                                background:r.qtyKomp===0?"#f8fafc":floor>0?"#fffbeb":"#eff6ff",
                                fontSize:14,textAlign:"center",fontWeight:700,fontFamily:"'DM Mono',monospace",
                                color:r.qtyKomp===0?"#cbd5e1":floor>0?"#b45309":"#1d4ed8"}}/>
                          )}
                          <div style={{flex:1,background:"#e2e8f0",borderRadius:99,height:8,overflow:"hidden"}}>
                            <div style={{width:`${r.pct}%`,height:"100%",background:pColor(r.pct),borderRadius:99}}/>
                          </div>
                          <span style={{fontWeight:800,color:pColor(r.pct),fontFamily:"'DM Mono',monospace",fontSize:13,minWidth:34}}>{r.pct}%</span>
                        </div>
                      );
                    })():(
                      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                        {PCT_STEPS.map((s:number)=>{
                          const reached=r.pct>=s;
                          const isNext=!done&&s===PCT_STEPS.find((x:number)=>x>r.pct);
                          const prevStep=PCT_STEPS[PCT_STEPS.indexOf(s)-1]||0;
                          return(
                            <button key={s} disabled={!bisaEdit}
                              onClick={()=>{if(bisaEdit)updatePctManual(r.panelId,r.kode,proses,reached?prevStep:s);}}
                              style={{flex:1,minWidth:40,padding:"9px 4px",borderRadius:8,border:"none",
                                cursor:bisaEdit?"pointer":"not-allowed",
                                background:reached?pColor(s):isNext?"#eff6ff":"#f1f5f9",
                                color:reached?"#fff":isNext?pc:"#94a3b8",
                                fontWeight:700,fontSize:11,outline:isNext&&bisaEdit?`2px solid ${pc}`:"none"}}>
                              {reached?"✓":`${s}%`}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      {workers.map((w:any)=>{
                        const key=`${r.panelId}_${r.kode}_${proses}_${w.id}`;
                        const timer=timerAktif[key];
                        const loading=timerLoading===key;
                        let durasiLabel="";
                        if(timer){
                          const menitBerjalan=(Date.now()-new Date(timer.mulai).getTime())/60000;
                          const totalMenit=(timerDurasiSelesai[key]||0)+menitBerjalan;
                          const jam=Math.floor(totalMenit/60);
                          const menit=Math.round(totalMenit%60);
                          durasiLabel=jam>0?`${jam}j ${menit}m`:`${menit}m`;
                        }
                        return(
                          <div key={w.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,
                            background:DIVISI_CONFIG[w.divisi]?.bg||"#f1f5f9",borderRadius:20,padding:"4px 8px 4px 12px"}}>
                            <span style={{fontSize:12,fontWeight:700,color:DIVISI_CONFIG[w.divisi]?.color||"#64748b"}}>
                              {DIVISI_CONFIG[w.divisi]?.icon} {w.nama}
                            </span>
                            <button disabled={loading}
                              onClick={()=>timer?stopTimer(w.id,r.panelId,r.kode,proses):startTimer(w.id,r.panelId,r.kode,proses,viewDate)}
                              style={{fontSize:11,fontWeight:700,border:"none",borderRadius:10,padding:"5px 10px",cursor:loading?"not-allowed":"pointer",
                                background:timer?"#fef2f2":"#f0fdf4",color:timer?"#dc2626":"#16a34a"}}>
                              {loading?"...":timer?`⏹ ${durasiLabel}`:"▶ Mulai"}
                            </button>
                          </div>
                        );
                      })}
                      <button onClick={()=>{setOperatorModal({taskId:r.task.id,kode:r.kode});setTempPekerjaIds(idsKomp);}}
                        style={{fontSize:11,color:"#64748b",fontWeight:600,background:"none",border:"1px dashed #cbd5e1",borderRadius:10,padding:"7px 10px",cursor:"pointer"}}>
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
'''

    lines[start_idx:end_idx + 1] = [new_block]

    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = FILE_PATH + f".bak_{ts}"
    shutil.copy2(FILE_PATH, backup_path)
    print(f"✅ Backup dibuat: {backup_path}")

    with open(FILE_PATH, "w", encoding="utf-8") as f:
        f.writelines(lines)

    print("✅ Berhasil dirombak:")
    print("   1. Kartu mobile sekarang dikelompokkan per panel (accordion, klik buka/tutup)")
    print("   2. Tombol 'Pilih Operator' sekarang cuma assign, TIDAK auto-start timer")
    print("   3. Timer tetap diklik manual satu-satu (tombol Mulai) per komponen seperti biasa")
    print("\nLangkah selanjutnya:")
    print("   npm run build")
    print("Kalau ada TypeScript error, PASTE error-nya lengkap ke chat, jangan di-fix manual dulu.")

if __name__ == "__main__":
    main()
