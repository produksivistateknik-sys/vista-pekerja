import shutil
import sys

PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

OLD_A = '''  const fetchWoList=async()=>{
    const{data}=await supabase.from("work_orders").select("id,wo,proyek").eq("is_archived",false).order("created_at",{ascending:false});
    setWoList(data??[]);
  };'''

NEW_A = '''  const[panelList,setPanelList]=useState<any[]>([]);
  const[selectedPanelId,setSelectedPanelId]=useState<number|null>(null);

  const fetchWoList=async()=>{
    const{data}=await supabase.from("work_orders").select("id,wo,proyek").eq("is_archived",false).order("created_at",{ascending:false});
    setWoList(data??[]);
  };

  const fetchPanelList=async(woId:number)=>{
    const{data}=await supabase.from("panels").select("id,no_pnl,nama,tipe").eq("wo_id",woId).is("deleted_at",null).order("no_pnl",{ascending:true});
    setPanelList(data??[]);
  };'''

OLD_B = '''    if(!selectedWoId){alert("Pilih Work Order dulu");return;}
    if(files.length===0&&!catatan.trim()){alert("Lampirkan foto atau tulis catatan minimal salah satu");return;}
    setUploading(true);
    const{data:tr,error:trErr}=await supabase.from("fcs_tracking_komponen").insert({
      wo_id:selectedWoId,
      sub_bagian:subBagian,
      operator_name:namaOperator,
      catatan:catatan.trim()||null,
    }).select().single();'''

NEW_B = '''    if(!selectedWoId){alert("Pilih Work Order dulu");return;}
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

EDITS = [
    ("EDIT A (state & fetchPanelList)", OLD_A, NEW_A),
    ("EDIT B (panel_id di submit)", OLD_B, NEW_B),
]

def main():
    shutil.copy(PATH, PATH + ".bak_panelselect3")
    print(f"[OK] Backup dibuat: {PATH}.bak_panelselect3")

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
    print("[OK] Bagian state, fetchPanelList, dan panel_id di submit berhasil ditambahkan")
    print("CATATAN: dropdown Pilih Panel di JSX BELUM ditambahkan - akan ada script lanjutan setelah ini")
    print("JANGAN build dulu, masih akan error karena dropdown belum ada (tidak masalah, tunggu script selanjutnya)")

if __name__ == "__main__":
    main()
