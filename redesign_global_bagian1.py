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

# EDIT A: Hapus pendingChecklist state
oldA = '''  const[pendingChecklist,setPendingChecklist]=useState<Record<string,{status:string,catatan:string}>>({});
'''
newA = ''''''
content = apply_edit(content, oldA, newA, "Edit A: Hapus pendingChecklist state")

# EDIT B: updateChecklistItem -> updateGlobalStatus + updateCatatanSeksi
oldB = '''  const updateChecklistItem=async(panelId:number,itemKey:string,status:string,catatan:string)=>{
    const panel=panelsList.find((p:any)=>p.id===panelId);
    const prevData=panel?.qc_checklist?.[itemKey]||{};
    const now=new Date().toISOString();
    const newItemData:any={...prevData,status,catatan,updated_by:user.nama,updated_at:now};
    if(status==="to_do")newItemData.todo_at=now;
    if(status==="complete")newItemData.complete_at=now;
    const newChecklist={...(panel?.qc_checklist||{}),[itemKey]:newItemData};
    await supabase.from("panels").update({qc_checklist:newChecklist}).eq("id",panelId);
    setPanelsList(prev=>prev.map((p:any)=>p.id===panelId?{...p,qc_checklist:newChecklist}:p));
  };'''

newB = '''  const updateGlobalStatus=async(panelId:number,status:string)=>{
    const panel=panelsList.find((p:any)=>p.id===panelId);
    const prevGlobal=panel?.qc_checklist?._global||{};
    const now=new Date().toISOString();
    const newGlobal:any={...prevGlobal,status,updated_by:user.nama,updated_at:now};
    if(status==="to_do")newGlobal.todo_at=now;
    if(status==="complete")newGlobal.complete_at=now;
    const newChecklist={...(panel?.qc_checklist||{}),_global:newGlobal};
    await supabase.from("panels").update({qc_checklist:newChecklist}).eq("id",panelId);
    setPanelsList(prev=>prev.map((p:any)=>p.id===panelId?{...p,qc_checklist:newChecklist}:p));
  };

  const updateCatatanSeksi=async(panelId:number,itemKey:string,catatan:string)=>{
    const panel=panelsList.find((p:any)=>p.id===panelId);
    const prevData=panel?.qc_checklist?.[itemKey]||{};
    const newChecklist={...(panel?.qc_checklist||{}),[itemKey]:{...prevData,catatan}};
    await supabase.from("panels").update({qc_checklist:newChecklist}).eq("id",panelId);
    setPanelsList(prev=>prev.map((p:any)=>p.id===panelId?{...p,qc_checklist:newChecklist}:p));
  };'''

content = apply_edit(content, oldB, newB, "Edit B: updateGlobalStatus + updateCatatanSeksi")

# EDIT C: getQcStatus rewrite + tambah fmtTglQc
oldC = '''  const getQcStatus=(panel:any)=>{
    const cl=panel.qc_checklist||{};
    const statuses=QC_ITEMS.map(it=>cl[it.key]?.status||"to_do");
    if(statuses.every(s=>s==="complete"))return"complete";
    if(statuses.some(s=>s==="in_progress"||s==="complete"))return"in_progress";
    return"to_do";
  };'''

newC = '''  const getQcStatus=(panel:any)=>{
    return panel.qc_checklist?._global?.status||"to_do";
  };
  const fmtTglQc=(iso:string)=>{
    if(!iso)return"";
    const d=new Date(iso);
    return d.toLocaleDateString("id-ID",{day:"numeric",month:"short"})+" "+d.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"});
  };'''

content = apply_edit(content, oldC, newC, "Edit C: getQcStatus + fmtTglQc")

write_file(content)
print("\nBagian 1 berhasil! Lanjut ke bagian 2 (redesign_global_bagian2.py).")
