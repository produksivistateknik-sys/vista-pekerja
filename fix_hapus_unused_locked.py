file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_hapus_locked", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = '''  const[locked,setLocked]=useState<Record<string,boolean>>({});
  const[lockLoading,setLockLoading]=useState(false);'''

NEW = '''  const[lockLoading,setLockLoading]=useState(false);'''

count = content.count(OLD)
print(f"  PATTERN occurrences: {count}")

if count == 1:
    content = content.replace(OLD, NEW, 1)
    
    # Hapus juga pemakaian setLocked di kunciProgress
    OLD2 = '    setLockLoading(false);\n    setLocked(prev=>({...prev,[TODAY]:true}));\n    alert('
    NEW2 = '    setLockLoading(false);\n    alert('
    count2 = content.count(OLD2)
    print(f"  PEMAKAIAN_SETLOCKED: {count2} occurrence(s)")
    if count2 == 1:
        content = content.replace(OLD2, NEW2, 1)
    
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] State locked yang tidak dipakai berhasil dihapus")
    print("[INFO] Jalankan: npm run build")
else:
    print(f"[FAIL] PATTERN occurrences = {count}, bukan 1. TIDAK menyimpan apapun")
