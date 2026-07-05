import re

FILE_PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    lines = f.readlines()

total_lines = len(lines)

print("=" * 80)
print("### Awal rows.map (tbody) ###")
print("=" * 80)
for i, line in enumerate(lines, start=1):
    if "{rows.map((r:any,ri:number)=>{" in line:
        start = max(0, i - 3)
        end = min(total_lines, i + 20)
        print(f"\n--- Match di baris {i} ---")
        for j in range(start, end):
            marker = ">>" if (j + 1) == i else "  "
            print(f"{marker} {j+1}: {lines[j].rstrip()}")
        break

print("\n" + "=" * 80)
print("### Akhir rows.map (cari '})}' setelah STATUS td) ###")
print("=" * 80)
for i, line in enumerate(lines, start=1):
    if 'label="TERCAPAI"' in line:
        start = max(0, i - 2)
        end = min(total_lines, i + 15)
        print(f"\n--- Match di baris {i} ---")
        for j in range(start, end):
            marker = ">>" if (j + 1) == i else "  "
            print(f"{marker} {j+1}: {lines[j].rstrip()}")
        break

print("\nSelesai. Copy-paste seluruh output ini ke chat.")
