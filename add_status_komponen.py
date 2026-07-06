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

old1 = '''  const fetchPanelList=async(woId:number)=>{
    const{data}=await supabase.from("panels").select("id,no_pnl,nama,tipe").eq("wo_id",woId).is("deleted_at",null).order("no_pnl",{ascending:true});
    setPanelList(data??[]);
  };'''

new1 = '''  const fetchPanelList=async(woId:number)=>{
    const{data}=await supabase.from("panels").select("id,no_pnl,nama,tipe,komponen_status").eq("wo_id",woId).is("deleted_at",null).order("no_pnl",{ascending:true});
    setPanelList(data??[]);
  };

  const updateKomponenStatus=async(panelId:number,status:string)=>{
    const panel=panelList.find((p:any)=>p.id===panelId);
    const prevAll=panel?.komponen_status||{};
    const prevMine=prevAll[subBagian]||{};
    const now=new Date().toISOString();
    const newMine:any={...prevMine,status,updated_by:namaOperator,updated_at:now};
    if(status==="to_do")newMine.todo_at=now;
    if(status==="complete")newMine.complete_at=now;
    const newAll={...prevAll,[subBagian]:newMine};
    await supabase.from("panels").update({komponen_status:newAll}).eq("id",panelId);
    setPanelList(prev=>prev.map((p:any)=>p.id===panelId?{...p,komponen_status:newAll}:p));
  };'''

content = apply_edit(content, old1, new1, "Edit 1: fetch komponen_status dan updateKomponenStatus")

old2 = '''      {selectedWoId&&selectedPanelId&&(
        <>
          <div style={{marginBottom:14}}>
            <Lbl>Catatan</Lbl>'''

new2 = '''      {selectedWoId&&selectedPanelId&&(()=>{
        const selectedPanelObj=panelList.find((p:any)=>p.id===selectedPanelId);
        const myStatus=selectedPanelObj?.komponen_status?.[subBagian]?.status||"to_do";
        const myData=selectedPanelObj?.komponen_status?.[subBagian]||{};
        return(
          <div style={{marginBottom:14,background:"#fff",border:"1px solid #e2e8f0",borderRadius:14,padding:14,boxShadow:"0 2px 8px rgba(0,0,0,0.04)"}}>
            <div style={{fontSize:11.5,fontWeight:600,color:"#94a3b8",marginBottom:8}}>Status Komponen ({subBagian})</div>
            <div style={{display:"flex",gap:6}}>
              {[{k:"to_do",label:"To Do",icon:"⚪",color:"#64748b"},
                {k:"in_progress",label:"Progress",icon:"🟠",color:"#ea580c"},
                {k:"complete",label:"Complete",icon:"✅",color:"#0d9488"}].map((s:any)=>{
                const active=myStatus===s.k;
                return(
                  <button key={s.k} onClick={()=>updateKomponenStatus(selectedPanelId,s.k)}
                    style={{flex:1,display:"flex",flexDirection:"column" as const,alignItems:"center",gap:3,
                      padding:"9px 4px",borderRadius:10,border:active?"none":"1px solid #e2e8f0",
                      background:active?s.color:"#fff",cursor:"pointer",transition:"all .15s",
                      boxShadow:active?`0 3px 8px ${s.color}44`:"none"}}>
                    <span style={{fontSize:15}}>{s.icon}</span>
                    <span style={{fontSize:9,fontWeight:700,color:active?"#fff":"#94a3b8"}}>{s.label}</span>
                  </button>
                );
              })}
            </div>
            {(myData.todo_at||myData.complete_at)&&(
              <div style={{display:"flex",gap:10,fontSize:9.5,color:"#94a3b8",marginTop:8}}>
                {myData.todo_at&&<span>To Do: {fmtDateTime(myData.todo_at)}</span>}
                {myData.complete_at&&<span>Selesai: {fmtDateTime(myData.complete_at)}</span>}
              </div>
            )}
          </div>
        );
      })()}

      {selectedWoId&&selectedPanelId&&(
        <>
          <div style={{marginBottom:14}}>
            <Lbl>Catatan</Lbl>'''

content = apply_edit(content, old2, new2, "Edit 2: UI status komponen per panel")

write_file(content)
print("\nSemua edit berhasil! Lanjut npm run build.")
