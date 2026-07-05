import re

FILE_PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    lines = f.readlines()

total_lines = len(lines)

def show(label, keyword, before=2, after=15, regex=False):
    print("=" * 80)
    print(f"### {label} ###")
    print("=" * 80)
    found = False
    for i, line in enumerate(lines, start=1):
        match = re.search(keyword, line) if regex else (keyword in line)
        if match:
            found = True
            start = max(0, i - before)
            end = min(total_lines, i + after)
            print(f"\n--- Match di baris {i} ---")
            for j in range(start, end):
                marker = ">>" if (j + 1) == i else "  "
                print(f"{marker} {j+1}: {lines[j].rstrip()}")
    if not found:
        print("  (tidak ditemukan)")
    print()

show("1. PROGRESS column penuh", r'\{isQtyBased\?\(', regex=True, before=2, after=15)
show("2. STEP checkmarks penuh", r"const bisaEdit=canEditProgressKomponen", regex=True, before=1, after=25)
show("3. Penutup table (cari '</tbody>')", r"</tbody>", regex=True, before=2, after=8)

print("Selesai. Copy-paste seluruh output ini ke chat.")
