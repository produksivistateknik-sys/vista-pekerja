import re

FILE_PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    lines = f.readlines()

total_lines = len(lines)

# 1. Dump sisa body row (2060-2150)
print("=" * 80)
print("### Sisa body row rendering (baris 2060-2150) ###")
print("=" * 80)
for i in range(2059, min(2150, total_lines)):
    print(f"{i+1}: {lines[i].rstrip()}")

# 2. Cari definisi function/const penting
print("\n" + "=" * 80)
print("### Cari definisi lockProgress, todayTasks, myProses, isQtyBased ###")
print("=" * 80)
patterns = [
    r"const\s+lockProgress\s*=",
    r"const\s+todayTasks\s*=",
    r"const\s+myProses\s*=",
    r"const\s+isQtyBased\s*=",
]
for pat in patterns:
    print(f"\n--- Pattern: {pat} ---")
    found = False
    for i, line in enumerate(lines, start=1):
        if re.search(pat, line):
            found = True
            start = max(0, i - 2)
            end = min(total_lines, i + 15)
            print(f"Match di baris {i}:")
            for j in range(start, end):
                marker = ">>" if (j + 1) == i else "  "
                print(f"{marker} {j+1}: {lines[j].rstrip()}")
    if not found:
        print("  (tidak ditemukan)")

print("\nSelesai. Copy-paste seluruh output ini ke chat.")
