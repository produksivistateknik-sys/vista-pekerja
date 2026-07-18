# -*- coding: utf-8 -*-
"""
Script: apply_disable_komponen_terpilih.py
Tujuan: Di popup "Pilih Komponen", komponen yang SUDAH dikonfirmasi terpilih
        sebelumnya (sudah muncul di kartu bawah) checkbox-nya jadi disabled -
        gak bisa di-uncheck gak sengaja (biar gak ilang dari kartu progress
        yang lagi jalan).

Cara pakai:
    python apply_disable_komponen_terpilih.py
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

    if "alreadyConfirmed" in content:
        fail("Perubahan sepertinya sudah pernah diterapkan (sudah ada 'alreadyConfirmed').")

    old = '''                    <div style={{overflowY:"auto",padding:"8px 16px",flex:1}}>
                      {panelRows.map((r:any)=>{
                        const checked=tempSelectedKomponen.includes(r.kode);
                        return(
                          <label key={r.kode} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 4px",borderBottom:"1px solid #f8fafc",cursor:"pointer"}}>
                            <input type="checkbox" checked={checked}
                              onChange={()=>{
                                setTempSelectedKomponen((prev:string[])=>checked?prev.filter(k=>k!==r.kode):[...prev,r.kode]);
                              }}
                              style={{width:16,height:16}}/>
                            <div style={{display:"flex",flexDirection:"column",gap:2,flex:1}}>
                              <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                                <span style={{fontSize:13,fontWeight:600,color:"#374151"}}>{r.item.nama}</span>
                                {r.wiringBadge&&(
                                  <span style={{fontSize:9,fontWeight:700,background:"#eef2ff",color:"#4f46e5",borderRadius:6,padding:"1px 6px"}}>
                                    ⚡ {(r.wiringBadge.bobot||"").replace("_"," ")} · {r.wiringBadge.jumlahOrang||"–"}org
                                  </span>
                                )}
                              </div>
                              <span style={{fontSize:10,color:"#94a3b8",fontFamily:"'DM Mono',monospace"}}>{r.kode}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>'''

    new = '''                    <div style={{overflowY:"auto",padding:"8px 16px",flex:1}}>
                      {panelRows.map((r:any)=>{
                        const checked=tempSelectedKomponen.includes(r.kode);
                        const panelKeyPopup=`${proses}_${komponenPopup.panelId}`;
                        const alreadyConfirmed=(selectedKomponen[panelKeyPopup]||[]).includes(r.kode);
                        return(
                          <label key={r.kode} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 4px",borderBottom:"1px solid #f8fafc",
                            cursor:alreadyConfirmed?"not-allowed":"pointer",opacity:alreadyConfirmed?0.55:1}}>
                            <input type="checkbox" checked={checked} disabled={alreadyConfirmed}
                              onChange={()=>{
                                if(alreadyConfirmed)return;
                                setTempSelectedKomponen((prev:string[])=>checked?prev.filter(k=>k!==r.kode):[...prev,r.kode]);
                              }}
                              style={{width:16,height:16}}/>
                            <div style={{display:"flex",flexDirection:"column",gap:2,flex:1}}>
                              <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                                <span style={{fontSize:13,fontWeight:600,color:"#374151"}}>{r.item.nama}</span>
                                {r.wiringBadge&&(
                                  <span style={{fontSize:9,fontWeight:700,background:"#eef2ff",color:"#4f46e5",borderRadius:6,padding:"1px 6px"}}>
                                    ⚡ {(r.wiringBadge.bobot||"").replace("_"," ")} · {r.wiringBadge.jumlahOrang||"–"}org
                                  </span>
                                )}
                                {alreadyConfirmed&&(
                                  <span style={{fontSize:9,fontWeight:700,background:"#f1f5f9",color:"#94a3b8",borderRadius:6,padding:"1px 6px"}}>
                                    sudah dipilih
                                  </span>
                                )}
                              </div>
                              <span style={{fontSize:10,color:"#94a3b8",fontFamily:"'DM Mono',monospace"}}>{r.kode}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>'''

    count = content.count(old)
    if count == 0:
        fail("Tidak ketemu blok popup checkbox persis seperti yang diharapkan. Struktur mungkin sudah berubah - kirim ulang dump terbaru.")
    if count > 1:
        fail(f"Blok itu muncul {count} kali (harusnya cuma 1) - perlu dicek manual dulu.")

    new_content = content.replace(old, new)

    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = FILE_PATH + f".bak_{ts}"
    shutil.copy2(FILE_PATH, backup_path)
    print(f"✅ Backup dibuat: {backup_path}")

    with open(FILE_PATH, "w", encoding="utf-8") as f:
        f.write(new_content)

    print("✅ Berhasil diubah: checkbox komponen yang sudah dikonfirmasi terpilih sekarang disabled")
    print("   di popup Pilih Komponen (gak bisa di-uncheck gak sengaja).")
    print("\nLangkah selanjutnya:")
    print("   npm run build")

if __name__ == "__main__":
    main()
