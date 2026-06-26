import shutil
import sys

PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

OLD_1 = '''function NameplateView({user}:any){'''

NEW_1 = '''function TrackingKomponenView({user}:any){
  const[namaOperator,setNamaOperator]=useState<string>(()=>localStorage.getItem("vista_tk_nama")||"");
  const[subBagian,setSubBagian]=useState<string>("Warehouse");
  const[woList,setWoList]=useState<any[]>([]);
  const[selectedWoId,setSelectedWoId]=useState<number|null>(null);
  const[catatan,setCatatan]=useState("");
  const[files,setFiles]=useState<File[]>([]);
  const[uploading,setUploading]=useState(false);
  const[riwayat,setRiwayat]=useState<any[]>([]);
  const[fotoMap,setFotoMap]=useState<Record<number,any[]>>({});
  const[loadingRiwayat,setLoadingRiwayat]=useState(true);

  const fetchWoList=async()=>{
    const{data}=await supabase.from("work_orders").select("id,wo,proyek").eq("is_archived",false).order("created_at",{ascending:false});
    setWoList(data??[]);
  };

  const fetchRiwayat=async(woId:number)=>{
    setLoadingRiwayat(true);
    const{data:tr}=await supabase.from("fcs_tracking_komponen").select("*").eq("wo_id",woId).order("created_at",{ascending:false});
    setRiwayat(tr??[]);
    if(tr&&tr.length>0){
      const ids=tr.map((t:any)=>t.id);
      const{data:fotos}=await supabase.from("fcs_tracking_komponen_foto").select("*").in("tracking_id",ids);
      const map:Record<number,any[]>={};
      (fotos??[]).forEach((f:any)=>{
        if(!map[f.tracking_id])map[f.tracking_id]=[];
        map[f.tracking_id].push(f);
      });
      setFotoMap(map);
    } else {
      setFotoMap({});
    }
    setLoadingRiwayat(false);
  };

  useEffect(()=>{fetchWoList();},[]);

  useEffect(()=>{
    if(selectedWoId)fetchRiwayat(selectedWoId);
    const ch=supabase.channel("realtime-tracking-komponen")
      .on("postgres_changes",{event:"*",schema:"public",table:"fcs_tracking_komponen"},()=>{if(selectedWoId)fetchRiwayat(selectedWoId);})
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[selectedWoId]);

  const handleFileSelect=(e:any)=>{
    const picked=Array.from(e.target.files||[]) as File[];
    setFiles(prev=>[...prev,...picked]);
  };

  const removeSelectedFile=(idx:number)=>{
    setFiles(prev=>prev.filter((_,i)=>i!==idx));
  };

  const submitTracking=async()=>{
    if(!namaOperator.trim()){alert("Isi nama kamu dulu");return;}
    if(!selectedWoId){alert("Pilih Work Order dulu");return;}
    if(files.length===0&&!catatan.trim()){alert("Lampirkan foto atau tulis catatan minimal salah satu");return;}
    localStorage.setItem("vista_tk_nama",namaOperator.trim());
    setUploading(true);
    const{data:tr,error:trErr}=await supabase.from("fcs_tracking_komponen").insert({
      wo_id:selectedWoId,
      sub_bagian:subBagian,
      operator_name:namaOperator.trim(),
      catatan:catatan.trim()||null,
    }).select().single();
    if(trErr||!tr){
      alert("Gagal menyimpan: "+(trErr?.message||"unknown error"));
      setUploading(false);
      return;
    }
    for(const file of files){
      const ext=file.name.split(".").pop();
      const safeName=`${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`;
      const path=`${tr.id}/${safeName}`;
      const{error:upErr}=await supabase.storage.from("tracking-komponen").upload(path,file);
      if(upErr){
        alert("Gagal upload foto "+file.name+": "+upErr.message);
        continue;
      }
      const{data:urlData}=supabase.storage.from("tracking-komponen").getPublicUrl(path);
      await supabase.from("fcs_tracking_komponen_foto").insert({
        tracking_id:tr.id,
        file_url:urlData.publicUrl,
      });
    }
    setCatatan("");
    setFiles([]);
    setUploading(false);
    fetchRiwayat(selectedWoId);
  };

  const fmtDateTime=(d:string)=>d?new Date(d).toLocaleString("id-ID",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):"-";

  const subBagianIcon:Record<string,string>={Warehouse:"📦",Assembling:"🔧",QS:"📋",QC:"🔍"};

  return(
    <div style={{padding:16}} className="fi">
      <div style={{fontWeight:800,fontSize:17,color:"#1e293b",marginBottom:4}}>📦 Tracking Komponen</div>
      <div style={{fontSize:12,color:"#64748b",marginBottom:16}}>Dokumentasi serah terima komponen antar bagian</div>

      <div style={{marginBottom:12}}>
        <Lbl>Nama Kamu</Lbl>
        <Inp value={namaOperator} onChange={(e:any)=>setNamaOperator(e.target.value)} placeholder="Tulis nama kamu..."/>
      </div>

      <div style={{marginBottom:12}}>
        <Lbl>Sub-bagian</Lbl>
        <div style={{display:"flex",gap:8,flexWrap:"wrap" as const}}>
          {["Warehouse","Assembling","QS","QC"].map(sb=>(
            <button key={sb} onClick={()=>setSubBagian(sb)}
              style={{flex:1,minWidth:80,padding:"10px 8px",borderRadius:10,border:`2px solid ${subBagian===sb?"#0d9488":"#e2e8f0"}`,
                background:subBagian===sb?"#0d948818":"#f8fafc",color:subBagian===sb?"#0d9488":"#64748b",
                cursor:"pointer",fontWeight:700,fontSize:13,textAlign:"center" as const}}>
              {subBagianIcon[sb]} {sb}
            </button>
          ))}
        </div>
      </div>

      <div style={{marginBottom:12}}>
        <Lbl>Work Order</Lbl>
        <select value={selectedWoId??""} onChange={(e:any)=>setSelectedWoId(e.target.value?Number(e.target.value):null)}
          style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid #e2e8f0",fontSize:14,background:"#fff"}}>
          <option value="">Pilih Work Order...</option>
          {woList.map((w:any)=>(
            <option key={w.id} value={w.id}>{w.wo} — {w.proyek}</option>
          ))}
        </select>
      </div>

      {selectedWoId&&(
        <>
          <div style={{marginBottom:12}}>
            <Lbl>Catatan</Lbl>
            <textarea value={catatan} onChange={(e:any)=>setCatatan(e.target.value)}
              placeholder="Tulis catatan, misal: komponen lengkap, diserahkan ke assembling"
              style={{width:"100%",minHeight:60,padding:"10px 12px",borderRadius:10,border:"1.5px solid #e2e8f0",fontSize:14,fontFamily:"inherit",resize:"vertical" as const}}/>
          </div>

          {files.length>0&&(
            <div style={{display:"flex",flexWrap:"wrap" as const,gap:8,marginBottom:10}}>
              {files.map((f,idx)=>(
                <div key={idx} style={{display:"flex",alignItems:"center",gap:6,background:"#f1f5f9",borderRadius:6,padding:"5px 10px",fontSize:12}}>
                  <span>📷</span>
                  <span style={{maxWidth:120,overflow:"hidden",textOverflow:"ellipsis" as const,whiteSpace:"nowrap" as const}}>{f.name}</span>
                  <button onClick={()=>removeSelectedFile(idx)} style={{border:"none",background:"none",cursor:"pointer",color:"#dc2626",fontWeight:700,fontSize:13}}>×</button>
                </div>
              ))}
            </div>
          )}

          <div style={{display:"flex",gap:10,marginBottom:20}}>
            <label style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"12px",borderRadius:10,border:"1.5px solid #e2e8f0",background:"#f8fafc",cursor:"pointer",fontSize:13,fontWeight:700,color:"#475569"}}>
              📷 Ambil/Pilih Foto
              <input type="file" accept="image/*" multiple capture="environment" onChange={handleFileSelect} style={{display:"none"}}/>
            </label>
            <button onClick={submitTracking} disabled={uploading}
              style={{flex:1,padding:"12px",borderRadius:10,border:"none",background:uploading?"#94a3b8":"#0d9488",color:"#fff",fontSize:14,fontWeight:800,cursor:uploading?"default":"pointer",fontFamily:"inherit"}}>
              {uploading?"Mengunggah...":"Kirim"}
            </button>
          </div>

          <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:8}}>Riwayat</div>
          {loadingRiwayat?(
            <div style={{textAlign:"center" as const,padding:30,color:"#94a3b8",fontSize:13}}>Memuat...</div>
          ):riwayat.length===0?(
            <div style={{textAlign:"center" as const,padding:30,color:"#94a3b8",fontSize:13}}>Belum ada riwayat untuk WO ini</div>
          ):(
            <div style={{display:"flex",flexDirection:"column" as const,gap:10}}>
              {riwayat.map((r:any)=>(
                <div key={r.id} style={{background:"#fff",border:"1px solid #e2e8f0",borderLeft:"3px solid #0d9488",borderRadius:10,padding:"12px 14px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:4}}>
                    <span style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>{subBagianIcon[r.sub_bagian]} {r.sub_bagian}</span>
                    <span style={{fontSize:11,color:"#94a3b8"}}>{fmtDateTime(r.created_at)}</span>
                  </div>
                  <div style={{fontSize:12,color:"#64748b",marginBottom:6}}>oleh {r.operator_name}</div>
                  {r.catatan&&<div style={{fontSize:13,color:"#334155",marginBottom:8}}>{r.catatan}</div>}
                  {(fotoMap[r.id]||[]).length>0&&(
                    <div style={{display:"flex",flexWrap:"wrap" as const,gap:6}}>
                      {(fotoMap[r.id]||[]).map((foto:any)=>(
                        <a key={foto.id} href={foto.file_url} target="_blank" rel="noopener noreferrer">
                          <img src={foto.file_url} style={{width:64,height:64,objectFit:"cover" as const,borderRadius:6,border:"1px solid #e2e8f0"}}/>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function NameplateView({user}:any){'''

EDITS = [
    ("EDIT 1 (komponen TrackingKomponenView)", OLD_1, NEW_1),
]

def main():
    shutil.copy(PATH, PATH + ".bak_trackingkomponen")
    print(f"[OK] Backup dibuat: {PATH}.bak_trackingkomponen")

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
    print("Catatan: komponen TrackingKomponenView belum dirender dimanapun, masih perlu langkah berikutnya")
    print("Selanjutnya jalankan: npm run build")

if __name__ == "__main__":
    main()
