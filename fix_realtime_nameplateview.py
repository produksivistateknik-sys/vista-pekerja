file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_realtime_npview", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = "  useEffect(()=>{fetchData();},[]);"
NEW = '''  useEffect(()=>{
    fetchData();
    const ch=supabase.channel("realtime-panels-nameplate")
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"panels"},()=>{fetchData();})
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"panels"},()=>{fetchData();})
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);'''

count = content.count(OLD)
print(f"  PATTERN occurrences: {count}")

if count == 1:
    content = content.replace(OLD, NEW, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Realtime listener panels berhasil ditambah di NameplateView")
    print("[INFO] Jalankan: npm run build")
else:
    print(f"[FAIL] PATTERN occurrences = {count}, bukan 1. TIDAK menyimpan apapun")
