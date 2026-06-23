file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_update_pernahmulai", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = '''    setTimerLoading(null);
    if(!error&&data){
      setTimerAktif(prev=>({...prev,[key]:data}));
    }
  };

  const stopTimer=async(pekerjaId:number,panelId:number,kode:string,proses:string)=>{'''

NEW = '''    setTimerLoading(null);
    if(!error&&data){
      setTimerAktif(prev=>({...prev,[key]:data}));
      setTimerPernahMulai(prev=>({...prev,[key]:true}));
    }
  };

  const stopTimer=async(pekerjaId:number,panelId:number,kode:string,proses:string)=>{'''

count = content.count(OLD)
print(f"  PATTERN occurrences: {count}")

if count == 1:
    content = content.replace(OLD, NEW, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] startTimer sekarang ikut update timerPernahMulai secara real-time")
    print("[INFO] Lanjut cek juga stopTimer untuk update timerSelesaiHariIni")
else:
    print(f"[FAIL] PATTERN occurrences = {count}, bukan 1. TIDAK menyimpan apapun")
