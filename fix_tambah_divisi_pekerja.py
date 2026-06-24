file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_divisi_pekerja", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = '''  qc:         {label:"QC",            icon:"\U0001f50d", color:"#16a34a",bg:"#f0fdf4",password:"qc123",      proses:["QC TEST","PACKING"]},
};'''

NEW = '''  qc:         {label:"QC",            icon:"\U0001f50d", color:"#16a34a",bg:"#f0fdf4",password:"qc123",      proses:["QC TEST","PACKING"]},
  nameplate:  {label:"Nameplate",     icon:"\U0001f3f7\ufe0f", color:"#0891b2",bg:"#ecfeff",password:"nameplate123",proses:null},
};'''

count = content.count(OLD)
print(f"  PATTERN occurrences: {count}")

if count == 1:
    content = content.replace(OLD, NEW, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Divisi nameplate berhasil ditambah dengan password 'nameplate123'")
    print("[INFO] Lanjut buat tampilan khusus untuk divisi nameplate")
else:
    print(f"[FAIL] PATTERN occurrences = {count}, bukan 1. TIDAK menyimpan apapun")
