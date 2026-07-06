import shutil
import sys
from datetime import datetime

FILE_PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

def read_file():
    with open(FILE_PATH, "r", encoding="utf-8") as f:
        return f.read()

def write_file(content):
    with open(FILE_PATH, "w", encoding="utf-8") as f:
        f.write(content)

def apply_edit(content, old, new, label):
    count = content.count(old)
    if count == 0:
        print(f"❌ GAGAL [{label}]: pattern tidak ditemukan. Tidak ada perubahan disimpan.")
        print("---- Pattern yang dicari ----")
        print(old)
        sys.exit(1)
    if count > 1:
        print(f"❌ GAGAL [{label}]: pattern ditemukan {count}x (harus unik/1x). Tidak ada perubahan disimpan.")
        sys.exit(1)
    print(f"✅ [{label}] pattern ditemukan 1x, mengganti...")
    return content.replace(old, new)


backup_path = FILE_PATH + f".bak_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
shutil.copy2(FILE_PATH, backup_path)
print(f"📦 Backup dibuat: {backup_path}\n")

content = read_file()

old1 = '''    return()=>{supabase.removeChannel(renharChannel);};
  },[viewDate,user.divisi]);

  const loadData=async()=>{'''

new1 = '''    return()=>{supabase.removeChannel(renharChannel);};
  },[viewDate,user.divisi]);

  useEffect(()=>{
    const fetchTimerData=()=>{
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
      });
    };
    const timerChannel=supabase.channel("realtime-timer-kerja-pekerja")
      .on("postgres_changes",{event:"*",schema:"public",table:"fcs_timer_kerja"},()=>{fetchTimerData();})
      .subscribe();
    return()=>{supabase.removeChannel(timerChannel);};
  },[viewDate]);

  const loadData=async()=>{'''

content = apply_edit(content, old1, new1, "Edit 1: Tambah realtime channel fcs_timer_kerja")

write_file(content)
print("\n🎉 Berhasil!")
print(f"   Backup asli ada di: {backup_path}")
print("   Sekarang perubahan timer (mulai/stop) dari operator/device manapun langsung")
print("   ke-sync realtime, gak perlu refresh manual lagi.")
print("   Lanjut: npm run build.")
