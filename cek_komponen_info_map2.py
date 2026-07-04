import re

FILE_PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    lines = f.readlines()

total_lines = len(lines)

print("=" * 80)
print("### Semua baris mengandung 'KomponenInfoMap' (case-insensitive) ###")
print("=" * 80)
for i, line in enumerate(lines, start=1):
    if re.search("komponeninfomap", line, re.IGNORECASE):
        print(f"{i}: {line.rstrip()}")

print("\n" + "=" * 80)
print("### Context lengkap sekitar baris 1380-1410 (fetch kompMap) ###")
print("=" * 80)
for i in range(1379, min(1410, total_lines)):
    print(f"{i+1}: {lines[i].rstrip()}")

print("\nSelesai. Copy-paste seluruh output ini ke chat.")
