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

old3 = '''  const updateChecklistItem=async(panelId:number,itemKey:string,status:string,catatan:string)=>{
    const panel=panelsList.find((p:any)=>p.id===panelId);
    const itemSebelumnya=panel?.qc_checklist?.[itemKey]?.status;
    const newChecklist={...(panel?.qc_checklist||{}),[itemKey]:{status,catatan,checked_by:user.nama,checked_at:new Date().toISOString()}};
    await supabase.from("panels").update({qc_checklist:newChecklist}).eq("id",panelId);
    setPanelsList(prev=>prev.map((p:any)=>p.id===panelId?{...p,qc_checklist:newChecklist}:p));

    if(status==="gagal"&&itemSebelumnya!=="gagal"){
      const itemLabel=QC_ITEMS.find(it=>it.key===itemKey)?.label||itemKey;
      await supabase.from("fcs_notifikasi").insert({
        tipe:"qc_gagal",pekerja_nama:user.nama,
        panel_id:panelId,panel_nama:panel?.nama||"",
        kode_komponen:itemKey,nama_komponen:itemLabel,
        proses:"QC TEST",catatan:catatan||"",
      });
    }
  };'''

new3 = '''  const updateChecklistItem=async(panelId:number,itemKey:string,status:string,catatan:string)=>{
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

content = apply_edit(content, old3, new3, "Edit 3: updateChecklistItem To Do/In Progress/Complete")

write_file(content)
print("\nBerhasil! Lanjut ke edit berikutnya.")
