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

old1 = '''    // simpan checkpoint log - siapa nyampein checkpoint berapa, buat riwayat kontribusi per operator
    if(checkpointLogEntries.length>0){
      await supabase.from("progress_checkpoint_log").insert(checkpointLogEntries);
    }'''

new1 = '''    // simpan checkpoint log - siapa nyampein checkpoint berapa, buat riwayat kontribusi per operator
    console.log("[DEBUG checkpointLog] jumlah entry:",checkpointLogEntries.length,checkpointLogEntries);
    if(checkpointLogEntries.length>0){
      try{
        const{error:cpErr}=await supabase.from("progress_checkpoint_log").insert(checkpointLogEntries);
        if(cpErr)console.error("[DEBUG checkpointLog] GAGAL insert:",cpErr);
        else console.log("[DEBUG checkpointLog] BERHASIL insert");
      }catch(e){
        console.error("[DEBUG checkpointLog] EXCEPTION:",e);
      }
    }'''

content = apply_edit(content, old1, new1, "Edit 1: Tambah diagnostic logging")

write_file(content)
print("\nBerhasil! Lanjut npm run build.")
