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

old1 = '''            if(kode.startsWith("__wiring_")){
              const parts=kode.replace("__wiring_","").split("_");
              const org=parts[0]; // misal "1org"
              const bobot=parts.slice(1).join(" "); // misal "MEDIUM" atau "VERY HARD"
              const wiringItem={kode,nama:`⚡ Wiring ${bobot} · ${org}`};
              // Progress wiring disimpan di checklist dengan key = kode token
              const cl=panel.checklist?.[kode]||{qty:0,progress:{},progressByDate:{}};
              const pct=getProgressOnDate(cl,proses,viewDate);
              rows.push({task,panel,panelId,item:wiringItem,kode,qtyKomp:1,qtyProses:1,pct,priColor,ki,wpDef:null,
                isFirst:ki===0,rowCount:(task.komponen||[]).length,isBusbar:false,isWiring:true,
                aktualSelesai:getFirstCompletionDate(cl,proses)});
              return;
            }'''

new1 = '''            if(kode.startsWith("__wiring_")){
              // Token wiring cuma buat ekstrak badge bobot/jumlah orang (via wiringInfoMap di row komponen real).
              // Gak bikin baris sendiri lagi - komponen real di bawah yang jadi baris (per-komponen tracking).
              return;
            }'''

content = apply_edit(content, old1, new1, "Edit 1: Token wiring skip, gak push row")

old2 = '''            const wpDef=isBusbarKomp?null:panelCfg.wps.find((w:any)=>w.items.some((it:any)=>it.kode===kode));
            rows.push({task,panel,panelId,item:item||busbarItem,kode,qtyKomp,qtyProses,pct,priColor,ki,wpDef,
              isFirst:ki===0,rowCount:(task.komponen||[]).length,isBusbar:isBusbarKomp,
              aktualSelesai:getFirstCompletionDate(cl,proses)});'''

new2 = '''            const wpDef=isBusbarKomp?null:panelCfg.wps.find((w:any)=>w.items.some((it:any)=>it.kode===kode));
            const wInfoLookup=wiringInfoMap[`${panelId}_${proses}`];
            const wiringBadge=wInfoLookup&&wInfoLookup.bobot?wInfoLookup:null;
            rows.push({task,panel,panelId,item:item||busbarItem,kode,qtyKomp,qtyProses,pct,priColor,ki,wpDef,
              isFirst:ki===0,rowCount:(task.komponen||[]).length,isBusbar:isBusbarKomp,
              aktualSelesai:getFirstCompletionDate(cl,proses),wiringBadge});'''

content = apply_edit(content, old2, new2, "Edit 2: Tambah wiringBadge di rows.push")

old3 = '''{isWiringProses?(
                      <>
                        <th style={{...thS,minWidth:80}}>BOBOT</th>'''

new3 = '''{false?(
                      <>
                        <th style={{...thS,minWidth:80}}>BOBOT</th>'''

content = apply_edit(content, old3, new3, "Edit 3: Flip kondisi header ke false")

old4 = '''{isWiringProses?(()=>{
                          const wInfo=wiringInfoMap[`${r.panelId}_${proses}`]||{};'''

new4 = '''{false?(()=>{
                          const wInfo=wiringInfoMap[`${r.panelId}_${proses}`]||{};'''

content = apply_edit(content, old4, new4, "Edit 4: Flip kondisi body render ke false")

old5 = '''<td style={{...td,fontWeight:600,color:"#374151",whiteSpace:"nowrap"}}>{r.item.nama}</td>'''

new5 = '''<td style={{...td,fontWeight:600,color:"#374151",whiteSpace:"nowrap"}}>
                              {r.item.nama}
                              {r.wiringBadge&&(()=>{
                                const BOBOT_COLOR:any={EASY:"#16a34a",MEDIUM:"#d97706",HARD:"#dc2626",VERY_HARD:"#7c3aed"};
                                const bc=BOBOT_COLOR[r.wiringBadge.bobot]||"#6366f1";
                                return(
                                  <span style={{marginLeft:6,background:bc+"18",color:bc,border:`1px solid ${bc}33`,borderRadius:6,padding:"1px 6px",fontSize:9,fontWeight:700,whiteSpace:"nowrap"}}>
                                    ⚡ {(r.wiringBadge.bobot||"").replace("_"," ")} · {r.wiringBadge.jumlahOrang||"–"}org
                                  </span>
                                );
                              })()}
                            </td>'''

content = apply_edit(content, old5, new5, "Edit 5: Tambah badge bobot/orang di nama komponen")

old6 = '''const kInfo=komponenInfoMap[`${r.panelId}_${proses}_${r.kode}`]||{};'''
new6 = '''const kInfo=r.wiringBadge||komponenInfoMap[`${r.panelId}_${proses}_${r.kode}`]||{};'''

content = apply_edit(content, old6, new6, "Edit 6: kInfo fallback ke wiringBadge")

write_file(content)
print("\n🎉 Semua edit berhasil diterapkan!")
print(f"   Backup asli ada di: {backup_path}")
print("   Catatan: kondisi 'isWiringProses' di header/body cuma di-flip ke 'false' (dead code, aman,")
print("   gak ganggu struktur JSX). Kolom BOBOT/ORANG lama gak dipake lagi, diganti badge di nama komponen.")
print("   Lanjut: npm run build.")
