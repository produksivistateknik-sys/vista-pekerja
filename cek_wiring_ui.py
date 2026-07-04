import re

FILE_PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

# Keywords yang mau dicari untuk lokasi kode terkait
KEYWORDS = [
    "pernahDikunci",
    "Sudah Dikunci",
    "wiringInfoMap",
    "CREATE BY",
    "CREATE ON",
    "TARGET SELESAI",
    "AKTUAL SELESAI",
    "isProsesSatuanOrang",
    "WIRING CONTROL",
    "WIRING POWER",
]

with open(FILE_PATH, "r", encoding="utf-8") as f:
    lines = f.readlines()

total_lines = len(lines)
print(f"Total baris file: {total_lines}\n")
print("=" * 80)

for kw in KEYWORDS:
    print(f"\n### Keyword: '{kw}' ###")
    found = False
    for i, line in enumerate(lines, start=1):
        if kw in line:
            found = True
            start = max(0, i - 3)
            end = min(total_lines, i + 3)
            print(f"\n--- Match di baris {i} (context {start+1}-{end}) ---")
            for j in range(start, end):
                marker = ">>" if (j + 1) == i else "  "
                print(f"{marker} {j+1}: {lines[j].rstrip()}")
    if not found:
        print("  (tidak ditemukan)")

print("\n" + "=" * 80)
print("\nSelesai. Copy-paste seluruh output ini ke chat.")
