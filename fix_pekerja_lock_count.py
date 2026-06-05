from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-pekerja\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Fix 1: Tambah busbar count
old = """    if(count>0||Object.keys(catatan).some(k=>catatan[k]?.trim())){
      setLockedCells(newLocked);
      setLockMsg(true);
      setTimeout(()=>setLockMsg(false),2500);
    }"""

new = """    // Hitung busbar tasks juga
    const busbarCount=todayTasks.filter((t:any)=>t.proses==="BUSBAR").length;
    if(count>0||busbarCount>0||Object.keys(catatan).some(k=>catatan[k]?.trim())){
      setLockedCells(newLocked);
      setLockMsg(true);
      setTimeout(()=>setLockMsg(false),2500);
    }"""

if old in content:
    content = content.replace(old, new)
    print("✅ busbarCount added to lock condition")
else:
    print("❌ Not found!")

# Fix 2: Hapus debug log
old_debug = """  const lockProgress=async()=>{
    console.log('lockProgress called, panelsMap:', Object.keys(panelsMap), 'todayTasks:', todayTasks.length);
    let count=0;"""
new_debug = """  const lockProgress=async()=>{
    let count=0;"""

if old_debug in content:
    content = content.replace(old_debug, new_debug)
    print("✅ Debug log removed")
else:
    print("⚠️  Debug log not found")

APP_PATH.write_text(content, encoding="utf-8")
print("\n✅ Selesai!")
