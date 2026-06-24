file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_pesan_tooltip", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = '''                                title={!bisaEdit?"Pilih operator dan klik Mulai dulu":reached?`Batalkan ${s}%`:`Set ${s}%`}'''
NEW = '''                                title={!bisaEdit?(proses==="PACKING"?"QC checklist belum lolos semua":"Pilih operator dan klik Mulai dulu"):reached?`Batalkan ${s}%`:`Set ${s}%`}'''

count = content.count(OLD)
print(f"  PATTERN occurrences: {count}")

if count == 1:
    content = content.replace(OLD, NEW, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Pesan tooltip sekarang kontekstual sesuai proses")
    print("[INFO] Jalankan: npm run build")
else:
    print(f"[FAIL] PATTERN occurrences = {count}, bukan 1. TIDAK menyimpan apapun")
