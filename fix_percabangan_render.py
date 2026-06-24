file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_percabangan_render", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = '''        <div style={{flex:1,overflowY:"auto"}}>
          <OperatorView user={user}/>
        </div>'''

NEW = '''        <div style={{flex:1,overflowY:"auto"}}>
          {user.divisi==="nameplate"?<NameplateView user={user}/>:<OperatorView user={user}/>}
        </div>'''

count = content.count(OLD)
print(f"  PATTERN occurrences: {count}")

if count == 1:
    content = content.replace(OLD, NEW, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Percabangan render berhasil ditambah")
    print("[INFO] Lanjut buat komponen NameplateView")
else:
    print(f"[FAIL] PATTERN occurrences = {count}, bukan 1. TIDAK menyimpan apapun")
