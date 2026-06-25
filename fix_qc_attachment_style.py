file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_qc_attachment", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

results = {}

# Fix 1: Tambah state lightbox
OLD1 = "  const[uploadingId,setUploadingId]=useState<number|null>(null);"
NEW1 = '''  const[uploadingId,setUploadingId]=useState<number|null>(null);
  const[lightbox,setLightbox]=useState<any>(null);'''
results['STATE_LIGHTBOX'] = content.count(OLD1)

# Fix 2: Update uploadFoto untuk simpan nama file asli
OLD2 = '''      const{data:urlData}=supabase.storage.from("qc-photos").getPublicUrl(fileName);
      const panel=panelsList.find((p:any)=>p.id===panelId);
      const newFoto=[...(panel?.qc_foto||[]),{url:urlData.publicUrl,uploaded_by:user.nama,uploaded_at:new Date().toISOString()}];'''
NEW2 = '''      const{data:urlData}=supabase.storage.from("qc-photos").getPublicUrl(fileName);
      const panel=panelsList.find((p:any)=>p.id===panelId);
      const newFoto=[...(panel?.qc_foto||[]),{url:urlData.publicUrl,name:file.name,uploaded_by:user.nama,uploaded_at:new Date().toISOString()}];'''
results['SIMPAN_NAMA'] = content.count(OLD2)

for k, v in results.items():
    print(f"  {k}: {v} occurrence(s)")

if all(v==1 for v in results.values()):
    content = content.replace(OLD1, NEW1, 1)
    content = content.replace(OLD2, NEW2, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] State lightbox dan simpan nama file asli berhasil ditambah")
    print("[INFO] Lanjut redesign total render section foto")
else:
    print("[FAIL] Ada occurrence tidak sesuai (harus semua 1), TIDAK menyimpan apapun")
