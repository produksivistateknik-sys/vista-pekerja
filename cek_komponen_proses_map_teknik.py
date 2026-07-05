import re

FILES = [
    r"C:\Users\User\vista-teknik\src\App.tsx",
    r"C:\Users\User\vista-teknik\src\services\fcsService.ts",
]

for FILE_PATH in FILES:
    print("=" * 80)
    print(f"### FILE: {FILE_PATH} ###")
    print("=" * 80)
    try:
        with open(FILE_PATH, "r", encoding="utf-8") as f:
            lines = f.readlines()
    except FileNotFoundError:
        print("  (file tidak ditemukan)\n")
        continue

    total_lines = len(lines)

    print("\n--- Cari 'KOMPONEN_PROSES_MAP' ---")
    found = False
    for i, line in enumerate(lines, start=1):
        if "KOMPONEN_PROSES_MAP" in line:
            found = True
            start = max(0, i - 2)
            end = min(total_lines, i + 20)
            print(f"\nMatch di baris {i}:")
            for j in range(start, end):
                marker = ">>" if (j + 1) == i else "  "
                print(f"{marker} {j+1}: {lines[j].rstrip()}")
    if not found:
        print("  (tidak ditemukan)")

    print("\n--- Cari '__wiring_' (generate token) ---")
    found = False
    for i, line in enumerate(lines, start=1):
        if "__wiring_" in line:
            found = True
            print(f"  Baris {i}: {line.rstrip()}")
    if not found:
        print("  (tidak ditemukan)")

print("\nSelesai. Copy-paste seluruh output ini ke chat.")
