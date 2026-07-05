import re

FILE_PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    lines = f.readlines()

total_lines = len(lines)

print("=" * 80)
print("### Blok isCellLocked/getLockedFloor (qty-input + kInfo) ###")
print("=" * 80)
for i, line in enumerate(lines, start=1):
    if "isCellLocked(r.panelId,r.kode,proses)" in line and "const locked=" in line:
        start = max(0, i - 3)
        end = min(total_lines, i + 40)
        print(f"\n--- Match di baris {i} ---")
        for j in range(start, end):
            marker = ">>" if (j + 1) == i else "  "
            print(f"{marker} {j+1}: {lines[j].rstrip()}")
        break

print("\nSelesai. Copy-paste seluruh output ini ke chat.")
