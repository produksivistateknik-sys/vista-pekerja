import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { stokTransaksiService } from "../lib/stokTransaksiService";
import { alertGagalSimpan } from "../lib/koneksi";
import { getLocalDateStr } from "../lib/dateHelpers";
import { SectionCard, EmptyState } from "./ui/Primitives";

// ─────────────────────────────────────────────────────────────────────────────
// GUNAKAN STOK KOMPONEN - operator Mekanik mencatat pemakaian stok sendiri (2 Okt 2026, desain
// disetujui user). Transaksi 'keluar' lewat stokTransaksiService.catatKeluar = RPC
// catat_transaksi_stok, fungsi yang SAMA PERSIS dgn form keluar Admin (vista-teknik
// KomponenStokTab) - jadi muncul di Riwayat Transaksi Admin yang sama. Sumber 'manual'; pembeda
// operator = sufiks " (operator)" di kolom Oleh (keputusan user, tanpa migration).
// - Sisa stok di form diperbarui realtime, tapi PENGAMAN sebenarnya ada di server: RPC mengunci
//   baris & mengecek stok terbaru saat tombol ditekan (2 operator rebutan stok terakhir -> cuma 1
//   yang berhasil, yang lain dapat "Stok tidak cukup").
// - Tanggal transaksi = tanggal lokal HP (bukan current_date server yang UTC).
// ─────────────────────────────────────────────────────────────────────────────

const ORANYE="#ff6a1a";

