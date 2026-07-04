import re

FILE_PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    lines = f.readlines()

total_lines = len(lines)

print("=" * 80)
print("### Semua baris mengandung 'kInfo' ###")
print("=" * 80)
for i, line in enumerate(lines, start=1):
    if "kInfo" in line:
        print(f"{i}: {line.rstrip()}")

print("\n" + "=" * 80)
print("### Full block baris 2060-2115 ###")
print("=" * 80)
for i in range(2059, min(2115, total_lines)):
    print(f"{i+1}: {lines[i].rstrip()}")

print("\nSelesai. Copy-paste seluruh output ini ke chat.")
