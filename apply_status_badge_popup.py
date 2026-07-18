# -*- coding: utf-8 -*-
"""
Script: apply_status_badge_popup.py
Tujuan: Di popup "Pilih Komponen", tiap baris komponen dikasih badge status
        sendiri (Belum / Dikerjakan Xpcs / Selesai) - bukan cuma label
        generik "sudah dipilih". Jadi operator langsung tau status TIAP
        komponen tanpa harus nebak dari ringkasan gabungan di kartu luar.

PRASYARAT: apply_disable_komponen_terpilih.py sudah pernah dijalankan.

Cara pakai:
    python apply_status_badge_popup.py
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

    if "alreadyConfirmed" not in content:
        fail("Tidak ketemu 'alreadyConfirmed' - jalankan apply_disable_komponen_terpilih.py dulu.")
    if "statusBadgeLabel" in content:
        fail("Perubahan sepertinya sudah pernah diterapkan (sudah ada 'statusBadgeLabel').")

    old = '''                                {alreadyConfirmed&&(
                                  <span style={{fontSize:9,fontWeight:700,background:"#f1f5f9",color:"#94a3b8",borderRadius:6,padding:"1px 6px"}}>
                                    sudah dipilih
                                  </span>
                                )}'''

    new = '''                                {alreadyConfirmed&&(()=>{
                                  const pct=r.pct||0;
                                  const statusBadgeLabel=pct>=100?"Selesai":pct>0?`Dikerjakan${r.qtyProses?` ${r.qtyProses}pcs`:""}`:"Belum";
                                  const statusBadgeColor=pct>=100?"#16a34a":pct>0?"#2563eb":"#94a3b8";
                                  const statusBadgeBg=pct>=100?"#dcfce7":pct>0?"#dbeafe":"#f1f5f9";
                                  return(
                                    <span style={{fontSize:9,fontWeight:700,background:statusBadgeBg,color:statusBadgeColor,borderRadius:6,padding:"1px 6px"}}>
                                      {statusBadgeLabel}
                                    </span>
                                  );
                                })()}'''

    count = content.count(old)
    if count == 0:
        fail("Tidak ketemu blok badge 'sudah dipilih' persis seperti yang diharapkan. Struktur mungkin sudah berubah - kirim ulang dump terbaru.")
    if count > 1:
        fail(f"Blok itu muncul {count} kali (harusnya cuma 1) - perlu dicek manual dulu.")

    new_content = content.replace(old, new)

    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = FILE_PATH + f".bak_{ts}"
    shutil.copy2(FILE_PATH, backup_path)
    print(f"✅ Backup dibuat: {backup_path}")

    with open(FILE_PATH, "w", encoding="utf-8") as f:
        f.write(new_content)

    print("✅ Berhasil diubah: badge 'sudah dipilih' di popup sekarang jadi status detail")
    print("   (Belum / Dikerjakan Xpcs / Selesai) per komponen.")
    print("\nLangkah selanjutnya:")
    print("   npm run build")

if __name__ == "__main__":
    main()
