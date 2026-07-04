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


# ── Backup dulu ──
backup_path = FILE_PATH + f".bak_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
shutil.copy2(FILE_PATH, backup_path)
print(f"📦 Backup dibuat: {backup_path}\n")

content = read_file()

# ── EDIT 1: Tambah helper getFirstCompletionDate ──
old1 = '''function getLatestProgress(cl:any, proses:string){
  const byDate=cl?.progressByDate?.[proses];
  if(byDate&&Object.keys(byDate).length>0){
    const dates=Object.keys(byDate).sort();
    return byDate[dates[dates.length-1]];
  }
  return cl?.progress?.[proses]||0;
}'''

new1 = '''function getLatestProgress(cl:any, proses:string){
  const byDate=cl?.progressByDate?.[proses];
  if(byDate&&Object.keys(byDate).length>0){
    const dates=Object.keys(byDate).sort();
    return byDate[dates[dates.length-1]];
  }
  return cl?.progress?.[proses]||0;
}
function getFirstCompletionDate(cl:any, proses:string){
  const byDate=cl?.progressByDate?.[proses];
  if(!byDate) return null;
  const doneDates=Object.keys(byDate).filter(d=>byDate[d]>=100).sort();
  return doneDates.length>0?doneDates[0]:null;
}'''

content = apply_edit(content, old1, new1, "Edit 1: Tambah getFirstCompletionDate")

# ── EDIT 2: rows.push wiring - tambah aktualSelesai ──
old2 = '''              rows.push({task,panel,panelId,item:wiringItem,kode,qtyKomp:1,qtyProses:1,pct,priColor,ki,wpDef:null,
                isFirst:ki===0,rowCount:(task.komponen||[]).length,isBusbar:false,isWiring:true});'''

new2 = '''              rows.push({task,panel,panelId,item:wiringItem,kode,qtyKomp:1,qtyProses:1,pct,priColor,ki,wpDef:null,
                isFirst:ki===0,rowCount:(task.komponen||[]).length,isBusbar:false,isWiring:true,
                aktualSelesai:getFirstCompletionDate(cl,proses)});'''

content = apply_edit(content, old2, new2, "Edit 2: aktualSelesai di rows.push wiring")

# ── EDIT 3: rows.push non-wiring - tambah aktualSelesai ──
old3 = '''            rows.push({task,panel,panelId,item:item||busbarItem,kode,qtyKomp,qtyProses,pct,priColor,ki,wpDef,
              isFirst:ki===0,rowCount:(task.komponen||[]).length,isBusbar:isBusbarKomp});'''

new3 = '''            rows.push({task,panel,panelId,item:item||busbarItem,kode,qtyKomp,qtyProses,pct,priColor,ki,wpDef,
              isFirst:ki===0,rowCount:(task.komponen||[]).length,isBusbar:isBusbarKomp,
              aktualSelesai:getFirstCompletionDate(cl,proses)});'''

content = apply_edit(content, old3, new3, "Edit 3: aktualSelesai di rows.push non-wiring")

# ── EDIT 4: Fix render AKTUAL SELESAI wiring (hapus new Date() bug) ──
old4 = '''<td style={{...td,fontSize:10,fontWeight:600,color:r.pct>=100?"#16a34a":"#94a3b8"}}>{r.pct>=100?fmtDate(new Date().toISOString()):"-"}</td>'''

new4 = '''<td style={{...td,fontSize:10,fontWeight:600,color:r.pct>=100?"#16a34a":"#94a3b8"}}>{r.pct>=100?fmtDate(r.aktualSelesai):"-"}</td>'''

content = apply_edit(content, old4, new4, "Edit 4: Fix render AKTUAL SELESAI (wiring)")

# ── EDIT 5a: Fix sumber kInfo dari komponenInfoMap (kosong) ke wiringInfoMap ──
old5a = '''const kInfo=komponenInfoMap[`${r.panelId}_${proses}_${r.kode}`]||{};'''
new5a = '''const kInfo=wiringInfoMap[`${r.panelId}_${proses}`]||{};'''

content = apply_edit(content, old5a, new5a, "Edit 5a: Fix sumber kInfo -> wiringInfoMap")

# ── EDIT 5b: Fix render AKTUAL SELESAI non-wiring (hapus new Date() bug) ──
old5b = '''<td style={{...td,fontSize:10,fontWeight:600,color:r.pct>=100?"#16a34a":"#94a3b8"}}>{r.pct>=100?fmtDate(new Date().toISOString()):"–"}</td>'''
new5b = '''<td style={{...td,fontSize:10,fontWeight:600,color:r.pct>=100?"#16a34a":"#94a3b8"}}>{r.pct>=100?fmtDate(r.aktualSelesai):"–"}</td>'''

content = apply_edit(content, old5b, new5b, "Edit 5b: Fix render AKTUAL SELESAI (non-wiring)")

write_file(content)
print("\n🎉 Semua edit berhasil diterapkan!")
print(f"   Backup asli ada di: {backup_path}")
print("   Catatan: komponenInfoMap state dibiarkan (gak dipakai lagi, tapi gak ganggu apa-apa).")
print("   Lanjut: npm run build untuk cek TypeScript error.")
