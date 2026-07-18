# -*- coding: utf-8 -*-
"""
Script: apply_selesai_semua_desktop.py
Tujuan: Tambah tombol "Selesai Semua" di sebelah "Pilih Operator & Mulai"
        di tabel desktop (POTONG/RENDAM/PAINTING) - stop SEMUA timer yang
        lagi jalan di antara komponen yang terkumpul, sekali klik.

PRASYARAT: apply_bulk_operator_mulai_desktop.py sudah pernah dijalankan.

Cara pakai:
    python apply_selesai_semua_desktop.py
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

    if "bulkStopDesktop" in content:
        fail("Perubahan sepertinya sudah pernah diterapkan.")

    old_fn = '''    const bulkAssignAndStartDesktop=async(proses:string,rowsToAssign:any[],pekerjaIds:number[])=>{
      // Khusus desktop: assign operator SEKALIGUS start timer buat semua baris terkumpul.
      for(const r of rowsToAssign){
        await updatePekerjaPerKomponen(r.task.id,r.kode,pekerjaIds);
      }
      for(const r of rowsToAssign){
        for(const pid of pekerjaIds){
          await startTimer(pid,r.panelId,r.kode,proses,viewDate);
        }
      }
    };
'''
    new_fn = old_fn + '''
    const bulkStopDesktop=async(proses:string,rowsToStop:any[])=>{
      for(const r of rowsToStop){
        const idsKomp=(r.task.pekerja_per_komponen||{})[r.kode]||[];
        for(const pid of idsKomp){
          const key=`${r.panelId}_${r.kode}_${proses}_${pid}`;
          if(timerAktif[key]){
            await stopTimer(pid,r.panelId,r.kode,proses);
          }
        }
      }
    };
'''
    count1 = content.count(old_fn)
    if count1 == 0:
        fail("Tidak ketemu fungsi bulkAssignAndStartDesktop persis seperti yang diharapkan. Struktur mungkin sudah berubah - kirim ulang dump terbaru.")
    if count1 > 1:
        fail(f"Fungsi itu muncul {count1} kali (harusnya cuma 1) - perlu dicek manual dulu.")
    content = content.replace(old_fn, new_fn)

    old_btn = '''                <button onClick={()=>{setBulkAssignProses(proses);setTempBulkPekerjaIds([]);}}
                  style={{padding:"8px 16px",borderRadius:8,border:"none",background:"#2563eb",color:"#fff",fontWeight:700,fontSize:12,cursor:"pointer"}}>
                  Pilih Operator & Mulai ({visibleRows.length} komponen)
                </button>'''
    new_btn = '''                <button onClick={()=>{setBulkAssignProses(proses);setTempBulkPekerjaIds([]);}}
                  style={{padding:"8px 16px",borderRadius:8,border:"none",background:"#2563eb",color:"#fff",fontWeight:700,fontSize:12,cursor:"pointer"}}>
                  Pilih Operator & Mulai ({visibleRows.length} komponen)
                </button>
                {(()=>{
                  const adaTimerJalan=visibleRows.some((r:any)=>{
                    const idsKomp=(r.task.pekerja_per_komponen||{})[r.kode]||[];
                    return idsKomp.some((pid:number)=>!!timerAktif[`${r.panelId}_${r.kode}_${proses}_${pid}`]);
                  });
                  if(!adaTimerJalan)return null;
                  return(
                    <button onClick={()=>bulkStopDesktop(proses,visibleRows)}
                      style={{marginLeft:8,padding:"8px 16px",borderRadius:8,border:"none",background:"#dc2626",color:"#fff",fontWeight:700,fontSize:12,cursor:"pointer"}}>
                      ⏹ Selesai Semua
                    </button>
                  );
                })()}'''
    count2 = content.count(old_btn)
    if count2 == 0:
        fail("Tidak ketemu tombol 'Pilih Operator & Mulai' persis seperti yang diharapkan. Struktur mungkin sudah berubah - kirim ulang dump terbaru.")
    if count2 > 1:
        fail(f"Tombol itu muncul {count2} kali (harusnya cuma 1) - perlu dicek manual dulu.")
    content = content.replace(old_btn, new_btn)

    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = FILE_PATH + f".bak_{ts}"
    shutil.copy2(FILE_PATH, backup_path)
    print(f"✅ Backup dibuat: {backup_path}")

    with open(FILE_PATH, "w", encoding="utf-8") as f:
        f.write(content)

    print("✅ Berhasil ditambahkan: tombol 'Selesai Semua' (muncul kalau ada timer yang lagi jalan)")
    print("   di sebelah 'Pilih Operator & Mulai' - stop semua timer sekali klik.")
    print("\nLangkah selanjutnya:")
    print("   npm run build")

if __name__ == "__main__":
    main()
