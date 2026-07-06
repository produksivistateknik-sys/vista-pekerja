FILE_PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    lines = f.readlines()

start_idx = None
for i, line in enumerate(lines):
    if "function QCChecklistTab" in line:
        start_idx = i
        break

if start_idx is not None:
    for j in range(start_idx, min(start_idx+420, len(lines))):
        print(f"{j+1}: {lines[j].rstrip()}")
else:
    print("tidak ditemukan")

print("Selesai.")
