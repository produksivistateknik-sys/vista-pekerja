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

# EDIT D: panel row computation - hapus statusBadge, tambah globalData
oldD = '''          const cl=p.qc_checklist||{};
          const qcStatus=getQcStatus(p);
          const qcSemuaComplete=qcStatus==="complete";
          const statusBadge=qcStatus==="complete"?{bg:"#f0fdf4",color:"#16a34a",label:"Selesai"}:qcStatus==="in_progress"?{bg:"#fff7ed",color:"#ea580c",label:"Sedang Dikerjakan"}:{bg:"#f1f5f9",color:"#64748b",label:"To Do"};'''

newD = '''          const cl=p.qc_checklist||{};
          const qcStatus=getQcStatus(p);
          const qcSemuaComplete=qcStatus==="complete";
          const globalData=p.qc_checklist?._global||{};'''

content = apply_edit(content, oldD, newD, "Edit D: panel row computation")

# EDIT E: Header - ganti badge readonly jadi tombol status global
oldE = '''              <div style={{padding:"12px 14px",borderBottom:"1px solid #f1f5f9",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontWeight:600,fontSize:13.5,color:"#0f172a"}}>{p.nama}</span>
                <span style={{fontSize:10,fontWeight:600,padding:"3px 9px",borderRadius:5,background:statusBadge.bg,color:statusBadge.color}}>
                  {statusBadge.label}
                </span>
              </div>'''

newE = '''              <div style={{padding:"12px 14px",borderBottom:"1px solid #f1f5f9"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <span style={{fontWeight:600,fontSize:13.5,color:"#0f172a"}}>{p.nama}</span>
                  <div style={{display:"flex",border:"1px solid #e2e8f0",borderRadius:7,overflow:"hidden",flexShrink:0}}>
                    <button onClick={()=>updateGlobalStatus(p.id,"to_do")}
                      style={{width:52,height:28,border:"none",cursor:"pointer",fontSize:9.5,fontWeight:600,
                        background:qcStatus==="to_do"?"#64748b":"#fff",color:qcStatus==="to_do"?"#fff":"#94a3b8"}}>
                      To Do
                    </button>
                    <button onClick={()=>updateGlobalStatus(p.id,"in_progress")}
                      style={{width:70,height:28,border:"none",borderLeft:"1px solid #e2e8f0",cursor:"pointer",fontSize:9.5,fontWeight:600,
                        background:qcStatus==="in_progress"?"#ea580c":"#fff",color:qcStatus==="in_progress"?"#fff":"#94a3b8"}}>
                      Progress
                    </button>
                    <button onClick={()=>updateGlobalStatus(p.id,"complete")}
                      style={{width:64,height:28,border:"none",borderLeft:"1px solid #e2e8f0",cursor:"pointer",fontSize:9.5,fontWeight:600,
                        background:qcStatus==="complete"?"#16a34a":"#fff",color:qcStatus==="complete"?"#fff":"#94a3b8"}}>
                      Complete
                    </button>
                  </div>
                </div>
                {(globalData.todo_at||globalData.complete_at)&&(
                  <div style={{display:"flex",gap:10,fontSize:9.5,color:"#94a3b8"}}>
                    {globalData.todo_at&&<span>To Do: {fmtTglQc(globalData.todo_at)}</span>}
                    {globalData.complete_at&&<span>Selesai: {fmtTglQc(globalData.complete_at)}</span>}
                  </div>
                )}
              </div>'''

content = apply_edit(content, oldE, newE, "Edit E: Header tombol status global")

write_file(content)
print("\nBagian 2a berhasil! Lanjut bagian 2b (redesign_global_bagian2b.py) untuk isi section.")
