file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_skip_lock", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = '''            const cellKey=`${kode}_${pr}`;
            if(processed.has(cellKey))return;
            const pct=getProgressOnDate(cl,pr,viewDate);
            if(pct===0)return;'''

NEW = '''            const cellKey=`${kode}_${pr}`;
            if(processed.has(cellKey))return;
            if(!canLockKomponen(task,kode,Number(panelId),pr))return;
            const pct=getProgressOnDate(cl,pr,viewDate);
            if(pct===0)return;'''

count = content.count(OLD)
print(f"  PATTERN occurrences: {count}")

if count == 1:
    content = content.replace(OLD, NEW, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] lockProgress sekarang SKIP komponen WIRING yang belum klik 'Selesai' hari ini")
    print("[INFO] Jalankan: npm run build")
else:
    print(f"[FAIL] PATTERN occurrences = {count}, bukan 1. TIDAK menyimpan apapun")
