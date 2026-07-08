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

old1 = '''  const lockProgress=async()=>{
    let count=0;
    const newLocked={...lockedCells};'''

new1 = '''  const lockProgress=async()=>{
    let count=0;
    const newLocked={...lockedCells};
    const checkpointLogEntries:any[]=[];'''

content = apply_edit(content, old1, new1, "Edit 1: Siapkan array checkpointLogEntries")

old2 = '''            const newEntry={pct,tanggal:viewDate,shift,ts:new Date().toISOString()};
            newChecklist[kode]={
              ...cl,
              history:{...(cl.history||{}),[pr]:[...prevHist,newEntry]}
            };
            newLocked[`${panelId}_${kode}_${pr}_${viewDate}_${shift}`]=true;
            processed.add(cellKey);
            count++;
          });'''

new2 = '''            const newEntry={pct,tanggal:viewDate,shift,ts:new Date().toISOString()};
            newChecklist[kode]={
              ...cl,
              history:{...(cl.history||{}),[pr]:[...prevHist,newEntry]}
            };
            newLocked[`${panelId}_${kode}_${pr}_${viewDate}_${shift}`]=true;
            processed.add(cellKey);
            count++;
            checkpointLogEntries.push({
              panel_id:Number(panelId),
              kode_komponen:kode,
              proses:pr,
              checkpoint:pct,
              pekerja_nama:user.nama,
              tanggal:viewDate,
            });
          });'''

content = apply_edit(content, old2, new2, "Edit 2: Push checkpoint log entry")

old3 = '''    // simpan catatan ke tabel kendala - 1 baris per (proses, panel) supaya bisa dikelompokkan per proyek/panel'''

new3 = '''    // simpan checkpoint log - siapa nyampein checkpoint berapa, buat riwayat kontribusi per operator
    if(checkpointLogEntries.length>0){
      await supabase.from("progress_checkpoint_log").insert(checkpointLogEntries);
    }

    // simpan catatan ke tabel kendala - 1 baris per (proses, panel) supaya bisa dikelompokkan per proyek/panel'''

content = apply_edit(content, old3, new3, "Edit 3: Batch insert checkpoint log")

write_file(content)
print("\nSemua edit berhasil! Lanjut npm run build.")
