file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_lock_progress_np", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

results = {}

# Fix 1: Ubah updateProgress jadi lokal saja (tidak langsung simpan ke Supabase)
OLD1 = '''  const updateProgress=async(panelId:number,field:"nameplate_progress"|"yellowmark_progress",val:number)=>{
    const updateByField=field==="nameplate_progress"?"nameplate_updated_by":"yellowmark_updated_by";
    const updateAtField=field==="nameplate_progress"?"nameplate_updated_at":"yellowmark_updated_at";
    await supabase.from("panels").update({
      [field]:val,[updateByField]:user.nama,[updateAtField]:new Date().toISOString()
    }).eq("id",panelId);
    setPanelsList(prev=>prev.map((p:any)=>p.id===panelId?{...p,[field]:val,[updateByField]:user.nama}:p));
  };'''

NEW1 = '''  const[locked,setLocked]=useState<Record<string,boolean>>({});
  const[lockLoading,setLockLoading]=useState(false);

  const updateProgress=(panelId:number,field:"nameplate_progress"|"yellowmark_progress",val:number)=>{
    setPanelsList(prev=>prev.map((p:any)=>p.id===panelId?{...p,[field]:val}:p));
  };

  const kunciProgress=async(panelList:any[])=>{
    setLockLoading(true);
    let count=0;
    for(const p of panelList){
      const npHist=p.nameplate_history||[];
      const ymHist=p.yellowmark_history||[];
      const npExistIdx=npHist.findIndex((h:any)=>h.tanggal===TODAY);
      const ymExistIdx=ymHist.findIndex((h:any)=>h.tanggal===TODAY);
      const npChanged=npExistIdx<0||npHist[npExistIdx].pct!==(p.nameplate_progress||0);
      const ymChanged=ymExistIdx<0||ymHist[ymExistIdx].pct!==(p.yellowmark_progress||0);
      if(!npChanged&&!ymChanged)continue;
      const newNpHist=[...npHist];
      if(npExistIdx>=0)newNpHist[npExistIdx]={...newNpHist[npExistIdx],pct:p.nameplate_progress||0,ts:new Date().toISOString()};
      else newNpHist.push({tanggal:TODAY,pct:p.nameplate_progress||0,oleh:user.nama,ts:new Date().toISOString()});
      const newYmHist=[...ymHist];
      if(ymExistIdx>=0)newYmHist[ymExistIdx]={...newYmHist[ymExistIdx],pct:p.yellowmark_progress||0,ts:new Date().toISOString()};
      else newYmHist.push({tanggal:TODAY,pct:p.yellowmark_progress||0,oleh:user.nama,ts:new Date().toISOString()});
      await supabase.from("panels").update({
        nameplate_progress:p.nameplate_progress||0,nameplate_updated_by:user.nama,nameplate_updated_at:new Date().toISOString(),nameplate_history:newNpHist,
        yellowmark_progress:p.yellowmark_progress||0,yellowmark_updated_by:user.nama,yellowmark_updated_at:new Date().toISOString(),yellowmark_history:newYmHist,
      }).eq("id",p.id);
      count++;
    }
    setLockLoading(false);
    setLocked(prev=>({...prev,[TODAY]:true}));
    alert(count>0?`${count} panel berhasil dikunci`:"Tidak ada perubahan untuk dikunci");
    fetchData();
  };'''

results['UPDATE_FUNCTION'] = content.count(OLD1)

for k, v in results.items():
    print(f"  {k}: {v} occurrence(s)")

if all(v==1 for v in results.values()):
    content = content.replace(OLD1, NEW1, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] updateProgress sekarang lokal, tambah fungsi kunciProgress dengan histori")
    print("[INFO] Lanjut tambah tombol Kunci Progress di render level 2")
else:
    print("[FAIL] Ada occurrence tidak sesuai (harus semua 1), TIDAK menyimpan apapun")
