file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_notif_available", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = '''  const stopTimer=async(pekerjaId:number,panelId:number,kode:string,proses:string)=>{
    const key=`${panelId}_${kode}_${proses}_${pekerjaId}`;
    const timer=timerAktif[key];
    if(!timer)return;
    setTimerLoading(key);
    const{error}=await supabase.from("fcs_timer_kerja").update({selesai:new Date().toISOString()}).eq("id",timer.id);
    setTimerLoading(null);
    if(!error){
      setTimerAktif(prev=>{const n={...prev};delete n[key];return n;});
    }
  };'''

NEW = '''  const stopTimer=async(pekerjaId:number,panelId:number,kode:string,proses:string)=>{
    const key=`${panelId}_${kode}_${proses}_${pekerjaId}`;
    const timer=timerAktif[key];
    if(!timer)return;
    setTimerLoading(key);
    const{error}=await supabase.from("fcs_timer_kerja").update({selesai:new Date().toISOString()}).eq("id",timer.id);
    setTimerLoading(null);
    if(!error){
      setTimerAktif(prev=>{const n={...prev};delete n[key];return n;});
      // Cek apakah progress sudah 100% dan lebih cepat dari rencana - kirim notifikasi
      await cekDanKirimNotifikasiAvailable(pekerjaId,panelId,kode,proses);
    }
  };

  const cekDanKirimNotifikasiAvailable=async(pekerjaId:number,panelId:number,kode:string,proses:string)=>{
    const panel=panelsMap[panelId];
    if(!panel)return;
    const pct=panel.checklist?.[kode]?.progress?.[proses]||0;
    if(pct<100)return;
    // Ambil rentangTanggal dari raw_schedule untuk cek apakah lebih cepat dari rencana
    const{data:rawRows}=await supabase.from("raw_schedule").select("schedule").eq("panel_id",panelId).eq("proses",proses);
    let tanggalRencanaSelesai:string|null=null;
    for(const row of rawRows||[]){
      for(const entries of Object.values(row.schedule||{}) as any[]){
        for(const entry of entries){
          const rentang=entry.rentangTanggal?.[kode];
          if(rentang){tanggalRencanaSelesai=rentang.selesai;}
        }
      }
    }
    if(!tanggalRencanaSelesai)return;
    const hariIni=new Date().toISOString().slice(0,10);
    if(hariIni>=tanggalRencanaSelesai)return; // tidak lebih cepat, tidak perlu notifikasi
    const pekerja=pekerjaList.find((p:any)=>p.id===pekerjaId);
    const allItems=PANEL_TYPES[panel.tipe]?.wps.flatMap((w:any)=>w.items)||[];
    const namaKomponen=allItems.find((it:any)=>it.kode===kode)?.nama||kode;
    await supabase.from("fcs_notifikasi").insert({
      tipe:"available",pekerja_id:pekerjaId,pekerja_nama:pekerja?.nama||"",
      panel_id:panelId,panel_nama:panel.nama,kode_komponen:kode,nama_komponen:namaKomponen,proses,
      tanggal_rencana_selesai:tanggalRencanaSelesai,tanggal_aktual_selesai:hariIni,
    });
  };'''

count = content.count(OLD)
print(f"  PATTERN occurrences: {count}")

if count == 1:
    content = content.replace(OLD, NEW, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Notifikasi available berhasil ditambah, trigger otomatis saat stopTimer")
    print("[INFO] Jalankan: npm run build")
else:
    print(f"[FAIL] PATTERN occurrences = {count}, bukan 1. TIDAK menyimpan apapun")
