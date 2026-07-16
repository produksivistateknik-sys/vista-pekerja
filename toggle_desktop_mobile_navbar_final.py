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
        print(repr(old))
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

old1 = '''  const cfg=user?DIVISI_CONFIG[user.divisi]:null;'''
new1 = '''  const cfg=user?DIVISI_CONFIG[user.divisi]:null;
  const [viewMode,setViewMode]=useState<"desktop"|"mobile">(()=>{
    try{return (localStorage.getItem("vista_pekerja_viewmode") as any)||"desktop";}catch{return "desktop";}
  });
  const toggleViewMode=()=>{
    const next=viewMode==="desktop"?"mobile":"desktop";
    setViewMode(next);
    try{localStorage.setItem("vista_pekerja_viewmode",next);}catch{}
  };
  const isOperatorDivisi=user&&!["nameplate","qc","komponen"].includes(user.divisi);'''
content = apply_edit(content, old1, new1, "Edit 1: State viewMode dan toggle")

old2 = '''<button onClick={()=>window.location.reload()} title="Refresh"
              style={{width:26,height:26,border:"1px solid #e2e8f0",borderRadius:8,
                background:"#f8fafc",display:"flex",alignItems:"center",justifyContent:"center",
                cursor:"pointer",fontSize:13,color:"#64748b"}}>
              🔄
            </button>'''
new2 = '''{isOperatorDivisi&&(
              <button onClick={toggleViewMode} title={viewMode==="desktop"?"Ganti ke tampilan Mobile":"Ganti ke tampilan Desktop"}
                style={{width:26,height:26,border:"1px solid #e2e8f0",borderRadius:8,
                  background:"#f8fafc",display:"flex",alignItems:"center",justifyContent:"center",
                  cursor:"pointer",fontSize:13,color:"#64748b"}}>
                {viewMode==="desktop"?"📱":"🖥️"}
              </button>
            )}
            <button onClick={()=>window.location.reload()} title="Refresh"
              style={{width:26,height:26,border:"1px solid #e2e8f0",borderRadius:8,
                background:"#f8fafc",display:"flex",alignItems:"center",justifyContent:"center",
                cursor:"pointer",fontSize:13,color:"#64748b"}}>
              🔄
            </button>'''
content = apply_edit(content, old2, new2, "Edit 2: Tombol toggle di navbar")

old3 = '''<OperatorView user={user'''
idx3 = content.find(old3)
print("Preview titik OperatorView:", repr(content[idx3:idx3+60]))

write_file(content)
print("\nBerhasil edit 1 dan 2! Lanjut cek pass prop viewMode ke OperatorView.")
