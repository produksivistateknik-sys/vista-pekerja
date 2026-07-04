import re

FILE_PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    lines = f.readlines()

total_lines = len(lines)

patterns = [
    r"const\s+getProgressOnDate\s*=",
    r"progressByDate\[",
    r"progressByDate\s*:",
    r"setProgressByDate|progressByDate=\{",
]

for pat in patterns:
    print("=" * 80)
    print(f"### Pattern: {pat} ###")
    print("=" * 80)
    found = False
    for i, line in enumerate(lines, start=1):
        if re.search(pat, line):
            found = True
            start = max(0, i - 3)
            end = min(total_lines, i + 12)
            print(f"\n--- Match di baris {i} ---")
            for j in range(start, end):
                marker = ">>" if (j + 1) == i else "  "
                print(f"{marker} {j+1}: {lines[j].rstrip()}")
    if not found:
        print("  (tidak ditemukan)")
    print()

# Cari juga di fcsService.ts kalau ada yang relevan
FCS_PATH = r"C:\Users\User\vista-teknik\src\services\fcsService.ts"
try:
    with open(FCS_PATH, "r", encoding="utf-8") as f:
        fcs_lines = f.readlines()
    print("=" * 80)
    print("### Cari 'progress' history di fcsService.ts ###")
    print("=" * 80)
    for pat in [r"progressByDate", r"history", r"log_progress", r"riwayat"]:
        found = False
        for i, line in enumerate(fcs_lines, start=1):
            if re.search(pat, line, re.IGNORECASE):
                found = True
                print(f"  Baris {i}: {line.rstrip()}")
        if not found:
            print(f"  Pattern '{pat}': tidak ditemukan")
except FileNotFoundError:
    print(f"\n(File {FCS_PATH} tidak ditemukan/dilewati)")

print("\nSelesai. Copy-paste seluruh output ini ke chat.")
