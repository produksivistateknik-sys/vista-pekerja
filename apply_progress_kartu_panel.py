# -*- coding: utf-8 -*-
"""
Script: apply_progress_kartu_panel.py
Tujuan: Kartu panel selector (yang di atas, buat pilih komponen per panel)
        sekarang nampilin ringkasan progress komponen yang udah dipilih:
        "X belum . Y dikerjakan (Z pcs) . W selesai" - bukan cuma "N komponen
        dipilih". Kartu tetap bisa diklik seperti biasa buat nambah/kurang
        komponen.

Cara pakai:
    python apply_progress_kartu_panel.py
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

    if "belumDikerjakanCount" in content:
        fail("Perubahan sepertinya sudah pernah diterapkan (sudah ada 'belumDikerjakanCount').")

    old = '''                  return panelList.map((pg:any)=>{
                    const panelKey=`${proses}_${pg.panelId}`;
                    const selCount=(selectedKomponen[panelKey]||[]).length;
                    return(
                      <button key={pg.panelId}
                        onClick={()=>{setKomponenPopup({proses,panelId:pg.panelId});setTempSelectedKomponen(selectedKomponen[panelKey]||[]);}}
                        style={{display:"flex",flexDirection:"column",alignItems:"flex-start",gap:2,
                          padding:"6px 12px",borderRadius:8,border:selCount>0?"1.5px solid #6366f1":"1px solid #e2e8f0",
                          background:selCount>0?"#eef2ff":"#fff",cursor:"pointer",textAlign:"left"}}>
                        <span style={{fontSize:9,color:"#94a3b8"}}>{pg.proyek}</span>
                        <span style={{fontSize:12,fontWeight:700,color:"#1e293b"}}>{pg.panel.nama}</span>
                        <span style={{fontSize:9,color:selCount>0?"#4f46e5":"#94a3b8",fontWeight:600}}>
                          {selCount>0?`${selCount} komponen dipilih`:"+ Pilih Komponen"}
                        </span>
                      </button>
                    );
                  });'''

    new = '''                  return panelList.map((pg:any)=>{
                    const panelKey=`${proses}_${pg.panelId}`;
                    const selKodeList=selectedKomponen[panelKey]||[];
                    const selCount=selKodeList.length;
                    const selRows=rows.filter((r:any)=>r.panelId===pg.panelId&&selKodeList.includes(r.kode));
                    const belumDikerjakanCount=selRows.filter((r:any)=>(r.pct||0)===0).length;
                    const dikerjakanRows=selRows.filter((r:any)=>(r.pct||0)>0&&(r.pct||0)<100);
                    const dikerjakanCount=dikerjakanRows.length;
                    const dikerjakanPcs=dikerjakanRows.reduce((s:number,r:any)=>s+(r.qtyProses||0),0);
                    const selesaiCount=selRows.filter((r:any)=>(r.pct||0)>=100).length;
                    return(
                      <button key={pg.panelId}
                        onClick={()=>{setKomponenPopup({proses,panelId:pg.panelId});setTempSelectedKomponen(selectedKomponen[panelKey]||[]);}}
                        style={{display:"flex",flexDirection:"column",alignItems:"flex-start",gap:2,
                          padding:"6px 12px",borderRadius:8,border:selCount>0?"1.5px solid #6366f1":"1px solid #e2e8f0",
                          background:selCount>0?"#eef2ff":"#fff",cursor:"pointer",textAlign:"left"}}>
                        <span style={{fontSize:9,color:"#94a3b8"}}>{pg.proyek}</span>
                        <span style={{fontSize:12,fontWeight:700,color:"#1e293b"}}>{pg.panel.nama}</span>
                        {selCount>0?(
                          <span style={{fontSize:9,color:"#4f46e5",fontWeight:600,display:"flex",gap:6,flexWrap:"wrap" as const}}>
                            {belumDikerjakanCount>0&&<span>{belumDikerjakanCount} belum</span>}
                            {dikerjakanCount>0&&<span>{dikerjakanCount} dikerjakan{dikerjakanPcs>0?` (${dikerjakanPcs}pcs)`:""}</span>}
                            {selesaiCount>0&&<span style={{color:"#16a34a"}}>{selesaiCount} selesai</span>}
                          </span>
                        ):(
                          <span style={{fontSize:9,color:"#94a3b8",fontWeight:600}}>+ Pilih Komponen</span>
                        )}
                      </button>
                    );
                  });'''

    count = content.count(old)
    if count == 0:
        fail("Tidak ketemu blok panel selector persis seperti yang diharapkan. Struktur mungkin sudah berubah - kirim ulang dump terbaru.")
    if count > 1:
        fail(f"Blok itu muncul {count} kali (harusnya cuma 1) - perlu dicek manual dulu.")

    new_content = content.replace(old, new)

    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = FILE_PATH + f".bak_{ts}"
    shutil.copy2(FILE_PATH, backup_path)
    print(f"✅ Backup dibuat: {backup_path}")

    with open(FILE_PATH, "w", encoding="utf-8") as f:
        f.write(new_content)

    print("✅ Berhasil diubah: kartu panel selector sekarang nampilin ringkasan progress")
    print("   (X belum . Y dikerjakan (Z pcs) . W selesai) bukan cuma jumlah komponen dipilih.")
    print("\nLangkah selanjutnya:")
    print("   npm run build")

if __name__ == "__main__":
    main()
