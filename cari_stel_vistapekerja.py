FILE_PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines, start=1):
    if "STEL" in line or "subBagianProses" in line:
        print(f"{i}: {line.strip()[:200]}")
