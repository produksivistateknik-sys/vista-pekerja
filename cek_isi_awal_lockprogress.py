FILE_PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    content = f.read()

idx = content.find("const lockProgress=async()=>{")
print(repr(content[idx:idx+300]))
