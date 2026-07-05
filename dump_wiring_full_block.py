import re

FILE_PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    lines = f.readlines()

total_lines = len(lines)

def show(label, keyword, before=3, after=10, regex=False, all_matches=True):
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
            if not all_matches:
                break
    if not found:
        print("  (tidak ditemukan)")
    print()

show("1. Card title/header per proses", r"Card key=\{proses\}", regex=True, before=2, after=12)
show("2. Header ternary lengkap (isWiringProses)", r"\{isWiringProses\?\(", regex=True, before=2, after=35)
show("3. rows-building loop (token wiring)", r"kode\.startsWith\(\"__wiring_\"\)", regex=True, before=5, after=15)
show("4. Body render ternary lengkap", r"isWiringProses\?\(\(\)=>\{", regex=True, before=2, after=60)

print("Selesai. Copy-paste seluruh output ini ke chat.")
