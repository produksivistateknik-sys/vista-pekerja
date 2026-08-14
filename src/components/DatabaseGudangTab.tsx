import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../lib/supabase";
import { SectionCard, EmptyState } from "./gudang/GudangUI";

// ─────────────────────────────────────────────────────────────────────────────
// TAB DATABASE (dalam GudangHome) - upload master komponen_bbmb_master via
// Excel/CSV (drag-drop atau file picker) + list searchable komponen yang sudah
// terdaftar. Upload MENAMBAHKAN doang - nama yang sudah ada (case-insensitive)
// atau duplikat dalam file di-skip, gak pernah replace/hapus data lama.
// ─────────────────────────────────────────────────────────────────────────────

type ParsedRow={nama:string;tipe:string};
type UploadResult={berhasil:number;skipDuplikat:number;skipKosong:number};

// Kolom A = nama (wajib), kolom B = tipe/spesifikasi (opsional, mis. "SEGI 6" buat
// "BAUT 10X100 KUNCI"). File sumber (database barang.xlsx) TANPA header - baris
// pertama LANGSUNG data. Tetap deteksi header kalau suatu saat ada file YANG PAKAI
// header (baris pertama isinya literal "nama"/"tipe"/dst) - baris itu dilewati,
// selain itu semua baris (termasuk baris pertama) dianggap data.
const HEADER_WORDS=new Set(["nama","tipe","satuan","name","type"]);
const isHeaderRow=(row:any[])=>{
  const a=String(row[0]??"").trim().toLowerCase();
  const b=String(row[1]??"").trim().toLowerCase();
  return HEADER_WORDS.has(a)||HEADER_WORDS.has(b);
};

const parseFileRows=async(file:File):Promise<ParsedRow[]>=>{
  const buf=await file.arrayBuffer();
  const wb=XLSX.read(buf,{type:"array"});
  const sheet=wb.Sheets[wb.SheetNames[0]];
  const rawRows:any[][]=XLSX.utils.sheet_to_json(sheet,{header:1,defval:"",blankrows:false});
  const dataRows=rawRows.length>0&&isHeaderRow(rawRows[0])?rawRows.slice(1):rawRows;
  return dataRows.map(row=>({
    nama:String(row[0]??"").trim(),
    tipe:String(row[1]??"").trim(),
  }));
};

