file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_state_modal_op", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = '  const [pekerjaList,setPekerjaList]=useState<any[]>([]);'
NEW = '''  const [pekerjaList,setPekerjaList]=useState<any[]>([]);
  const [operatorModal,setOperatorModal]=useState<any>(null);
  const [tempPekerjaIds,setTempPekerjaIds]=useState<number[]>([]);'''

count = content.count(OLD)
print(f"  PATTERN occurrences: {count}")

if count == 1:
    content = content.replace(OLD, NEW, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] State modal operator berhasil ditambah")
    print("[INFO] Lanjut update render kolom OPERATOR jadi clickable + buat modal")
else:
    print(f"[FAIL] PATTERN occurrences = {count}, bukan 1. TIDAK menyimpan apapun")
