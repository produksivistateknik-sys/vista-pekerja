# -*- coding: utf-8 -*-
"""
Script: apply_bulk_collect_flow.py
Tujuan: Ubah tampilan card mobile jadi alur "kumpulin dulu, baru assign operator sekali
        buat semua komponen terkumpul + auto-start timer semua sekaligus" - kayak pola
        Wiring Control drilldown, tapi dipakai buat SEMUA proses (batch/qty/timer) di mobile.
        Desktop TIDAK diubah sama sekali.

PRASYARAT: apply_mobile_cards.py sudah pernah dijalankan sebelumnya di file ini.

Cara pakai:
    python apply_bulk_collect_flow.py
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
    if "bulkAssignAndStart" in joined:
        fail("bulkAssignAndStart sudah ada di file ini — script ini sepertinya sudah pernah dijalankan.")
    if "PROSES_CARD_MODE" not in joined:
        fail("PROSES_CARD_MODE belum ada di file ini — jalankan apply_mobile_cards.py dulu sebelum script ini.")
    if "{viewMode==='mobile'?(" not in joined:
        fail("Blok mobile ({viewMode==='mobile'?(...)}) belum ketemu — jalankan apply_mobile_cards.py dulu, atau strukturnya sudah berubah.")

    # ---------- ANCHOR 1: state bulkAssignProses + tempBulkPekerjaIds ----------
    idx1 = find_line(lines, "const [tempPekerjaIds,setTempPekerjaIds]=useState<number[]>([]);")
    if idx1 is None:
        fail("Tidak ketemu baris state 'tempPekerjaIds'. Struktur mungkin berubah.")
    ind1 = indent_of(lines[idx1])
    lines.insert(idx1 + 1,
        f"{ind1}const [bulkAssignProses,setBulkAssignProses]=useState<string|null>(null);\n"
        f"{ind1}const [tempBulkPekerjaIds,setTempBulkPekerjaIds]=useState<number[]>([]);\n"
    )

    # ---------- ANCHOR 2: fungsi bulkAssignAndStart, taruh setelah updatePekerjaPerKomponen selesai ----------
    idx2 = find_line(lines, 'setRenhar(prev=>prev.map((t:any)=>t.id===taskId?{...t,pekerja_per_komponen:newMap}:t));')
    if idx2 is None:
        fail("Tidak ketemu baris dalam fungsi 'updatePekerjaPerKomponen'. Struktur mungkin berubah.")
    close_idx = None
    for i in range(idx2 + 1, len(lines)):
        if lines[i].strip() == "};":
            close_idx = i
            break
    if close_idx is None:
        fail("Tidak ketemu penutup fungsi 'updatePekerjaPerKomponen'.")
    ind2 = indent_of(lines[idx2])
    fn_indent = ind2[:-2] if len(ind2) >= 2 else ind2  # asumsi body 2 spasi lebih dalam dari deklarasi fungsi
    bulk_fn = f"""
{fn_indent}const bulkAssignAndStart=async(proses:string,rowsToAssign:any[],pekerjaIds:number[])=>{{
{fn_indent}  for(const r of rowsToAssign){{
{fn_indent}    await updatePekerjaPerKomponen(r.task.id,r.kode,pekerjaIds);
{fn_indent}  }}
{fn_indent}  for(const r of rowsToAssign){{
{fn_indent}    for(const pid of pekerjaIds){{
{fn_indent}      await startTimer(pid,r.panelId,r.kode,proses,viewDate);
{fn_indent}    }}
{fn_indent}  }}
{fn_indent}}};
"""
    lines.insert(close_idx + 1, bulk_fn)

    # ---------- ANCHOR 3: visibleRows filter berlaku juga saat mobile ----------
    idx3 = None
    for i, line in enumerate(lines):
        if line.strip().startswith("const visibleRows=isDrilldownProses?rows.filter("):
            idx3 = i
            break
    if idx3 is None:
        fail("Tidak ketemu baris 'const visibleRows=isDrilldownProses?rows.filter(...)'. Struktur mungkin berubah.")
    lines[idx3] = lines[idx3].replace(
        "isDrilldownProses?rows.filter(",
        "(isDrilldownProses||viewMode==='mobile')?rows.filter("
    )

    # ---------- ANCHOR 4: tombol '+ Pilih Komponen' per panel juga muncul saat mobile ----------
    idx4 = find_line(lines, "{isDrilldownProses&&(")
    if idx4 is None:
        fail("Tidak ketemu baris '{isDrilldownProses&&(' (blok tombol pilih komponen per panel). Struktur mungkin berubah.")
    lines[idx4] = lines[idx4].replace(
        "{isDrilldownProses&&(",
        "{(isDrilldownProses||viewMode==='mobile')&&("
    )

    # ---------- ANCHOR 5: ganti isi blok mobile (viewMode==='mobile'?( ... ):( ) ----------
    start_idx = find_line(lines, "{viewMode==='mobile'?(")
    if start_idx is None:
        fail("Tidak ketemu baris pembuka blok mobile.")
    end_idx = None
    for i in range(start_idx + 1, len(lines) - 2):
        if lines[i].strip() == "</div>" and lines[i + 1].strip() == "):(":
            # pastikan baris sesudahnya memang pembuka tabel desktop (bukan kecocokan kebetulan)
            if lines[i + 2].strip().startswith('<div style={{overflowX:"auto"}}>'):
                end_idx = i + 1
                break
    if end_idx is None:
        fail("Tidak ketemu baris penutup blok mobile ('</div>' diikuti '):(' lalu pembuka tabel desktop). Struktur mungkin berubah.")

    ind = indent_of(lines[start_idx])

    new_mobile_block = f"""{ind}{{viewMode==='mobile'?(
{ind}  <div style={{{{display:"flex",flexDirection:"column",gap:14,padding:"4px 2px"}}}}>
{ind}    {{(()=>{{
{ind}      const activeRows=visibleRows.filter((r:any)=>((r.task.pekerja_per_komponen||{{}})[r.kode]||[]).length>0);
{ind}      const pendingRows=visibleRows.filter((r:any)=>((r.task.pekerja_per_komponen||{{}})[r.kode]||[]).length===0);
{ind}      return(
{ind}        <>
{ind}          {{pendingRows.length>0&&(
{ind}            <div style={{{{background:"#fff",border:"1.5px dashed #cbd5e1",borderRadius:14,padding:"12px 14px",display:"flex",flexDirection:"column",gap:8}}}}>
{ind}              <div style={{{{fontSize:11,fontWeight:700,color:"#64748b"}}}}>TERKUMPUL, BELUM ADA OPERATOR ({{pendingRows.length}})</div>
{ind}              <div style={{{{display:"flex",flexDirection:"column",gap:6}}}}>
{ind}                {{pendingRows.map((r:any)=>(
{ind}                  <div key={{`${{r.task.id}}-${{r.kode}}-pending`}} style={{{{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,fontSize:12,paddingBottom:6,borderBottom:"1px solid #f1f5f9"}}}}>
{ind}                    <div style={{{{display:"flex",flexDirection:"column"}}}}>
{ind}                      <span style={{{{fontWeight:600,color:"#374151"}}}}>{{r.item.nama}}</span>
{ind}                      <span style={{{{fontSize:10,color:"#94a3b8"}}}}>{{r.task.proyek}} · {{r.panel.nama}} · {{r.kode}}</span>
{ind}                    </div>
{ind}                    <span style={{{{fontSize:10,color:"#94a3b8",fontFamily:"'DM Mono',monospace"}}}}>QTY {{r.qtyKomp}}</span>
{ind}                  </div>
{ind}                ))}}
{ind}              </div>
{ind}              <button onClick={{()=>{{setBulkAssignProses(proses);setTempBulkPekerjaIds([]);}}}}
{ind}                style={{{{marginTop:4,padding:"11px",borderRadius:10,border:"none",background:"#2563eb",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}}}>
{ind}                Pilih Operator & Mulai ({{pendingRows.length}})
{ind}              </button>
{ind}              {{bulkAssignProses===proses&&(
{ind}                <div style={{{{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}}}
{ind}                  onClick={{()=>setBulkAssignProses(null)}}>
{ind}                  <div style={{{{background:"#fff",borderRadius:14,padding:20,width:"100%",maxWidth:380,maxHeight:"80vh",overflowY:"auto"}}}}
{ind}                    onClick={{(e:any)=>e.stopPropagation()}}>
{ind}                    <div style={{{{fontWeight:800,fontSize:14,color:"#1e293b",marginBottom:4}}}}>Pilih Operator</div>
{ind}                    <div style={{{{fontSize:11,color:"#94a3b8",marginBottom:14}}}}>Operator akan di-assign & timer langsung mulai untuk {{pendingRows.length}} komponen terkumpul di {{proses}}</div>
{ind}                    <div style={{{{display:"flex",flexDirection:"column",gap:6,marginBottom:16}}}}>
{ind}                      {{pekerjaList.filter((p:any)=>p.divisi===user.divisi).map((p:any)=>{{
{ind}                        const checked=tempBulkPekerjaIds.includes(p.id);
{ind}                        return(
{ind}                          <label key={{p.id}} style={{{{display:"flex",alignItems:"center",gap:10,border:`1.5px solid ${{checked?"#2563eb":"#e2e8f0"}}`,borderRadius:10,padding:"10px 12px",cursor:"pointer",background:checked?"#eff6ff":"#fff"}}}}>
{ind}                            <input type="checkbox" checked={{checked}}
{ind}                              onChange={{()=>setTempBulkPekerjaIds((prev:number[])=>checked?prev.filter((id:number)=>id!==p.id):[...prev,p.id])}}/>
{ind}                            <span style={{{{fontSize:13,fontWeight:600,color:"#1e293b"}}}}>{{p.nama}}</span>
{ind}                          </label>
{ind}                        );
{ind}                      }})}}
{ind}                    </div>
{ind}                    <div style={{{{display:"flex",gap:8}}}}>
{ind}                      <button onClick={{()=>setBulkAssignProses(null)}}
{ind}                        style={{{{flex:1,padding:"10px",borderRadius:10,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#64748b",fontWeight:700,fontSize:13,cursor:"pointer"}}}}>Batal</button>
{ind}                      <button disabled={{tempBulkPekerjaIds.length===0}}
{ind}                        onClick={{async()=>{{
{ind}                          await bulkAssignAndStart(proses,pendingRows,tempBulkPekerjaIds);
{ind}                          setBulkAssignProses(null);
{ind}                        }}}}
{ind}                        style={{{{flex:1,padding:"10px",borderRadius:10,border:"none",
{ind}                          background:tempBulkPekerjaIds.length===0?"#94a3b8":"#16a34a",color:"#fff",fontWeight:700,fontSize:13,
{ind}                          cursor:tempBulkPekerjaIds.length===0?"not-allowed":"pointer"}}}}>
{ind}                        Mulai ({{tempBulkPekerjaIds.length}})
{ind}                      </button>
{ind}                    </div>
{ind}                  </div>
{ind}                </div>
{ind}              )}}
{ind}            </div>
{ind}          )}}

{ind}          {{activeRows.map((r:any)=>{{
{ind}            const done=isDone(r);
{ind}            const bisaEdit=canEditProgressKomponen(r.task,r.kode,r.panelId,proses);
{ind}            const kInfo=r.wiringBadge||komponenInfoMap[`${{r.panelId}}_${{proses}}_${{r.kode}}`]||{{}};
{ind}            const fmtD=(d:string)=>d?new Date(d).toLocaleDateString("id-ID",{{day:"numeric",month:"short"}}):"–";
{ind}            const idsKomp=(r.task.pekerja_per_komponen||{{}})[r.kode]||[];
{ind}            const workers=idsKomp.map((id:number)=>pekerjaList.find((p:any)=>p.id===id)).filter(Boolean);
{ind}            return(
{ind}              <div key={{`${{r.task.id}}-${{r.kode}}-m`}} style={{{{background:done?"#f0fdf4":"#fff",
{ind}                border:`1.5px solid ${{done?"#bbf7d0":"#e2e8f0"}}`,borderRadius:14,padding:"12px 14px",
{ind}                display:"flex",flexDirection:"column",gap:10}}}}>
{ind}                <div style={{{{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}}}>
{ind}                  <div style={{{{display:"flex",flexDirection:"column",gap:3}}}}>
{ind}                    <div style={{{{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}}}>
{ind}                      {{r.wpDef&&<span style={{{{background:r.wpDef.color+"18",color:r.wpDef.color,border:`1px solid ${{r.wpDef.color}}33`,borderRadius:4,padding:"1px 6px",fontSize:10,fontWeight:700}}}}>{{r.wpDef.wp}}</span>}}
{ind}                      <span style={{{{fontWeight:700,fontSize:13,color:"#374151"}}}}>{{r.item.nama}}</span>
{ind}                    </div>
{ind}                    <div style={{{{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}}}>
{ind}                      <span style={{{{fontSize:10,color:"#94a3b8",fontFamily:"'DM Mono',monospace"}}}}>{{r.kode}}</span>
{ind}                      <Badge label={{r.task.prioritas||"Sedang"}} color={{r.priColor}}/>
{ind}                      {{cardMode==='timer'&&r.wiringBadge&&(
{ind}                        <span style={{{{background:"#eef2ff",color:"#4f46e5",borderRadius:6,padding:"1px 6px",fontSize:9,fontWeight:700}}}}>
{ind}                          ⚡ {{(r.wiringBadge.bobot||"").replace("_"," ")}} · {{r.wiringBadge.jumlahOrang||"–"}}org
{ind}                        </span>
{ind}                      )}}
{ind}                    </div>
{ind}                  </div>
{ind}                  {{r.pct===100
{ind}                    ?<Badge label="TERCAPAI" color="#16a34a" bg="#dcfce7"/>
{ind}                    :r.pct===0
{ind}                    ?<Badge label="BELUM MULAI" color="#94a3b8" bg="#f1f5f9"/>
{ind}                    :<Badge label="ON PROGRESS" color="#2563eb" bg="#dbeafe"/>
{ind}                  }}
{ind}                </div>

{ind}                <div style={{{{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,fontSize:10,color:"#64748b"}}}}>
{ind}                  <div>QTY KOMP: <b style={{{{color:"#475569"}}}}>{{r.qtyKomp}} 🔒</b></div>
{ind}                  <div>CREATE BY: <b style={{{{color:"#475569"}}}}>{{kInfo.createdBy||"–"}}</b></div>
{ind}                  <div>TARGET: <b style={{{{color:"#1d4ed8"}}}}>{{fmtD(kInfo.targetSelesai)}}</b></div>
{ind}                  <div>AKTUAL: <b style={{{{color:r.pct>=100?"#16a34a":"#94a3b8"}}}}>{{r.pct>=100?fmtD(r.aktualSelesai):"–"}}</b></div>
{ind}                </div>

{ind}                {{cardMode==='qty'?(()=>{{
{ind}                  const locked=isCellLocked(r.panelId,r.kode,proses);
{ind}                  const floor=getLockedFloor(r.panelId,r.kode,proses);
{ind}                  return(
{ind}                    <div style={{{{display:"flex",alignItems:"center",gap:10}}}}>
{ind}                      {{locked?(
{ind}                        <span style={{{{padding:"7px 10px",borderRadius:8,border:"1.5px solid #16a34a",background:"#f0fdf4",fontSize:13,fontWeight:700,color:"#16a34a"}}}}>{{r.qtyProses}} 🔒</span>
{ind}                      ):(
{ind}                        <input type="number" min={{floor}} max={{r.qtyKomp}} value={{r.qtyProses}}
{ind}                          onChange={{(e:any)=>updateQtyProses(r.panelId,r.kode,proses,Number(e.target.value))}}
{ind}                          disabled={{r.qtyKomp===0}}
{ind}                          style={{{{width:70,padding:"8px",borderRadius:8,
{ind}                            border:`1.5px solid ${{r.qtyKomp===0?"#e2e8f0":floor>0?"#f59e0b":"#2563eb"}}`,
{ind}                            background:r.qtyKomp===0?"#f8fafc":floor>0?"#fffbeb":"#eff6ff",
{ind}                            fontSize:14,textAlign:"center",fontWeight:700,fontFamily:"'DM Mono',monospace",
{ind}                            color:r.qtyKomp===0?"#cbd5e1":floor>0?"#b45309":"#1d4ed8"}}}}/>
{ind}                      )}}
{ind}                      <div style={{{{flex:1,background:"#e2e8f0",borderRadius:99,height:8,overflow:"hidden"}}}}>
{ind}                        <div style={{{{width:`${{r.pct}}%`,height:"100%",background:pColor(r.pct),borderRadius:99}}}}/>
{ind}                      </div>
{ind}                      <span style={{{{fontWeight:800,color:pColor(r.pct),fontFamily:"'DM Mono',monospace",fontSize:13,minWidth:34}}}}>{{r.pct}}%</span>
{ind}                    </div>
{ind}                  );
{ind}                }})():(
{ind}                  <div style={{{{display:"flex",gap:6,flexWrap:"wrap"}}}}>
{ind}                    {{PCT_STEPS.map((s:number)=>{{
{ind}                      const reached=r.pct>=s;
{ind}                      const isNext=!done&&s===PCT_STEPS.find((x:number)=>x>r.pct);
{ind}                      const prevStep=PCT_STEPS[PCT_STEPS.indexOf(s)-1]||0;
{ind}                      return(
{ind}                        <button key={{s}} disabled={{!bisaEdit}}
{ind}                          onClick={{()=>{{if(bisaEdit)updatePctManual(r.panelId,r.kode,proses,reached?prevStep:s);}}}}
{ind}                          style={{{{flex:1,minWidth:40,padding:"9px 4px",borderRadius:8,border:"none",
{ind}                            cursor:bisaEdit?"pointer":"not-allowed",
{ind}                            background:reached?pColor(s):isNext?"#eff6ff":"#f1f5f9",
{ind}                            color:reached?"#fff":isNext?pc:"#94a3b8",
{ind}                            fontWeight:700,fontSize:11,outline:isNext&&bisaEdit?`2px solid ${{pc}}`:"none"}}}}>
{ind}                          {{reached?"✓":`${{s}}%`}}
{ind}                        </button>
{ind}                      );
{ind}                    }})}}
{ind}                  </div>
{ind}                )}}

{ind}                <div style={{{{display:"flex",flexDirection:"column",gap:6}}}}>
{ind}                  {{workers.map((w:any)=>{{
{ind}                    const key=`${{r.panelId}}_${{r.kode}}_${{proses}}_${{w.id}}`;
{ind}                    const timer=timerAktif[key];
{ind}                    const loading=timerLoading===key;
{ind}                    let durasiLabel="";
{ind}                    if(timer){{
{ind}                      const menitBerjalan=(Date.now()-new Date(timer.mulai).getTime())/60000;
{ind}                      const totalMenit=(timerDurasiSelesai[key]||0)+menitBerjalan;
{ind}                      const jam=Math.floor(totalMenit/60);
{ind}                      const menit=Math.round(totalMenit%60);
{ind}                      durasiLabel=jam>0?`${{jam}}j ${{menit}}m`:`${{menit}}m`;
{ind}                    }}
{ind}                    return(
{ind}                      <div key={{w.id}} style={{{{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,
{ind}                        background:DIVISI_CONFIG[w.divisi]?.bg||"#f1f5f9",borderRadius:20,padding:"4px 8px 4px 12px"}}}}>
{ind}                        <span style={{{{fontSize:12,fontWeight:700,color:DIVISI_CONFIG[w.divisi]?.color||"#64748b"}}}}>
{ind}                          {{DIVISI_CONFIG[w.divisi]?.icon}} {{w.nama}}
{ind}                        </span>
{ind}                        <button disabled={{loading}}
{ind}                          onClick={{()=>timer?stopTimer(w.id,r.panelId,r.kode,proses):startTimer(w.id,r.panelId,r.kode,proses,viewDate)}}
{ind}                          style={{{{fontSize:11,fontWeight:700,border:"none",borderRadius:10,padding:"5px 10px",cursor:loading?"not-allowed":"pointer",
{ind}                            background:timer?"#fef2f2":"#f0fdf4",color:timer?"#dc2626":"#16a34a"}}}}>
{ind}                          {{loading?"...":timer?`⏹ ${{durasiLabel}}`:"▶ Mulai"}}
{ind}                        </button>
{ind}                      </div>
{ind}                    );
{ind}                  }})}}
{ind}                  <button onClick={{()=>{{setOperatorModal({{taskId:r.task.id,kode:r.kode}});setTempPekerjaIds(idsKomp);}}}}
{ind}                    style={{{{fontSize:11,color:"#64748b",fontWeight:600,background:"none",border:"1px dashed #cbd5e1",borderRadius:10,padding:"7px 10px",cursor:"pointer"}}}}>
{ind}                    {{workers.length>0?"+ Edit Operator":"+ Pilih Operator"}}
{ind}                  </button>
{ind}                </div>
{ind}              </div>
{ind}            );
{ind}          }})}}

{ind}          {{visibleRows.length===0&&(
{ind}            <div style={{{{textAlign:"center",padding:"24px 10px",color:"#94a3b8",fontSize:12}}}}>
{ind}              Belum ada komponen dikumpulkan.<br/>Tap panel di atas untuk pilih komponen.
{ind}            </div>
{ind}          )}}
{ind}        </>
{ind}      );
{ind}    }})()}}
{ind}  </div>
{ind}):(
"""

    lines[start_idx:end_idx + 1] = [new_mobile_block]

    # ---------- simpan ----------
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = FILE_PATH + f".bak_{ts}"
    shutil.copy2(FILE_PATH, backup_path)
    print(f"✅ Backup dibuat: {backup_path}")

    with open(FILE_PATH, "w", encoding="utf-8") as f:
        f.writelines(lines)

    print("✅ Berhasil disisipkan:")
    print("   1. State bulkAssignProses, tempBulkPekerjaIds")
    print("   2. Fungsi bulkAssignAndStart (assign operator + start timer untuk banyak komponen sekaligus)")
    print("   3. visibleRows & tombol '+ Pilih Komponen' sekarang aktif juga di mobile (semua proses)")
    print("   4. Blok mobile baru: TERKUMPUL (belum ada operator) vs kartu detail (sudah ada operator)")
    print("\nLangkah selanjutnya:")
    print("   npm run build")
    print("Kalau ada TypeScript error, PASTE error-nya lengkap ke chat, jangan di-fix manual dulu.")

if __name__ == "__main__":
    main()
