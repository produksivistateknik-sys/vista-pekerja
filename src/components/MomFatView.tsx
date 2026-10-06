import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { hapusFotoDariStorage } from "../lib/fotoHelpers";
import { unggahMediaKeR2 } from "../lib/siapkanMedia";
import { isVideoFoto } from "../lib/mediaThumb";
import { ThumbMedia } from "./ui/ThumbMedia";
import { MediaPickerSheet } from "./ui/MediaPickerSheet";
import { FotoZoomViewerPekerja, type FotoViewerPekerja } from "./FotoZoomViewerPekerja";
import { SectionCard, EmptyState } from "./ui/Primitives";
import { alertGagalSimpan } from "../lib/koneksi";

// ─────────────────────────────────────────────────────────────────────────────
// REVISI ALUR (3 Okt 2026, diminta user): QC TIDAK upload dokumen / edit poin lagi - Admin &
// Engineering yang upload MOM + menyusun poin di vista-teknik (Report Produksi > MOM FAT, OCR +
// koreksi). Di sini QC cuma lihat dokumen, CENTANG poin & tambah foto. (Upload QC dulu sering gagal
// "Failed to send a request to the Edge Function" dari HP.) Keterangan asli di bawah:
// MOM FAT (30 Agu 2026) - OCR checklist utk QC, dari dokumen Minutes of Meeting Factory
// Acceptance Test (PDF/foto scan). BERDIRI SENDIRI (bukan terkait WO/panel manapun), dan
// SEMUA QC bisa lihat+lanjutkan dokumen yang diupload QC lain (dikonfirmasi: dokumen ini
// catatan tim/proyek, bukan personal seperti proyek_luar).
//
// OCR (Tesseract.js + pdf.js, lihat ocrHelpers.ts) jalan sekali pas upload, hasilnya
// disimpan permanen ke mom_fat_poin - bukan di-run ulang tiap kali halaman dibuka.
// Tesseract LEMAH baca tulisan tangan (keterbatasan OCR non-AI) - baris confidence rendah
// dikasih badge "cek manual" (lihat OCR_CONFIDENCE_THRESHOLD).
// ─────────────────────────────────────────────────────────────────────────────
type MomFat={id:number,judul:string,file_url:string,file_type:string,status:string,operator_nama:string,created_at:string,is_archived:boolean};
type Poin={id:number,mom_fat_id:number,urutan:number,teks:string,selesai:boolean,ocr_confidence:number|null,dicentang_oleh:string|null,foto:FotoViewerPekerja[]};

