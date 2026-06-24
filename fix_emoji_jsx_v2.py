file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_emoji_jsx_v2", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

results = {}

OLD1 = '''placeholder="\\u{1F50D} Cari proyek atau WO..."'''
NEW1 = '''placeholder="\U0001f50d Cari proyek atau WO..."'''
results['SEARCH_PLACEHOLDER'] = content.count(OLD1)

OLD2 = '''<div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>WO {g.wo?.wo} \\u00b7 {g.selesai}/{g.totalPanel} panel selesai</div>'''
NEW2 = '''<div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>WO {g.wo?.wo} \u00b7 {g.selesai}/{g.totalPanel} panel selesai</div>'''
results['MIDDLE_DOT'] = content.count(OLD2)

for k, v in results.items():
    print(f"  {k}: {v} occurrence(s)")

if all(v==1 for v in results.values()):
    content = content.replace(OLD1, NEW1, 1)
    content = content.replace(OLD2, NEW2, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Karakter search dan titik tengah berhasil diperbaiki")
    print("[INFO] Jalankan: npm run build")
else:
    print("[FAIL] Ada occurrence tidak sesuai (harus semua 1), TIDAK menyimpan apapun")
