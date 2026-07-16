FILE_PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    content = f.read()

marker = '<div style={{overflowX:"auto"}}>'
idx = content.find(marker)
print(f"Posisi marker: {idx}")

i = idx
depth = 0
end_idx = None
while i < len(content):
    if content[i:i+4] == "<div":
        nxt = content[i+4]
        if nxt in (" ", ">"):
            depth += 1
    elif content[i:i+6] == "</div>":
        depth -= 1
        if depth == 0:
            end_idx = i + 6
            break
    i += 1

print(f"Posisi akhir div: {end_idx}")
print("\n=== 150 karakter SEBELUM akhir ===")
print(content[end_idx-150:end_idx])
print("\n=== 150 karakter SETELAH akhir ===")
print(content[end_idx:end_idx+150])
