import re

FILE_PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    lines = f.readlines()

total_lines = len(lines)

print("=" * 80)
print("### Cari 'KOMPONEN_PROSES_MAP' ###")
print("=" * 80)
found = False
for i, line in enumerate(lines, start=1):
    if "KOMPONEN_PROSES_MAP" in line:
        found = True
        start = max(0, i - 2)
        end = min(total_lines, i + 15)
        print(f"\n--- Match di baris {i} ---")
        for j in range(start, end):
            marker = ">>" if (j + 1) == i else "  "
            print(f"{marker} {j+1}: {lines[j].rstrip()}")
if not found:
    print("  (tidak ditemukan)")

print("\n" + "=" * 80)
print("### Cari 'PANEL_TYPES' - definisi awal (struktur wps/items) ###")
print("=" * 80)
for i, line in enumerate(lines, start=1):
    if re.search(r"const\s+PANEL_TYPES", line):
        start = max(0, i - 2)
        end = min(total_lines, i + 40)
        print(f"\n--- Match di baris {i} ---")
        for j in range(start, end):
            marker = ">>" if (j + 1) == i else "  "
            print(f"{marker} {j+1}: {lines[j].rstrip()}")
        break

print("\n" + "=" * 80)
print("### Cari 'allItems' (bagaimana dipakai/didapat) ###")
print("=" * 80)
for i, line in enumerate(lines, start=1):
    if "allItems" in line:
        print(f"{i}: {line.rstrip()}")

print("\nSelesai. Copy-paste seluruh output ini ke chat.")
