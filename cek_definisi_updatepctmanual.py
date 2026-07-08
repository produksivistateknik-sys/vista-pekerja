import re

FILE_PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    lines = f.readlines()

total_lines = len(lines)

for i, line in enumerate(lines, start=1):
    if "const updatePctManual" in line or "updatePctManual=" in line:
        start=max(0,i-2)
        end=min(total_lines,i+50)
        print(f"--- Match di baris {i} ---")
        for j in range(start,end):
            marker=">>" if (j+1)==i else "  "
            print(f"{marker} {j+1}: {lines[j].rstrip()}")
        print()
        break

print("Selesai.")
