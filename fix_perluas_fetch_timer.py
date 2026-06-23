file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_perluas_fetch", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = '''    // Ambil semua timer yang masih aktif (belum selesai) untuk divisi ini
    supabase.from("fcs_timer_kerja").select("*").is("selesai",null).then(({data})=>{
      const map:Record<string,any>={};
      (data??[]).forEach((t:any)=>{map[`${t.panel_id}_${t.kode_komponen}_${t.proses}_${t.pekerja_id}`]=t;});
      setTimerAktif(map);
    });'''

NEW = '''    // Ambil semua timer aktif (lintas tanggal) + semua timer hari ini (aktif maupun sudah selesai)
    supabase.from("fcs_timer_kerja").select("*").or(`selesai.is.null,tanggal.eq.${viewDate}`).then(({data})=>{
      const mapAktif:Record<string,any>={};
      const mapPernahMulai:Record<string,boolean>={};
      const mapSelesaiHariIni:Record<string,boolean>={};
      (data??[]).forEach((t:any)=>{
        const key=`${t.panel_id}_${t.kode_komponen}_${t.proses}_${t.pekerja_id}`;
        if(!t.selesai)mapAktif[key]=t;
        mapPernahMulai[key]=true;
        if(t.tanggal===viewDate&&t.selesai)mapSelesaiHariIni[key]=true;
      });
      setTimerAktif(mapAktif);
      setTimerPernahMulai(mapPernahMulai);
      setTimerSelesaiHariIni(mapSelesaiHariIni);
    });'''

count = content.count(OLD)
print(f"  PATTERN occurrences: {count}")

if count == 1:
    content = content.replace(OLD, NEW, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Fetch timer diperluas, dapat data pernahMulai dan selesaiHariIni")
    print("[INFO] Lanjut tambah state timerPernahMulai dan timerSelesaiHariIni")
else:
    print(f"[FAIL] PATTERN occurrences = {count}, bukan 1. TIDAK menyimpan apapun")
