import re

FILE_PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    lines = f.readlines()

total_lines = len(lines)

print("=" * 80)
print("### Cari semua baris mengandung 'getProgressOnDate' ###")
print("=" * 80)
for i, line in enumerate(lines, start=1):
    if "getProgressOnDate" in line:
        print(f"{i}: {line.rstrip()}")

# Cari definisinya spesifik (baris yang punya '=' setelah nama fungsi, tanda deklarasi)
print("\n" + "=" * 80)
print("### Detail baris deklarasi (dengan context 15 baris ke bawah) ###")
print("=" * 80)
for i, line in enumerate(lines, start=1):
    if re.search(r"getProgressOnDate\s*=\s*\(", line) or re.search(r"function\s+getProgressOnDate", line):
        start = max(0, i - 2)
        end = min(total_lines, i + 15)
        print(f"\n--- Definisi ditemukan di baris {i} ---")
        for j in range(start, end):
            marker = ">>" if (j + 1) == i else "  "
            print(f"{marker} {j+1}: {lines[j].rstrip()}")

print("\nSelesai. Copy-paste seluruh output ini ke chat.")
