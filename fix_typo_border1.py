file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

OLD = '''background:itemData.status==="lolos"?"#16a34a":"#fff",color:itemData.status==="lolos"?"#fff":"#94a3b8",border1:"1px solid #e2e8f0"}}>\u2713 Lolos</button>'''
NEW = '''background:itemData.status==="lolos"?"#16a34a":"#fff",color:itemData.status==="lolos"?"#fff":"#94a3b8",border:"1px solid #e2e8f0"}}>\u2713 Lolos</button>'''

count = content.count(OLD)
print(f"  PATTERN occurrences: {count}")

if count == 1:
    content = content.replace(OLD, NEW, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Typo border1 berhasil diperbaiki jadi border")
else:
    print(f"[FAIL] PATTERN occurrences = {count}, kemungkinan script sebelumnya belum dijalankan")
