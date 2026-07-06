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

old1 = '''  const[uploadingId,setUploadingId]=useState<number|null>(null);'''
new1 = '''  const[uploadingId,setUploadingId]=useState<string|null>(null);'''
content = apply_edit(content, old1, new1, "Edit 1: uploadingId type")

old2 = '''  const uploadFoto=async(panelId:number,file:File)=>{
    setUploadingId(panelId);
    try{
      const fileName=`${panelId}_${Date.now()}_${file.name}`;
      const{error:upErr}=await supabase.storage.from("qc-photos").upload(fileName,file);
      if(upErr){alert("Gagal upload: "+upErr.message);setUploadingId(null);return;}
      const{data:urlData}=supabase.storage.from("qc-photos").getPublicUrl(fileName);
      const panel=panelsList.find((p:any)=>p.id===panelId);
      const newFoto=[...(panel?.qc_foto||[]),{url:urlData.publicUrl,name:file.name,uploaded_by:user.nama,uploaded_at:new Date().toISOString()}];
      await supabase.from("panels").update({qc_foto:newFoto}).eq("id",panelId);
      setPanelsList(prev=>prev.map((p:any)=>p.id===panelId?{...p,qc_foto:newFoto}:p));
    }catch(err:any){
      alert("Terjadi kesalahan: "+err.message);
    }
    setUploadingId(null);
  };

  const hapusFoto=async(panelId:number,fotoUrl:string)=>{
    const panel=panelsList.find((p:any)=>p.id===panelId);
    const newFoto=(panel?.qc_foto||[]).filter((f:any)=>f.url!==fotoUrl);
    await supabase.from("panels").update({qc_foto:newFoto}).eq("id",panelId);
    setPanelsList(prev=>prev.map((p:any)=>p.id===panelId?{...p,qc_foto:newFoto}:p));
  };'''

new2 = '''  const uploadFotoSeksi=async(panelId:number,itemKey:string,file:File)=>{
    const uploadKey=`${panelId}_${itemKey}`;
    setUploadingId(uploadKey);
    try{
      const fileName=`${panelId}_${itemKey}_${Date.now()}_${file.name}`;
      const{error:upErr}=await supabase.storage.from("qc-photos").upload(fileName,file);
      if(upErr){alert("Gagal upload: "+upErr.message);setUploadingId(null);return;}
      const{data:urlData}=supabase.storage.from("qc-photos").getPublicUrl(fileName);
      const panel=panelsList.find((p:any)=>p.id===panelId);
      const prevData=panel?.qc_checklist?.[itemKey]||{status:"to_do",catatan:""};
      const newFoto=[...(prevData.foto||[]),{url:urlData.publicUrl,name:file.name,uploaded_by:user.nama,uploaded_at:new Date().toISOString()}];
      const newChecklist={...(panel?.qc_checklist||{}),[itemKey]:{...prevData,foto:newFoto}};
      await supabase.from("panels").update({qc_checklist:newChecklist}).eq("id",panelId);
      setPanelsList(prev=>prev.map((p:any)=>p.id===panelId?{...p,qc_checklist:newChecklist}:p));
    }catch(err:any){
      alert("Terjadi kesalahan: "+err.message);
    }
    setUploadingId(null);
  };

  const hapusFotoSeksi=async(panelId:number,itemKey:string,fotoUrl:string)=>{
    const panel=panelsList.find((p:any)=>p.id===panelId);
    const prevData=panel?.qc_checklist?.[itemKey]||{status:"to_do",catatan:""};
    const newFoto=(prevData.foto||[]).filter((f:any)=>f.url!==fotoUrl);
    const newChecklist={...(panel?.qc_checklist||{}),[itemKey]:{...prevData,foto:newFoto}};
    await supabase.from("panels").update({qc_checklist:newChecklist}).eq("id",panelId);
    setPanelsList(prev=>prev.map((p:any)=>p.id===panelId?{...p,qc_checklist:newChecklist}:p));
  };'''

content = apply_edit(content, old2, new2, "Edit 2: uploadFoto/hapusFoto jadi per-section")

write_file(content)
print("\nBerhasil! Lanjut npm run build.")
