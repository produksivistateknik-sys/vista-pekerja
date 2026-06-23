file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_state_timer", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = "  const [operatorModal,setOperatorModal]=useState<any>(null);"
NEW = '''  const [operatorModal,setOperatorModal]=useState<any>(null);
  const [timerAktif,setTimerAktif]=useState<Record<string,any>>({});
  const [timerLoading,setTimerLoading]=useState<string|null>(null);'''

count1 = content.count(OLD)
print(f"  STATE occurrences: {count1}")

# Tambah useEffect fetch timer aktif (yang belum selesai) untuk panel-panel yang sedang ditampilkan
OLD2 = '    supabase.from("pekerja").select("id,nama,divisi").then(({data})=>setPekerjaList(data??[]));'
NEW2 = '''    supabase.from("pekerja").select("id,nama,divisi").then(({data})=>setPekerjaList(data??[]));
    // Ambil semua timer yang masih aktif (belum selesai) untuk divisi ini
    supabase.from("fcs_timer_kerja").select("*").is("selesai",null).then(({data})=>{
      const map:Record<string,any>={};
      (data??[]).forEach((t:any)=>{map[`${t.panel_id}_${t.kode_komponen}_${t.proses}_${t.pekerja_id}`]=t;});
      setTimerAktif(map);
    });'''
count2 = content.count(OLD2)
print(f"  FETCH_TIMER occurrences: {count2}")

# Tambah function startTimer dan stopTimer
OLD3 = "  const updatePekerjaPerKomponen=async(taskId:number,kode:string,pekerjaIds:number[])=>{"
NEW3 = '''  const startTimer=async(pekerjaId:number,panelId:number,kode:string,proses:string,tanggal:string)=>{
    const key=`${panelId}_${kode}_${proses}_${pekerjaId}`;
    setTimerLoading(key);
    const{data,error}=await supabase.from("fcs_timer_kerja").insert({
      pekerja_id:pekerjaId,panel_id:panelId,kode_komponen:kode,proses,tanggal,mulai:new Date().toISOString()
    }).select().single();
    setTimerLoading(null);
    if(!error&&data){
      setTimerAktif(prev=>({...prev,[key]:data}));
    }
  };

  const stopTimer=async(pekerjaId:number,panelId:number,kode:string,proses:string)=>{
    const key=`${panelId}_${kode}_${proses}_${pekerjaId}`;
    const timer=timerAktif[key];
    if(!timer)return;
    setTimerLoading(key);
    const{error}=await supabase.from("fcs_timer_kerja").update({selesai:new Date().toISOString()}).eq("id",timer.id);
    setTimerLoading(null);
    if(!error){
      setTimerAktif(prev=>{const n={...prev};delete n[key];return n;});
    }
  };

  const updatePekerjaPerKomponen=async(taskId:number,kode:string,pekerjaIds:number[])=>{'''
count3 = content.count(OLD3)
print(f"  TIMER_FUNCTIONS occurrences: {count3}")

if count1==1 and count2==1 and count3==1:
    content = content.replace(OLD, NEW, 1)
    content = content.replace(OLD2, NEW2, 1)
    content = content.replace(OLD3, NEW3, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] State dan function timer berhasil ditambah")
    print("[INFO] Lanjut update render tombol Mulai/Selesai per operator")
else:
    print("[FAIL] Ada occurrence tidak sesuai (harus semua 1), TIDAK menyimpan apapun")
