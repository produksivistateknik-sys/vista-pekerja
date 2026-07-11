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
        print(f"GAGAL [{label}]: pattern tidak ditemukan.")
        print(repr(old))
        sys.exit(1)
    if count > 1:
        print(f"GAGAL [{label}]: ditemukan {count}x.")
        sys.exit(1)
    print(f"OK [{label}]")
    return content.replace(old, new)


backup_path = FILE_PATH + f".bak_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
shutil.copy2(FILE_PATH, backup_path)
print(f"Backup: {backup_path}\n")

content = read_file()

old1 = '''  const [timerAktif,setTimerAktif]=useState<Record<string,any>>({});
  const [,setTimerPernahMulai]=useState<Record<string,boolean>>({});
  const [timerSelesaiHariIni,setTimerSelesaiHariIni]=useState<Record<string,boolean>>({});'''

new1 = '''  const [timerAktif,setTimerAktif]=useState<Record<string,any>>({});
  const [,setTimerPernahMulai]=useState<Record<string,boolean>>({});
  const [timerSelesaiHariIni,setTimerSelesaiHariIni]=useState<Record<string,boolean>>({});
  const [timerDurasiSelesai,setTimerDurasiSelesai]=useState<Record<string,number>>({});'''

content = apply_edit(content, old1, new1, "Edit 1: Tambah state timerDurasiSelesai")

old23 = '''      const mapAktif:Record<string,any>={};
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

    const renharChannel=supabase.channel("realtime-renhar-pekerja")'''

new23 = '''      const mapAktif:Record<string,any>={};
      const mapPernahMulai:Record<string,boolean>={};
      const mapSelesaiHariIni:Record<string,boolean>={};
      const mapDurasiSelesai:Record<string,number>={};
      (data??[]).forEach((t:any)=>{
        const key=`${t.panel_id}_${t.kode_komponen}_${t.proses}_${t.pekerja_id}`;
        if(!t.selesai)mapAktif[key]=t;
        mapPernahMulai[key]=true;
        if(t.tanggal===viewDate&&t.selesai){
          mapSelesaiHariIni[key]=true;
          mapDurasiSelesai[key]=(mapDurasiSelesai[key]||0)+Number(t.durasi_menit||0);
        }
      });
      setTimerAktif(mapAktif);
      setTimerPernahMulai(mapPernahMulai);
      setTimerSelesaiHariIni(mapSelesaiHariIni);
      setTimerDurasiSelesai(mapDurasiSelesai);
    });

    const renharChannel=supabase.channel("realtime-renhar-pekerja")'''

content = apply_edit(content, old23, new23, "Edit 2: Update fetch awal hitung akumulasi durasi")

old4 = '''        const mapAktif:Record<string,any>={};
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
    const timerChannel=supabase.channel("realtime-timer-kerja-pekerja")'''

new4 = '''        const mapAktif:Record<string,any>={};
        const mapPernahMulai:Record<string,boolean>={};
        const mapSelesaiHariIni:Record<string,boolean>={};
        const mapDurasiSelesai:Record<string,number>={};
        (data??[]).forEach((t:any)=>{
          const key=`${t.panel_id}_${t.kode_komponen}_${t.proses}_${t.pekerja_id}`;
          if(!t.selesai)mapAktif[key]=t;
          mapPernahMulai[key]=true;
          if(t.tanggal===viewDate&&t.selesai){
            mapSelesaiHariIni[key]=true;
            mapDurasiSelesai[key]=(mapDurasiSelesai[key]||0)+Number(t.durasi_menit||0);
          }
        });
        setTimerAktif(mapAktif);
        setTimerPernahMulai(mapPernahMulai);
        setTimerSelesaiHariIni(mapSelesaiHariIni);
        setTimerDurasiSelesai(mapDurasiSelesai);
      });
    };
    const timerChannel=supabase.channel("realtime-timer-kerja-pekerja")'''

content = apply_edit(content, old4, new4, "Edit 3: Update fetch realtime hitung akumulasi durasi")

write_file(content)
print("\nSemua edit berhasil! Lanjut display durasiLabel.")
