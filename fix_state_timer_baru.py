file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_state_timer_baru", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = "  const [timerAktif,setTimerAktif]=useState<Record<string,any>>({});"
NEW = '''  const [timerAktif,setTimerAktif]=useState<Record<string,any>>({});
  const [timerPernahMulai,setTimerPernahMulai]=useState<Record<string,boolean>>({});
  const [timerSelesaiHariIni,setTimerSelesaiHariIni]=useState<Record<string,boolean>>({});'''

count = content.count(OLD)
print(f"  PATTERN occurrences: {count}")

if count == 1:
    content = content.replace(OLD, NEW, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] State timerPernahMulai dan timerSelesaiHariIni berhasil ditambah")
    print("[INFO] Lanjut tambah helper canEditProgress dan canLockKomponen")
else:
    print(f"[FAIL] PATTERN occurrences = {count}, bukan 1. TIDAK menyimpan apapun")
