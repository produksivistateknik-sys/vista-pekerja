FILE_PATH = r"C:\Users\User\vista-teknik\src\services\fcsService.ts"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    lines = f.readlines()

total_lines = len(lines)

print(f"Total baris: {total_lines}\n")
print("=" * 80)
print("### Context baris 440-540 ###")
print("=" * 80)
for i in range(439, min(540, total_lines)):
    print(f"{i+1}: {lines[i].rstrip()}")

print("\nSelesai. Copy-paste seluruh output ini ke chat.")
