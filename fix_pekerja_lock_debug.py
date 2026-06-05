from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-pekerja\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

old = """  const lockProgress=async()=>{
    let count=0;
    const newLocked={...lockedCells};"""

new = """  const lockProgress=async()=>{
    console.log('lockProgress called, panelsMap:', Object.keys(panelsMap), 'todayTasks:', todayTasks.length);
    let count=0;
    const newLocked={...lockedCells};"""

if old in content:
    content = content.replace(old, new)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ Debug log added!")
else:
    print("❌ Not found!")
