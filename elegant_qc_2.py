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

old1 = '''              <div style={{padding:"12px 14px",borderBottom:"1px solid #f1f5f9"}}>
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

new1 = '''              <div style={{padding:"14px 14px 12px",borderBottom:"1px solid #f1f5f9",background:"linear-gradient(180deg,#fafbfc,#fff)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <span style={{fontWeight:700,fontSize:14.5,color:"#0f172a"}}>{p.nama}</span>
                  {(globalData.todo_at||globalData.complete_at)&&(
                    <span style={{fontSize:9.5,color:"#94a3b8"}}>
                      {globalData.complete_at?("Selesai "+fmtTglQc(globalData.complete_at)):("Mulai "+fmtTglQc(globalData.todo_at))}
                    </span>
                  )}
                </div>
                <div style={{display:"flex",gap:6}}>
                  {[{k:"to_do",label:"To Do",icon:"ti ti-circle-dashed",color:"#64748b"},
                    {k:"in_progress",label:"Progress",icon:"ti ti-loader-2",color:"#ea580c"},
                    {k:"complete",label:"Complete",icon:"ti ti-circle-check",color:"#16a34a"}].map((s:any)=>{
                    const active=qcStatus===s.k;
                    return(
                      <button key={s.k} onClick={()=>updateGlobalStatus(p.id,s.k)}
                        style={{flex:1,display:"flex",flexDirection:"column" as const,alignItems:"center",gap:3,
                          padding:"9px 4px",borderRadius:10,border:active?"none":"1px solid #e2e8f0",
                          background:active?s.color:"#fff",cursor:"pointer",transition:"all .15s",
                          boxShadow:active?`0 3px 8px ${s.color}44`:"none"}}>
                        <i className={s.icon} style={{fontSize:16,color:active?"#fff":s.color}}/>
                        <span style={{fontSize:9,fontWeight:700,color:active?"#fff":"#94a3b8"}}>{s.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>'''

content = apply_edit(content, old1, new1, "Edit 1: Redesign status selector tactile")

write_file(content)
print("\nBagian 2 berhasil! Lanjut bagian 3.")
