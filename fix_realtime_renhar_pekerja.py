file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_realtime_renhar_pkj", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = '''      setTimerSelesaiHariIni(mapSelesaiHariIni);
    });
  },[viewDate,user.divisi]);'''

NEW = '''      setTimerSelesaiHariIni(mapSelesaiHariIni);
    });

    const renharChannel=supabase.channel("realtime-renhar-pekerja")
      .on("postgres_changes",{event:"*",schema:"public",table:"renhar"},(payload:any)=>{
        const row=payload.new||payload.old;
        if(row?.tanggal===viewDate&&row?.divisi===user.divisi){
          loadData();
        }
      })
      .subscribe();
    return()=>{supabase.removeChannel(renharChannel);};
  },[viewDate,user.divisi]);'''

count = content.count(OLD)
print(f"  PATTERN occurrences: {count}")

if count == 1:
    content = content.replace(OLD, NEW, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Realtime listener renhar berhasil ditambah di Vista Pekerja")
    print("[INFO] Jalankan: npm run build")
else:
    print(f"[FAIL] PATTERN occurrences = {count}, bukan 1. TIDAK menyimpan apapun")
