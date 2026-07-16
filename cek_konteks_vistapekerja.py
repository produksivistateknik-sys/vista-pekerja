FILE_PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    lines = f.readlines()

print("=== Sekitar baris 65-95 ===")
for i in range(64, 95):
    print(f"{i+1}: {lines[i].rstrip()[:200]}")

print("\n=== Sekitar baris 1485-1495 ===")
for i in range(1484, 1495):
    print(f"{i+1}: {lines[i].rstrip()[:200]}")
