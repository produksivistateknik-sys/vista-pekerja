# -*- coding: utf-8 -*-
"""
Script: apply_tombol_mulai_per_komponen.py
Tujuan: Ganti tombol Mulai/Selesai yang tadinya per-OPERATOR (tiap nama ada
        tombolnya sendiri) jadi SATU tombol per KOMPONEN yang start/stop
        timer semua operator yang ke-assign di situ sekaligus.

PRASYARAT: apply_satu_tombol_operator.py sudah pernah dijalankan sebelumnya.

Cara pakai:
    python apply_tombol_mulai_per_komponen.py
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

    if "anyTimerRunning" in content:
        fail("Perubahan sepertinya sudah pernah diterapkan (sudah ada 'anyTimerRunning').")

    old = '''                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      {workers.length===0&&(
                        <div style={{fontSize:11,color:"#94a3b8",fontStyle:"italic",padding:"6px 0"}}>Belum ada operator - klik "Pilih Operator" di atas.</div>
                      )}
                      {workers.map((w:any)=>{
                        const key=`${r.panelId}_${r.kode}_${proses}_${w.id}`;
                        const timer=timerAktif[key];
                        const loading=timerLoading===key;
                        let durasiLabel="";
                        if(timer){
                          const menitBerjalan=(Date.now()-new Date(timer.mulai).getTime())/60000;
                          const totalMenit=(timerDurasiSelesai[key]||0)+menitBerjalan;
                          const jam=Math.floor(totalMenit/60);
                          const menit=Math.round(totalMenit%60);
                          durasiLabel=jam>0?`${jam}j ${menit}m`:`${menit}m`;
                        }
                        return(
                          <div key={w.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,
                            background:DIVISI_CONFIG[w.divisi]?.bg||"#f1f5f9",borderRadius:20,padding:"4px 8px 4px 12px"}}>
                            <span style={{fontSize:12,fontWeight:700,color:DIVISI_CONFIG[w.divisi]?.color||"#64748b"}}>
                              {DIVISI_CONFIG[w.divisi]?.icon} {w.nama}
                            </span>
                            <button disabled={loading}
                              onClick={()=>timer?stopTimer(w.id,r.panelId,r.kode,proses):startTimer(w.id,r.panelId,r.kode,proses,viewDate)}
                              style={{fontSize:11,fontWeight:700,border:"none",borderRadius:10,padding:"5px 10px",cursor:loading?"not-allowed":"pointer",
                                background:timer?"#fef2f2":"#f0fdf4",color:timer?"#dc2626":"#16a34a"}}>
                              {loading?"...":timer?`⏹ ${durasiLabel}`:"▶ Mulai"}
                            </button>
                          </div>
                        );
                      })}
                      <button disabled={cellLocked||r.pct===0} onClick={()=>lockSingleKomponen(r.panelId,r.kode,proses)}'''

    new = '''                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      {workers.length===0&&(
                        <div style={{fontSize:11,color:"#94a3b8",fontStyle:"italic",padding:"6px 0"}}>Belum ada operator - klik "Pilih Operator" di atas.</div>
                      )}
                      {workers.length>0&&(()=>{
                        const timerKeys=workers.map((w:any)=>`${r.panelId}_${r.kode}_${proses}_${w.id}`);
                        const anyTimerRunning=timerKeys.some((k:string)=>!!timerAktif[k]);
                        const anyLoading=timerKeys.some((k:string)=>timerLoading===k);
                        let durasiLabel="";
                        const runningKey=timerKeys.find((k:string)=>timerAktif[k]);
                        if(runningKey){
                          const timer=timerAktif[runningKey];
                          const menitBerjalan=(Date.now()-new Date(timer.mulai).getTime())/60000;
                          const totalMenit=(timerDurasiSelesai[runningKey]||0)+menitBerjalan;
                          const jam=Math.floor(totalMenit/60);
                          const menit=Math.round(totalMenit%60);
                          durasiLabel=jam>0?`${jam}j ${menit}m`:`${menit}m`;
                        }
                        return(
                          <div style={{display:"flex",flexDirection:"column",gap:6}}>
                            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                              {workers.map((w:any)=>(
                                <span key={w.id} style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:11,fontWeight:700,
                                  color:DIVISI_CONFIG[w.divisi]?.color||"#64748b",background:DIVISI_CONFIG[w.divisi]?.bg||"#f1f5f9",
                                  borderRadius:20,padding:"4px 10px"}}>
                                  {DIVISI_CONFIG[w.divisi]?.icon} {w.nama}
                                </span>
                              ))}
                            </div>
                            <button disabled={anyLoading}
                              onClick={()=>{
                                if(anyTimerRunning){
                                  workers.forEach((w:any)=>{
                                    const k=`${r.panelId}_${r.kode}_${proses}_${w.id}`;
                                    if(timerAktif[k])stopTimer(w.id,r.panelId,r.kode,proses);
                                  });
                                } else {
                                  workers.forEach((w:any)=>startTimer(w.id,r.panelId,r.kode,proses,viewDate));
                                }
                              }}
                              style={{fontSize:12,fontWeight:700,border:"none",borderRadius:10,padding:"8px 10px",cursor:anyLoading?"not-allowed":"pointer",
                                background:anyTimerRunning?"#fef2f2":"#f0fdf4",color:anyTimerRunning?"#dc2626":"#16a34a"}}>
                              {anyLoading?"...":anyTimerRunning?`⏹ Selesai ${durasiLabel}`:"▶ Mulai"}
                            </button>
                          </div>
                        );
                      })()}
                      <button disabled={cellLocked||r.pct===0} onClick={()=>lockSingleKomponen(r.panelId,r.kode,proses)}'''

    count = content.count(old)
    if count == 0:
        fail("Tidak ketemu blok timer per-operator persis seperti yang diharapkan. Struktur mungkin sudah berubah - kirim ulang dump terbaru.")
    if count > 1:
        fail(f"Blok itu muncul {count} kali (harusnya cuma 1) - perlu dicek manual dulu.")

    new_content = content.replace(old, new)

    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = FILE_PATH + f".bak_{ts}"
    shutil.copy2(FILE_PATH, backup_path)
    print(f"✅ Backup dibuat: {backup_path}")

    with open(FILE_PATH, "w", encoding="utf-8") as f:
        f.write(new_content)

    print("✅ Berhasil diubah: tombol Mulai/Selesai sekarang SATU per komponen (start/stop semua operator sekaligus).")
    print("\nLangkah selanjutnya:")
    print("   npm run build")

if __name__ == "__main__":
    main()
