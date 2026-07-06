FILE_PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i in range(459, 780):
    print(f"{i+1}: {lines[i].rstrip()}")

print("Selesai.")
