import shutil
import sys
from datetime import datetime

FILE_PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

def read_file():
    with open(FILE_PATH, "r", encoding="utf-8") as f:
        return f.read()

def write_file(content):
    with open(FILE_PATH, "w", encoding="utf-8") as f:
        f.write(content)

def apply_edit(content, old, new, label):
    count = content.count(old)
    if count == 0:
        print(f"❌ GAGAL [{label}]: pattern tidak ditemukan. Tidak ada perubahan disimpan.")
        print("---- Pattern yang dicari ----")
        print(old)
        sys.exit(1)
    if count > 1:
        print(f"❌ GAGAL [{label}]: pattern ditemukan {count}x (harus unik/1x). Tidak ada perubahan disimpan.")
        sys.exit(1)
    print(f"✅ [{label}] pattern ditemukan 1x, mengganti...")
    return content.replace(old, new)


backup_path = FILE_PATH + f".bak_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
shutil.copy2(FILE_PATH, backup_path)
print(f"📦 Backup dibuat: {backup_path}\n")

content = read_file()

# ── EDIT 1: Tambah state baru ──
old1 = '''  const [komponenInfoMap,setKomponenInfoMap]=useState<Record<string,any>>({});'''

new1 = '''  const [komponenInfoMap,setKomponenInfoMap]=useState<Record<string,any>>({});
  const [selectedKomponen,setSelectedKomponen]=useState<Record<string,string[]>>({});
  const [komponenPopup,setKomponenPopup]=useState<{proses:string,panelId:number}|null>(null);
  const [tempSelectedKomponen,setTempSelectedKomponen]=useState<string[]>([]);'''

content = apply_edit(content, old1, new1, "Edit 1: Tambah state selectedKomponen/komponenPopup")

# ── EDIT 2: Deklarasi isDrilldownProses + visibleRows ──
old2 = '''        const isDone=(r:any)=>r.pct===100;'''

new2 = '''        const isDone=(r:any)=>r.pct===100;
        const isDrilldownProses=["WIRING CONTROL","WIRING POWER","BUSBAR"].includes(proses);
        const visibleRows=isDrilldownProses?rows.filter((r:any)=>(selectedKomponen[`${proses}_${r.panelId}`]||[]).includes(r.kode)):rows;'''

content = apply_edit(content, old2, new2, "Edit 2: Deklarasi isDrilldownProses + visibleRows")

# ── EDIT 3: Badge X/Y selesai di header card pakai visibleRows ──
old3 = '''                  {rows.filter((r:any)=>isDone(r)).length}/{rows.length} selesai'''

new3 = '''                  {visibleRows.filter((r:any)=>isDone(r)).length}/{visibleRows.length} selesai'''

content = apply_edit(content, old3, new3, "Edit 3: Badge pakai visibleRows")

# ── EDIT 4: Sisipin panel list trigger + popup checklist, sebelum tabel ──
old4 = '''            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>'''

new4 = '''            {isDrilldownProses&&(
              <div style={{display:"flex",flexWrap:"wrap",gap:8,padding:"10px 16px",background:"#f8fafc",borderBottom:"1px solid #f1f5f9"}}>
                {(()=>{
                  const seenPanel=new Set();
                  const panelList:any[]=[];
                  rows.forEach((r:any)=>{
                    if(!seenPanel.has(r.panelId)){
                      seenPanel.add(r.panelId);
                      panelList.push({panelId:r.panelId,panel:r.panel,proyek:r.task.proyek});
                    }
                  });
                  return panelList.map((pg:any)=>{
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
                  });
                })()}
              </div>
            )}
            {komponenPopup&&komponenPopup.proses===proses&&(()=>{
              const panelRows=rows.filter((r:any)=>r.panelId===komponenPopup.panelId);
              const panelInfo=panelRows[0];
              return(
                <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:16}}
                  onClick={()=>setKomponenPopup(null)}>
                  <div onClick={(e:any)=>e.stopPropagation()} style={{background:"#fff",borderRadius:12,width:"100%",maxWidth:400,maxHeight:"80vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>
                    <div style={{padding:"14px 16px",borderBottom:"1px solid #f1f5f9"}}>
                      <div style={{fontSize:11,color:"#94a3b8"}}>{panelInfo?.task.proyek}</div>
                      <div style={{fontSize:15,fontWeight:700,color:"#1e293b"}}>{panelInfo?.panel.nama}</div>
                      <div style={{fontSize:11,color:"#64748b",marginTop:4}}>Pilih komponen yang mau dikerjakan</div>
                    </div>
                    <div style={{overflowY:"auto",padding:"8px 16px",flex:1}}>
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
                    </div>
                    <div style={{display:"flex",gap:8,padding:"12px 16px",borderTop:"1px solid #f1f5f9"}}>
                      <button onClick={()=>setTempSelectedKomponen(panelRows.map((r:any)=>r.kode))}
                        style={{fontSize:11,color:"#1d4ed8",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Pilih Semua</button>
                      <button onClick={()=>setTempSelectedKomponen([])}
                        style={{fontSize:11,color:"#dc2626",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Kosongkan</button>
                      <div style={{flex:1}}/>
                      <button onClick={()=>setKomponenPopup(null)}
                        style={{padding:"8px 14px",borderRadius:8,border:"1px solid #e2e8f0",background:"#fff",fontSize:12,fontWeight:600,color:"#64748b",cursor:"pointer"}}>Batal</button>
                      <button onClick={()=>{
                          setSelectedKomponen((prev:any)=>({...prev,[`${proses}_${komponenPopup.panelId}`]:tempSelectedKomponen}));
                          setKomponenPopup(null);
                        }}
                        style={{padding:"8px 14px",borderRadius:8,border:"none",background:"#4f46e5",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer"}}>
                        Konfirmasi ({tempSelectedKomponen.length})
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>'''

content = apply_edit(content, old4, new4, "Edit 4: Panel list trigger + popup checklist")

# ── EDIT 5: rows.map di tbody -> visibleRows.map ──
old5 = '''                  {rows.map((r:any,ri:number)=>{'''
new5 = '''                  {visibleRows.map((r:any,ri:number)=>{'''

content = apply_edit(content, old5, new5, "Edit 5: tbody pakai visibleRows")

write_file(content)
print("\n🎉 Semua edit berhasil diterapkan!")
print(f"   Backup asli ada di: {backup_path}")
print("   Behavior: WIRING CONTROL/POWER/BUSBAR - tabel tetap flat kayak awal, tapi kosong dulu")
print("   sampai operator klik nama panel di atas tabel -> popup checklist -> pilih komponen ->")
print("   konfirmasi -> komponen yang dipilih baru muncul jadi baris di tabel.")
print("   Proses lain TIDAK berubah sama sekali.")
print("   Lanjut: npm run build.")
