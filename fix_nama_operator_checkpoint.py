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

old1 = '''            const newEntry={pct,tanggal:viewDate,shift,ts:new Date().toISOString()};
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

new1 = '''            const newEntry={pct,tanggal:viewDate,shift,ts:new Date().toISOString()};
            newChecklist[kode]={
              ...cl,
              history:{...(cl.history||{}),[pr]:[...prevHist,newEntry]}
            };
            newLocked[`${panelId}_${kode}_${pr}_${viewDate}_${shift}`]=true;
            processed.add(cellKey);
            count++;
            {
              const idsKomp=(task.pekerja_per_komponen||{})[kode]||[];
              const workerObjs=idsKomp.map((wid:number)=>pekerjaList.find((p:any)=>p.id===wid)).filter(Boolean);
              const pekerjaNamaLog=workerObjs.length>0?workerObjs.map((w:any)=>w.nama).join(", "):user.nama;
              checkpointLogEntries.push({
                panel_id:Number(panelId),
                kode_komponen:kode,
                proses:pr,
                checkpoint:pct,
                pekerja_nama:pekerjaNamaLog,
                tanggal:viewDate,
              });
            }
          });'''

content = apply_edit(content, old1, new1, "Edit 1: Fix nama operator jalur checkpoint baru")

old2 = '''            if(existIdx>=0){
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

new2 = '''            if(existIdx>=0){
              if(prevHist[existIdx].pct!==pct){
                const updatedHist=[...prevHist];
                updatedHist[existIdx]={...updatedHist[existIdx],pct,ts:new Date().toISOString()};
                newChecklist[kode]={...cl,history:{...(cl.history||{}),[pr]:updatedHist}};
                const idsKomp=(task.pekerja_per_komponen||{})[kode]||[];
                const workerObjs=idsKomp.map((wid:number)=>pekerjaList.find((p:any)=>p.id===wid)).filter(Boolean);
                const pekerjaNamaLog=workerObjs.length>0?workerObjs.map((w:any)=>w.nama).join(", "):user.nama;
                checkpointLogEntries.push({
                  panel_id:Number(panelId),
                  kode_komponen:kode,
                  proses:pr,
                  checkpoint:pct,
                  pekerja_nama:pekerjaNamaLog,
                  tanggal:viewDate,
                });
              }
              processed.add(cellKey);
              return;
            }'''

content = apply_edit(content, old2, new2, "Edit 2: Fix nama operator jalur update existing")

write_file(content)
print("\nSemua edit berhasil! Lanjut npm run build.")
