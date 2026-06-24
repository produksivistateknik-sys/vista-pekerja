file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_emoji_jsx", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

results = {}

OLD1 = '''<span style={{fontSize:11,fontWeight:600,color:"#0891b2"}}>\\u{1F3F7}\\ufe0f Nameplate</span>'''
NEW1 = '''<span style={{fontSize:11,fontWeight:600,color:"#0891b2"}}>\U0001f3f7\ufe0f Nameplate</span>'''
results['NAMEPLATE_EMOJI'] = content.count(OLD1)

OLD2 = '''<span style={{fontSize:11,fontWeight:600,color:"#ca8a04"}}>\\u{1F7E1} Yellowmark</span>'''
NEW2 = '''<span style={{fontSize:11,fontWeight:600,color:"#ca8a04"}}>\U0001f7e1 Yellowmark</span>'''
results['YELLOWMARK_EMOJI'] = content.count(OLD2)

for k, v in results.items():
    print(f"  {k}: {v} occurrence(s)")

if all(v==1 for v in results.values()):
    content = content.replace(OLD1, NEW1, 1)
    content = content.replace(OLD2, NEW2, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Emoji JSX berhasil diperbaiki")
    print("[INFO] Jalankan: npm run build")
else:
    print("[FAIL] Ada occurrence tidak sesuai (harus semua 1), TIDAK menyimpan apapun")
