FILE_PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines, start=1):
    if "updateChecklistItem" in line and "const" in line:
        start=max(0,i-1)
        end=min(len(lines),i+20)
        for j in range(start,end):
            print(f"{j+1}: {lines[j].rstrip()}")
        break

print("\nSelesai.")
