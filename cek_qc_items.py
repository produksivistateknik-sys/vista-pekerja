import re

FILE_PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    lines = f.readlines()

total_lines = len(lines)

def show(label, keyword, before=2, after=30, regex=False, max_matches=2):
    print("=" * 80)
    print(f"### {label} (cari: '{keyword}') ###")
    print("=" * 80)
    count = 0
    for i, line in enumerate(lines, start=1):
        match = re.search(keyword, line) if regex else (keyword in line)
        if match:
            count += 1
            if count > max_matches:
                break
            start = max(0, i - before)
            end = min(total_lines, i + after)
            print(f"\n--- Match #{count} di baris {i} ---")
            for j in range(start, end):
                marker = ">>" if (j + 1) == i else "  "
                print(f"{marker} {j+1}: {lines[j].rstrip()}")
    if count == 0:
        print("  (tidak ditemukan)")
    print()

show("1. Definisi QC_ITEMS", r"const QC_ITEMS", regex=True, before=2, after=40)
show("2. Render checklist di panel (map QC_ITEMS)", r"QC_ITEMS.map", regex=True, before=5, after=40)

print("Selesai.")
