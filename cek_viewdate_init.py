import re

FILE_PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    lines = f.readlines()

total_lines = len(lines)

print("=" * 80)
print("### Semua baris mengandung 'viewDate' yang berhubungan sama useState/inisialisasi ###")
print("=" * 80)
for i, line in enumerate(lines, start=1):
    if re.search(r"\[viewDate\s*,\s*set", line) or re.search(r"viewDate\s*=\s*useState", line):
        start = max(0, i - 3)
        end = min(total_lines, i + 3)
        print(f"\n--- Match di baris {i} ---")
        for j in range(start, end):
            marker = ">>" if (j + 1) == i else "  "
            print(f"{marker} {j+1}: {lines[j].rstrip()}")

print("\nSelesai. Copy-paste seluruh output ini ke chat.")
