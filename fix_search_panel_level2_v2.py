file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_search_panel_v2", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD1 = '''  const[selectedWoId,setSelectedWoId]=useState<number|null>(null);
  const[uploadingId,setUploadingId]=useState<number|null>(null);
  const[lightbox,setLightbox]=useState<any>(null);'''
NEW1 = '''  const[selectedWoId,setSelectedWoId]=useState<number|null>(null);
  const[searchPanel,setSearchPanel]=useState("");
  const[uploadingId,setUploadingId]=useState<number|null>(null);
  const[lightbox,setLightbox]=useState<any>(null);'''

count = content.count(OLD1)
print(f"  PATTERN occurrences: {count}")

if count == 1:
    content = content.replace(OLD1, NEW1, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] State searchPanel berhasil ditambah khusus di QCChecklistTab")
    print("[INFO] Lanjut tambah search box dan filter (step terpisah)")
else:
    print(f"[FAIL] PATTERN occurrences = {count}, bukan 1. TIDAK menyimpan apapun")
