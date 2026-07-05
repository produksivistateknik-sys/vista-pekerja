FILE_PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    lines = f.readlines()

print("=" * 80)
print("### Baris 1-10 (import) ###")
print("=" * 80)
for i in range(0, 10):
    print(f"{i+1}: {lines[i].rstrip()}")

print("\n" + "=" * 80)
print("### Sekitar state wiringInfoMap/komponenInfoMap ###")
print("=" * 80)
for i, line in enumerate(lines, start=1):
    if "wiringInfoMap,setWiringInfoMap" in line or "komponenInfoMap,setKomponenInfoMap" in line:
        print(f"{i}: {line.rstrip()}")

print("\nSelesai. Copy-paste seluruh output ini ke chat.")
