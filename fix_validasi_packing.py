file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_validasi_packing", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = '''    if(!isWiringProses(proses))return true;
    const ids=(task?.pekerja_per_komponen||{})[kode]||[];
    if(ids.length===0)return false;
    return ids.some((pid:number)=>timerPernahMulai[`${panelId}_${kode}_${proses}_${pid}`]);
  };'''

NEW = '''    if(proses==="PACKING"){
      const panel=panelsMap[panelId];
      const cl=panel?.qc_checklist||{};
      return QC_ITEMS.every(item=>cl[item.key]?.status==="lolos");
    }
    if(!isWiringProses(proses))return true;
    const ids=(task?.pekerja_per_komponen||{})[kode]||[];
    if(ids.length===0)return false;
    return ids.some((pid:number)=>timerPernahMulai[`${panelId}_${kode}_${proses}_${pid}`]);
  };'''

count = content.count(OLD)
print(f"  PATTERN occurrences: {count}")

if count == 1:
    content = content.replace(OLD, NEW, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Validasi PACKING berhasil ditambah - progress disabled kalau QC checklist belum semua Lolos")
    print("[INFO] Jalankan: npm run build")
else:
    print(f"[FAIL] PATTERN occurrences = {count}, bukan 1. TIDAK menyimpan apapun")
