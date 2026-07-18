# -*- coding: utf-8 -*-
"""
Script: apply_simpan_progress_tanpa_kunci.py
Tujuan: Tombol "Kunci Progress" per komponen diubah jadi "Simpan Progress" -
        tetap nyimpen checkpoint ke Vista Teknik (progress_checkpoint_log +
        panels.checklist), TAPI TIDAK mengunci input qty. Operator bisa
        terus update qty & klik simpan berkali-kali sepanjang hari.

Cara pakai:
    python apply_simpan_progress_tanpa_kunci.py
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

    if "// TIDAK setLockedCells" in content:
        fail("Perubahan sepertinya sudah pernah diterapkan.")

    # 1) Hapus setLockedCells di lockSingleKomponen (biar gak ngunci input qty)
    old_fn_part = '''      setLockedCells((prev:any)=>({...prev,[`${panelId}_${kode}_${proses}_${viewDate}_${shift}`]:true}));
    }'''
    new_fn_part = '''      // TIDAK setLockedCells - biar qty tetap bisa diedit lanjut, cuma checkpoint aja yang disimpan
    }'''
    count1 = content.count(old_fn_part)
    if count1 == 0:
        fail("Tidak ketemu baris setLockedCells di lockSingleKomponen. Struktur mungkin sudah berubah - kirim ulang dump terbaru.")
    if count1 > 1:
        fail(f"Baris itu muncul {count1} kali (harusnya cuma 1) - perlu dicek manual dulu.")
    content = content.replace(old_fn_part, new_fn_part)

    # 2) Ganti tombol jadi "Simpan Progress", selalu aktif (bukan disabled pas cellLocked)
    old_btn = '''                      <button disabled={cellLocked||r.pct===0} onClick={()=>lockSingleKomponen(r.panelId,r.kode,proses)}
                        style={{fontSize:11,fontWeight:700,border:"none",borderRadius:10,padding:"7px 10px",
                          cursor:(cellLocked||r.pct===0)?"not-allowed":"pointer",
                          background:cellLocked?"#f0fdf4":"#eff6ff",color:cellLocked?"#16a34a":"#1d4ed8"}}>
                        {cellLocked?"🔒 Terkunci":"🔒 Kunci Progress"}
                      </button>'''
    new_btn = '''                      <button disabled={r.pct===0} onClick={()=>lockSingleKomponen(r.panelId,r.kode,proses)}
                        style={{fontSize:11,fontWeight:700,border:"none",borderRadius:10,padding:"7px 10px",
                          cursor:r.pct===0?"not-allowed":"pointer",
                          background:"#eff6ff",color:"#1d4ed8"}}>
                        💾 Simpan Progress
                      </button>'''
    count2 = content.count(old_btn)
    if count2 == 0:
        fail("Tidak ketemu tombol 'Kunci Progress' persis seperti yang diharapkan. Struktur mungkin sudah berubah - kirim ulang dump terbaru.")
    if count2 > 1:
        fail(f"Tombol itu muncul {count2} kali (harusnya cuma 1) - perlu dicek manual dulu.")
    content = content.replace(old_btn, new_btn)

    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = FILE_PATH + f".bak_{ts}"
    shutil.copy2(FILE_PATH, backup_path)
    print(f"✅ Backup dibuat: {backup_path}")

    with open(FILE_PATH, "w", encoding="utf-8") as f:
        f.write(content)

    print("✅ Berhasil diubah:")
    print("   1. lockSingleKomponen tidak lagi mengunci input qty (cuma simpan checkpoint)")
    print("   2. Tombol jadi 'Simpan Progress', selalu aktif selama pct>0")
    print("\nLangkah selanjutnya:")
    print("   npm run build")

if __name__ == "__main__":
    main()
