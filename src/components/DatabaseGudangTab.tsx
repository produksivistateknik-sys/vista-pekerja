import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../lib/supabase";
import { SectionCard, EmptyState, SegmentedControl } from "./gudang/GudangUI";

// ─────────────────────────────────────────────────────────────────────────────
// TAB DATABASE (dalam GudangHome) - upload master komponen via Excel/CSV +
// list searchable komponen yang sudah terdaftar. REVISI (2 Sep 2026, biar
// konsisten sama komponen_master baru dari import DATABASE_BARU - REVISI.xlsx,
// 1.974 baris BBMB+BBMU) - tab ini dulu BBMB-only (komponen_bbmb_master, cuma
// nama+tipe), sekarang pindah ke komponen_master (BBMB+BBMU, + kode_barang/
// merk/satuan_utama/satuan_list). Kategori (BBMB/BBMU) DIPILIH lewat toggle di
// atas (bukan kolom di file) - 1 upload/tambah = 1 kategori, biar gak perlu
// ngetik "BBMB"/"BBMU" berulang di tiap baris kayak file sumber besar.
// Satuan dari kolom "Satuan" + "Satuan Alternatif" - parsing sama persis
// aturan yang dipakai import besar (UOM/UOM REVISI): kalau alternatif beda
// dan ada kata "ATAU", jadi satuan_list multi-opsi.
// Upload MENAMBAHKAN doang - nama+kategori yang sudah ada (case-insensitive)
// atau duplikat dalam file di-skip, gak pernah replace/hapus data lama.
// ─────────────────────────────────────────────────────────────────────────────

type Kategori="BBMB"|"BBMU";
type ParsedRow={nama:string;kodeBarang:string;tipe:string;merk:string;satuan:string;satuanAlt:string};
type UploadResult={berhasil:number;skipDuplikat:number;skipKosong:number};

// Kolom A=nama (wajib), B=kode barang, C=tipe, D=merk, E=satuan, F=satuan alternatif - semua
// opsional kecuali nama. File TANPA header - baris pertama LANGSUNG data. Tetap deteksi header
// kalau suatu saat ada file YANG PAKAI header (baris pertama isinya literal "nama"/dst).
const HEADER_WORDS=new Set(["nama","kode barang","tipe","merk","satuan","name","type"]);
const isHeaderRow=(row:any[])=>{
  const a=String(row[0]??"").trim().toLowerCase();
  return HEADER_WORDS.has(a);
};

const parseFileRows=async(file:File):Promise<ParsedRow[]>=>{
  const buf=await file.arrayBuffer();
  const wb=XLSX.read(buf,{type:"array"});
  const sheet=wb.Sheets[wb.SheetNames[0]];
  const rawRows:any[][]=XLSX.utils.sheet_to_json(sheet,{header:1,defval:"",blankrows:false});
  const dataRows=rawRows.length>0&&isHeaderRow(rawRows[0])?rawRows.slice(1):rawRows;
  return dataRows.map(row=>({
    nama:String(row[0]??"").trim(),
    kodeBarang:String(row[1]??"").trim(),
    tipe:String(row[2]??"").trim(),
    merk:String(row[3]??"").trim(),
    satuan:String(row[4]??"").trim(),
    satuanAlt:String(row[5]??"").trim(),
  }));
};

