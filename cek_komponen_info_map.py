import re

FILE_PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    lines = f.readlines()

total_lines = len(lines)

print("=" * 80)
print("### Semua baris mengandung 'komponenInfoMap' ###")
print("=" * 80)
for i, line in enumerate(lines, start=1):
    if "komponenInfoMap" in line:
        print(f"{i}: {line.rstrip()}")

print("\n" + "=" * 80)
print("### Context lengkap tiap match (10 baris sebelum-sesudah) ###")
print("=" * 80)
for i, line in enumerate(lines, start=1):
    if "komponenInfoMap" in line:
        start = max(0, i - 10)
        end = min(total_lines, i + 10)
        print(f"\n--- Match di baris {i} ---")
        for j in range(start, end):
            marker = ">>" if (j + 1) == i else "  "
            print(f"{marker} {j+1}: {lines[j].rstrip()}")

print("\nSelesai. Copy-paste seluruh output ini ke chat.")
