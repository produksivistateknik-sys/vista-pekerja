file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_qcdivisi_wrapper", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

results = {}

# Fix 1: Update percabangan render utama
OLD1 = '''          {user.divisi==="nameplate"?<NameplateView user={user}/>:<OperatorView user={user}/>}'''
NEW1 = '''          {user.divisi==="nameplate"?<NameplateView user={user}/>:user.divisi==="qc"?<QCDivisiView user={user}/>:<OperatorView user={user}/>}'''
results['PERCABANGAN'] = content.count(OLD1)

for k, v in results.items():
    print(f"  {k}: {v} occurrence(s)")

if all(v==1 for v in results.values()):
    content = content.replace(OLD1, NEW1, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Percabangan render untuk divisi QC berhasil ditambah")
    print("[INFO] Lanjut buat komponen QCDivisiView dan QCChecklistTab")
else:
    print("[FAIL] Ada occurrence tidak sesuai (harus semua 1), TIDAK menyimpan apapun")
