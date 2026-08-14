import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { QC_ITEMS } from "../lib/panelTypes";
import { downloadFotoNp } from "../lib/fotoHelpers";
import { FotoZoomViewerPekerja, type FotoViewerPekerja } from "./FotoZoomViewerPekerja";

// ─────────────────────────────────────────────────────────────────────────────
// ARSIP QC - redesign search-first (17 Agu 2026), KHUSUS divisi QC. Terpisah dari
// ArsipSeksiView.tsx (dipakai QS/Assembling Luar/Wiring Control/Nameplate, TIDAK
// disentuh sama sekali) - redesign bertahap per-divisi, QC duluan.
// Sumber data SAMA (panel_seksi_archived, seksi='qc'), cuma tampilannya beda: 1 baris
// arsip (1 panel, data gabung 4 kategori QC_ITEMS) di-FLATTEN jadi sampai 4 "card"
// terpisah - 1 card = 1 kategori yang punya foto - biar tiap card bisa punya 1 badge
// kategori (bukan campur), dan filter chip kategori (Semua/Fisik/Spesifikasi/Baut/Test)
// jadi masuk akal buat difilter.
// ─────────────────────────────────────────────────────────────────────────────

const KATEGORI_COLOR:Record<string,string>={fisik:"#2563eb",spesifikasi:"#7c3aed",baut:"#ea580c",test:"#16a34a"};

type QCCard={
  id:string;
  rowId:number;
  kategoriKey:string;kategoriLabel:string;kategoriIcon:string;
  fotos:FotoViewerPekerja[];
  catatan:string;
  panelNama:string;proyek:string;woNumber:string;
  waktuTerbaru:string;
};

const fmtTgl=(iso?:string)=>iso?new Date(iso).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"}):"—";
const fmtTglJam=(iso?:string)=>iso?new Date(iso).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"})+" "+new Date(iso).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"}):"—";

