# -*- coding: utf-8 -*-
"""
Script: apply_panel_proyek_kartu.py
Tujuan: Tambah baris kecil "Proyek · Nama Panel" di kartu mobile aktif (yang ada
        step %/qty progress), persis di bawah nama komponen, biar operator tau
        komponen ini punya panel & proyek apa.

Cara pakai:
    python apply_panel_proyek_kartu.py
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

    old = (
        '                                <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>\n'
        '                                  {r.wpDef&&<span style={{background:r.wpDef.color+"18",color:r.wpDef.color,border:`1px solid ${r.wpDef.color}33`,borderRadius:4,padding:"1px 6px",fontSize:10,fontWeight:700}}>{r.wpDef.wp}</span>}\n'
        '                                  <span style={{fontWeight:700,fontSize:13,color:"#374151"}}>{r.item.nama}</span>\n'
        '                                </div>\n'
        '                                <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>\n'
        '                                  <span style={{fontSize:10,color:"#94a3b8",fontFamily:"\'DM Mono\',monospace"}}>{r.kode}</span>\n'
        '                                  <Badge label={r.task.prioritas||"Sedang"} color={r.priColor}/>\n'
    )
    new = (
        '                                <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>\n'
        '                                  {r.wpDef&&<span style={{background:r.wpDef.color+"18",color:r.wpDef.color,border:`1px solid ${r.wpDef.color}33`,borderRadius:4,padding:"1px 6px",fontSize:10,fontWeight:700}}>{r.wpDef.wp}</span>}\n'
        '                                  <span style={{fontWeight:700,fontSize:13,color:"#374151"}}>{r.item.nama}</span>\n'
        '                                </div>\n'
        '                                <div style={{fontSize:10,color:"#94a3b8"}}>{r.task.proyek} · {r.panel.nama}</div>\n'
        '                                <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>\n'
        '                                  <span style={{fontSize:10,color:"#94a3b8",fontFamily:"\'DM Mono\',monospace"}}>{r.kode}</span>\n'
        '                                  <Badge label={r.task.prioritas||"Sedang"} color={r.priColor}/>\n'
    )

    count = content.count(old)
    if count == 0:
        fail("Tidak ketemu blok header kartu aktif persis seperti yang diharapkan. Struktur mungkin sudah berubah — kirim ulang dump terbaru.")
    if count > 1:
        fail(f"Blok itu muncul {count} kali (harusnya cuma 1) — perlu dicek manual dulu.")

    new_content = content.replace(old, new)

    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = FILE_PATH + f".bak_{ts}"
    shutil.copy2(FILE_PATH, backup_path)
    print(f"✅ Backup dibuat: {backup_path}")

    with open(FILE_PATH, "w", encoding="utf-8") as f:
        f.write(new_content)

    print("✅ Berhasil ditambahkan baris 'Proyek · Nama Panel' di kartu mobile aktif.")
    print("\nLangkah selanjutnya:")
    print("   npm run build")

if __name__ == "__main__":
    main()
