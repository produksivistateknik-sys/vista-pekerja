FILE_PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    content = f.read()

import re
hits = []
for m in re.finditer(r".*(DEBUG|LOCKPROGRESS DIPANGGIL|\[v2\]|\[v3\]).*", content):
    line_no = content[:m.start()].count("\n") + 1
    hits.append((line_no, m.group().strip()))

if not hits:
    print("Bersih! Gak ada sisa debug code (DEBUG/LOCKPROGRESS DIPANGGIL/[v2]/[v3]).")
else:
    print(f"Ditemukan {len(hits)} baris yang masih ada jejak debug:")
    for ln, txt in hits:
        print(f"{ln}: {txt}")