export function ArsipQCView(){
  const[rows,setRows]=useState<any[]>([]);
  const[loading,setLoading]=useState(true);
  const[search,setSearch]=useState("");
  const[activeKategori,setActiveKategori]=useState<string>("semua");
  const[selectedCard,setSelectedCard]=useState<QCCard|null>(null);
  const[detailIndex,setDetailIndex]=useState(0);
  const[fotoViewerOpen,setFotoViewerOpen]=useState(false);
  const[deleting,setDeleting]=useState(false);

  const fetchRows=async()=>{
    setLoading(true);
    const{data}=await supabase.from("panel_seksi_archived").select("*").eq("seksi","qc").order("diarsipkan_pada",{ascending:false});
    setRows(data??[]);
    setLoading(false);
  };
  useEffect(()=>{
    fetchRows();
    const ch=supabase.channel("realtime-panel-seksi-archived-qc-redesign")
      .on("postgres_changes",{event:"*",schema:"public",table:"panel_seksi_archived",filter:"seksi=eq.qc"},()=>fetchRows())
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);

  const cards=useMemo(()=>{
    const list:QCCard[]=[];
    rows.forEach((r:any)=>{
      QC_ITEMS.forEach(item=>{
        const catData=r.data?.[item.key];
        const fotos:FotoViewerPekerja[]=catData?.foto||[];
        if(fotos.length===0)return;
        const waktuTerbaru=fotos.reduce((latest:string,f:any)=>(f.uploaded_at&&f.uploaded_at>latest?f.uploaded_at:latest),r.diarsipkan_pada||"");
        list.push({
          id:`${r.id}_${item.key}`,rowId:r.id,
          kategoriKey:item.key,kategoriLabel:item.label,kategoriIcon:item.icon,
          fotos,catatan:catData?.catatan||"",
          panelNama:r.panel_nama||"-",proyek:r.proyek_snapshot||"-",woNumber:r.wo_number_snapshot||"-",
          waktuTerbaru,
        });
      });
    });
    return list.sort((a,b)=>(b.waktuTerbaru||"").localeCompare(a.waktuTerbaru||""));
  },[rows]);

  const filtered=cards.filter(c=>{
    if(activeKategori!=="semua"&&c.kategoriKey!==activeKategori)return false;
    if(!search)return true;
    const q=search.toLowerCase();
    return c.panelNama.toLowerCase().includes(q)||c.proyek.toLowerCase().includes(q)||c.woNumber.toLowerCase().includes(q);
  });

  const bagikan=async(card:QCCard)=>{
    const foto=card.fotos[detailIndex]||card.fotos[0];
    const text=`${card.panelNama} - ${card.kategoriLabel} (${card.proyek})`;
    if((navigator as any).share){
      try{await(navigator as any).share({title:text,text,url:foto.url});}catch{/* user batal share - diamkan */}
    } else {
      try{await navigator.clipboard.writeText(foto.url);alert("Link foto disalin ke clipboard.");}
      catch{alert(foto.url);}
    }
  };

  // Download berurutan pakai downloadFotoNp yang sudah ada (reuse, bukan bikin cara baru) -
  // jeda kecil antar-download biar browser gak nge-block banyak download barengan.
  const downloadSemua=async(card:QCCard)=>{
    for(let i=0;i<card.fotos.length;i++){
      await downloadFotoNp(card.fotos[i].url,`${card.panelNama}_${card.kategoriLabel}_${i+1}`);
      if(i<card.fotos.length-1)await new Promise(res=>setTimeout(res,350));
    }
  };

  // PENTING: cuma hapus SNAPSHOT arsip (row/kategori di panel_seksi_archived), BUKAN file di
  // Storage - foto yang sama masih dipakai tampilan LIVE (panels.qc_checklist), hapus Storage
  // di sini bakal ikut ngerusak itu. Kalau qc_checklist live berubah lagi nanti (trigger),
  // entry arsip ini otomatis dibuat ulang - ini bukan penghapusan permanen/audit trail.
  const hapusArsip=async(card:QCCard)=>{
    if(!window.confirm(`Hapus arsip "${card.kategoriLabel}" untuk panel ${card.panelNama}? Foto asli TIDAK terhapus dari sistem, cuma snapshot arsip ini yang hilang.`))return;
    setDeleting(true);
    const row=rows.find((r:any)=>r.id===card.rowId);
    if(row){
      const newData={...row.data};
      delete newData[card.kategoriKey];
      const masihAdaFoto=QC_ITEMS.some(item=>(newData[item.key]?.foto||[]).length>0);
      if(masihAdaFoto)await supabase.from("panel_seksi_archived").update({data:newData}).eq("id",card.rowId);
      else await supabase.from("panel_seksi_archived").delete().eq("id",card.rowId);
    }
    setDeleting(false);
    setSelectedCard(null);
    fetchRows();
  };

  return(
    <>
      <div style={{padding:16}} className="fi">
        <div style={{position:"relative" as const,marginBottom:10}}>
          <i className="ti ti-search" style={{position:"absolute" as const,left:12,top:11,fontSize:15,color:"#94a3b8"}}/>
          <input value={search} onChange={(e:any)=>setSearch(e.target.value)} placeholder="Cari WO, proyek, atau nama panel..."
            style={{width:"100%",height:40,padding:"0 12px 0 34px",border:"1.5px solid #e2e8f0",borderRadius:10,fontSize:13.5,outline:"none",background:"#fff",color:"#1e293b",boxSizing:"border-box" as const}}/>
        </div>

        {/* Fade-edge di kanan - isyarat visual masih bisa di-scroll ke samping (chip terakhir
            sempat kepotong tanpa ini). pointer-events:none biar gak nge-block tap ke chip di
            baliknya. */}
        <div style={{position:"relative" as const,marginBottom:8}}>
          <div style={{display:"flex",gap:6,overflowX:"auto" as const,paddingBottom:2}}>
            {[{key:"semua",label:"Semua",icon:"📁"},...QC_ITEMS].map((k:any)=>{
              const active=activeKategori===k.key;
              const color=k.key==="semua"?"#334155":KATEGORI_COLOR[k.key];
              return(
                <button key={k.key} onClick={()=>setActiveKategori(k.key)}
                  style={{flexShrink:0,display:"flex",alignItems:"center",gap:5,padding:"7px 12px",borderRadius:20,
                    border:active?`1.5px solid ${color}`:"1.5px solid #e2e8f0",
                    background:active?color+"14":"#fff",color:active?color:"#64748b",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap" as const}}>
                  <span>{k.icon}</span>{k.label}
                </button>
              );
            })}
          </div>
          <div style={{position:"absolute" as const,top:0,right:0,bottom:2,width:28,pointerEvents:"none" as const,
            background:"linear-gradient(to right, transparent, #f1f5f9)"}}/>
        </div>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <span style={{fontSize:11,color:"#94a3b8"}}>{filtered.length} arsip</span>
          <span style={{fontSize:11,color:"#94a3b8",display:"flex",alignItems:"center",gap:4}}>
            <i className="ti ti-sort-descending" style={{fontSize:13}}/>Terbaru
          </span>
        </div>

        {loading?(
          <div style={{textAlign:"center",padding:40,color:"#94a3b8",fontSize:12}}>Memuat arsip...</div>
        ):filtered.length===0?(
          <div style={{textAlign:"center",padding:40,color:"#94a3b8",fontSize:12,background:"#fff",borderRadius:10,border:"1px solid #e2e8f0"}}>
            {search||activeKategori!=="semua"?"Gak ada arsip yang cocok.":"Belum ada yang diarsipkan."}
          </div>
        ):(
          <div style={{display:"flex",flexDirection:"column" as const,gap:10}}>
            {filtered.map(card=>{
              const color=KATEGORI_COLOR[card.kategoriKey];
              return(
                <div key={card.id} onClick={()=>{setSelectedCard(card);setDetailIndex(0);}}
                  style={{background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:12,overflow:"hidden",cursor:"pointer"}}>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gridTemplateRows:"repeat(2,1fr)",gap:2,background:"#f1f5f9"}}>
                    {Array.from({length:4}).map((_,i)=>{
                      const f=card.fotos[i];
                      const sisaFoto=card.fotos.length-4;
                      return(
                        <div key={i} style={{position:"relative" as const,aspectRatio:"1",background:"#e2e8f0",overflow:"hidden"}}>
                          {f&&<img src={f.url} loading="lazy" style={{width:"100%",height:"100%",objectFit:"cover" as const}}/>}
                          {i===3&&sisaFoto>0&&(
                            <div style={{position:"absolute" as const,inset:0,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                              <span style={{color:"#fff",fontWeight:800,fontSize:16}}>+{sisaFoto}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{padding:"10px 12px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:12}}>
                      <span style={{background:color+"18",color,borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700,flexShrink:0}}>{card.kategoriIcon} {card.kategoriLabel}</span>
                      <span style={{fontSize:10,color:"#94a3b8",whiteSpace:"nowrap" as const,flexShrink:0}}>{card.fotos.length} foto</span>
                    </div>
                    <div style={{fontWeight:800,fontSize:13,color:"#0f172a"}}>{card.panelNama}</div>
                    <div style={{fontSize:11,color:"#64748b",marginTop:1,overflow:"hidden",textOverflow:"ellipsis" as const,whiteSpace:"nowrap" as const}}>WO {card.woNumber} · {card.proyek}</div>
                    <div style={{fontSize:10,color:"#94a3b8",marginTop:4}}>{fmtTgl(card.waktuTerbaru)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* DETAIL VIEWER - dark mode, full-screen, position:fixed independen dari scroll list
          di belakangnya (pola sama dengan FotoZoomViewerPekerja). */}
      {selectedCard&&(()=>{
        const card=selectedCard;
        const fotoAktif=card.fotos[detailIndex]||card.fotos[0];
        return(
          <div style={{position:"fixed" as const,inset:0,background:"#0b0f19",zIndex:9998,display:"flex",flexDirection:"column" as const,overflowY:"auto" as const}} className="fi">
            <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",paddingTop:"max(12px, env(safe-area-inset-top))",flexShrink:0}}>
              <button onClick={()=>setSelectedCard(null)}
                style={{width:36,height:36,borderRadius:99,background:"rgba(255,255,255,0.1)",color:"#fff",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <i className="ti ti-arrow-left" style={{fontSize:18}}/>
              </button>
              <div style={{color:"#fff",fontWeight:700,fontSize:14}}>Informasi Arsip</div>
            </div>

            <div onClick={()=>setFotoViewerOpen(true)} style={{padding:"0 16px",cursor:"pointer"}}>
              <div style={{width:"100%",aspectRatio:"1",borderRadius:12,overflow:"hidden",background:"#000",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <img src={fotoAktif.url} style={{width:"100%",height:"100%",objectFit:"contain" as const}}/>
              </div>
            </div>

            {card.fotos.length>1&&(
              <div style={{display:"flex",gap:6,overflowX:"auto" as const,padding:"10px 16px",flexShrink:0}}>
                {card.fotos.map((f,fi)=>(
                  <div key={fi} onClick={()=>setDetailIndex(fi)}
                    style={{width:52,height:52,borderRadius:8,overflow:"hidden",cursor:"pointer",flexShrink:0,
                      border:fi===detailIndex?"2px solid #fff":"2px solid transparent",opacity:fi===detailIndex?1:0.5}}>
                    <img src={f.url} style={{width:"100%",height:"100%",objectFit:"cover" as const}}/>
                  </div>
                ))}
              </div>
            )}

            <div style={{background:"#141a29",borderRadius:"16px 16px 0 0",padding:16,marginTop:8,flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
                <span style={{background:KATEGORI_COLOR[card.kategoriKey]+"22",color:KATEGORI_COLOR[card.kategoriKey],borderRadius:6,padding:"3px 10px",fontSize:11,fontWeight:700}}>
                  {card.kategoriIcon} {card.kategoriLabel}
                </span>
              </div>
              <div style={{display:"flex",flexDirection:"column" as const,gap:11,marginBottom:18}}>
                {[
                  {label:"Tanggal",value:fmtTglJam(fotoAktif.uploaded_at)},
                  {label:"Proyek",value:card.proyek},
                  {label:"Panel",value:card.panelNama},
                  {label:"WO",value:card.woNumber},
                  {label:"Diupload oleh",value:fotoAktif.uploaded_by||"-"},
                  {label:"Keterangan",value:card.catatan||"-"},
                ].map(f=>(
                  <div key={f.label}>
                    <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:2}}>{f.label}</div>
                    <div style={{fontSize:13,color:"#e2e8f0",fontWeight:600}}>{f.value}</div>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>bagikan(card)}
                  style={{flex:1,display:"flex",flexDirection:"column" as const,alignItems:"center",gap:4,padding:"10px 6px",borderRadius:10,background:"rgba(255,255,255,0.08)",color:"#fff",border:"none",cursor:"pointer",fontSize:10.5,fontWeight:700}}>
                  <i className="ti ti-share" style={{fontSize:17}}/>Bagikan
                </button>
                <button onClick={()=>downloadSemua(card)}
                  style={{flex:1,display:"flex",flexDirection:"column" as const,alignItems:"center",gap:4,padding:"10px 6px",borderRadius:10,background:"rgba(255,255,255,0.08)",color:"#fff",border:"none",cursor:"pointer",fontSize:10.5,fontWeight:700}}>
                  <i className="ti ti-download" style={{fontSize:17}}/>Download Semua
                </button>
                <button onClick={()=>hapusArsip(card)} disabled={deleting}
                  style={{flex:1,display:"flex",flexDirection:"column" as const,alignItems:"center",gap:4,padding:"10px 6px",borderRadius:10,background:"rgba(220,38,38,0.15)",color:"#f87171",border:"none",cursor:deleting?"default":"pointer",fontSize:10.5,fontWeight:700}}>
                  <i className={deleting?"ti ti-loader-2":"ti ti-trash"} style={{fontSize:17}}/>{deleting?"Menghapus...":"Hapus"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {fotoViewerOpen&&selectedCard&&(
        <FotoZoomViewerPekerja fotos={selectedCard.fotos} startIndex={detailIndex} label={`${selectedCard.kategoriLabel}_${selectedCard.panelNama}`} onClose={()=>setFotoViewerOpen(false)}/>
      )}
    </>
  );
}
