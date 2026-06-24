file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_hapus_wrapper_qc", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = '''          {user.divisi==="nameplate"?<NameplateView user={user}/>:user.divisi==="qc"?<QCDivisiView user={user}/>:<OperatorView user={user}/>}'''
NEW = '''          {user.divisi==="nameplate"?<NameplateView user={user}/>:user.divisi==="qc"?<QCChecklistTab user={user}/>:<OperatorView user={user}/>}'''

count = content.count(OLD)
print(f"  PATTERN occurrences: {count}")

if count == 1:
    content = content.replace(OLD, NEW, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Routing sekarang langsung ke QCChecklistTab, tanpa wrapper tab")
    print("[INFO] Lanjut redesign total QCChecklistTab dengan gaya enterprise + tombol Packing")
else:
    print(f"[FAIL] PATTERN occurrences = {count}, bukan 1. TIDAK menyimpan apapun")