// Sama persis logic parsing satuan yang dipakai script import besar (DATABASE_BARU - REVISI.xlsx)
// - satuan_list SELALU dari hasil ini, bukan cuma satuan tunggal, biar konsisten sama data hasil
// import 1.974 baris itu (satuan_utama match salah satu elemen satuan_list).
const buildSatuan=(satuanRaw:string,satuanAltRaw:string):{satuan_utama:string|null;satuan_list:string[]}=>{
  const satuan=satuanRaw.trim().toUpperCase();
  const alt=satuanAltRaw.trim().toUpperCase();
  if(!alt||alt===satuan)return{satuan_utama:satuan||null,satuan_list:satuan?[satuan]:[]};
  if(alt.includes(" ATAU ")){
    const list=alt.split(" ATAU ").map(s=>s.trim()).filter(Boolean);
    return{satuan_utama:list.includes(satuan)?satuan:list[0],satuan_list:list};
  }
  // beda tapi TANPA "ATAU" - dianggap sinonim/kata penuh dari satuan singkat, satuan tunggal
  // (sama perlakuan kayak edge-case BTG/BATANG di import besar).
  return{satuan_utama:alt||satuan||null,satuan_list:[alt||satuan].filter(Boolean) as string[]};
};

export function DatabaseGudangTab(){
  const[kategoriAktif,setKategoriAktif]=useState<Kategori>("BBMB");

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
  // Guard race condition (2 Sep 2026, ketemu pas verifikasi) - toggle kategori cepat (atau fetch
  // yang telat balik gara-gara BBMU 1.424 baris lebih lambat dari BBMB) bisa bikin response LAMA
  // nyampe belakangan dan nimpa balik hasil fetch yang lebih baru (query-nya sendiri udah benar,
  // race-nya di urutan resolve promise) - ref ini nyimpen kategori TERAKHIR yang diminta, response
  // yang gak match lagi pas balik (kategori udah keburu diganti) di-buang, gak dipakai buat setState.
  const latestKategoriRef=useRef<Kategori>("BBMB");

  const[addOpen,setAddOpen]=useState(false);
  const[addNama,setAddNama]=useState("");
  const[addKodeBarang,setAddKodeBarang]=useState("");
  const[addTipe,setAddTipe]=useState("");
  const[addMerk,setAddMerk]=useState("");
  const[addSatuan,setAddSatuan]=useState("");
  const[addSatuanAlt,setAddSatuanAlt]=useState("");
  const[addSubmitting,setAddSubmitting]=useState(false);
  const[addError,setAddError]=useState("");

  const fetchMasterList=async()=>{
    const kategoriDiminta=kategoriAktif;
    latestKategoriRef.current=kategoriDiminta;
    setLoadingList(true);
    // Paginasi penuh (2 Sep 2026, ketemu pas verifikasi) - BBMU sendirian 1.424 baris, lebih dari
    // cap default PostgREST 1000 baris tanpa .range() - tanpa ini list BBMU kepotong diam-diam.
    let all:any[]=[];
    let from=0;
    const PAGE=1000;
    while(true){
      const{data}=await supabase.from("komponen_master").select("*").eq("kategori",kategoriDiminta).order("nama",{ascending:true}).range(from,from+PAGE-1);
      all=all.concat(data??[]);
      if(!data||data.length<PAGE)break;
      from+=PAGE;
    }
    // Kalau kategori aktif udah ganti LAGI sebelum fetch panjang ini kelar (BBMU 1.424 baris bisa
    // makan beberapa ratus ms lebih dari BBMB), buang hasilnya - biar gak nimpa balik data yang
    // lebih baru dengan data basi.
    if(latestKategoriRef.current!==kategoriDiminta)return;
    setMasterList(all);
    setLoadingList(false);
  };

  useEffect(()=>{
    fetchMasterList();
    const ch=supabase.channel("realtime-gudang-master-komponen")
      .on("postgres_changes",{event:"*",schema:"public",table:"komponen_master"},fetchMasterList)
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[kategoriAktif]);

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
    const existing=await supabase.from("komponen_master").select("nama").eq("kategori",kategoriAktif).then(r=>r.data??[]);
    const existingSet=new Set(existing.map((r:any)=>r.nama.trim().toLowerCase()));
    const seenInFile=new Set<string>();
    const toInsert:any[]=[];
    let skipDuplikat=0,skipKosong=0;
    for(const row of parsed){
      if(!row.nama){skipKosong++;continue;}
      const key=row.nama.toLowerCase();
      if(existingSet.has(key)||seenInFile.has(key)){skipDuplikat++;continue;}
      seenInFile.add(key);
      const{satuan_utama,satuan_list}=buildSatuan(row.satuan,row.satuanAlt);
      toInsert.push({
        nama:row.nama,kategori:kategoriAktif,
        kode_barang:row.kodeBarang||null,tipe:row.tipe||null,merk:row.merk||null,
        satuan_utama,satuan_list,
      });
    }
    if(toInsert.length>0){
      const{error:insErr}=await supabase.from("komponen_master").insert(toInsert);
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

  // Cek duplikat case-insensitive SAMA kategori aktif - nama sama tapi kategori beda itu SAH
  // (bukan duplikat, dua komponen berbeda konteks BBMB vs BBMU).
  const submitTambahKomponen=async()=>{
    const nama=addNama.trim();
    if(!nama){setAddError("Nama wajib diisi");return;}
    setAddSubmitting(true);
    setAddError("");
    const{data:existing}=await supabase.from("komponen_master").select("id").eq("kategori",kategoriAktif).ilike("nama",nama).limit(1);
    if(existing&&existing.length>0){
      setAddError(`Komponen dengan nama ini sudah ada di ${kategoriAktif}`);
      setAddSubmitting(false);
      return;
    }
    const{satuan_utama,satuan_list}=buildSatuan(addSatuan,addSatuanAlt);
    const{error:insErr}=await supabase.from("komponen_master").insert({
      nama,kategori:kategoriAktif,
      kode_barang:addKodeBarang.trim()||null,tipe:addTipe.trim()||null,merk:addMerk.trim()||null,
      satuan_utama,satuan_list,
    });
    if(insErr){setAddError("Gagal simpan: "+insErr.message);setAddSubmitting(false);return;}
    setAddSubmitting(false);
    setAddNama("");setAddKodeBarang("");setAddTipe("");setAddMerk("");setAddSatuan("");setAddSatuanAlt("");setAddOpen(false);
    fetchMasterList();
  };

  const filteredList=masterList.filter((m:any)=>!search||m.nama.toLowerCase().includes(search.toLowerCase()));
  const inpStyle:any={width:"100%",padding:"9px 11px",borderRadius:9,border:"1.5px solid #cbd5e1",fontSize:13,fontWeight:600,color:"#0f172a",background:"#fff",fontFamily:"inherit"};

  return(
    <div style={{padding:16}} className="fi">
      <SectionCard icon="🗂️" title="Kategori" subtitle="Pilih kategori sebelum upload/tambah/cari - 1 aksi = 1 kategori">
        <SegmentedControl options={[{key:"BBMB",label:"BBMB (Bantu)",icon:"🧰"},{key:"BBMU",label:"BBMU (Utama)",icon:"⚙️"}]}
          value={kategoriAktif} onChange={(k)=>{setKategoriAktif(k);resetUpload();}}/>
      </SectionCard>

      <SectionCard icon="📤" title={`Upload Master Komponen ${kategoriAktif}`} subtitle="Upload Excel/CSV buat nambah daftar komponen">
      <div
        onDragOver={(e:any)=>{e.preventDefault();setDragOver(true);}}
        onDragLeave={()=>setDragOver(false)}
        onDrop={(e:any)=>{e.preventDefault();setDragOver(false);onFile(e.dataTransfer.files?.[0]||null);}}
        onClick={()=>fileInputRef.current?.click()}
        style={{border:`2px dashed ${dragOver?"#0369a1":"#cbd5e1"}`,borderRadius:14,padding:"24px 16px",
          textAlign:"center" as const,background:dragOver?"#eff6ff":"#f8fafc",cursor:"pointer",marginBottom:14}}>
        <div style={{fontSize:28,marginBottom:6}}>📤</div>
        <div style={{fontSize:13,fontWeight:700,color:"#334155"}}>Tap buat pilih file, atau drag & drop</div>
        <div style={{fontSize:11,color:"#94a3b8",marginTop:4,lineHeight:1.6}}>Excel (.xlsx) atau CSV - kolom: Nama (wajib) · Kode Barang · Tipe · Merk · Satuan · Satuan Alternatif (pisah "ATAU" kalau lebih dari 1)</div>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={(e:any)=>onFile(e.target.files?.[0]||null)} style={{display:"none"}}/>
      </div>

      {error&&<div style={{background:"#fef2f2",border:"1px solid #fecaca",color:"#dc2626",borderRadius:10,padding:"10px 12px",fontSize:12,marginBottom:14}}>{error}</div>}

      {parsed&&!result&&(
        <div style={{background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:14,padding:14,marginBottom:14}}>
          <div style={{fontSize:12.5,color:"#475569",marginBottom:12}}>
            <strong>{fileName}</strong> — {parsed.length} baris terdeteksi ({isiCount} ada nama{kosongCount>0?`, ${kosongCount} kosong (dilewati)`:""}), kategori <strong>{kategoriAktif}</strong>.
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

      <SectionCard icon="🗄️" title="Komponen Terdaftar" subtitle={`Cari & kelola daftar komponen ${kategoriAktif}`}
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
            <input value={addNama} onChange={(e:any)=>{setAddNama(e.target.value);setAddError("");}} placeholder="Nama komponen (wajib)" style={inpStyle}/>
            <div style={{display:"flex",gap:8}}>
              <input value={addKodeBarang} onChange={(e:any)=>setAddKodeBarang(e.target.value)} placeholder="Kode Barang" style={inpStyle}/>
              <input value={addMerk} onChange={(e:any)=>setAddMerk(e.target.value)} placeholder="Merk" style={inpStyle}/>
            </div>
            <input value={addTipe} onChange={(e:any)=>setAddTipe(e.target.value)} placeholder="Tipe / spesifikasi" style={inpStyle}/>
            <div style={{display:"flex",gap:8}}>
              <input value={addSatuan} onChange={(e:any)=>setAddSatuan(e.target.value)} placeholder="Satuan (mis. PCS, METER)" style={inpStyle}/>
              <input value={addSatuanAlt} onChange={(e:any)=>setAddSatuanAlt(e.target.value)} placeholder="Satuan alternatif (mis. METER ATAU ROLL)" style={inpStyle}/>
            </div>
          </div>
          {addError&&<div style={{fontSize:11.5,color:"#dc2626",marginBottom:10,fontWeight:600}}>{addError}</div>}
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>{setAddOpen(false);setAddNama("");setAddKodeBarang("");setAddTipe("");setAddMerk("");setAddSatuan("");setAddSatuanAlt("");setAddError("");}}
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
          description={search?"Gak ada komponen yang cocok dengan pencarian.":`Upload file Excel/CSV di atas buat mulai isi daftar komponen ${kategoriAktif}.`}/>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:360,overflowY:"auto" as const}}>
          {filteredList.map((m:any)=>(
            <div key={m.id} style={{display:"flex",flexDirection:"column",gap:2,background:"#f8fafc",borderRadius:9,padding:"9px 12px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                <span style={{fontSize:13,fontWeight:600,color:"#334155",flex:1,minWidth:0}}>{m.nama}</span>
                {m.satuan_list&&m.satuan_list.length>0&&(
                  <span style={{flexShrink:0,fontSize:10,fontWeight:700,color:"#0369a1",background:"#eff6ff",borderRadius:20,padding:"2px 8px"}}>
                    {m.satuan_list.join(" / ")}
                  </span>
                )}
              </div>
              {(m.kode_barang||m.tipe||m.merk)&&(
                <div style={{fontSize:10.5,color:"#94a3b8",fontWeight:600}}>
                  {[m.kode_barang,m.tipe,m.merk].filter(Boolean).join(" · ")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      </SectionCard>
    </div>
  );
}
