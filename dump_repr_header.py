FILE_PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines, start=1):
    if "user.sub_bagian||cfg?.label" in line:
        start=max(0,i-3)
        end=min(len(lines),i+3)
        for j in range(start,end):
            marker=">>" if (j+1)==i else "  "
            print(f"{marker} {j+1}: {repr(lines[j])}")
        print()

print("Selesai.")
