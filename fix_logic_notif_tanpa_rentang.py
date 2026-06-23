file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_logic_notif_baru", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = '''    const panel=panelsMap[panelId];
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
    if(hariIni>=tanggalRencanaSelesai)return; // tidak lebih cepat, tidak perlu notifikasi'''

NEW = '''    const panel=panelsMap[panelId];
    if(!panel)return;
    const pct=panel.checklist?.[kode]?.progress?.[proses]||0;
    if(pct<100)return;
    // Cari tanggal TERJAUH di mana komponen ini sudah di-assign manual di raw_schedule
    // (ini jadi acuan "rencana selesai" - bukan dari rentangTanggal lagi, tapi dari assignment manual planner)
    const{data:rawRows}=await supabase.from("raw_schedule").select("schedule").eq("panel_id",panelId).eq("proses",proses);
    let tanggalRencanaSelesai:string|null=null;
    for(const row of rawRows||[]){
      for(const[tglKey,entries] of Object.entries(row.schedule||{}) as [string,any[]][]){
        for(const entry of entries){
          if((entry.komponen||[]).includes(kode)){
            if(!tanggalRencanaSelesai||tglKey>tanggalRencanaSelesai)tanggalRencanaSelesai=tglKey;
          }
        }
      }
    }
    if(!tanggalRencanaSelesai)return;
    const hariIni=new Date().toISOString().slice(0,10);
    if(hariIni>=tanggalRencanaSelesai)return; // tidak lebih cepat, tidak perlu notifikasi'''

count = content.count(OLD)
print(f"  PATTERN occurrences: {count}")

if count == 1:
    content = content.replace(OLD, NEW, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Logic notifikasi sekarang hitung 'rencana selesai' dari assignment manual terjauh")
    print("[INFO] Jalankan: npm run build")
else:
    print(f"[FAIL] PATTERN occurrences = {count}, bukan 1. TIDAK menyimpan apapun")
