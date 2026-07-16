FILE_PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines, start=1):
    if "QTY PROSES" in line or "AKTUAL SELESAI" in line or "TARGET SELESAI" in line:
        print(f"{i}: {line.strip()[:200]}")
