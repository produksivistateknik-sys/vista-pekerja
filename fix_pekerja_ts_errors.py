from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-pekerja\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Fix 1: Hapus selDc yang tidak dipakai
old1 = "  const selDc=(DIVISI_CONFIG as any)[div]||{};\n"
if old1 in content:
    content = content.replace(old1, "")
    print("✅ selDc removed")
else:
    print("⚠️  selDc not found")

# Fix 2: Tambah _ prefix pada Sel agar tidak error unused
old2 = "function Sel({style={},children,...p}:any){"
new2 = "function _Sel({style={},children,...p}:any){"
if old2 in content:
    content = content.replace(old2, new2)
    print("✅ Sel renamed to _Sel")
else:
    print("⚠️  Sel not found")

APP_PATH.write_text(content, encoding="utf-8")
print("✅ Selesai!")
