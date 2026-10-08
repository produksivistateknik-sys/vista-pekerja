import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "../lib/supabase";
import { QC_ITEMS } from "../lib/panelTypes";
import { downloadFotoNp } from "../lib/fotoHelpers";
import { FotoZoomViewerPekerja, type FotoViewerPekerja } from "./FotoZoomViewerPekerja";
import { ThumbMedia } from "./ui/ThumbMedia";
import { isVideoFoto } from "../lib/mediaThumb";
import { kataCari, cocokSemuaKata, bacaSesi, tulisSesi } from "../lib/cariArsip";
import { alertGagalSimpan } from "../lib/koneksi";

// ─────────────────────────────────────────────────────────────────────────────
// ARSIP QC - redesign search-first (17 Agu 2026), KHUSUS divisi QC. Terpisah dari
// ArsipSeksiView.tsx (dipakai QS/Assembling Luar/Wiring Control/Nameplate, TIDAK
// disentuh sama sekali) - redesign bertahap per-divisi, QC duluan.
//
// REVISI (17 Agu 2026): sebelumnya 1 baris arsip (1 panel, data gabung 4 kategori
// QC_ITEMS) di-flatten jadi sampai 4 card terpisah per kategori. SEKARANG dibalik -
// 1 card = 1 PANEL, semua foto lintas kategori digabung jadi satu koleksi, kategori
// QC TIDAK ditampilkan/dibedakan sama sekali di manapun (list maupun detail). Ini
// sebenarnya JUSTRU lebih sederhana dari struktur data aslinya: trigger arsip QC
// pakai ON CONFLICT (panel_id,seksi,kode) dengan kode selalu '' - artinya 1 panel
// SUDAH otomatis 1 baris di panel_seksi_archived (dikonfirmasi ke data live: 0
// panel_id duplikat), jadi grouping di sini gak perlu logic tambahan - cukup gabung
// array foto 4 kategori per baris, TANPA flatten.
//
// REVISI (8 Okt 2026) - 2 level, daftar LANGSUNG tampil (dulu kosong sampai operator mengetik):
//   Level 1: daftar WO/proyek (tanpa foto, ringan), arsip terbaru dulu. Ketikan mengerucutkan
//     daftar (pencarian per-kata lib/cariArsip.ts - "071 pp" dulu 0 hasil).
//   Level 2: panel dalam 1 WO + kolom "Cari panel di WO ini". Panel gak ketemu -> pesan "Panel
//     tidak ditemukan di WO ini", ketikan & WO terpilih TETAP (gak di-reset), tombol Ubah
//     pencarian / Ganti proyek / Cari di semua WO.
// Ketikan & WO terpilih disimpan di sessionStorage (keluar ke menu lalu masuk lagi = tetap).
// Kelompok WO pakai nomor WO + proyek SNAPSHOT (bukan wo_id): 2 WO live punya 2 wo_id utk nomor
// & proyek yang sama (015 GODREJ, 016 BALI TENNIS) - kalau per wo_id muncul 2 baris kembar; dan
// 13 baris arsip WO-nya sudah tidak ada di work_orders, jadi JANGAN join ke tabel live.
// ─────────────────────────────────────────────────────────────────────────────

type QCCard={
  id:number; // row.id - 1 row = 1 panel, gak perlu id komposit
  fotos:FotoViewerPekerja[]; // gabungan semua kategori, urut uploaded_at terbaru dulu
  panelNama:string;proyek:string;woNumber:string;
  waktuTerbaru:string;
  woKey:string;
};
type QCGrupWo={key:string;woNumber:string;proyek:string;cards:QCCard[];waktuTerbaru:string};

const SESI_CARI="arsipqc_cari",SESI_WO="arsipqc_wo",SESI_CARI_PANEL="arsipqc_cari_panel";

const fmtTgl=(iso?:string)=>iso?new Date(iso).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"}):"—";
const fmtTglJam=(iso?:string)=>iso?new Date(iso).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"})+" "+new Date(iso).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"}):"—";

