import re

FILE_PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    lines = f.readlines()

total_lines = len(lines)

def show(label, keyword, before=2, after=15, regex=False, max_matches=5):
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

show("1. subBagianPassword komponen", r"subBagianPassword", regex=True, before=2, after=5)
show("2. sub_bagian dropdown selection", r"sub_bagian", regex=True, before=2, after=3, max_matches=10)

print("Selesai.")
