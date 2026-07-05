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

old1 = '''  const [wiringInfoMap,setWiringInfoMap]=useState<Record<string,any>>({});
  const [komponenInfoMap,setKomponenInfoMap]=useState<Record<string,any>>({});'''

new1 = '''  const [wiringInfoMap,setWiringInfoMap]=useState<Record<string,any>>({});
  const [komponenInfoMap,setKomponenInfoMap]=useState<Record<string,any>>({});
  const [expandedPanel,setExpandedPanel]=useState<Record<string,boolean>>({});'''

content = apply_edit(content, old1, new1, "Edit 1: Tambah state expandedPanel")

old2 = '''                  {rows.map((r:any,ri:number)=>{
                    const done=isDone(r);
                    const rBg=done?"#f0fdf4":ri%2===0?"#fff":"#f8fafc";
                    const td:any={padding:"6px 8px",borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",
                      background:rBg,verticalAlign:"middle"};
                    return(
                      <tr key={`${r.task.id}-${r.kode}`}>'''

new2 = '''                  {rows.map((r:any,ri:number)=>{
                    const done=isDone(r);
                    const rBg=done?"#f0fdf4":ri%2===0?"#fff":"#f8fafc";
                    const td:any={padding:"6px 8px",borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",
                      background:rBg,verticalAlign:"middle"};
                    const isDrilldown=["WIRING CONTROL","WIRING POWER","BUSBAR"].includes(proses);
                    const panelKey=`${proses}_${r.panelId}`;
                    const isNewPanelGroup=isDrilldown&&(ri===0||rows[ri-1].panelId!==r.panelId);
                    const panelExpanded=!!expandedPanel[panelKey];
                    const panelHeaderRow=isNewPanelGroup?(()=>{
                      const panelRows=rows.filter((x:any)=>x.panelId===r.panelId);
                      const doneCount=panelRows.filter((x:any)=>isDone(x)).length;
                      const allDone=panelRows.length>0&&doneCount===panelRows.length;
                      return(
                        <tr key={`ph-${proses}-${r.panelId}`} onClick={()=>setExpandedPanel(prev=>({...prev,[panelKey]:!prev[panelKey]}))}
                          style={{cursor:"pointer",background:"#eef2ff"}}>
                          <td colSpan={20} style={{padding:"8px 12px",borderBottom:"1px solid #e2e8f0"}}>
                            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                              <div style={{display:"flex",flexDirection:"column",gap:1}}>
                                <span style={{fontSize:10,color:"#94a3b8"}}>{r.task.proyek}</span>
                                <span style={{fontSize:13,fontWeight:700,color:"#1e293b"}}>{r.panel.nama}</span>
                              </div>
                              <div style={{display:"flex",alignItems:"center",gap:8}}>
                                <span style={{fontSize:11,fontWeight:700,background:allDone?"#dcfce7":"#fef3c7",
                                  color:allDone?"#16a34a":"#b45309",borderRadius:20,padding:"3px 10px"}}>
                                  {doneCount}/{panelRows.length} selesai
                                </span>
                                <span style={{fontSize:14,color:"#64748b"}}>{panelExpanded?"▲":"▼"}</span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })():null;
                    const dataRow=(!isDrilldown||panelExpanded)?(
                      <tr key={`${r.task.id}-${r.kode}`}>'''

content = apply_edit(content, old2, new2, "Edit 2: Awal rows.map - grouping panel")

old3 = '''                          {r.pct===100
                            ?<Badge label="TERCAPAI" color="#16a34a" bg="#dcfce7"/>
                            :r.pct===0
                            ?<Badge label="BELUM MULAI" color="#94a3b8" bg="#f1f5f9"/>
                            :<Badge label="ON PROGRESS" color="#2563eb" bg="#dbeafe"/>
                          }
                        </td>
                      </tr>
                    );
                  })}'''

new3 = '''                          {r.pct===100
                            ?<Badge label="TERCAPAI" color="#16a34a" bg="#dcfce7"/>
                            :r.pct===0
                            ?<Badge label="BELUM MULAI" color="#94a3b8" bg="#f1f5f9"/>
                            :<Badge label="ON PROGRESS" color="#2563eb" bg="#dbeafe"/>
                          }
                        </td>
                      </tr>
                    ):null;
                    return [panelHeaderRow,dataRow];
                  })}'''

content = apply_edit(content, old3, new3, "Edit 3: Akhir rows.map - return array")

write_file(content)
print("\n🎉 Semua edit berhasil diterapkan!")
print(f"   Backup asli ada di: {backup_path}")
print("   Behavior: WIRING CONTROL/POWER/BUSBAR sekarang di-grouping per panel (klik nama panel")
print("   buat expand/collapse). Proses lain (RAKIT, POTONG, dll) TIDAK berubah - tetap flat table.")
print("   Lanjut: npm run build.")
