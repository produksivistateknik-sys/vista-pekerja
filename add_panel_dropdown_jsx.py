import shutil
import sys

PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

OLD = '''      <div style={{marginBottom:14}}>
        <Lbl>Work Order</Lbl>
        <select value={selectedWoId??""} onChange={(e:any)=>setSelectedWoId(e.target.value?Number(e.target.value):null)}
          style={{width:"100%",padding:"12px 14px",borderRadius:12,border:"1.5px solid #e2e8f0",fontSize:14,background:"#fff"}}>
          <option value="">Pilih Work Order...</option>
          {woList.map((w:any)=>(
            <option key={w.id} value={w.id}>{w.wo} — {w.proyek}</option>
          ))}
        </select>
      </div>

      {selectedWoId&&(
        <>'''

NEW = '''      <div style={{marginBottom:14}}>
        <Lbl>Work Order</Lbl>
        <select value={selectedWoId??""} onChange={(e:any)=>setSelectedWoId(e.target.value?Number(e.target.value):null)}
          style={{width:"100%",padding:"12px 14px",borderRadius:12,border:"1.5px solid #e2e8f0",fontSize:14,background:"#fff"}}>
          <option value="">Pilih Work Order...</option>
          {woList.map((w:any)=>(
            <option key={w.id} value={w.id}>{w.wo} — {w.proyek}</option>
          ))}
        </select>
      </div>

      {selectedWoId&&(
        <div style={{marginBottom:14}}>
          <Lbl>Panel</Lbl>
          <select value={selectedPanelId??""} onChange={(e:any)=>setSelectedPanelId(e.target.value?Number(e.target.value):null)}
            style={{width:"100%",padding:"12px 14px",borderRadius:12,border:"1.5px solid #e2e8f0",fontSize:14,background:"#fff"}}>
            <option value="">Pilih Panel...</option>
            {panelList.map((p:any)=>(
              <option key={p.id} value={p.id}>#{p.no_pnl} {p.nama} ({p.tipe})</option>
            ))}
          </select>
          {panelList.length===0&&(
            <div style={{fontSize:12,color:"#94a3b8",marginTop:6}}>Belum ada panel untuk WO ini</div>
          )}
        </div>
      )}

      {selectedWoId&&selectedPanelId&&(
        <>'''

def main():
    shutil.copy(PATH, PATH + ".bak_panelselect4")
    print(f"[OK] Backup dibuat: {PATH}.bak_panelselect4")

    with open(PATH, "r", encoding="utf-8") as f:
        content = f.read()

    count = content.count(OLD)
    if count != 1:
        print(f"[FAIL] Pattern OLD ditemukan {count} kali (harus tepat 1). Tidak ada perubahan disimpan.")
        sys.exit(1)

    content = content.replace(OLD, NEW)

    with open(PATH, "w", encoding="utf-8") as f:
        f.write(content)

    print("[OK] Dropdown Pilih Panel berhasil ditambahkan di JSX")
    print("Form catatan/foto/kirim sekarang cuma muncul setelah WO dan Panel keduanya dipilih")
    print("Selanjutnya jalankan: npm run build")

if __name__ == "__main__":
    main()
