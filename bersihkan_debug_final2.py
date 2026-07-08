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

old1 = '''alert('LOCKPROGRESS DIPANGGIL - versi terbaru v3');
    '''
new1 = ''''''
content = apply_edit(content, old1, new1, "Edit 1: Hapus alert LOCKPROGRESS")

old2 = '''    console.log("[DEBUG checkpointLog] jumlah entry:",checkpointLogEntries.length,checkpointLogEntries);
    if(checkpointLogEntries.length>0){
      try{
        const{error:cpErr}=await supabase.from("progress_checkpoint_log").insert(checkpointLogEntries);
        if(cpErr)console.error("[DEBUG checkpointLog] GAGAL insert:",cpErr);
        else console.log("[DEBUG checkpointLog] BERHASIL insert");
      }catch(e){
        console.error("[DEBUG checkpointLog] EXCEPTION:",e);
      }
    }'''
new2 = '''    if(checkpointLogEntries.length>0){
      await supabase.from("progress_checkpoint_log").insert(checkpointLogEntries);
    }'''
content = apply_edit(content, old2, new2, "Edit 2: Hapus console.log/error debug checkpointLog")

old3 = '''{lockMsg?"✅ Progress hari ini berhasil dikunci & tersimpan! [v2]":pernahDikunci?"✅ Sudah Dikunci — Kunci Ulang [v2]":"🔒 Kunci Progress Hari Ini [v2]"}'''
new3 = '''{lockMsg?"✅ Progress hari ini berhasil dikunci & tersimpan!":pernahDikunci?"✅ Sudah Dikunci — Kunci Ulang":"🔒 Kunci Progress Hari Ini"}'''
content = apply_edit(content, old3, new3, "Edit 3: Hapus marker [v2] tombol Kunci")

write_file(content)
print("\nSemua edit berhasil! Lanjut npm run build.")
