# -*- coding: utf-8 -*-
"""
Script: apply_mobile_cards.py
Tujuan: Nambahin tampilan CARD MOBILE di OperatorView (Vista Pekerja),
        3 mode: batch (Potong/Rendam/Painting), qty (Bending/Stel/Assembling),
        timer (Wiring Control/Power). Tabel desktop yang sudah ada TIDAK diubah/dihapus,
        cuma dibungkus kondisi viewMode==='desktop', dan ditambah cabang mobile di sebelahnya.

Cara pakai:
    python apply_mobile_cards.py

Aman dijalankan berkali-kali (idempotent check) - kalau anchor sudah pernah
disisipkan sebelumnya, script akan berhenti dan bilang "sudah pernah di-apply".
"""
import re
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

def main():
    try:
        with open(FILE_PATH, "r", encoding="utf-8") as f:
            lines = f.readlines()
    except FileNotFoundError:
        fail(f"File tidak ditemukan di {FILE_PATH}")

    # ---------- idempotency check ----------
    joined_check = "".join(lines)
    if "PROSES_CARD_MODE" in joined_check:
        fail("PROSES_CARD_MODE sudah ada di file ini — sepertinya script ini sudah pernah dijalankan sebelumnya. Cek manual dulu sebelum lanjut.")

    # ---------- ANCHOR 1: sisipkan const PROSES_CARD_MODE + cardMode ----------
    anchor1_idx = None
    for i, line in enumerate(lines):
        if line.strip() == "const isQtyBased=QTY_DIVISI.includes(user.divisi);":
            anchor1_idx = i
            break
    if anchor1_idx is None:
        fail("Tidak ketemu baris 'const isQtyBased=QTY_DIVISI.includes(user.divisi);' — struktur file mungkin sudah berubah dari yang saya lihat terakhir. Kirim ulang dump terbaru kalau ini muncul.")

    ind1 = indent_of(lines[anchor1_idx])
    proses_card_mode_block = (
        f"{ind1}const PROSES_CARD_MODE:Record<string,string>={{\n"
        f"{ind1}  POTONG:'batch',RENDAM:'batch',PAINTING:'batch',\n"
        f"{ind1}  BENDING:'qty',STEL:'qty',FINISHING:'qty',RAKIT:'qty',\"PASANG KOMPONEN\":'qty',BUSBAR:'qty',\n"
        f"{ind1}  \"WIRING CONTROL\":'timer',\"WIRING POWER\":'timer',\n"
        f"{ind1}}};\n"
    )
    lines.insert(anchor1_idx + 1, proses_card_mode_block)

    # ---------- ANCHOR 2: sisipkan const cardMode di dalam myProses.map ----------
    anchor2_idx = None
    for i, line in enumerate(lines):
        if line.strip() == 'const isWiringProses=["WIRING CONTROL","WIRING POWER"].includes(proses);':
            anchor2_idx = i
            break
    if anchor2_idx is None:
        fail("Tidak ketemu baris 'const isWiringProses=[\"WIRING CONTROL\",\"WIRING POWER\"].includes(proses);' di dalam myProses.map. Struktur mungkin berubah.")

    ind2 = indent_of(lines[anchor2_idx])
    lines.insert(anchor2_idx + 1, f"{ind2}const cardMode=PROSES_CARD_MODE[proses]||'qty';\n")

    # ---------- ANCHOR 3: bungkus blok <div overflowX auto><table>...</table></div> ----------
    start_idx = None
    for i, line in enumerate(lines):
        if line.strip() == '<div style={{overflowX:"auto"}}>':
            # pastikan baris berikutnya (skip blank) adalah <table ...>
            j = i + 1
            while j < len(lines) and lines[j].strip() == "":
                j += 1
            if j < len(lines) and lines[j].strip().startswith('<table style={{width:"100%"'):
                start_idx = i
                break
    if start_idx is None:
        fail("Tidak ketemu blok pembuka '<div style={{overflowX:\"auto\"}}><table ...>' desktop table. Struktur mungkin berubah.")

    # cari </table> pertama setelah start_idx, lalu </div> tepat setelahnya
    table_close_idx = None
    for i in range(start_idx + 1, len(lines)):
        if lines[i].strip() == "</table>":
            table_close_idx = i
            break
    if table_close_idx is None:
        fail("Tidak ketemu penutup '</table>' yang sesuai.")

    div_close_idx = None
    j = table_close_idx + 1
    while j < len(lines) and lines[j].strip() == "":
        j += 1
    if j < len(lines) and lines[j].strip() == "</div>":
        div_close_idx = j
    if div_close_idx is None:
        fail("Tidak ketemu '</div>' penutup tepat setelah '</table>'. Struktur mungkin berubah.")

    ind3 = indent_of(lines[start_idx])

    # --- konten kartu mobile ---
    mobile_block = f"""{ind3}{{viewMode==='mobile'?(
{ind3}  <div style={{{{display:"flex",flexDirection:"column",gap:10,padding:"4px 2px"}}}}>
{ind3}    {{visibleRows.map((r:any)=>{{
{ind3}      const done=isDone(r);
{ind3}      const bisaEdit=canEditProgressKomponen(r.task,r.kode,r.panelId,proses);
{ind3}      const kInfo=r.wiringBadge||komponenInfoMap[`${{r.panelId}}_${{proses}}_${{r.kode}}`]||{{}};
{ind3}      const fmtD=(d:string)=>d?new Date(d).toLocaleDateString("id-ID",{{day:"numeric",month:"short"}}):"–";
{ind3}      const idsKomp=(r.task.pekerja_per_komponen||{{}})[r.kode]||[];
{ind3}      const workers=idsKomp.map((id:number)=>pekerjaList.find((p:any)=>p.id===id)).filter(Boolean);
{ind3}      return(
{ind3}        <div key={{`${{r.task.id}}-${{r.kode}}-m`}} style={{{{background:done?"#f0fdf4":"#fff",
{ind3}          border:`1.5px solid ${{done?"#bbf7d0":"#e2e8f0"}}`,borderRadius:14,padding:"12px 14px",
{ind3}          display:"flex",flexDirection:"column",gap:10}}}}>
{ind3}          <div style={{{{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}}}>
{ind3}            <div style={{{{display:"flex",flexDirection:"column",gap:3}}}}>
{ind3}              <div style={{{{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}}}>
{ind3}                {{r.wpDef&&<span style={{{{background:r.wpDef.color+"18",color:r.wpDef.color,border:`1px solid ${{r.wpDef.color}}33`,borderRadius:4,padding:"1px 6px",fontSize:10,fontWeight:700}}}}>{{r.wpDef.wp}}</span>}}
{ind3}                <span style={{{{fontWeight:700,fontSize:13,color:"#374151"}}}}>{{r.item.nama}}</span>
{ind3}              </div>
{ind3}              <div style={{{{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}}}>
{ind3}                <span style={{{{fontSize:10,color:"#94a3b8",fontFamily:"'DM Mono',monospace"}}}}>{{r.kode}}</span>
{ind3}                <Badge label={{r.task.prioritas||"Sedang"}} color={{r.priColor}}/>
{ind3}                {{cardMode==='timer'&&r.wiringBadge&&(
{ind3}                  <span style={{{{background:"#eef2ff",color:"#4f46e5",borderRadius:6,padding:"1px 6px",fontSize:9,fontWeight:700}}}}>
{ind3}                    ⚡ {{(r.wiringBadge.bobot||"").replace("_"," ")}} · {{r.wiringBadge.jumlahOrang||"–"}}org
{ind3}                  </span>
{ind3}                )}}
{ind3}              </div>
{ind3}            </div>
{ind3}            {{r.pct===100
{ind3}              ?<Badge label="TERCAPAI" color="#16a34a" bg="#dcfce7"/>
{ind3}              :r.pct===0
{ind3}              ?<Badge label="BELUM MULAI" color="#94a3b8" bg="#f1f5f9"/>
{ind3}              :<Badge label="ON PROGRESS" color="#2563eb" bg="#dbeafe"/>
{ind3}            }}
{ind3}          </div>

{ind3}          <div style={{{{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,fontSize:10,color:"#64748b"}}}}>
{ind3}            <div>QTY KOMP: <b style={{{{color:"#475569"}}}}>{{r.qtyKomp}} 🔒</b></div>
{ind3}            <div>CREATE BY: <b style={{{{color:"#475569"}}}}>{{kInfo.createdBy||"–"}}</b></div>
{ind3}            <div>TARGET: <b style={{{{color:"#1d4ed8"}}}}>{{fmtD(kInfo.targetSelesai)}}</b></div>
{ind3}            <div>AKTUAL: <b style={{{{color:r.pct>=100?"#16a34a":"#94a3b8"}}}}>{{r.pct>=100?fmtD(r.aktualSelesai):"–"}}</b></div>
{ind3}          </div>

{ind3}          {{cardMode==='qty'?(()=>{{
{ind3}            const locked=isCellLocked(r.panelId,r.kode,proses);
{ind3}            const floor=getLockedFloor(r.panelId,r.kode,proses);
{ind3}            return(
{ind3}              <div style={{{{display:"flex",alignItems:"center",gap:10}}}}>
{ind3}                {{locked?(
{ind3}                  <span style={{{{padding:"7px 10px",borderRadius:8,border:"1.5px solid #16a34a",background:"#f0fdf4",fontSize:13,fontWeight:700,color:"#16a34a"}}}}>{{r.qtyProses}} 🔒</span>
{ind3}                ):(
{ind3}                  <input type="number" min={{floor}} max={{r.qtyKomp}} value={{r.qtyProses}}
{ind3}                    onChange={{(e:any)=>updateQtyProses(r.panelId,r.kode,proses,Number(e.target.value))}}
{ind3}                    disabled={{r.qtyKomp===0}}
{ind3}                    style={{{{width:70,padding:"8px",borderRadius:8,
{ind3}                      border:`1.5px solid ${{r.qtyKomp===0?"#e2e8f0":floor>0?"#f59e0b":"#2563eb"}}`,
{ind3}                      background:r.qtyKomp===0?"#f8fafc":floor>0?"#fffbeb":"#eff6ff",
{ind3}                      fontSize:14,textAlign:"center",fontWeight:700,fontFamily:"'DM Mono',monospace",
{ind3}                      color:r.qtyKomp===0?"#cbd5e1":floor>0?"#b45309":"#1d4ed8"}}}}/>
{ind3}                )}}
{ind3}                <div style={{{{flex:1,background:"#e2e8f0",borderRadius:99,height:8,overflow:"hidden"}}}}>
{ind3}                  <div style={{{{width:`${{r.pct}}%`,height:"100%",background:pColor(r.pct),borderRadius:99}}}}/>
{ind3}                </div>
{ind3}                <span style={{{{fontWeight:800,color:pColor(r.pct),fontFamily:"'DM Mono',monospace",fontSize:13,minWidth:34}}}}>{{r.pct}}%</span>
{ind3}              </div>
{ind3}            );
{ind3}          }})():(
{ind3}            <div style={{{{display:"flex",gap:6,flexWrap:"wrap"}}}}>
{ind3}              {{PCT_STEPS.map((s:number)=>{{
{ind3}                const reached=r.pct>=s;
{ind3}                const isNext=!done&&s===PCT_STEPS.find((x:number)=>x>r.pct);
{ind3}                const prevStep=PCT_STEPS[PCT_STEPS.indexOf(s)-1]||0;
{ind3}                return(
{ind3}                  <button key={{s}} disabled={{!bisaEdit}}
{ind3}                    onClick={{()=>{{if(bisaEdit)updatePctManual(r.panelId,r.kode,proses,reached?prevStep:s);}}}}
{ind3}                    style={{{{flex:1,minWidth:40,padding:"9px 4px",borderRadius:8,border:"none",
{ind3}                      cursor:bisaEdit?"pointer":"not-allowed",
{ind3}                      background:reached?pColor(s):isNext?"#eff6ff":"#f1f5f9",
{ind3}                      color:reached?"#fff":isNext?pc:"#94a3b8",
{ind3}                      fontWeight:700,fontSize:11,outline:isNext&&bisaEdit?`2px solid ${{pc}}`:"none"}}}}>
{ind3}                    {{reached?"✓":`${{s}}%`}}
{ind3}                  </button>
{ind3}                );
{ind3}              }})}}
{ind3}            </div>
{ind3}          )}}

{ind3}          <div style={{{{display:"flex",flexDirection:"column",gap:6}}}}>
{ind3}            {{workers.map((w:any)=>{{
{ind3}              const key=`${{r.panelId}}_${{r.kode}}_${{proses}}_${{w.id}}`;
{ind3}              const timer=timerAktif[key];
{ind3}              const loading=timerLoading===key;
{ind3}              let durasiLabel="";
{ind3}              if(timer){{
{ind3}                const menitBerjalan=(Date.now()-new Date(timer.mulai).getTime())/60000;
{ind3}                const totalMenit=(timerDurasiSelesai[key]||0)+menitBerjalan;
{ind3}                const jam=Math.floor(totalMenit/60);
{ind3}                const menit=Math.round(totalMenit%60);
{ind3}                durasiLabel=jam>0?`${{jam}}j ${{menit}}m`:`${{menit}}m`;
{ind3}              }}
{ind3}              return(
{ind3}                <div key={{w.id}} style={{{{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,
{ind3}                  background:DIVISI_CONFIG[w.divisi]?.bg||"#f1f5f9",borderRadius:20,padding:"4px 8px 4px 12px"}}}}>
{ind3}                  <span style={{{{fontSize:12,fontWeight:700,color:DIVISI_CONFIG[w.divisi]?.color||"#64748b"}}}}>
{ind3}                    {{DIVISI_CONFIG[w.divisi]?.icon}} {{w.nama}}
{ind3}                  </span>
{ind3}                  <button disabled={{loading}}
{ind3}                    onClick={{()=>timer?stopTimer(w.id,r.panelId,r.kode,proses):startTimer(w.id,r.panelId,r.kode,proses,viewDate)}}
{ind3}                    style={{{{fontSize:11,fontWeight:700,border:"none",borderRadius:10,padding:"5px 10px",cursor:loading?"not-allowed":"pointer",
{ind3}                      background:timer?"#fef2f2":"#f0fdf4",color:timer?"#dc2626":"#16a34a"}}}}>
{ind3}                    {{loading?"...":timer?`⏹ ${{durasiLabel}}`:"▶ Mulai"}}
{ind3}                  </button>
{ind3}                </div>
{ind3}              );
{ind3}            }})}}
{ind3}            <button onClick={{()=>{{setOperatorModal({{taskId:r.task.id,kode:r.kode}});setTempPekerjaIds(idsKomp);}}}}
{ind3}              style={{{{fontSize:11,color:"#64748b",fontWeight:600,background:"none",border:"1px dashed #cbd5e1",borderRadius:10,padding:"7px 10px",cursor:"pointer"}}}}>
{ind3}              {{workers.length>0?"+ Edit Operator":"+ Pilih Operator"}}
{ind3}            </button>
{ind3}          </div>
{ind3}        </div>
{ind3}      );
{ind3}    }})}}
{ind3}  </div>
{ind3}):(
"""

    lines.insert(start_idx, mobile_block)
    # setelah insert, semua index sesudah start_idx bergeser +1 baris (karena mobile_block dianggap 1 elemen list yang berisi banyak "\n")
    div_close_idx_shifted = div_close_idx + 1

    lines.insert(div_close_idx_shifted + 1, f"{ind3})}}\n")

    # ---------- simpan ----------
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = FILE_PATH + f".bak_{ts}"
    shutil.copy2(FILE_PATH, backup_path)
    print(f"✅ Backup dibuat: {backup_path}")

    with open(FILE_PATH, "w", encoding="utf-8") as f:
        f.writelines(lines)

    print("✅ Berhasil disisipkan:")
    print("   1. const PROSES_CARD_MODE (setelah isQtyBased)")
    print("   2. const cardMode (di dalam myProses.map)")
    print("   3. Blok kartu mobile, dibungkus viewMode==='mobile' ? (...) : (tabel desktop lama)")
    print("\nLangkah selanjutnya:")
    print("   cd vista-pekerja")
    print("   npm run build")
    print("Kalau build sukses, commit & push seperti biasa.")
    print("Kalau ada TypeScript error, PASTE error-nya lengkap ke chat, jangan di-fix manual dulu.")

if __name__ == "__main__":
    main()
