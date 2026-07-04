FILE_PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

RANGES = [
    ("Data fetching wiringInfoMap (context lengkap)", 1310, 1400),
    ("Table header render (ternary wiring vs non-wiring)", 1900, 1960),
    ("Table body render (kolom data per row)", 1990, 2060),
    ("Area sekitar tombol Kunci Progress", 2140, 2200),
]

with open(FILE_PATH, "r", encoding="utf-8") as f:
    lines = f.readlines()

total_lines = len(lines)

for label, start, end in RANGES:
    start = max(1, start)
    end = min(total_lines, end)
    print("=" * 80)
    print(f"### {label} (baris {start}-{end}) ###")
    print("=" * 80)
    for i in range(start - 1, end):
        print(f"{i+1}: {lines[i].rstrip()}")
    print()

print("Selesai. Copy-paste seluruh output ini ke chat.")
