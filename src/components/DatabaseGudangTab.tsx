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

// MODE TABEL (7 Sep 2026) - toggle Card/Tabel di "Komponen Terdaftar", ditujukan buat dibuka
// dari layar lebih lebar (tablet Gudang/laptop admin), bukan gantiin card di HP (card TETAP
// default & satu-satunya mode di layar sempit - lihat komentar di render list di bawah).
type SortDir="asc"|"desc";
const TABLE_COLUMNS=[
  {key:"kode_barang",label:"KODE BARANG"},
  {key:"nama",label:"NAMA BARANG"},
  {key:"tipe",label:"TIPE"},
  {key:"merk",label:"MERK"},
  {key:"kategori",label:"KATEGORI"},
  {key:"satuan",label:"SATUAN"},
] as const;
const TABLE_PAGE_SIZE=50;
// Nilai tampilan per kolom - satuan digabung dari satuan_list (bukan field mentah tunggal).
const getColValue=(m:any,colKey:string):string=>{
  if(colKey==="satuan")return(m.satuan_list&&m.satuan_list.length>0)?m.satuan_list.join(", "):"";
  return String(m[colKey]??"");
};

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

// Duplikat = nama SAMA DAN kode_barang SAMA (atau sama-sama kosong) - BUKAN nama doang (7 Sep
// 2026, bukti nyata dari database: "SKUN BESI 10-6" punya 2 baris SAH sejak import awal, kode
// barang beda SKB10-6TML vs SKB10-6PM - varian/SKU fisik berbeda yang kebetulan dikasih nama
// generik sama di source data. Cek nama doang salah nge-flag ini sebagai duplikat, di Edit
// (blokir simpan), Tambah, DAN Upload (skip diam-diam - ini akar bug "SKUN ter-skip" yang
// ditemukan sebelumnya). Dipakai bareng ketiganya biar definisi duplikat konsisten.
const normKode=(k:string|null|undefined):string=>(k||"").trim().toLowerCase();

