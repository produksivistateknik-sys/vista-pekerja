# -*- coding: utf-8 -*-
"""
Script: apply_bulk_operator_mulai_desktop.py
Tujuan: Tahap 2 - tambah SATU tombol "Pilih Operator & Mulai" di atas tabel
        desktop, khusus buat POTONG/RENDAM/PAINTING (proses yang di Tahap 1
        udah punya alur "kumpul dulu"). Klik tombol ini -> pilih operator ->
        assign SEKALIGUS start timer buat SEMUA baris yang udah terkumpul.

PRASYARAT: apply_kumpul_dulu_desktop.py sudah pernah dijalankan.

Cara pakai:
    python apply_bulk_operator_mulai_desktop.py
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
            lines = f.readlines()
    except FileNotFoundError:
        fail(f"File tidak ditemukan di {FILE_PATH}")

    joined = "".join(lines)
    if "PROSES_KUMPUL_DULU_DESKTOP" not in joined:
        fail("PROSES_KUMPUL_DULU_DESKTOP belum ada - jalankan apply_kumpul_dulu_desktop.py dulu.")
    if "bulkAssignAndStartDesktop" in joined:
        fail("Perubahan sepertinya sudah pernah diterapkan.")

    anchor1 = "    const bulkAssignAndStart=async(_proses:string,rowsToAssign:any[],pekerjaIds:number[])=>{\n"
    idx1 = None
    for i, l in enumerate(lines):
        if l == anchor1:
            idx1 = i
            break
    if idx1 is None:
        fail("Tidak ketemu 'const bulkAssignAndStart=async(...)'. Struktur mungkin sudah berubah - kirim ulang dump terbaru.")

    close_idx = None
    for i in range(idx1 + 1, len(lines)):
        if lines[i].strip() == "};":
            close_idx = i
            break
    if close_idx is None:
        fail("Tidak ketemu penutup fungsi bulkAssignAndStart.")

    new_fn = (
        "\n"
        "    const bulkAssignAndStartDesktop=async(proses:string,rowsToAssign:any[],pekerjaIds:number[])=>{\n"
        "      // Khusus desktop: assign operator SEKALIGUS start timer buat semua baris terkumpul.\n"
        "      for(const r of rowsToAssign){\n"
        "        await updatePekerjaPerKomponen(r.task.id,r.kode,pekerjaIds);\n"
        "      }\n"
        "      for(const r of rowsToAssign){\n"
        "        for(const pid of pekerjaIds){\n"
        "          await startTimer(pid,r.panelId,r.kode,proses,viewDate);\n"
        "        }\n"
        "      }\n"
        "    };\n"
    )
    lines.insert(close_idx + 1, new_fn)

    content = "".join(lines)

    old_marker = "            {viewMode==='mobile'?("
    if content.count(old_marker) != 1:
        fail(f"Baris '{{viewMode==='mobile'?(' muncul {content.count(old_marker)} kali (harusnya 1) - perlu dicek manual.")

    bulk_ui = '''            {viewMode==='desktop'&&PROSES_KUMPUL_DULU_DESKTOP.includes(proses)&&visibleRows.length>0&&(
              <div style={{padding:"10px 16px",background:"#f8fafc",borderBottom:"1px solid #f1f5f9"}}>
                <button onClick={()=>{setBulkAssignProses(proses);setTempBulkPekerjaIds([]);}}
                  style={{padding:"8px 16px",borderRadius:8,border:"none",background:"#2563eb",color:"#fff",fontWeight:700,fontSize:12,cursor:"pointer"}}>
                  Pilih Operator & Mulai ({visibleRows.length} komponen)
                </button>
                {bulkAssignProses===proses&&viewMode==='desktop'&&(
                  <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
                    onClick={()=>setBulkAssignProses(null)}>
                    <div style={{background:"#fff",borderRadius:14,padding:20,width:"100%",maxWidth:380,maxHeight:"80vh",overflowY:"auto"}}
                      onClick={(e:any)=>e.stopPropagation()}>
                      <div style={{fontWeight:800,fontSize:14,color:"#1e293b",marginBottom:4}}>Pilih Operator</div>
                      <div style={{fontSize:11,color:"#94a3b8",marginBottom:14}}>Operator akan di-assign & timer langsung mulai untuk {visibleRows.length} komponen terkumpul di {proses}.</div>
                      <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:16}}>
                        {pekerjaList.filter((p:any)=>p.divisi===user.divisi).map((p:any)=>{
                          const checked=tempBulkPekerjaIds.includes(p.id);
                          return(
                            <label key={p.id} style={{display:"flex",alignItems:"center",gap:10,border:`1.5px solid ${checked?"#2563eb":"#e2e8f0"}`,borderRadius:10,padding:"10px 12px",cursor:"pointer",background:checked?"#eff6ff":"#fff"}}>
                              <input type="checkbox" checked={checked}
                                onChange={()=>setTempBulkPekerjaIds((prev:number[])=>checked?prev.filter((id:number)=>id!==p.id):[...prev,p.id])}/>
                              <span style={{fontSize:13,fontWeight:600,color:"#1e293b"}}>{p.nama}</span>
                            </label>
                          );
                        })}
                      </div>
                      <div style={{display:"flex",gap:8}}>
                        <button onClick={()=>setBulkAssignProses(null)}
                          style={{flex:1,padding:"10px",borderRadius:10,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#64748b",fontWeight:700,fontSize:13,cursor:"pointer"}}>Batal</button>
                        <button disabled={tempBulkPekerjaIds.length===0}
                          onClick={async()=>{
                            await bulkAssignAndStartDesktop(proses,visibleRows,tempBulkPekerjaIds);
                            setBulkAssignProses(null);
                          }}
                          style={{flex:1,padding:"10px",borderRadius:10,border:"none",
                            background:tempBulkPekerjaIds.length===0?"#94a3b8":"#16a34a",color:"#fff",fontWeight:700,fontSize:13,
                            cursor:tempBulkPekerjaIds.length===0?"not-allowed":"pointer"}}>
                          Mulai ({tempBulkPekerjaIds.length})
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            {viewMode==='mobile'?('''

    content = content.replace(old_marker, bulk_ui)

    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = FILE_PATH + f".bak_{ts}"
    shutil.copy2(FILE_PATH, backup_path)
    print(f"✅ Backup dibuat: {backup_path}")

    with open(FILE_PATH, "w", encoding="utf-8") as f:
        f.write(content)

    print("✅ Berhasil ditambahkan:")
    print("   1. Fungsi bulkAssignAndStartDesktop (assign + start timer sekaligus)")
    print("   2. Tombol 'Pilih Operator & Mulai' di atas tabel desktop untuk POTONG/RENDAM/PAINTING")
    print("\nLangkah selanjutnya:")
    print("   npm run build")
    print("Kalau ada TypeScript error, PASTE error-nya lengkap ke chat, jangan di-fix manual dulu.")

if __name__ == "__main__":
    main()
