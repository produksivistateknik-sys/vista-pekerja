import shutil
import sys

PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

OLD_1 = '''  const fetchWoList=async()=>{
    const{data}=await supabase.from("work_orders").select("id,wo,proyek").eq("is_archived",false).order("created_at",{ascending:false});
    setWoList(data??[]);
  };'''

NEW_1 = '''  const[panelList,setPanelList]=useState<any[]>([]);
  const[selectedPanelId,setSelectedPanelId]=useState<number|null>(null);

  const fetchWoList=async()=>{
    const{data}=await supabase.from("work_orders").select("id,wo,proyek").eq("is_archived",false).order("created_at",{ascending:false});
    setWoList(data??[]);
  };

  const fetchPanelList=async(woId:number)=>{
    const{data}=await supabase.from("panels").select("id,no_pnl,nama,tipe").eq("wo_id",woId).is("deleted_at",null).order("no_pnl",{ascending:true});
    setPanelList(data??[]);
  };'''

OLD_2 = '''  useEffect(()=>{fetchWoList();},[]);
  useEffect(()=>{if(selectedWoId)fetchRiwayat(selectedWoId);},[selectedWoId]);'''

NEW_2 = '''  useEffect(()=>{fetchWoList();},[]);
  useEffect(()=>{
    setSelectedPanelId(null);
    if(selectedWoId){fetchPanelList(selectedWoId);fetchRiwayat(selectedWoId);}
  },[selectedWoId]);'''

OLD_3 = '''    if(!selectedWoId){alert("Pilih Work Order dulu");return;}
    if(files.length===0&&!catatan.trim()){alert("Lampirkan foto atau tulis catatan minimal salah satu");return;}
    setUploading(true);
    const{data:tr,error:trErr}=await supabase.from("fcs_tracking_komponen").insert({
      wo_id:selectedWoId,
      sub_bagian:subBagian,
      operator_name:namaOperator,
      catatan:catatan.trim()||null,
    }).select().single();'''

NEW_3 = '''    if(!selectedWoId){alert("Pilih Work Order dulu");return;}
    if(!selectedPanelId){alert("Pilih Panel dulu");return;}
    if(files.length===0&&!catatan.trim()){alert("Lampirkan foto atau tulis catatan minimal salah satu");return;}
    setUploading(true);
    const{data:tr,error:trErr}=await supabase.from("fcs_tracking_komponen").insert({
      wo_id:selectedWoId,
      panel_id:selectedPanelId,
      sub_bagian:subBagian,
      operator_name:namaOperator,
      catatan:catatan.trim()||null,
    }).select().single();'''

OLD_4 = '''      <div style={{marginBottom:14}}>
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

NEW_4 = '''      <div style={{marginBottom:14}}>
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

EDITS = [
    ("EDIT 1 (state & fetch panel list)", OLD_1, NEW_1),
    ("EDIT 2 (reset & fetch saat WO berubah)", OLD_2, NEW_2),
    ("EDIT 3 (sertakan panel_id saat submit)", OLD_3, NEW_3),
    ("EDIT 4 (dropdown Pilih Panel di JSX)", OLD_4, NEW_4),
]

def main():
    shutil.copy(PATH, PATH + ".bak_panelselect")
    print(f"[OK] Backup dibuat: {PATH}.bak_panelselect")

    with open(PATH, "r", encoding="utf-8") as f:
        content = f.read()

    failed = []
    for name, old, new in EDITS:
        count = content.count(old)
        if count != 1:
            failed.append((name, count))

    if failed:
        print("[FAIL] Ada pattern yang tidak ditemukan tepat 1 kali. Tidak ada perubahan disimpan.")
        for name, count in failed:
            print(f"  - {name}: ditemukan {count} kali")
        sys.exit(1)

    for name, old, new in EDITS:
        content = content.replace(old, new)
        print(f"[OK] {name} berhasil diterapkan")

    with open(PATH, "w", encoding="utf-8") as f:
        f.write(content)

    print("")
    print("[OK] SEMUA EDIT BERHASIL DITERAPKAN")
    print("Ringkasan:")
    print("  - Setelah pilih WO, muncul dropdown Pilih Panel (filter no_pnl, nama, tipe)")
    print("  - Form catatan/foto/kirim cuma muncul setelah WO dan Panel keduanya dipilih")
    print("  - panel_id disertakan saat submit tracking")
    print("Selanjutnya jalankan: npm run build")

if __name__ == "__main__":
    main()