export function GunakanStokView({user,registerBackHandler}:{user:any;registerBackHandler?:(fn:(()=>boolean)|null)=>void}){
  const [items,setItems]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [errMuat,setErrMuat]=useState<string|null>(null);
  const [pilihId,setPilihId]=useState<number|null>(null);
  const [sheet,setSheet]=useState(false);
  const [proyek,setProyek]=useState("");
  const [panel,setPanel]=useState("");
  const [jumlah,setJumlah]=useState(1);
  const [catatan,setCatatan]=useState("");
  const [saving,setSaving]=useState(false);
  const [flash,setFlash]=useState<string|null>(null);
  const namaOp=user?.nama||user?.name||"-";

  const muat=async()=>{
    try{
      setItems(await stokTransaksiService.ambilStokTersedia());
      setErrMuat(null);
    }catch(err:any){
      console.error("[GunakanStok] gagal memuat:",err);
      setErrMuat(err?.message||String(err));
    }finally{
      setLoading(false);
    }
  };

  useEffect(()=>{
    muat();
    let t:any=null;
    const muatUlang=()=>{clearTimeout(t);t=setTimeout(muat,500);};
    const ch=supabase.channel("realtime-gunakan-stok-"+(user?.id??"x"))
      .on("postgres_changes",{event:"*",schema:"public",table:"komponen_stok"},muatUlang)
      .subscribe();
    const onVisible=()=>{if(document.visibilityState==="visible")muat();};
    document.addEventListener("visibilitychange",onVisible);
    return()=>{clearTimeout(t);supabase.removeChannel(ch);document.removeEventListener("visibilitychange",onVisible);};
  },[]);

  // Tombol back HP menutup bottom sheet dulu (bukan keluar menu).
  useEffect(()=>{
    if(!registerBackHandler)return;
    registerBackHandler(sheet?()=>{setSheet(false);return true;}:null);
    return()=>registerBackHandler(null);
  },[sheet]);

  const item=items.find(i=>i.id===pilihId)||null;
  const sisa=item?.stok??0;
  const jml=Math.max(1,Math.min(jumlah,sisa||1));
  const bisaSimpan=!!item&&sisa>=1&&proyek.trim().length>0&&!saving;

  const catat=async()=>{
    if(!item){alert("Pilih item stok dulu.");return;}
    if(!proyek.trim()){alert("Nama proyek wajib diisi.");return;}
    if(!window.confirm(`Catat pemakaian ${jml} pcs ${item.nama}?\n\nProyek: ${proyek.trim()}\nPanel: ${panel.trim()||"-"}\n\nStok akan berkurang dan tidak bisa dibatalkan dari HP.`))return;
    setSaving(true);
    try{
      const t=await stokTransaksiService.catatKeluar({
        komponenId:item.id,jumlah:jml,proyek:proyek.trim(),panel:panel.trim()||null,
        keterangan:catatan.trim()||null,createdBy:`${namaOp} (operator)`,tanggal:getLocalDateStr(),
      });
      setFlash(`✅ ${item.nama}: ${jml} pcs tercatat dipakai · sisa stok ${t?.stok_sesudah??"-"} pcs`);
      setTimeout(()=>setFlash(null),4000);
      setJumlah(1);setCatatan("");setPilihId(null);setProyek("");setPanel("");
      await muat();
    }catch(err:any){
      alertGagalSimpan(err,`Gunakan stok ${item.nama}`,{aksi:"catat pemakaian stok",ulangi:"Catat Pemakaian",
        catatanServer:"Kalau pesannya \"Stok tidak cukup\", stok baru saja dipakai orang lain - angka sisa sudah diperbarui, sesuaikan jumlahnya lalu coba lagi."});
      await muat();
    }finally{
      setSaving(false);
    }
  };

  const lbl={fontSize:12,fontWeight:700,color:"#0f172a",marginBottom:6,display:"block"} as const;
  const inp={width:"100%",boxSizing:"border-box" as const,padding:"11px 12px",borderRadius:10,border:"1px solid #e6e8ee",background:"#f8f9fb",fontSize:13.5,color:"#0f172a",marginBottom:14,fontFamily:"inherit"};

  if(loading)return <div style={{padding:16}}><SectionCard icon="📦" title="Gunakan Stok Komponen" subtitle="Memuat..."><div style={{textAlign:"center",padding:20,color:"#94a3b8",fontSize:12}}>Memuat...</div></SectionCard></div>;

  return(
    <div style={{padding:16}}>
      <SectionCard icon="📦" title="Gunakan Stok Komponen" subtitle={`${user?.sub_bagian||"Mekanik"} · mencatat pemakaian stok untuk WO`}>
        {errMuat&&<div style={{fontSize:11,color:"#b91c1c",background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"8px 10px",marginBottom:10}}>Gagal memuat data stok: {errMuat}. Coba buka ulang menu ini.</div>}
        {flash&&<div style={{fontSize:12,fontWeight:700,color:"#166534",background:"#dcfce7",borderRadius:8,padding:"8px 10px",marginBottom:10}}>{flash}</div>}

        {items.length===0&&!errMuat?(
          <EmptyState title="Belum ada stok yang bisa dipakai" description="Semua item stok komponen sedang kosong (0 pcs)."/>
        ):(
          <div>
            <span style={lbl}>Pilih Item Stok</span>
            <button onClick={()=>setSheet(true)}
              style={{...inp,display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",textAlign:"left" as const}}>
              <span style={{color:item?"#0f172a":"#94a3b8"}}>{item?item.nama:"Tap untuk pilih item…"}</span>
              <span style={{color:"#94a3b8"}}>▾</span>
            </button>

            {pilihId!==null&&!item&&(
              <div style={{fontSize:11.5,color:"#b91c1c",background:"#fef2f2",borderRadius:8,padding:"8px 10px",marginTop:-6,marginBottom:14}}>
                Stok item yang dipilih baru saja habis dipakai orang lain. Pilih item lain.
              </div>
            )}
            {item&&(
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#e6f7ee",borderRadius:10,padding:"10px 12px",marginTop:-4,marginBottom:14}}>
                <div style={{minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:13.5,color:"#0f172a"}}>{item.nama}</div>
                  <div style={{fontSize:11,color:"#6b7280",fontFamily:"'DM Mono',monospace"}}>{item.kode||"-"}</div>
                </div>
                <div style={{textAlign:"right" as const,flexShrink:0}}>
                  <div style={{fontWeight:800,fontSize:17,color:"#1a9e5c"}}>{sisa}</div>
                  <div style={{fontSize:9.5,color:"#6b7280",textTransform:"uppercase" as const}}>sisa pcs</div>
                </div>
              </div>
            )}

            <span style={lbl}>Nama Proyek</span>
            <input value={proyek} onChange={e=>setProyek(e.target.value)} placeholder="contoh: CLS FONTAINE CLINIC SANUR" style={inp}/>

            <span style={lbl}>Nama Panel</span>
            <input value={panel} onChange={e=>setPanel(e.target.value)} placeholder="contoh: PP-LIFT SERVICE (OUTDOOR TYPE)" style={inp}/>

            <span style={lbl}>Jumlah Dipakai</span>
            <div style={{display:"flex",alignItems:"center",gap:10,background:"#f8f9fb",border:"1px solid #e6e8ee",borderRadius:10,padding:"8px 12px",marginBottom:6}}>
              <span style={{fontSize:12.5,color:"#6b7280",flex:1}}>pcs</span>
              <button disabled={!item||jml<=1} onClick={()=>setJumlah(jml-1)} style={{width:30,height:30,borderRadius:8,border:"1px solid #e2e8f0",background:"#fff",fontWeight:800,fontSize:15,color:"#0f172a",cursor:"pointer"}}>−</button>
              <span style={{fontWeight:800,fontSize:15,minWidth:24,textAlign:"center" as const,fontVariantNumeric:"tabular-nums"}}>{item?jml:0}</span>
              <button disabled={!item||jml>=sisa} onClick={()=>setJumlah(jml+1)} style={{width:30,height:30,borderRadius:8,border:"1px solid #e2e8f0",background:"#fff",fontWeight:800,fontSize:15,color:"#0f172a",cursor:"pointer"}}>+</button>
            </div>
            <div style={{fontSize:11,color:"#6b7280",marginBottom:14}}>{item?`Maksimal sesuai sisa stok tersedia (${sisa} pcs) — tidak bisa melebihi.`:"Pilih item dulu untuk melihat sisa stok."}</div>

            <span style={lbl}>Catatan <span style={{fontWeight:500,color:"#6b7280",fontSize:11}}>(opsional)</span></span>
            <textarea value={catatan} onChange={e=>setCatatan(e.target.value)} placeholder="contoh: dipakai untuk ganti komponen reject di lapangan"
              style={{...inp,resize:"vertical" as const,minHeight:60}}/>

            <button onClick={catat} disabled={!bisaSimpan}
              style={{width:"100%",border:"none",borderRadius:10,padding:"12px 0",fontWeight:700,fontSize:14,cursor:bisaSimpan?"pointer":"not-allowed",
                background:bisaSimpan?ORANYE:"#cbd5e1",color:"#fff",fontFamily:"inherit"}}>
              {saving?"Menyimpan...":!item?"Catat Pemakaian (pilih item dulu)":!proyek.trim()?"Catat Pemakaian (isi proyek dulu)":`Catat Pemakaian (${jml} pcs)`}
            </button>
          </div>
        )}
      </SectionCard>

      {sheet&&(
        <div onClick={()=>setSheet(false)} style={{position:"fixed",inset:0,background:"rgba(11,26,61,.45)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:1000}}>
          <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:480,background:"#fff",borderRadius:"18px 18px 0 0",maxHeight:"70vh",overflowY:"auto",padding:16}}>
            <div style={{fontWeight:700,fontSize:15,marginBottom:10,color:"#0f172a"}}>Pilih Item Stok</div>
            {items.map(i=>(
              <div key={i.id} onClick={()=>{setPilihId(i.id);setJumlah(1);setSheet(false);}}
                style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"11px 4px",borderBottom:"1px solid #e6e8ee",cursor:"pointer",background:i.id===pilihId?"#f0fdf4":"transparent"}}>
                <div style={{minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:13.5,color:"#0f172a"}}>{i.nama}</div>
                  <div style={{fontSize:11,color:"#6b7280",fontFamily:"'DM Mono',monospace"}}>{i.kode||"-"}</div>
                </div>
                <div style={{fontWeight:700,fontSize:12.5,color:"#1a9e5c",flexShrink:0}}>{i.stok} pcs</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
