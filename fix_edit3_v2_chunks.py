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

# Chunk A
oldA = '''    const itemSebelumnya=panel?.qc_checklist?.[itemKey]?.status;
'''
newA = '''    const prevData=panel?.qc_checklist?.[itemKey]||{};
    const now=new Date().toISOString();
'''
content = apply_edit(content, oldA, newA, "Chunk A: hapus itemSebelumnya")

# Chunk B
oldB = '''    const newChecklist={...(panel?.qc_checklist||{}),[itemKey]:{status,catatan,checked_by:user.nama,checked_at:new Date().toISOString()}};
'''
newB = '''    const newItemData:any={...prevData,status,catatan,updated_by:user.nama,updated_at:now};
    if(status==="to_do")newItemData.todo_at=now;
    if(status==="complete")newItemData.complete_at=now;
    const newChecklist={...(panel?.qc_checklist||{}),[itemKey]:newItemData};
'''
content = apply_edit(content, oldB, newB, "Chunk B: ganti newChecklist")

# Chunk C - hapus blok notifikasi gagal
oldC = '''
    if(status==="gagal"&&itemSebelumnya!=="gagal"){
      const itemLabel=QC_ITEMS.find(it=>it.key===itemKey)?.label||itemKey;
      await supabase.from("fcs_notifikasi").insert({
        tipe:"qc_gagal",pekerja_nama:user.nama,
        panel_id:panelId,panel_nama:panel?.nama||"",
        kode_komponen:itemKey,nama_komponen:itemLabel,
        proses:"QC TEST",catatan:catatan||"",
      });
    }
'''
newC = '''
'''
content = apply_edit(content, oldC, newC, "Chunk C: hapus notifikasi gagal")

write_file(content)
print("\nBerhasil semua! Lanjut ke edit 4-7 (redesign_qc_edits_4_7.py).")
