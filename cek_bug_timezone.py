import re

FILES = [
    r"C:\Users\User\vista-pekerja\src\App.tsx",
    r"C:\Users\User\vista-teknik\src\App.tsx",
    r"C:\Users\User\vista-teknik\src\services\fcsService.ts",
]

PATTERN = r"toISOString\(\)\.slice\(0,\s*10\)"

for path in FILES:
    print("=" * 80)
    print(f"### FILE: {path} ###")
    print("=" * 80)
    try:
        with open(path, "r", encoding="utf-8") as f:
            lines = f.readlines()
    except FileNotFoundError:
        print("  (file tidak ditemukan, dilewati)\n")
        continue

    total_lines = len(lines)
    found = False
    for i, line in enumerate(lines, start=1):
        if re.search(PATTERN, line):
            found = True
            start = max(0, i - 2)
            end = min(total_lines, i + 2)
            print(f"\n--- Match di baris {i} ---")
            for j in range(start, end):
                marker = ">>" if (j + 1) == i else "  "
                print(f"{marker} {j+1}: {lines[j].rstrip()}")
    if not found:
        print("  (tidak ditemukan)")
    print()

print("Selesai. Copy-paste seluruh output ini ke chat.")
