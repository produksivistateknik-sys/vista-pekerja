import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { uploadToR2 } from "../lib/r2Client";
import { ocrDocument, detectFileType, OCR_CONFIDENCE_THRESHOLD } from "../lib/ocrHelpers";
import { MediaPickerSheet } from "./ui/MediaPickerSheet";
import { SectionCard, EmptyState } from "./ui/Primitives";

// ─────────────────────────────────────────────────────────────────────────────
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
type MomFat={id:number,judul:string,file_url:string,file_type:string,status:string,operator_nama:string,created_at:string};
type Poin={id:number,mom_fat_id:number,urutan:number,teks:string,selesai:boolean,ocr_confidence:number|null,dicentang_oleh:string|null};

export function MomFatView({user}:{user:any}){
  const[mode,setMode]=useState<"list"|"upload"|"detail">("list");
  const[loading,setLoading]=useState(true);
  const[list,setList]=useState<MomFat[]>([]);
  const[progressMap,setProgressMap]=useState<Record<number,{done:number,total:number}>>({});

  const fetchList=async()=>{
    setLoading(true);
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
    setLoading(false);
  };
  useEffect(()=>{
    fetchList();
    const ch=supabase.channel("realtime-mom-fat-list")
      .on("postgres_changes",{event:"*",schema:"public",table:"mom_fat"},fetchList)
      .on("postgres_changes",{event:"*",schema:"public",table:"mom_fat_poin"},fetchList)
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);

  // ── Upload ──
  const[uploadFile,setUploadFile]=useState<File|null>(null);
  const[judul,setJudul]=useState("");
  const[uploading,setUploading]=useState(false);
  const[ocrProgress,setOcrProgress]=useState(0);
  const[ocrStage,setOcrStage]=useState<""|"upload"|"ocr"|"simpan">("");

  const pilihFile=(files:FileList|null)=>{
    if(!files||files.length===0)return;
    const f=files[0];
    if(!detectFileType(f)){alert("File harus berupa PDF atau foto (JPG/PNG).");return;}
    setUploadFile(f);
  };

  const prosesUpload=async()=>{
    if(!uploadFile){alert("Pilih dokumen dulu (PDF/foto).");return;}
    if(!judul.trim()){alert("Judul/nama dokumen wajib diisi.");return;}
    const fileType=detectFileType(uploadFile);
    if(!fileType)return;
    setUploading(true);
    let momFatId:number|null=null;
    try{
      setOcrStage("upload");
      const ext=fileType==="pdf"?"pdf":(uploadFile.type.split("/")[1]||"jpg");
      const key=`mom-fat/${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`;
      const fileUrl=await uploadToR2(uploadFile,key,uploadFile.type);

      const{data:row,error}=await supabase.from("mom_fat" as any).insert({
        judul:judul.trim(),file_url:fileUrl,file_type:fileType,status:"processing",
        pekerja_id:user.id,operator_nama:user.nama||user.name||"Operator",
      }).select().single();
      if(error||!row){alert("Gagal simpan record: "+(error?.message||"unknown error"));setUploading(false);return;}
      momFatId=(row as any).id;

      setOcrStage("ocr");
      const lines=await ocrDocument(uploadFile,setOcrProgress);

      setOcrStage("simpan");
      if(lines.length>0){
        const rows=lines.map((l,i)=>({mom_fat_id:momFatId,urutan:i+1,teks:l.teks,ocr_confidence:l.confidence}));
        await supabase.from("mom_fat_poin" as any).insert(rows);
      }
      await supabase.from("mom_fat" as any).update({status:"ready",updated_at:new Date().toISOString()}).eq("id",momFatId);

      setUploadFile(null);setJudul("");setOcrProgress(0);setOcrStage("");
      setMode("list");
      fetchList();
    }catch(err:any){
      if(momFatId)await supabase.from("mom_fat" as any).update({status:"error"}).eq("id",momFatId);
      alert("Gagal proses OCR: "+(err?.message||"unknown error")+"\n\nDokumen tetap tersimpan, coba lagi atau isi checklist manual.");
      setMode("list");
      fetchList();
    }
    setUploading(false);
  };

  // ── Detail/checklist ──
  const[activeMomFat,setActiveMomFat]=useState<MomFat|null>(null);
  const[poinList,setPoinList]=useState<Poin[]>([]);
  const[editingId,setEditingId]=useState<number|null>(null);
  const[editText,setEditText]=useState("");
  const[tambahText,setTambahText]=useState("");

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
    await supabase.from("mom_fat_poin" as any).update({
      selesai:selesaiBaru,
      dicentang_oleh:selesaiBaru?(user.nama||user.name||"Operator"):null,
      dicentang_at:selesaiBaru?new Date().toISOString():null,
    }).eq("id",p.id);
  };

  const mulaiEdit=(p:Poin)=>{setEditingId(p.id);setEditText(p.teks);};
  const simpanEdit=async(p:Poin)=>{
    const teksBaru=editText.trim();
    setEditingId(null);
    if(!teksBaru||teksBaru===p.teks)return;
    setPoinList(prev=>prev.map(x=>x.id===p.id?{...x,teks:teksBaru}:x));
    await supabase.from("mom_fat_poin" as any).update({teks:teksBaru}).eq("id",p.id);
  };

  const hapusPoin=async(p:Poin)=>{
    if(!confirm("Hapus poin ini? (biasanya dipakai buat buang baris hasil OCR yang bukan checklist, misal header/tanda tangan)"))return;
    setPoinList(prev=>prev.filter(x=>x.id!==p.id));
    await supabase.from("mom_fat_poin" as any).delete().eq("id",p.id);
  };

  const tambahPoin=async()=>{
    if(!tambahText.trim()||!activeMomFat)return;
    const urutanBaru=poinList.length>0?Math.max(...poinList.map(p=>p.urutan))+1:1;
    const teks=tambahText.trim();
    setTambahText("");
    await supabase.from("mom_fat_poin" as any).insert({mom_fat_id:activeMomFat.id,urutan:urutanBaru,teks,ocr_confidence:null});
    fetchPoin(activeMomFat.id);
  };

  const statusLabel:any={processing:{bg:"#fffbeb",color:"#d97706",label:"Proses OCR..."},ready:{bg:"#f0fdf4",color:"#16a34a",label:"Siap"},error:{bg:"#fef2f2",color:"#dc2626",label:"Gagal OCR"}};

  if(mode==="detail"&&activeMomFat){
    const total=poinList.length;
    const done=poinList.filter(p=>p.selesai).length;
    return(
      <div style={{padding:16}}>
        <button onClick={()=>{setMode("list");setActiveMomFat(null);}} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:"#2563eb",fontWeight:700,fontSize:13,cursor:"pointer",marginBottom:12,padding:0}}>
          <i className="ti ti-arrow-left"/> Kembali
        </button>
        <SectionCard icon="📋" title={activeMomFat.judul} subtitle={`${done}/${total} poin selesai · oleh ${activeMomFat.operator_nama}`}>
          <a href={activeMomFat.file_url} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",gap:6,fontSize:12,fontWeight:700,color:"#2563eb",marginBottom:14,textDecoration:"none"}}>
            <i className="ti ti-file-description"/> Lihat dokumen asli
          </a>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {poinList.map(p=>{
              const kurangYakin=p.ocr_confidence!=null&&p.ocr_confidence<OCR_CONFIDENCE_THRESHOLD;
              return(
                <div key={p.id} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 12px",background:p.selesai?"#f0fdf4":"#f8fafc",borderRadius:10,border:"1px solid "+(p.selesai?"#bbf7d0":"#e2e8f0")}}>
                  <input type="checkbox" checked={p.selesai} onChange={()=>toggleCentang(p)} style={{width:18,height:18,marginTop:1,flexShrink:0,cursor:"pointer"}}/>
                  <div style={{flex:1,minWidth:0}}>
                    {editingId===p.id?(
                      <input autoFocus value={editText} onChange={e=>setEditText(e.target.value)} onBlur={()=>simpanEdit(p)}
                        onKeyDown={e=>{if(e.key==="Enter")(e.target as HTMLInputElement).blur();}}
                        style={{width:"100%",padding:"6px 8px",borderRadius:6,border:"1.5px solid #2563eb",fontSize:13,fontFamily:"inherit",boxSizing:"border-box"}}/>
                    ):(
                      <div onClick={()=>mulaiEdit(p)} style={{fontSize:13,color:p.selesai?"#16a34a":"#1e293b",textDecoration:p.selesai?"line-through":"none",cursor:"text",lineHeight:1.5}}>{p.teks}</div>
                    )}
                    <div style={{display:"flex",gap:6,alignItems:"center",marginTop:4,flexWrap:"wrap"}}>
                      {kurangYakin&&<span style={{fontSize:9.5,fontWeight:800,color:"#d97706",background:"#fffbeb",borderRadius:20,padding:"1px 8px"}}>⚠️ Cek manual (hasil OCR kurang yakin)</span>}
                      {p.dicentang_oleh&&<span style={{fontSize:10,color:"#94a3b8"}}>✓ {p.dicentang_oleh}</span>}
                    </div>
                  </div>
                  <button onClick={()=>hapusPoin(p)} style={{background:"none",border:"none",color:"#cbd5e1",cursor:"pointer",padding:2,flexShrink:0}} title="Hapus poin">
                    <i className="ti ti-x" style={{fontSize:14}}/>
                  </button>
                </div>
              );
            })}
          </div>
          <div style={{display:"flex",gap:8,marginTop:14}}>
            <input value={tambahText} onChange={e=>setTambahText(e.target.value)} placeholder="Tambah poin manual..."
              onKeyDown={e=>{if(e.key==="Enter")tambahPoin();}}
              style={{flex:1,padding:"10px 12px",borderRadius:10,border:"1.5px solid #e2e8f0",fontSize:13,fontFamily:"inherit",boxSizing:"border-box"}}/>
            <button onClick={tambahPoin} style={{padding:"10px 16px",borderRadius:10,border:"none",background:"#1d4ed8",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>+ Tambah</button>
          </div>
        </SectionCard>
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
        <button onClick={()=>setMode("upload")} style={{flex:1,padding:"10px",borderRadius:10,border:"none",cursor:"pointer",
          fontSize:12.5,fontWeight:700,background:mode==="upload"?"#1d4ed8":"#e2e8f0",color:mode==="upload"?"#fff":"#64748b"}}>
          ➕ Upload Dokumen
        </button>
      </div>

      {mode==="upload"?(
        <SectionCard icon="📄" title="Upload Dokumen MOM FAT">
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div>
              <label style={{fontSize:11,fontWeight:700,color:"#64748b",display:"block",marginBottom:4}}>Judul Dokumen</label>
              <input value={judul} onChange={e=>setJudul(e.target.value)} placeholder="mis. FAT CIMORY CITEUREUP - 19 Agustus 2026" disabled={uploading}
                style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid #e2e8f0",fontSize:13,fontFamily:"inherit",boxSizing:"border-box"}}/>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:700,color:"#64748b",display:"block",marginBottom:4}}>Dokumen (PDF atau Foto)</label>
              <MediaPickerSheet onFiles={pilihFile} allowAnyFile multiple={false} disabled={uploading}
                triggerStyle={{display:"flex",alignItems:"center",gap:8,padding:"14px",borderRadius:10,border:"1.5px dashed #cbd5e1",background:"#f8fafc",cursor:uploading?"default":"pointer"}}>
                <i className="ti ti-upload" style={{fontSize:18,color:"#64748b"}}/>
                <span style={{fontSize:12.5,color:"#64748b",fontWeight:600}}>{uploadFile?uploadFile.name:"Pilih file PDF atau foto scan..."}</span>
              </MediaPickerSheet>
            </div>
            {uploading&&(
              <div style={{textAlign:"center",padding:16,background:"#eff6ff",borderRadius:10}}>
                <div style={{fontSize:12.5,fontWeight:700,color:"#1d4ed8",marginBottom:6}}>
                  {ocrStage==="upload"?"Mengupload dokumen...":ocrStage==="ocr"?`Membaca dokumen (OCR)... ${ocrProgress}%`:"Menyimpan checklist..."}
                </div>
                <div style={{fontSize:11,color:"#64748b"}}>Proses ini bisa makan waktu sampai ~30 detik tergantung ukuran dokumen.</div>
              </div>
            )}
            <button onClick={prosesUpload} disabled={uploading}
              style={{width:"100%",padding:13,fontSize:14,fontWeight:700,color:"#fff",background:"#1d4ed8",
                border:"none",borderRadius:10,cursor:uploading?"default":"pointer",fontFamily:"inherit",opacity:uploading?.7:1}}>
              {uploading?"Memproses...":"Upload & Baca Dokumen"}
            </button>
          </div>
        </SectionCard>
      ):(
        <SectionCard icon="📋" title="Dokumen MOM FAT" subtitle={loading?"Memuat...":`${list.length} dokumen`}>
          {loading?(
            <div style={{textAlign:"center",padding:20,color:"#94a3b8",fontSize:12}}>Memuat...</div>
          ):list.length===0?(
            <EmptyState title="Belum ada dokumen" description={'Upload dokumen MOM FAT pertama lewat tab "Upload Dokumen".'} variant="box-paper"/>
          ):list.map(m=>{
            const st=statusLabel[m.status]||statusLabel.processing;
            const prog=progressMap[m.id]||{done:0,total:0};
            return(
              <div key={m.id} onClick={()=>m.status==="ready"&&bukaDetail(m)} style={{border:"1px solid #f1f5f9",borderRadius:12,marginBottom:8,padding:"12px 14px",cursor:m.status==="ready"?"pointer":"default"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                  <div style={{minWidth:0,flex:1}}>
                    <div style={{fontWeight:700,fontSize:13,color:"#1e293b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.judul}</div>
                    <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>👤 {m.operator_nama} · {m.status==="ready"?`${prog.done}/${prog.total} poin`:""}</div>
                  </div>
                  <span style={{background:st.bg,color:st.color,borderRadius:20,padding:"3px 10px",fontSize:10.5,fontWeight:700,flexShrink:0}}>{st.label}</span>
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
      )}
    </div>
  );
}
