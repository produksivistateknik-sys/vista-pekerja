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

old1 = '''    // simpan catatan ke tabel kendala
    const prosesLogged=new Set();
    for(const task of todayTasks){
      const proses=task.proses;
      if(catatan[proses]?.trim()&&!prosesLogged.has(proses)){
        prosesLogged.add(proses);
        await supabase.from("kendala").insert({
          divisi:user.divisi,
          divisi_label:cfg.label,
          tanggal:viewDate,
          proses,
          catatan:catatan[proses].trim(),
          operator:user.nama,
          ts:new Date().toISOString(),
        });
      }
    }'''

new1 = '''    // simpan catatan ke tabel kendala - 1 baris per (proses, panel) supaya bisa dikelompokkan per proyek/panel
    const kendalaLogged=new Set();
    for(const task of todayTasks){
      const proses=task.proses;
      if(!catatan[proses]?.trim())continue;
      const panelIdTask=task.panel_id||task.panelId;
      const comboKey=proses+"|"+panelIdTask;
      if(kendalaLogged.has(comboKey))continue;
      kendalaLogged.add(comboKey);
      await supabase.from("kendala").insert({
        divisi:user.divisi,
        divisi_label:cfg.label,
        tanggal:viewDate,
        proses,
        catatan:catatan[proses].trim(),
        operator:user.nama,
        ts:new Date().toISOString(),
        proyek:task.proyek||null,
        panel:task.panel||null,
        panel_id:panelIdTask||null,
      });
    }'''

content = apply_edit(content, old1, new1, "Edit 1: Insert kendala per proses+panel")

write_file(content)
print("\nBerhasil! Lanjut npm run build.")