export function MomFatView({user,registerBackHandler}:{user:any,registerBackHandler?:(fn:(()=>boolean)|null)=>void}){
  const[mode,setMode]=useState<"list"|"detail"|"arsip">("list");
  // Navigasi Kembali per-level (7 Sep 2026) - lihat komentar sama di KomponenPasangView.tsx.
  // "upload"/"arsip" itu TAB (peer), bukan level - cuma "detail" yang perlu mundur ke "list".
  const[loading,setLoading]=useState(true);
  const[list,setList]=useState<MomFat[]>([]);
  const[progressMap,setProgressMap]=useState<Record<number,{done:number,total:number}>>({});
  const[search,setSearch]=useState("");

  // silent (4 Sep 2026, fix pola sama RiwayatGudangTab.tsx) - dipakai listener realtime di bawah
  // (tanpa filter, semua QC pakai dokumen yang sama) biar list gak "berkedip" tiap ada QC lain
  // yang upload/centang poin dokumen manapun.
  const fetchList=async(silent=false)=>{
    if(!silent)setLoading(true);
    const{data}=await supabase.from("mom_fat" as any).select("*").order("created_at",{ascending:false}).limit(200);
    setList(data||[]);
    const{data:poinAll}=await supabase.from("mom_fat_poin" as any).select("mom_fat_id,selesai");
    const map:Record<number,{done:number,total:number}>={};
    (poinAll||[]).forEach((p:any)=>{
      if(!map[p.mom_fat_id])map[p.mom_fat_id]={done:0,total:0};
      map[p.mom_fat_id].total++;
      if(p.selesai)map[p.mom_fat_id].done++;
    });
    setProgressMap(map);
    if(!silent)setLoading(false);
  };
  useEffect(()=>{
    fetchList();
    const ch=supabase.channel("realtime-mom-fat-list")
      .on("postgres_changes",{event:"*",schema:"public",table:"mom_fat"},()=>fetchList(true))
      .on("postgres_changes",{event:"*",schema:"public",table:"mom_fat_poin"},()=>fetchList(true))
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);

  // ── Detail/checklist ──
  const[activeMomFat,setActiveMomFat]=useState<MomFat|null>(null);
  useEffect(()=>{
    registerBackHandler?.(()=>{
      if(mode==="detail"){setMode("list");setActiveMomFat(null);return true;}
      return false;
    });
    return()=>registerBackHandler?.(null);
  },[mode]);
  const[poinList,setPoinList]=useState<Poin[]>([]);
  const[uploadingPoinId,setUploadingPoinId]=useState<number|null>(null);
  const[fotoViewer,setFotoViewer]=useState<{fotos:FotoViewerPekerja[],startIndex:number,label:string}|null>(null);

  const bukaDetail=(m:MomFat)=>{setActiveMomFat(m);setMode("detail");};

  const fetchPoin=async(momFatId:number)=>{
    const{data}=await supabase.from("mom_fat_poin" as any).select("*").eq("mom_fat_id",momFatId).order("urutan",{ascending:true});
    setPoinList(data||[]);
  };
  useEffect(()=>{
    if(mode!=="detail"||!activeMomFat)return;
    fetchPoin(activeMomFat.id);
    const ch=supabase.channel("realtime-mom-fat-poin-"+activeMomFat.id)
      .on("postgres_changes",{event:"*",schema:"public",table:"mom_fat_poin"},(payload:any)=>{
        const row=payload.new||payload.old;
        if(row?.mom_fat_id===activeMomFat.id)fetchPoin(activeMomFat.id);
      })
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[mode,activeMomFat?.id]);

  const toggleCentang=async(p:Poin)=>{
    const selesaiBaru=!p.selesai;
    setPoinList(prev=>prev.map(x=>x.id===p.id?{...x,selesai:selesaiBaru}:x));
    // Cek error (3 Okt 2026) - centang sekarang satu-satunya tugas QC di MOM FAT; dulu hasil
    // diabaikan, centang yang gagal tersimpan tetap kelihatan tercentang.
    const{error}=await supabase.from("mom_fat_poin" as any).update({
      selesai:selesaiBaru,
      dicentang_oleh:selesaiBaru?(user.nama||user.name||"Operator"):null,
      dicentang_at:selesaiBaru?new Date().toISOString():null,
    }).eq("id",p.id);
    if(error){
      setPoinList(prev=>prev.map(x=>x.id===p.id?{...x,selesai:p.selesai}:x));
      alertGagalSimpan(error,`Centang MOM FAT poin ${p.id}`,{aksi:"simpan centang",ulangi:"centang"});
    }
  };

  // Foto/video (6 Okt 2026) - tiap file dicoba sendiri-sendiri: yang berhasil TETAP disimpan walau
  // ada yang gagal (dulu 1 gagal = semua batal, file yang sudah naik jadi yatim di R2), yang gagal
  // disebutkan namanya supaya operator tahu harus pilih ulang.
  const uploadFotoPoin=async(p:Poin,files:FileList)=>{
    setUploadingPoinId(p.id);
    const fotoBaru:FotoViewerPekerja[]=[];
    const gagal:string[]=[];
    for(const file of Array.from(files)){
      try{
        const m=await unggahMediaKeR2(file,`mom-fat/${p.mom_fat_id}/${p.id}`);
        fotoBaru.push({url:m.url,mime:m.mime,name:m.name,uploaded_by:user.nama||user.name||"Operator",uploaded_at:new Date().toISOString()});
      }catch(err:any){
        console.error("Upload dokumentasi MOM FAT gagal:",file.name,err);
        gagal.push("• "+file.name+" - "+(err?.message||"unknown error"));
      }
    }
    if(fotoBaru.length>0){
      const newFoto=[...(p.foto||[]),...fotoBaru];
      const{error:fErr}=await supabase.from("mom_fat_poin" as any).update({foto:newFoto}).eq("id",p.id);
      if(fErr)alertGagalSimpan(fErr,`Simpan foto MOM FAT poin ${p.id}`,{aksi:"simpan foto/video",ulangi:"Tambah Foto"});
      else setPoinList(prev=>prev.map(x=>x.id===p.id?{...x,foto:newFoto}:x));
    }
    if(gagal.length>0)alert(`${gagal.length} foto/video gagal diunggah:\n${gagal.join("\n")}\n\nPilih ulang lewat "Tambah Foto".`);
    setUploadingPoinId(null);
  };

  const hapusFotoPoin=async(p:Poin,fotoUrl:string)=>{
    if(!window.confirm("Hapus foto ini?"))return;
    const newFoto=(p.foto||[]).filter(f=>f.url!==fotoUrl);
    setPoinList(prev=>prev.map(x=>x.id===p.id?{...x,foto:newFoto}:x));
    // Referensi DB dihapus DULU, file storage baru dihapus kalau DB berhasil (6 Okt 2026 - dulu
    // kebalik: DB gagal = foto masih tercatat tapi filenya sudah hilang, jadi tautan rusak).
    const{error}=await supabase.from("mom_fat_poin" as any).update({foto:newFoto}).eq("id",p.id);
    if(error){fetchPoin(p.mom_fat_id);alertGagalSimpan(error,`Hapus foto MOM FAT poin ${p.id}`,{aksi:"hapus foto"});return;}
    await hapusFotoDariStorage("mom-fat-photos",fotoUrl);
  };

  const statusLabel:any={processing:{bg:"#fffbeb",color:"#d97706",label:"Proses OCR..."},ready:{bg:"#f0fdf4",color:"#16a34a",label:"Siap"},error:{bg:"#fef2f2",color:"#dc2626",label:"Gagal OCR"}};

  if(mode==="detail"&&activeMomFat){
    const total=poinList.length;
    const done=poinList.filter(p=>p.selesai).length;
    return(
      <div style={{padding:16}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <button onClick={()=>{setMode("list");setActiveMomFat(null);}} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:"#2563eb",fontWeight:700,fontSize:13,cursor:"pointer",padding:0}}>
            <i className="ti ti-arrow-left"/> Kembali
          </button>
        </div>
        <SectionCard icon="📋" title={activeMomFat.judul} subtitle={`${done}/${total} poin selesai · diupload ${activeMomFat.operator_nama}`}>
          <a href={activeMomFat.file_url} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",gap:6,fontSize:12,fontWeight:700,color:"#2563eb",marginBottom:14,textDecoration:"none"}}>
            <i className="ti ti-file-description"/> Lihat dokumen asli
          </a>
          <div style={{display:"flex",flexDirection:"column",gap:8,textAlign:"left"}}>
            {poinList.map(p=>{
              return(
                <div key={p.id} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 12px",background:p.selesai?"#f0fdf4":"#f8fafc",borderRadius:10,border:"1px solid "+(p.selesai?"#bbf7d0":"#e2e8f0")}}>
                  <input type="checkbox" checked={p.selesai} onChange={()=>toggleCentang(p)} style={{width:18,height:18,marginTop:1,flexShrink:0,cursor:"pointer"}}/>
                  <div style={{flex:1,minWidth:0,textAlign:"left"}}>
                    <div onClick={()=>toggleCentang(p)} style={{textAlign:"left",fontSize:13,color:p.selesai?"#16a34a":"#1e293b",textDecoration:p.selesai?"line-through":"none",cursor:"pointer",lineHeight:1.5}}>{p.teks}</div>
                    <div style={{display:"flex",gap:6,alignItems:"center",marginTop:4,flexWrap:"wrap"}}>
                      {p.dicentang_oleh&&<span style={{fontSize:10,color:"#94a3b8"}}>✓ {p.dicentang_oleh}</span>}
                    </div>
                    <div style={{marginTop:6}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:5}}>
                        {(p.foto||[]).length>0&&<span style={{fontSize:9.5,fontWeight:600,color:"#64748b"}}>Foto {p.foto.length}</span>}
                        <MediaPickerSheet allowVideo disabled={uploadingPoinId===p.id}
                          triggerStyle={{display:"flex",alignItems:"center",gap:4,cursor:"pointer",color:"#2563eb",fontSize:10.5,fontWeight:600,marginLeft:"auto"}}
                          onFiles={(files)=>uploadFotoPoin(p,files)}>
                          <i className={uploadingPoinId===p.id?"ti ti-loader-2":"ti ti-camera-plus"} style={{fontSize:12}}/>
                          Tambah Foto
                        </MediaPickerSheet>
                      </div>
                      {(p.foto||[]).length>0&&(
                        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:5}}>
                          {p.foto.map((f,fi)=>(
                            <div key={fi} style={{position:"relative",aspectRatio:"1",borderRadius:7,overflow:"hidden",cursor:"pointer",background:"#f1f5f9"}}
                              onClick={()=>setFotoViewer({fotos:p.foto,startIndex:fi,label:p.teks})}>
                              <ThumbMedia url={f.url} video={isVideoFoto(f)}/>
                              <button onClick={(e)=>{e.stopPropagation();hapusFotoPoin(p,f.url);}}
                                style={{position:"absolute",top:2,right:2,width:15,height:15,borderRadius:99,background:"rgba(15,23,42,0.6)",color:"#fff",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                                <i className="ti ti-x" style={{fontSize:8}}/>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
        {fotoViewer&&<FotoZoomViewerPekerja fotos={fotoViewer.fotos} startIndex={fotoViewer.startIndex} label={fotoViewer.label} onClose={()=>setFotoViewer(null)}/>}
      </div>
    );
  }

  return(
    <div style={{padding:16}}>
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        <button onClick={()=>setMode("list")} style={{flex:1,padding:"10px",borderRadius:10,border:"none",cursor:"pointer",
          fontSize:12.5,fontWeight:700,background:mode==="list"?"#1d4ed8":"#e2e8f0",color:mode==="list"?"#fff":"#64748b"}}>
          📋 Daftar Dokumen
        </button>
        <button onClick={()=>setMode("arsip")} style={{flex:1,padding:"10px",borderRadius:10,border:"none",cursor:"pointer",
          fontSize:12.5,fontWeight:700,background:mode==="arsip"?"#1d4ed8":"#e2e8f0",color:mode==="arsip"?"#fff":"#64748b"}}>
          🗄️ Arsip
        </button>
      </div>

      {(()=>{
        const isArsip=mode==="arsip";
        const q=search.trim().toLowerCase();
        const filteredList=list.filter(m=>{
          const matchQ=!q||(m.judul||"").toLowerCase().includes(q)||(m.operator_nama||"").toLowerCase().includes(q);
          if(!matchQ)return false;
          return isArsip?m.is_archived:(q?true:!m.is_archived);
        });
        return(
        <SectionCard icon={isArsip?"🗄️":"📋"} title={isArsip?"Arsip Dokumen":"Dokumen MOM FAT"} subtitle={loading?"Memuat...":`${filteredList.length} dokumen`}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari judul dokumen / operator..."
            style={{width:"100%",padding:"9px 12px",borderRadius:10,border:"1.5px solid #e2e8f0",fontSize:13,fontFamily:"inherit",boxSizing:"border-box",marginBottom:12}}/>
          {loading?(
            <div style={{textAlign:"center",padding:20,color:"#94a3b8",fontSize:12}}>Memuat...</div>
          ):filteredList.length===0?(
            <EmptyState title={isArsip?"Belum ada dokumen diarsip":"Belum ada dokumen"} description={isArsip?"Dokumen yang diarsipkan Admin/Engineering akan muncul di sini.":(q?"Tidak ada dokumen yang cocok.":'Dokumen MOM FAT diupload oleh Admin/Engineering di Vista Teknik - akan muncul di sini.')} variant="box-paper"/>
          ):filteredList.map(m=>{
            const st=statusLabel[m.status]||statusLabel.processing;
            const prog=progressMap[m.id]||{done:0,total:0};
            return(
              <div key={m.id} onClick={()=>m.status==="ready"&&bukaDetail(m)} style={{border:"1px solid #f1f5f9",borderRadius:12,marginBottom:8,padding:"12px 14px",cursor:m.status==="ready"?"pointer":"default"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                  <div style={{minWidth:0,flex:1}}>
                    <div style={{fontWeight:700,fontSize:13,color:"#1e293b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.judul}</div>
                    <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>👤 {m.operator_nama} · {m.status==="ready"?`${prog.done}/${prog.total} poin`:""}</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:5,flexShrink:0}}>
                    {m.is_archived&&<span style={{background:"#f1f5f9",color:"#64748b",borderRadius:20,padding:"3px 10px",fontSize:10.5,fontWeight:700}}>Arsip</span>}
                    <span style={{background:st.bg,color:st.color,borderRadius:20,padding:"3px 10px",fontSize:10.5,fontWeight:700}}>{st.label}</span>
                  </div>
                </div>
                {m.status==="ready"&&prog.total>0&&(
                  <div style={{height:6,background:"#e2e8f0",borderRadius:99,marginTop:8,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${Math.round((prog.done/prog.total)*100)}%`,background:"#16a34a",borderRadius:99}}/>
                  </div>
                )}
              </div>
            );
          })}
        </SectionCard>
        );
      })()}
    </div>
  );
}
