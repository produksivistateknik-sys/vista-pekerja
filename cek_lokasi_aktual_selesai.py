import re

FILE_PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    lines = f.readlines()

total_lines = len(lines)

def show(label, keyword, before=5, after=8, regex=False):
    print("=" * 80)
    print(f"### {label} (cari: '{keyword}') ###")
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

show("1. Render buggy new Date() untuk AKTUAL SELESAI", r"new Date\(\)\.toISOString\(\)", regex=True, before=8, after=3)
show("2. rows.push wiring (isWiring:true)", "isWiring:true", before=15, after=3)
show("3. rows.push non-wiring (isBusbar:isBusbarKomp)", "isBusbar:isBusbarKomp", before=10, after=3)
show("4. Header non-wiring - TARGET SELESAI th", "TARGET SELESAI</th>", before=5, after=5)
show("5. Body block CREATE BY non-wiring (yang kita tambahin kemarin)", r"!isWiringProses&&\(\(\)=>\{", regex=True, before=2, after=15)

print("Selesai. Copy-paste seluruh output ini ke chat.")