// Sub-komponen mode Tabel (7 Sep 2026) - dipisah dari DatabaseGudangTab biar gak numpuk di 1
// fungsi raksasa, tapi tetap 1 file (fitur ini murni bagian dari tab Database ini).
function KomponenTabelView({rows,totalRows,sortCol,sortDir,onSort,columnFilters,openFilterCol,onOpenFilterCol,
  getUniqueColValues,onToggleFilterValue,onRowClick,page,totalPages,onPageChange}:{
  rows:any[];totalRows:number;
  sortCol:string|null;sortDir:SortDir;onSort:(colKey:string)=>void;
  columnFilters:Record<string,string[]>;openFilterCol:string|null;onOpenFilterCol:(col:string|null)=>void;
  getUniqueColValues:(colKey:string)=>string[];onToggleFilterValue:(colKey:string,val:string)=>void;
  onRowClick:(row:any)=>void;
  page:number;totalPages:number;onPageChange:(p:number)=>void;
}){
  const thS:any={background:"#1e2330",color:"#c8d0e8",padding:"7px 10px",fontWeight:600,
    fontSize:10,textAlign:"left" as const,whiteSpace:"nowrap" as const,
    borderRight:"1px solid #ffffff10",textTransform:"uppercase" as const,letterSpacing:.4,position:"relative" as const};
  const td:any={padding:"7px 10px",borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",fontSize:12,verticalAlign:"middle" as const,cursor:"pointer"};
  return(
    <div>
      <div style={{overflowX:"auto" as const,borderRadius:10,border:"1px solid #e2e8f0"}}>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:640}}>
          <thead><tr>
            {TABLE_COLUMNS.map(c=>{
              const isSorted=sortCol===c.key;
              const activeFilterCount=(columnFilters[c.key]||[]).length;
              return(
                <th key={c.key} style={thS}>
                  <div style={{display:"flex",alignItems:"center",gap:4}}>
                    <span onClick={()=>onSort(c.key)} style={{cursor:"pointer",display:"flex",alignItems:"center",gap:3}}>
                      {c.label}
                      {isSorted&&<i className={`ti ti-arrow-${sortDir==="asc"?"up":"down"}`} style={{fontSize:11}}/>}
                    </span>
                    <span onClick={(e:any)=>{e.stopPropagation();onOpenFilterCol(openFilterCol===c.key?null:c.key);}}
                      style={{cursor:"pointer",position:"relative" as const,display:"flex",alignItems:"center"}}>
                      <i className="ti ti-filter" style={{fontSize:11,color:activeFilterCount>0?"#38bdf8":"#c8d0e8"}}/>
                      {activeFilterCount>0&&<span style={{position:"absolute" as const,top:-4,right:-6,background:"#38bdf8",color:"#0b1220",borderRadius:99,fontSize:8,fontWeight:800,padding:"0 3px",lineHeight:"12px"}}>{activeFilterCount}</span>}
                    </span>
                    {openFilterCol===c.key&&(
                      <div onClick={(e:any)=>e.stopPropagation()} style={{position:"absolute" as const,top:"100%",left:0,zIndex:100,marginTop:4,
                        background:"#fff",border:"1px solid #e2e8f0",borderRadius:8,boxShadow:"0 4px 16px #00000025",minWidth:170,maxHeight:220,overflowY:"auto" as const,padding:6,
                        textTransform:"none" as const,letterSpacing:"normal" as const,fontWeight:400}}>
                        {(columnFilters[c.key]||[]).length>0&&(
                          <button onClick={()=>(columnFilters[c.key]||[]).forEach(v=>onToggleFilterValue(c.key,v))}
                            style={{width:"100%",padding:"5px 8px",background:"#fef2f2",border:"none",
                              borderRadius:6,color:"#dc2626",fontSize:11,cursor:"pointer",fontFamily:"inherit",textAlign:"left" as const,marginBottom:4}}>
                            ✕ Reset filter
                          </button>
                        )}
                        {getUniqueColValues(c.key).map(v=>{
                          const isSel=(columnFilters[c.key]||[]).includes(v);
                          return(
                            <div key={v} onClick={()=>onToggleFilterValue(c.key,v)}
                              style={{padding:"5px 8px",borderRadius:6,cursor:"pointer",fontSize:11,
                                display:"flex",alignItems:"center",gap:7,
                                background:isSel?"#eff6ff":"transparent",color:isSel?"#1d4ed8":"#1e293b"}}>
                              <span style={{width:13,height:13,borderRadius:3,border:`1.5px solid ${isSel?"#1d4ed8":"#cbd5e1"}`,
                                background:isSel?"#1d4ed8":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                                {isSel&&<i className="ti ti-check" style={{fontSize:9,color:"#fff"}}/>}
                              </span>
                              <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{v}</span>
                            </div>
                          );
                        })}
                        {getUniqueColValues(c.key).length===0&&<div style={{padding:"5px 8px",fontSize:11,color:"#94a3b8"}}>Tidak ada nilai</div>}
                      </div>
                    )}
                  </div>
                </th>
              );
            })}
          </tr></thead>
          <tbody>
            {rows.map((m:any,i:number)=>(
              <tr key={m.id} onClick={()=>onRowClick(m)} style={{background:i%2===0?"#fff":"#f8fafc"}}>
                {TABLE_COLUMNS.map(c=>(
                  <td key={c.key} style={td}>{getColValue(m,c.key)||<span style={{color:"#cbd5e1"}}>—</span>}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {openFilterCol&&<div style={{position:"fixed" as const,inset:0,zIndex:99}} onClick={()=>onOpenFilterCol(null)}/>}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:8,fontSize:11,color:"#64748b",flexWrap:"wrap" as const,gap:8}}>
        <span>{totalRows} komponen - klik baris buat edit</span>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <button onClick={()=>onPageChange(Math.max(1,page-1))} disabled={page<=1}
            style={{padding:"4px 10px",borderRadius:6,border:"1px solid #e2e8f0",background:page<=1?"#f8fafc":"#fff",color:page<=1?"#cbd5e1":"#334155",cursor:page<=1?"default":"pointer",fontFamily:"inherit",fontSize:11}}>
            ‹ Sebelumnya
          </button>
          <span>Hal {page} / {totalPages}</span>
          <button onClick={()=>onPageChange(Math.min(totalPages,page+1))} disabled={page>=totalPages}
            style={{padding:"4px 10px",borderRadius:6,border:"1px solid #e2e8f0",background:page>=totalPages?"#f8fafc":"#fff",color:page>=totalPages?"#cbd5e1":"#334155",cursor:page>=totalPages?"default":"pointer",fontFamily:"inherit",fontSize:11}}>
            Selanjutnya ›
          </button>
        </div>
      </div>
    </div>
  );
}

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

  // Mode Tabel (7 Sep 2026) - toggle Card/Tabel, filter per kolom, sort, edit.
  const[viewMode,setViewMode]=useState<"card"|"table">("card");
  const[columnFilters,setColumnFilters]=useState<Record<string,string[]>>({});
  const[openFilterCol,setOpenFilterCol]=useState<string|null>(null);
  const[sortCol,setSortCol]=useState<string|null>(null);
  const[sortDir,setSortDir]=useState<SortDir>("asc");
  const[tablePage,setTablePage]=useState(1);

  const[editTarget,setEditTarget]=useState<any|null>(null);
  const[editNama,setEditNama]=useState("");
  const[editKodeBarang,setEditKodeBarang]=useState("");
  const[editTipe,setEditTipe]=useState("");
  const[editMerk,setEditMerk]=useState("");
  const[editSatuan,setEditSatuan]=useState("");
  const[editSatuanAlt,setEditSatuanAlt]=useState("");
  const[editSubmitting,setEditSubmitting]=useState(false);
  const[editError,setEditError]=useState("");
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

  // silent (4 Sep 2026, fix pola sama RiwayatGudangTab.tsx) - dipakai listener realtime di bawah
  // (tanpa filter kategori) biar list gak "berkedip" tiap ada perubahan komponen_master dari
  // kategori manapun/siapapun, sementara toggle kategori manual & aksi upload/tambah tetap non-silent.
  const fetchMasterList=async(silent=false)=>{
    const kategoriDiminta=kategoriAktif;
    latestKategoriRef.current=kategoriDiminta;
    if(!silent)setLoadingList(true);
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
    if(!silent)setLoadingList(false);
  };

  useEffect(()=>{
    fetchMasterList();
    const ch=supabase.channel("realtime-gudang-master-komponen")
      .on("postgres_changes",{event:"*",schema:"public",table:"komponen_master"},()=>fetchMasterList(true))
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[kategoriAktif]);

  // Balik ke halaman 1 tiap ganti kategori/kata kunci pencarian - biar gak nyangkut di halaman
  // yang jadi kosong kalau hasil filter/search jauh lebih sedikit dari sebelumnya.
  useEffect(()=>{setTablePage(1);setColumnFilters({});},[kategoriAktif,search]);

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
    // Pakai masterList yang udah di state (fetchMasterList paginasi penuh) - JANGAN .select() baru
    // tanpa .range() di sini, kategori BBMU >1000 baris jadi kepotong diam-diam kalau query ulang
    // (bug nyata ketemu 2 Sep 2026, sama persis kasus renhar - lihat komentar fetchMasterList).
    // Kunci dedup nama+kode_barang (7 Sep 2026) - dulu nama doang, bikin varian sah dengan nama
    // sama tapi kode_barang beda (mis. SKUN BESI 10-6 SKB10-6TML vs SKB10-6PM) ke-skip diam-diam
    // dianggap "sudah ada" - lihat komentar normKode.
    const existingSet=new Set(masterList.map((r:any)=>r.nama.trim().toLowerCase()+"|"+normKode(r.kode_barang)));
    const seenInFile=new Set<string>();
    const toInsert:any[]=[];
    let skipDuplikat=0,skipKosong=0;
    for(const row of parsed){
      if(!row.nama){skipKosong++;continue;}
      const key=row.nama.toLowerCase()+"|"+normKode(row.kodeBarang);
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
    const kodeBaru=normKode(addKodeBarang);
    const{data:candidates}=await supabase.from("komponen_master").select("id,kode_barang").eq("kategori",kategoriAktif).ilike("nama",nama);
    if((candidates||[]).some((r:any)=>normKode(r.kode_barang)===kodeBaru)){
      setAddError(`Komponen dengan nama & kode barang ini sudah ada di ${kategoriAktif}`);
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

  // REVISI (2 Sep 2026) - search sekarang cari di nama ATAU kode_barang, bukan nama doang.
  const filteredList=masterList.filter((m:any)=>{
    if(!search)return true;
    const q=search.toLowerCase();
    return m.nama.toLowerCase().includes(q)||(m.kode_barang||"").toLowerCase().includes(q);
  });

  // Mode Tabel - filter per kolom (dari masterList, BUKAN filteredList, biar opsi dropdown gak
  // ikut menyempit sendiri kalau kolom lain lagi difilter - simplifikasi sengaja, bukan cascading
  // Excel-style) + sort + pagination client-side (gak ada library tabel/virtualisasi di app ini,
  // 50 baris/halaman cukup ringan buat ~1.400 baris BBMU tanpa dependency baru).
  const getUniqueColValues=(colKey:string):string[]=>{
    const set=new Set<string>();
    masterList.forEach((m:any)=>{const v=getColValue(m,colKey);if(v)set.add(v);});
    return[...set].sort((a,b)=>a.localeCompare(b));
  };
  const tableRows=filteredList.filter((m:any)=>
    TABLE_COLUMNS.every(c=>{
      const sel=columnFilters[c.key];
      if(!sel||sel.length===0)return true;
      return sel.includes(getColValue(m,c.key));
    })
  );
  if(sortCol){
    tableRows.sort((a:any,b:any)=>{
      const va=getColValue(a,sortCol),vb=getColValue(b,sortCol);
      const cmp=va.localeCompare(vb,"id",{numeric:true,sensitivity:"base"});
      return sortDir==="asc"?cmp:-cmp;
    });
  }
  const tableTotalPages=Math.max(1,Math.ceil(tableRows.length/TABLE_PAGE_SIZE));
  const tablePageClamped=Math.min(tablePage,tableTotalPages);
  const pagedRows=tableRows.slice((tablePageClamped-1)*TABLE_PAGE_SIZE,tablePageClamped*TABLE_PAGE_SIZE);
  const toggleSort=(colKey:string)=>{
    if(sortCol!==colKey){setSortCol(colKey);setSortDir("asc");}
    else setSortDir(d=>d==="asc"?"desc":"asc");
  };
  const toggleColumnFilterValue=(colKey:string,val:string)=>{
    setColumnFilters(prev=>{
      const cur=prev[colKey]||[];
      const next=cur.includes(val)?cur.filter(v=>v!==val):[...cur,val];
      return{...prev,[colKey]:next};
    });
    setTablePage(1);
  };

  // Edit (7 Sep 2026) - BELUM ADA sebelumnya (cuma Upload & Tambah), 1 modal dipakai bareng dari
  // tombol edit di card MAUPUN klik baris di tabel. satuanAlt di-prefill dari satuan_list PENUH
  // (bukan cuma yang beda dari satuan_utama) - biar submit ulang lewat buildSatuan (parser yang
  // SAMA persis dipakai Tambah/Upload) hasilnya konsisten round-trip.
  const openEditModal=(m:any)=>{
    setEditTarget(m);
    setEditNama(m.nama||"");
    setEditKodeBarang(m.kode_barang||"");
    setEditTipe(m.tipe||"");
    setEditMerk(m.merk||"");
    setEditSatuan(m.satuan_utama||"");
    setEditSatuanAlt((m.satuan_list&&m.satuan_list.length>1)?m.satuan_list.join(" ATAU "):"");
    setEditError("");
  };
  const closeEditModal=()=>{setEditTarget(null);setEditError("");};
  const submitEditKomponen=async()=>{
    if(!editTarget)return;
    const nama=editNama.trim();
    if(!nama){setEditError("Nama wajib diisi");return;}
    setEditSubmitting(true);
    setEditError("");
    const kodeBaru=normKode(editKodeBarang);
    const{data:candidates}=await supabase.from("komponen_master").select("id,kode_barang").eq("kategori",editTarget.kategori).ilike("nama",nama).neq("id",editTarget.id);
    if((candidates||[]).some((r:any)=>normKode(r.kode_barang)===kodeBaru)){
      setEditError(`Komponen dengan nama & kode barang ini sudah ada di ${editTarget.kategori}`);
      setEditSubmitting(false);
      return;
    }
    const{satuan_utama,satuan_list}=buildSatuan(editSatuan,editSatuanAlt);
    const{error:updErr}=await supabase.from("komponen_master").update({
      nama,kode_barang:editKodeBarang.trim()||null,tipe:editTipe.trim()||null,merk:editMerk.trim()||null,
      satuan_utama,satuan_list,
    }).eq("id",editTarget.id);
    if(updErr){setEditError("Gagal simpan: "+updErr.message);setEditSubmitting(false);return;}
    setEditSubmitting(false);
    closeEditModal();
    fetchMasterList();
  };

  // Kategori badge - warna beda per kategori biar gampang dibedain sekilas mata.
  const KATEGORI_BADGE:Record<string,{bg:string;color:string}>={
    BBMB:{bg:"#fdf2f8",color:"#be185d"},
    BBMU:{bg:"#eef2ff",color:"#4f46e5"},
  };
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
          <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0,flexWrap:"wrap" as const}}>
            <span style={{background:"#eff6ff",color:"#1d4ed8",borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700}}>{masterList.length} total</span>
            {/* Toggle Card/Tabel (7 Sep 2026) - Tabel ditujukan buat layar lebar (tablet/laptop),
                card TETAP default & satu-satunya yang nyaman di HP sempit (lihat komentar di
                render list card di bawah). */}
            <div style={{display:"flex",border:"1px solid #cbd5e1",borderRadius:8,overflow:"hidden"}}>
              <button onClick={()=>setViewMode("card")}
                style={{padding:"5px 9px",border:"none",background:viewMode==="card"?"#334155":"#fff",
                  color:viewMode==="card"?"#fff":"#64748b",fontWeight:700,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>
                <i className="ti ti-layout-cards" style={{fontSize:12}}/>
              </button>
              <button onClick={()=>setViewMode("table")}
                style={{padding:"5px 9px",border:"none",background:viewMode==="table"?"#334155":"#fff",
                  color:viewMode==="table"?"#fff":"#64748b",fontWeight:700,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>
                <i className="ti ti-table" style={{fontSize:12}}/>
              </button>
            </div>
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
      <input value={search} onChange={(e:any)=>setSearch(e.target.value)} placeholder="🔍 Cari nama atau kode barang..."
        style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid #cbd5e1",fontSize:14,fontFamily:"inherit",marginBottom:10}}/>
      {loadingList?(
        <div style={{textAlign:"center",padding:24,color:"#94a3b8",fontSize:13}}>Memuat...</div>
      ):(viewMode==="card"?filteredList:tableRows).length===0?(
        <EmptyState title={search||Object.values(columnFilters).some(v=>v.length>0)?"Tidak ditemukan":"Belum ada komponen"}
          description={search||Object.values(columnFilters).some(v=>v.length>0)?"Gak ada komponen yang cocok dengan pencarian/filter.":`Upload file Excel/CSV di atas buat mulai isi daftar komponen ${kategoriAktif}.`}/>
      ):viewMode==="table"?(
        <KomponenTabelView rows={pagedRows} totalRows={tableRows.length}
          sortCol={sortCol} sortDir={sortDir} onSort={toggleSort}
          columnFilters={columnFilters} openFilterCol={openFilterCol} onOpenFilterCol={setOpenFilterCol}
          getUniqueColValues={getUniqueColValues} onToggleFilterValue={toggleColumnFilterValue}
          onRowClick={openEditModal}
          page={tablePageClamped} totalPages={tableTotalPages} onPageChange={setTablePage}/>
      ):(
        // REVISI (2 Sep 2026) - card per baris dengan label kolom kecil di atas tiap value, meniru
        // struktur kolom Excel sumber (KODE BARANG/NAMA BARANG/TIPE/MERK/SATUAN/KATEGORI) TAPI
        // disusun vertikal - dipilih di atas tabel+scroll horizontal karena app ini murni mobile
        // (GudangHome sengaja gak punya toggle desktop) dan pola card udah dipakai konsisten di
        // semua list lain (BBMB/BBMU/Riwayat) - scroll horizontal 6 kolom di layar HP sempit
        // gak nyaman dipakai jempol. Mode Tabel (7 Sep 2026) sekarang tersedia sebagai TOGGLE
        // buat layar lebih lebar, card ini tetap default & gak diubah sama sekali.
        <div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:420,overflowY:"auto" as const}}>
          {filteredList.map((m:any)=>{
            const badge=KATEGORI_BADGE[m.kategori]||{bg:"#f1f5f9",color:"#64748b"};
            const satuanText=m.satuan_list&&m.satuan_list.length>0?m.satuan_list.join(", "):"-";
            const kolom=[
              {label:"KODE BARANG",value:m.kode_barang},
              {label:"TIPE",value:m.tipe},
              {label:"MERK",value:m.merk},
              {label:"SATUAN",value:satuanText!=="-"?satuanText:null},
            ].filter(k=>k.value);
            return(
              <div key={m.id} style={{background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:12,padding:"10px 12px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:kolom.length>0?8:0}}>
                  <span style={{fontSize:13.5,fontWeight:700,color:"#1e293b",flex:1,minWidth:0}}>{m.nama}</span>
                  <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                    <span style={{background:badge.bg,color:badge.color,borderRadius:20,padding:"2px 9px",fontSize:9.5,fontWeight:800,letterSpacing:.3}}>
                      {m.kategori}
                    </span>
                    <button onClick={()=>openEditModal(m)}
                      style={{width:22,height:22,borderRadius:6,border:"1px solid #e2e8f0",background:"#fff",
                        color:"#64748b",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>
                      <i className="ti ti-pencil" style={{fontSize:11}}/>
                    </button>
                  </div>
                </div>
                {kolom.length>0&&(
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px 10px"}}>
                    {kolom.map(k=>(
                      <div key={k.label}>
                        <div style={{fontSize:9,fontWeight:700,color:"#94a3b8",letterSpacing:.3,marginBottom:1}}>{k.label}</div>
                        <div style={{fontSize:12,fontWeight:600,color:"#334155"}}>{k.value}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      </SectionCard>

      {editTarget&&(
        <div onClick={closeEditModal} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div onClick={(e:any)=>e.stopPropagation()} style={{background:"#fff",borderRadius:16,padding:20,width:"100%",maxWidth:400,maxHeight:"90vh",overflowY:"auto" as const}}>
            <div style={{fontWeight:800,fontSize:15,color:"#1e293b",marginBottom:2}}>Edit Komponen</div>
            <div style={{fontSize:11.5,color:"#94a3b8",marginBottom:12}}>Kategori {editTarget.kategori} - tidak bisa diubah dari sini</div>
            <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:10}}>
              <input value={editNama} onChange={(e:any)=>{setEditNama(e.target.value);setEditError("");}} placeholder="Nama komponen (wajib)" style={inpStyle}/>
              <div style={{display:"flex",gap:8}}>
                <input value={editKodeBarang} onChange={(e:any)=>setEditKodeBarang(e.target.value)} placeholder="Kode Barang" style={inpStyle}/>
                <input value={editMerk} onChange={(e:any)=>setEditMerk(e.target.value)} placeholder="Merk" style={inpStyle}/>
              </div>
              <input value={editTipe} onChange={(e:any)=>setEditTipe(e.target.value)} placeholder="Tipe / spesifikasi" style={inpStyle}/>
              <div style={{display:"flex",gap:8}}>
                <input value={editSatuan} onChange={(e:any)=>setEditSatuan(e.target.value)} placeholder="Satuan (mis. PCS, METER)" style={inpStyle}/>
                <input value={editSatuanAlt} onChange={(e:any)=>setEditSatuanAlt(e.target.value)} placeholder="Satuan alternatif (mis. METER ATAU ROLL)" style={inpStyle}/>
              </div>
            </div>
            {editError&&<div style={{fontSize:11.5,color:"#dc2626",marginBottom:10,fontWeight:600}}>{editError}</div>}
            <div style={{display:"flex",gap:8}}>
              <button onClick={closeEditModal} disabled={editSubmitting}
                style={{flex:1,padding:"10px",borderRadius:9,border:"1px solid #e2e8f0",background:"#fff",color:"#64748b",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                Batal
              </button>
              <button onClick={submitEditKomponen} disabled={editSubmitting}
                style={{flex:1,padding:"10px",borderRadius:9,border:"none",
                  background:editSubmitting?"#94a3b8":"#16a34a",color:"#fff",fontWeight:700,fontSize:13,
                  cursor:editSubmitting?"default":"pointer",fontFamily:"inherit"}}>
                {editSubmitting?"Menyimpan...":"Simpan Perubahan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
