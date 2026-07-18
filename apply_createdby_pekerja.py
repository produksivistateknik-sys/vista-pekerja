# -*- coding: utf-8 -*-
"""
Script: apply_createdby_pekerja.py
Tujuan: komponenInfoMap (buat nampilin CREATE BY di kartu mobile & tabel desktop)
        sekarang baca createdBy/createdAt LANGSUNG dari entry raw_schedule.schedule,
        bukan dari tabel fcs_schedule (sistem lama yang udah gak dipakai lagi buat
        generate). Data lama yang emang gak punya createdBy tetap tampil "–".

Cara pakai:
    python apply_createdby_pekerja.py
"""
import shutil
import datetime
import sys

FILE_PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

def fail(msg):
    print("\n❌ GAGAL:", msg)
    print("Tidak ada perubahan yang disimpan. File asli aman.")
    sys.exit(1)

def main():
    try:
        with open(FILE_PATH, "r", encoding="utf-8") as f:
            content = f.read()
    except FileNotFoundError:
        fail(f"File tidak ditemukan di {FILE_PATH}")

    if "e.createdBy" in content:
        fail("Perubahan sepertinya sudah pernah diterapkan (sudah ada 'e.createdBy').")

    old = (
        '      (rawDtNw||[]).forEach((row:any)=>{\n'
        '        Object.entries(row.schedule||{}).forEach(([tgl,entries]:any)=>{\n'
        '          (entries||[]).forEach((e:any)=>{\n'
        '            (e.komponen||[]).forEach((k:string)=>{\n'
        '              if(k.startsWith("__wiring_"))return;\n'
        '              const key=`${row.panel_id}_${row.proses}_${k}`;\n'
        '              if(!kompMap[key])kompMap[key]={createdBy:null,createdAt:null,targetSelesai:null};\n'
        '              if(!kompMap[key].targetSelesai||tgl>kompMap[key].targetSelesai)kompMap[key].targetSelesai=tgl;\n'
        '            });\n'
        '          });\n'
        '        });\n'
        '      });'
    )
    new = (
        '      (rawDtNw||[]).forEach((row:any)=>{\n'
        '        Object.entries(row.schedule||{}).forEach(([tgl,entries]:any)=>{\n'
        '          (entries||[]).forEach((e:any)=>{\n'
        '            (e.komponen||[]).forEach((k:string)=>{\n'
        '              if(k.startsWith("__wiring_"))return;\n'
        '              const key=`${row.panel_id}_${row.proses}_${k}`;\n'
        '              if(!kompMap[key])kompMap[key]={createdBy:e.createdBy||null,createdAt:e.createdAt||null,targetSelesai:null};\n'
        '              else if(!kompMap[key].createdBy&&e.createdBy){kompMap[key].createdBy=e.createdBy;kompMap[key].createdAt=e.createdAt;}\n'
        '              if(!kompMap[key].targetSelesai||tgl>kompMap[key].targetSelesai)kompMap[key].targetSelesai=tgl;\n'
        '            });\n'
        '          });\n'
        '        });\n'
        '      });'
    )

    count = content.count(old)
    if count == 0:
        fail("Tidak ketemu blok 'rawDtNw.forEach(...)' persis seperti yang diharapkan. Struktur mungkin sudah berubah — kirim ulang dump terbaru.")
    if count > 1:
        fail(f"Blok itu muncul {count} kali (harusnya cuma 1) — perlu dicek manual dulu.")

    new_content = content.replace(old, new)

    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = FILE_PATH + f".bak_{ts}"
    shutil.copy2(FILE_PATH, backup_path)
    print(f"✅ Backup dibuat: {backup_path}")

    with open(FILE_PATH, "w", encoding="utf-8") as f:
        f.write(new_content)

    print("✅ Berhasil diubah: komponenInfoMap sekarang baca createdBy/createdAt langsung dari raw_schedule.")
    print("\nLangkah selanjutnya:")
    print("   npm run build")

if __name__ == "__main__":
    main()
