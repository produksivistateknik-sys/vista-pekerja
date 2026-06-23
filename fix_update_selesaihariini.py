file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_update_selesai", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = '''    if(!error){
      setTimerAktif(prev=>{const n={...prev};delete n[key];return n;});
      // Cek apakah progress sudah 100% dan lebih cepat dari rencana - kirim notifikasi
      await cekDanKirimNotifikasiAvailable(pekerjaId,panelId,kode,proses);
    }
  };'''

NEW = '''    if(!error){
      setTimerAktif(prev=>{const n={...prev};delete n[key];return n;});
      setTimerSelesaiHariIni(prev=>({...prev,[key]:true}));
      // Cek apakah progress sudah 100% dan lebih cepat dari rencana - kirim notifikasi
      await cekDanKirimNotifikasiAvailable(pekerjaId,panelId,kode,proses);
    }
  };'''

count = content.count(OLD)
print(f"  PATTERN occurrences: {count}")

if count == 1:
    content = content.replace(OLD, NEW, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] stopTimer sekarang ikut update timerSelesaiHariIni secara real-time")
    print("[INFO] Jalankan: npm run build")
else:
    print(f"[FAIL] PATTERN occurrences = {count}, bukan 1. TIDAK menyimpan apapun")
