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
        print(f"GAGAL [{label}]: pattern tidak ditemukan.")
        print(old)
        sys.exit(1)
    if count > 1:
        print(f"GAGAL [{label}]: ditemukan {count}x.")
        sys.exit(1)
    print(f"OK [{label}]")
    return content.replace(old, new)


backup_path = FILE_PATH + f".bak_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
shutil.copy2(FILE_PATH, backup_path)
print(f"Backup: {backup_path}\n")

content = read_file()

old1 = '''            <span style={{background:cfg?.bg,color:cfg?.color,border:`1px solid ${cfg?.color}30`,
              borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>{cfg?.icon} {user.sub_bagian||cfg?.label}</span>
            <button onClick={()=>{setUser(null);setPage("landing");}}'''

new1 = '''            <span style={{background:cfg?.bg,color:cfg?.color,border:`1px solid ${cfg?.color}30`,
              borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>{cfg?.icon} {user.sub_bagian||cfg?.label}</span>
            <button onClick={()=>window.location.reload()} title="Refresh"
              style={{width:26,height:26,border:"1px solid #e2e8f0",borderRadius:8,
                background:"#f8fafc",display:"flex",alignItems:"center",justifyContent:"center",
                cursor:"pointer",fontSize:13,color:"#64748b"}}>
              🔄
            </button>
            <button onClick={()=>{setUser(null);setPage("landing");}}'''

content = apply_edit(content, old1, new1, "Edit 1: Tambah tombol refresh header")

write_file(content)
print("\nBerhasil! Lanjut npm run build.")
