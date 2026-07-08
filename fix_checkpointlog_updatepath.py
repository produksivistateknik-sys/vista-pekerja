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

old1 = '''            if(existIdx>=0){
              if(prevHist[existIdx].pct!==pct){
                const updatedHist=[...prevHist];
                updatedHist[existIdx]={...updatedHist[existIdx],pct,ts:new Date().toISOString()};
                newChecklist[kode]={...cl,history:{...(cl.history||{}),[pr]:updatedHist}};
              }
              processed.add(cellKey);
              return;
            }'''

new1 = '''            if(existIdx>=0){
              if(prevHist[existIdx].pct!==pct){
                const updatedHist=[...prevHist];
                updatedHist[existIdx]={...updatedHist[existIdx],pct,ts:new Date().toISOString()};
                newChecklist[kode]={...cl,history:{...(cl.history||{}),[pr]:updatedHist}};
                checkpointLogEntries.push({
                  panel_id:Number(panelId),
                  kode_komponen:kode,
                  proses:pr,
                  checkpoint:pct,
                  pekerja_nama:user.nama,
                  tanggal:viewDate,
                });
              }
              processed.add(cellKey);
              return;
            }'''

content = apply_edit(content, old1, new1, "Edit 1: Catat checkpoint log di jalur update existing")

write_file(content)
print("\nBerhasil! Lanjut npm run build.")