export function DatabaseGudangTab(){
  const[fileName,setFileName]=useState("");
  const[parsed,setParsed]=useState<ParsedRow[]|null>(null);
  const[uploading,setUploading]=useState(false);
  const[result,setResult]=useState<UploadResult|null>(null);
  const[error,setError]=useState("");
  const[dragOver,setDragOver]=useState(false);
  const fileInputRef=useRef<HTMLInputElement>(null);

  const[masterList,setMasterList]=useState<any[]>([]);
  const[loadingList,setLoadingList]=useState(true);
  const[search,setSearch]=useState("");

  const[addOpen,setAddOpen]=useState(false);
  const[addNama,setAddNama]=useState("");
  const[addTipe,setAddTipe]=useState("");
  const[addSubmitting,setAddSubmitting]=useState(false);
  const[addError,setAddError]=useState("");

  const fetchMasterList=async()=>{
    setLoadingList(true);
    const{data}=await supabase.from("komponen_bbmb_master").select("*").order("nama",{ascending:true});
    setMasterList(data??[]);
    setLoadingList(false);
  };

  useEffect(()=>{
    fetchMasterList();
    const ch=supabase.channel("realtime-gudang-master-komponen")
      .on("postgres_changes",{event:"*",schema:"public",table:"komponen_bbmb_master"},fetchMasterList)
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);

  const onFile=async(file:File|null)=>{
    if(!file)return;
    setFileName(file.name);
    setResult(null);
    setError("");
    try{
      const rows=await parseFileRows(file);
      setParsed(rows);
    }catch(e:any){
      setError("Gagal membaca file: "+(e?.message||"format tidak dikenali"));
      setParsed(null);
    }
  };

  const kosongCount=(parsed||[]).filter(r=>!r.nama).length;
  const isiCount=(parsed||[]).length-kosongCount;

  const doUpload=async()=>{
    if(!parsed)return;
    setUploading(true);
    const existing=await supabase.from("komponen_bbmb_master").select("nama").then(r=>r.data??[]);
    const existingSet=new Set(existing.map((r:any)=>r.nama.trim().toLowerCase()));
    const seenInFile=new Set<string>();
    const toInsert:{nama:string;tipe:string|null}[]=[];
    let skipDuplikat=0,skipKosong=0;
    for(const row of parsed){
      if(!row.nama){skipKosong++;continue;}
      const key=row.nama.toLowerCase();
      if(existingSet.has(key)||seenInFile.has(key)){skipDuplikat++;continue;}
      seenInFile.add(key);
      toInsert.push({nama:row.nama,tipe:row.tipe||null});
    }
    if(toInsert.length>0){
      const{error:insErr}=await supabase.from("komponen_bbmb_master").insert(toInsert);
      if(insErr){setError("Gagal upload: "+insErr.message);setUploading(false);return;}
    }
    setResult({berhasil:toInsert.length,skipDuplikat,skipKosong});
    setUploading(false);
    fetchMasterList();
  };

  const resetUpload=()=>{
    setFileName("");setParsed(null);setResult(null);setError("");
    if(fileInputRef.current)fileInputRef.current.value="";
  };

  // Cek duplikat case-insensitive sama persis rule-nya kayak doUpload() di atas, cuma di-scope ke
  // 1 nama (query .ilike langsung ke DB, bukan fetch semua nama) - lebih murah buat tambah 1 item.
  const submitTambahKomponen=async()=>{
    const nama=addNama.trim();
    if(!nama){setAddError("Nama wajib diisi");return;}
    setAddSubmitting(true);
    setAddError("");
    const{data:existing}=await supabase.from("komponen_bbmb_master").select("id").ilike("nama",nama).limit(1);
    if(existing&&existing.length>0){
      setAddError("Komponen dengan nama ini sudah ada");
      setAddSubmitting(false);
      return;
    }
    const{error:insErr}=await supabase.from("komponen_bbmb_master").insert({nama,tipe:addTipe.trim()||null});
    if(insErr){setAddError("Gagal simpan: "+insErr.message);setAddSubmitting(false);return;}
    setAddSubmitting(false);
    setAddNama("");setAddTipe("");setAddOpen(false);
    fetchMasterList();
  };

  const filteredList=masterList.filter((m:any)=>!search||m.nama.toLowerCase().includes(search.toLowerCase()));

  return(
    <div style={{padding:16}} className="fi">
      <SectionCard icon="📤" title="Upload Master Komponen" subtitle="Upload Excel/CSV buat nambah daftar komponen BBMB">
      <div
        onDragOver={(e:any)=>{e.preventDefault();setDragOver(true);}}
        onDragLeave={()=>setDragOver(false)}
        onDrop={(e:any)=>{e.preventDefault();setDragOver(false);onFile(e.dataTransfer.files?.[0]||null);}}
        onClick={()=>fileInputRef.current?.click()}
        style={{border:`2px dashed ${dragOver?"#0369a1":"#cbd5e1"}`,borderRadius:14,padding:"24px 16px",
          textAlign:"center" as const,background:dragOver?"#eff6ff":"#f8fafc",cursor:"pointer",marginBottom:14}}>
        <div style={{fontSize:28,marginBottom:6}}>📤</div>
        <div style={{fontSize:13,fontWeight:700,color:"#334155"}}>Tap buat pilih file, atau drag & drop</div>
        <div style={{fontSize:11,color:"#94a3b8",marginTop:4}}>Excel (.xlsx) atau CSV - kolom A: nama (wajib), kolom B: tipe (opsional)</div>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={(e:any)=>onFile(e.target.files?.[0]||null)} style={{display:"none"}}/>
      </div>

      {error&&<div style={{background:"#fef2f2",border:"1px solid #fecaca",color:"#dc2626",borderRadius:10,padding:"10px 12px",fontSize:12,marginBottom:14}}>{error}</div>}

      {parsed&&!result&&(
        <div style={{background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:14,padding:14,marginBottom:14}}>
          <div style={{fontSize:12.5,color:"#475569",marginBottom:12}}>
            <strong>{fileName}</strong> — {parsed.length} baris terdeteksi ({isiCount} ada nama{kosongCount>0?`, ${kosongCount} kosong (dilewati)`:""}).
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={resetUpload} style={{flex:1,padding:"11px",borderRadius:10,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#64748b",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Batal</button>
            <button onClick={doUpload} disabled={uploading||isiCount===0}
              style={{flex:1,padding:"11px",borderRadius:10,border:"none",
                background:uploading||isiCount===0?"#94a3b8":"#16a34a",color:"#fff",fontWeight:700,fontSize:13,
                cursor:uploading||isiCount===0?"default":"pointer",fontFamily:"inherit"}}>
              {uploading?"Mengunggah...":`Upload (${isiCount})`}
            </button>
          </div>
        </div>
      )}

      {result&&(
        <div style={{background:"#f0fdf4",border:"1.5px solid #bbf7d0",borderRadius:14,padding:14,marginBottom:14,fontSize:13,color:"#166534",lineHeight:1.9}}>
          ✅ <strong>{result.berhasil}</strong> komponen berhasil ditambahkan.<br/>
          {result.skipDuplikat>0&&<>⏭ {result.skipDuplikat} baris dilewati (nama sudah ada / duplikat).<br/></>}
          {result.skipKosong>0&&<>⏭ {result.skipKosong} baris dilewati (kolom nama kosong).<br/></>}
          <button onClick={resetUpload} style={{marginTop:8,padding:"8px 16px",borderRadius:9,border:"1px solid #bbf7d0",background:"#fff",color:"#16a34a",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Upload File Lain</button>
        </div>
      )}
      </SectionCard>

      <SectionCard icon="🗄️" title="Komponen Terdaftar" subtitle="Cari & kelola daftar komponen BBMB"
        right={
          <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
            <span style={{background:"#eff6ff",color:"#1d4ed8",borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700}}>{masterList.length} total</span>
            <button onClick={()=>{setAddOpen(o=>!o);setAddError("");}}
              style={{padding:"5px 10px",borderRadius:8,border:"1px solid #cbd5e1",background:addOpen?"#f1f5f9":"#fff",
                color:"#334155",fontWeight:700,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>
              + Tambah
            </button>
          </div>
        }>
      {addOpen&&(
        <div style={{background:"#f8fafc",border:"1.5px solid #e2e8f0",borderRadius:12,padding:12,marginBottom:12}}>
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:10}}>
            <input value={addNama} onChange={(e:any)=>{setAddNama(e.target.value);setAddError("");}} placeholder="Nama komponen (wajib)"
              style={{width:"100%",padding:"9px 11px",borderRadius:9,border:"1.5px solid #cbd5e1",fontSize:13,fontWeight:600,color:"#0f172a",background:"#fff",fontFamily:"inherit"}}/>
            <input value={addTipe} onChange={(e:any)=>setAddTipe(e.target.value)} placeholder="Tipe / spesifikasi (opsional)"
              style={{width:"100%",padding:"9px 11px",borderRadius:9,border:"1.5px solid #cbd5e1",fontSize:13,fontWeight:600,color:"#0f172a",background:"#fff",fontFamily:"inherit"}}/>
          </div>
          {addError&&<div style={{fontSize:11.5,color:"#dc2626",marginBottom:10,fontWeight:600}}>{addError}</div>}
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>{setAddOpen(false);setAddNama("");setAddTipe("");setAddError("");}}
              style={{flex:1,padding:"9px",borderRadius:9,border:"1px solid #e2e8f0",background:"#fff",color:"#64748b",fontWeight:700,fontSize:12.5,cursor:"pointer",fontFamily:"inherit"}}>
              Batal
            </button>
            <button onClick={submitTambahKomponen} disabled={addSubmitting}
              style={{flex:1,padding:"9px",borderRadius:9,border:"none",
                background:addSubmitting?"#94a3b8":"#16a34a",color:"#fff",fontWeight:700,fontSize:12.5,
                cursor:addSubmitting?"default":"pointer",fontFamily:"inherit"}}>
              {addSubmitting?"Menyimpan...":"Simpan"}
            </button>
          </div>
        </div>
      )}
      <input value={search} onChange={(e:any)=>setSearch(e.target.value)} placeholder="🔍 Cari nama komponen..."
        style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid #cbd5e1",fontSize:14,fontFamily:"inherit",marginBottom:10}}/>
      {loadingList?(
        <div style={{textAlign:"center",padding:24,color:"#94a3b8",fontSize:13}}>Memuat...</div>
      ):filteredList.length===0?(
        <EmptyState title={search?"Tidak ditemukan":"Belum ada komponen"}
          description={search?"Gak ada komponen yang cocok dengan pencarian.":"Upload file Excel/CSV di atas buat mulai isi daftar komponen BBMB."}/>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:360,overflowY:"auto" as const}}>
          {filteredList.map((m:any)=>(
            <div key={m.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"#f8fafc",borderRadius:9,padding:"9px 12px"}}>
              <span style={{fontSize:13,fontWeight:600,color:"#334155"}}>{m.nama}</span>
              {m.tipe&&<span style={{fontSize:10.5,color:"#94a3b8",fontWeight:600}}>{m.tipe}</span>}
            </div>
          ))}
        </div>
      )}
      </SectionCard>
    </div>
  );
}