// Paginasi eksplisit (BUG FIX 5 Sep 2026) - Supabase/PostgREST default mentok 1000 baris per
// request tanpa .range(). Trigger arsip nulis SATU baris per PANEL per SEKSI (bukan per WO),
// jadi tabel ini tumbuh lebih cepat dari panels sendiri - begitu tembus 1000 baris, arsip LAMA
// (order .diarsipkan_pada desc) ke-cut diam-diam dari tab Arsip QC tanpa pesan error apa pun.
const fetchAllPaged=async(build:(from:number,to:number)=>any):Promise<any[]>=>{
  let all:any[]=[];
  let from=0;
  const PAGE=1000;
  while(true){
    const{data,error}=await build(from,from+PAGE-1);
    if(error)throw error;
    all=all.concat(data??[]);
    if(!data||data.length<PAGE)break;
    from+=PAGE;
  }
  return all;
};

export function ArsipQCView({registerBackHandler}:{registerBackHandler?:(fn:(()=>boolean)|null)=>void}={}){
  const[rows,setRows]=useState<any[]>([]);
  const[loading,setLoading]=useState(true);
  const[gagalMuat,setGagalMuat]=useState(false);
  const[search,setSearch]=useState(()=>bacaSesi(SESI_CARI,""));
  const[woKey,setWoKey]=useState<string|null>(()=>bacaSesi<string|null>(SESI_WO,null));
  const[cariPanel,setCariPanel]=useState(()=>bacaSesi(SESI_CARI_PANEL,""));
  const[selectedCard,setSelectedCard]=useState<QCCard|null>(null);
  const[detailIndex,setDetailIndex]=useState(0);
  const[fotoViewerOpen,setFotoViewerOpen]=useState(false);
  const[deleting,setDeleting]=useState(false);
  const inputPanelRef=useRef<HTMLInputElement>(null);
  const sudahMuat=useRef(false);
  useEffect(()=>{tulisSesi(SESI_CARI,search);},[search]);
  useEffect(()=>{tulisSesi(SESI_WO,woKey);},[woKey]);
  useEffect(()=>{tulisSesi(SESI_CARI_PANEL,cariPanel);},[cariPanel]);

  // Kembali per-level (pola sama WoDigitalView/KomponenPasangView): viewer foto -> detail ->
  // daftar panel WO -> daftar WO -> baru keluar ke menu. Dulu tanpa handler: "Kembali" di header
  // langsung keluar ke menu & ketikan pencarian ikut hilang.
  useEffect(()=>{
    registerBackHandler?.(()=>{
      if(fotoViewerOpen){setFotoViewerOpen(false);return true;}
      if(selectedCard){setSelectedCard(null);return true;}
      if(woKey){setWoKey(null);return true;}
      return false;
    });
    return()=>registerBackHandler?.(null);
  },[fotoViewerOpen,selectedCard,woKey]);

  // BUG FIX (8 Okt 2026): dulu tanpa try/catch - koneksi gagal = "Memuat arsip..." selamanya; dan
  // tiap event realtime daftar diganti "Memuat arsip..." sebentar (kedip). Sekarang tulisan memuat
  // cuma di muatan PERTAMA, muat ulang berikutnya diam-diam (data lama tetap tampil).
  const fetchRows=async()=>{
    if(!sudahMuat.current)setLoading(true);
    try{
      const data=await fetchAllPaged((from,to)=>supabase.from("panel_seksi_archived").select("*").eq("seksi","qc").order("diarsipkan_pada",{ascending:false}).range(from,to));
      setRows(data);
      setGagalMuat(false);
      sudahMuat.current=true;
    }catch(err){
      console.error("[Arsip QC] gagal memuat arsip:",err);
      setGagalMuat(true);
    }finally{
      setLoading(false);
    }
  };
  useEffect(()=>{
    fetchRows();
    const ch=supabase.channel("realtime-panel-seksi-archived-qc-redesign")
      .on("postgres_changes",{event:"*",schema:"public",table:"panel_seksi_archived",filter:"seksi=eq.qc"},()=>fetchRows())
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);

  const cards=useMemo(()=>{
    const list:QCCard[]=rows.map((r:any)=>{
      const fotos:FotoViewerPekerja[]=QC_ITEMS.flatMap(item=>r.data?.[item.key]?.foto||[])
        .sort((a:any,b:any)=>(b.uploaded_at||"").localeCompare(a.uploaded_at||""));
      const waktuTerbaru=fotos[0]?.uploaded_at||r.diarsipkan_pada||"";
      const proyek=r.proyek_snapshot||"-",woNumber=r.wo_number_snapshot||"-";
      return{id:r.id,fotos,panelNama:r.panel_nama||"-",proyek,woNumber,waktuTerbaru,woKey:`${woNumber}|${proyek}`};
    });
    return list.sort((a,b)=>(b.waktuTerbaru||"").localeCompare(a.waktuTerbaru||""));
  },[rows]);

  // Kelompok per WO, urutan = arsip terbaru dulu (cards sudah urut terbaru -> kartu pertama tiap
  // grup = waktu terbarunya, urutan Map = urutan sisip).
  const grupWo=useMemo(()=>{
    const map=new Map<string,QCGrupWo>();
    for(const c of cards){
      let g=map.get(c.woKey);
      if(!g){g={key:c.woKey,woNumber:c.woNumber,proyek:c.proyek,cards:[],waktuTerbaru:c.waktuTerbaru};map.set(c.woKey,g);}
      g.cards.push(c);
    }
    return[...map.values()];
  },[cards]);

  // Level 1: WO tampil kalau semua kata cocok di WO/proyek-nya, ATAU ada panelnya yang cocok
  // (kata boleh campur WO/proyek + nama panel, mis. "071 pp").
  const kata=kataCari(search);
  const woTersaring=useMemo(()=>grupWo.map(g=>{
    const cocokWo=cocokSemuaKata(kata,g.woNumber,g.proyek);
    const panelCocok=cocokWo?[]:g.cards.filter(c=>cocokSemuaKata(kata,c.panelNama,g.proyek,g.woNumber));
    return{g,cocokWo,panelCocok};
  }).filter(x=>x.cocokWo||x.panelCocok.length>0),[grupWo,search]);

  const grupAktif=woKey?grupWo.find(g=>g.key===woKey)||null:null;
  // WO terpilih (dari sessionStorage / sebelum hapus) sudah tidak ada di arsip -> balik ke daftar WO.
  useEffect(()=>{if(!loading&&!gagalMuat&&woKey&&!grupAktif)setWoKey(null);},[loading,gagalMuat,woKey,grupAktif]);
  const kataPanel=kataCari(cariPanel);
  const panelTersaring=grupAktif?grupAktif.cards.filter(c=>cocokSemuaKata(kataPanel,c.panelNama)):[];

  // Masuk WO dari hasil pencarian: kata yang BUKAN bagian WO/proyek-nya (mis. "pp" dari "071 pp")
  // dibawa jadi pencarian panel - operator langsung lihat panel yang dia cari.
  const pilihWo=(g:QCGrupWo)=>{
    setCariPanel(kata.filter(k=>!cocokSemuaKata([k],g.woNumber,g.proyek)).join(" "));
    setWoKey(g.key);
  };

  const bagikan=async(card:QCCard)=>{
    const foto=card.fotos[detailIndex]||card.fotos[0];
    const text=`${card.panelNama} (${card.proyek})`;
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
      await downloadFotoNp(card.fotos[i].url,`${card.panelNama}_${i+1}`);
      if(i<card.fotos.length-1)await new Promise(res=>setTimeout(res,350));
    }
  };

  // PENTING: cuma hapus SNAPSHOT arsip (row di panel_seksi_archived), BUKAN file di Storage -
  // foto yang sama masih dipakai tampilan LIVE (panels.qc_checklist), hapus Storage di sini
  // bakal ikut ngerusak itu. Kalau qc_checklist live berubah lagi nanti (trigger), entry arsip
  // ini otomatis dibuat ulang - ini bukan penghapusan permanen/audit trail. Sekarang 1 card =
  // 1 panel = 1 row utuh, jadi Hapus langsung hapus row-nya (gak ada lagi per-kategori).
  const hapusArsip=async(card:QCCard)=>{
    if(!window.confirm(`Hapus arsip QC untuk panel ${card.panelNama}? Foto asli TIDAK terhapus dari sistem, cuma snapshot arsip ini yang hilang.`))return;
    setDeleting(true);
    // BUG FIX (8 Okt 2026): dulu error diabaikan - gagal hapus tetap terlihat "berhasil" diam-diam.
    // .select() biar ketahuan juga kalau 0 baris terhapus (sudah dihapus orang lain / ditolak RLS).
    try{
      const{data,error}=await supabase.from("panel_seksi_archived").delete().eq("id",card.id).select("id");
      if(error)throw error;
      if(!data||data.length===0){
        console.error(`[Hapus arsip QC ${card.id}] delete 0 baris`);
        alert("Arsip tidak terhapus (mungkin sudah dihapus orang lain). Daftar dimuat ulang.");
      }
      setSelectedCard(null);
      fetchRows();
    }catch(err){
      alertGagalSimpan(err,`Hapus arsip QC ${card.id}`,{aksi:"hapus arsip",ulangi:"Hapus"});
    }finally{
      setDeleting(false);
    }
  };

  return(
    <>
      <div style={{padding:16}} className="fi">
        {gagalMuat&&(
          <div style={{display:"flex",alignItems:"center",gap:8,padding:"9px 12px",marginBottom:10,borderRadius:10,background:"#fef2f2",border:"1px solid #fecaca",color:"#b91c1c",fontSize:12}}>
            <i className="ti ti-wifi-off" style={{fontSize:15,flexShrink:0}}/>
            <span style={{flex:1}}>{rows.length?"Gagal memuat ulang arsip - yang tampil mungkin belum terbaru.":"Gagal memuat arsip - koneksi lambat/putus."}</span>
            <button onClick={()=>fetchRows()} style={{border:"none",background:"#b91c1c",color:"#fff",borderRadius:8,padding:"5px 10px",fontSize:11.5,fontWeight:700,cursor:"pointer",flexShrink:0}}>Coba lagi</button>
          </div>
        )}

        {!grupAktif?(
          <>
            {/* LEVEL 1 - daftar WO/proyek */}
            <div style={{position:"relative" as const,marginBottom:10}}>
              <i className="ti ti-search" style={{position:"absolute" as const,left:12,top:11,fontSize:15,color:"#94a3b8"}}/>
              <input value={search} onChange={(e:any)=>setSearch(e.target.value)} placeholder="Cari WO, proyek, atau nama panel..."
                style={{width:"100%",height:40,padding:search?"0 38px 0 34px":"0 12px 0 34px",border:"1.5px solid #e2e8f0",borderRadius:10,fontSize:13.5,outline:"none",background:"#fff",color:"#1e293b",boxSizing:"border-box" as const}}/>
              {search&&(
                <button onClick={()=>setSearch("")} aria-label="Hapus pencarian"
                  style={{position:"absolute" as const,right:6,top:6,width:28,height:28,borderRadius:99,border:"none",background:"#f1f5f9",color:"#64748b",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <i className="ti ti-x" style={{fontSize:14}}/>
                </button>
              )}
            </div>

            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <span style={{fontSize:11,color:"#94a3b8"}}>{woTersaring.length} WO{kata.length?` cocok dari ${grupWo.length}`:""} · {cards.length} panel diarsip</span>
              <span style={{fontSize:11,color:"#94a3b8",display:"flex",alignItems:"center",gap:4}}>
                <i className="ti ti-sort-descending" style={{fontSize:13}}/>Terbaru
              </span>
            </div>

            {loading?(
              <div style={{textAlign:"center",padding:40,color:"#94a3b8",fontSize:12}}>Memuat arsip...</div>
            ):grupWo.length===0?(
              !gagalMuat&&<div style={{textAlign:"center",padding:40,color:"#94a3b8",fontSize:12,background:"#fff",borderRadius:10,border:"1px solid #e2e8f0"}}>
                Belum ada arsip QC.
              </div>
            ):woTersaring.length===0?(
              <div style={{textAlign:"center",padding:"28px 16px",color:"#64748b",fontSize:12.5,background:"#fff",borderRadius:10,border:"1px solid #e2e8f0"}}>
                <div style={{fontWeight:700,color:"#0f172a"}}>Tidak ada WO, proyek, atau panel yang cocok dengan “{search.trim()}”.</div>
                <button onClick={()=>setSearch("")} style={{marginTop:12,border:"1.5px solid #e2e8f0",background:"#fff",color:"#1d4ed8",borderRadius:9,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>Hapus pencarian</button>
              </div>
            ):(
              <div style={{border:"1px solid #e2e8f0",borderRadius:12,overflow:"hidden"}}>
                {woTersaring.map(({g,cocokWo,panelCocok},i)=>(
                  <div key={g.key} onClick={()=>pilihWo(g)}
                    style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",cursor:"pointer",borderTop:i===0?"none":"1px solid #f1f5f9",background:"#fff"}}>
                    <div style={{width:34,height:34,borderRadius:9,background:"#eff6ff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <i className="ti ti-folder" style={{fontSize:16,color:"#1d4ed8"}}/>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:700,color:"#0f172a",overflow:"hidden",textOverflow:"ellipsis" as const,whiteSpace:"nowrap" as const}}>WO {g.woNumber} · {g.proyek}</div>
                      <div style={{fontSize:11,color:"#94a3b8",marginTop:2,overflow:"hidden",textOverflow:"ellipsis" as const,whiteSpace:"nowrap" as const}}>
                        {!cocokWo
                          ?<span style={{color:"#1d4ed8",fontWeight:600}}>{panelCocok.length} panel cocok: {panelCocok.map(c=>c.panelNama).join(", ")}</span>
                          :`${g.cards.length} panel · terakhir ${fmtTgl(g.waktuTerbaru)}`}
                      </div>
                    </div>
                    <i className="ti ti-chevron-right" style={{fontSize:16,color:"#cbd5e1",flexShrink:0}}/>
                  </div>
                ))}
              </div>
            )}
          </>
        ):(
          <>
            {/* LEVEL 2 - panel dalam 1 WO */}
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
              <button onClick={()=>setWoKey(null)} aria-label="Ganti proyek"
                style={{width:34,height:34,borderRadius:9,background:"#f1f5f9",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <i className="ti ti-arrow-left" style={{fontSize:17,color:"#475569"}}/>
              </button>
              <div style={{minWidth:0}}>
                <div style={{fontSize:14,fontWeight:800,color:"#0f172a",overflow:"hidden",textOverflow:"ellipsis" as const,whiteSpace:"nowrap" as const}}>WO {grupAktif.woNumber} · {grupAktif.proyek}</div>
                <div style={{fontSize:11,color:"#94a3b8"}}>{grupAktif.cards.length} panel diarsip</div>
              </div>
            </div>

            <div style={{position:"relative" as const,marginBottom:10}}>
              <i className="ti ti-search" style={{position:"absolute" as const,left:12,top:11,fontSize:15,color:"#94a3b8"}}/>
              <input ref={inputPanelRef} value={cariPanel} onChange={(e:any)=>setCariPanel(e.target.value)} placeholder="Cari panel di WO ini..."
                style={{width:"100%",height:40,padding:cariPanel?"0 38px 0 34px":"0 12px 0 34px",border:"1.5px solid #e2e8f0",borderRadius:10,fontSize:13.5,outline:"none",background:"#fff",color:"#1e293b",boxSizing:"border-box" as const}}/>
              {cariPanel&&(
                <button onClick={()=>setCariPanel("")} aria-label="Hapus pencarian panel"
                  style={{position:"absolute" as const,right:6,top:6,width:28,height:28,borderRadius:99,border:"none",background:"#f1f5f9",color:"#64748b",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <i className="ti ti-x" style={{fontSize:14}}/>
                </button>
              )}
            </div>

            {panelTersaring.length===0?(
              <div style={{textAlign:"center",padding:"24px 16px",background:"#fffbeb",border:"1px solid #fde68a",borderRadius:12}}>
                <i className="ti ti-file-search" style={{fontSize:26,color:"#d97706"}}/>
                <div style={{fontSize:13.5,fontWeight:800,color:"#92400e",marginTop:6}}>Panel tidak ditemukan di WO ini</div>
                <div style={{fontSize:12,color:"#a16207",marginTop:4}}>Tidak ada panel “{cariPanel.trim()}” di WO {grupAktif.woNumber} · {grupAktif.proyek}.</div>
                <div style={{display:"flex",flexDirection:"column" as const,gap:8,marginTop:14}}>
                  <button onClick={()=>{inputPanelRef.current?.focus();inputPanelRef.current?.select();}}
                    style={{border:"1.5px solid #e2e8f0",background:"#fff",color:"#1e293b",borderRadius:10,padding:"10px",fontSize:12.5,fontWeight:700,cursor:"pointer"}}>
                    <i className="ti ti-pencil" style={{marginRight:6}}/>Ubah pencarian
                  </button>
                  <button onClick={()=>setWoKey(null)}
                    style={{border:"1.5px solid #e2e8f0",background:"#fff",color:"#1e293b",borderRadius:10,padding:"10px",fontSize:12.5,fontWeight:700,cursor:"pointer"}}>
                    <i className="ti ti-folders" style={{marginRight:6}}/>Ganti proyek
                  </button>
                  <button onClick={()=>{setSearch(cariPanel.trim());setWoKey(null);}}
                    style={{border:"none",background:"#1d4ed8",color:"#fff",borderRadius:10,padding:"10px",fontSize:12.5,fontWeight:700,cursor:"pointer"}}>
                    <i className="ti ti-search" style={{marginRight:6}}/>Cari “{cariPanel.trim()}” di semua WO
                  </button>
                </div>
              </div>
            ):(
              <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
                {panelTersaring.map(card=>(
                  <div key={card.id} onClick={()=>{setSelectedCard(card);setDetailIndex(0);}}
                    style={{display:"flex",gap:10,alignItems:"center",background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:12,padding:10,cursor:"pointer"}}>
                    <div style={{width:72,height:72,flexShrink:0,display:"grid",gridTemplateColumns:"repeat(2,1fr)",gridTemplateRows:"repeat(2,1fr)",gap:2,borderRadius:8,overflow:"hidden",background:"#f1f5f9"}}>
                      {Array.from({length:4}).map((_,i)=>{
                        const f=card.fotos[i];
                        const sisaFoto=card.fotos.length-4;
                        return(
                          <div key={i} style={{position:"relative" as const,background:"#e2e8f0",overflow:"hidden"}}>
                            {f&&<ThumbMedia url={f.url} video={isVideoFoto(f)}/>}
                            {i===3&&sisaFoto>0&&(
                              <div style={{position:"absolute" as const,inset:0,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                                <span style={{color:"#fff",fontWeight:800,fontSize:11}}>+{sisaFoto}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:800,fontSize:13,color:"#0f172a",overflow:"hidden",textOverflow:"ellipsis" as const,whiteSpace:"nowrap" as const}}>{card.panelNama}</div>
                      <div style={{fontSize:11,color:"#64748b",overflow:"hidden",textOverflow:"ellipsis" as const,whiteSpace:"nowrap" as const,marginTop:2}}>{card.proyek} · WO {card.woNumber}</div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4}}>
                        <span style={{fontSize:10,color:"#94a3b8"}}>{fmtTgl(card.waktuTerbaru)}</span>
                        <span style={{fontSize:10,color:"#94a3b8",flexShrink:0}}>{card.fotos.length} foto</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
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
                <ThumbMedia url={fotoAktif.url} video={isVideoFoto(fotoAktif)} contain/>
              </div>
            </div>

            {card.fotos.length>1&&(
              <div style={{display:"flex",gap:6,overflowX:"auto" as const,padding:"10px 16px",flexShrink:0}}>
                {card.fotos.map((f,fi)=>(
                  <div key={fi} onClick={()=>setDetailIndex(fi)}
                    style={{width:52,height:52,borderRadius:8,overflow:"hidden",cursor:"pointer",flexShrink:0,
                      border:fi===detailIndex?"2px solid #fff":"2px solid transparent",opacity:fi===detailIndex?1:0.5}}>
                    <ThumbMedia url={f.url} video={isVideoFoto(f)}/>
                  </div>
                ))}
              </div>
            )}

            <div style={{background:"#141a29",borderRadius:"16px 16px 0 0",padding:16,marginTop:8,flex:1}}>
              <div style={{display:"flex",flexDirection:"column" as const,gap:11,marginBottom:18}}>
                {[
                  {label:"Tanggal",value:fmtTglJam(fotoAktif.uploaded_at)},
                  {label:"Proyek",value:card.proyek},
                  {label:"Panel",value:card.panelNama},
                  {label:"WO",value:card.woNumber},
                  {label:"Diupload oleh",value:fotoAktif.uploaded_by||"-"},
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
        <FotoZoomViewerPekerja fotos={selectedCard.fotos} startIndex={detailIndex} label={selectedCard.panelNama} onClose={()=>setFotoViewerOpen(false)}/>
      )}
    </>
  );
}
