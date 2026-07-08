import re

FILE_PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines, start=1):
    if "Mulai" in line and ("button" in line.lower() or "onClick" in line):
        start=max(0,i-8)
        end=min(len(lines),i+8)
        print(f"--- Match di baris {i} ---")
        for j in range(start,end):
            marker=">>" if (j+1)==i else "  "
            print(f"{marker} {j+1}: {lines[j].rstrip()}")
        print()

print("Selesai.")
