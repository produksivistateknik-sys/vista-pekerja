import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "../lib/supabase";
import { PESAN_DIANTREKAN, unggahBanyak, MAKS_FOTO_PER_SIMPAN, pesanMelebihiBatasFoto } from "../lib/siapkanMedia";
import { tempelAtauAntrekan } from "../lib/antreanFoto";
import { isVideoFoto } from "../lib/mediaThumb";
import { alertGagalSimpan } from "../lib/koneksi";
import { ThumbMedia } from "./ui/ThumbMedia";
import { FotoZoomViewerPekerja, type FotoViewerPekerja } from "./FotoZoomViewerPekerja";
import { MediaPickerSheet } from "./ui/MediaPickerSheet";
import { SectionCard, EmptyState } from "./ui/Primitives";
import { useSaatFotoAntreanTertempel } from "../lib/useSaatFotoAntreanTertempel";
import { hariKerjaWib } from "../lib/tanggalWib";
import { aktivitasPL, labelWaktuPL, jejakUbahCatatanPL, normalNamaPL } from "../lib/proyekLuarPantau";
import { bacaSemuaDraf, kirimSemuaDraf, EVENT_DRAF_CATATAN_PL } from "../lib/drafCatatanProyekLuar";
import { CatatanProyekLuarOtomatis } from "./CatatanProyekLuarOtomatis";

// ─────────────────────────────────────────────────────────────────────────────
// PROYEK LUAR (30 Agu 2026) - laporan/dokumentasi pekerjaan operator di proyek eksternal,
// BERDIRI SENDIRI (tidak terkait WO/panel manapun). Cuma muncul untuk divisi
// qc/wiring_ctrl/wiring_pwr/assembling (lihat App.tsx menuTiles).
//
// Tabel `proyek_luar` BELUM masuk supabase-generated.ts (baru dibuat via migration
// 20260830010000) - pakai (table as any) buat query, pola yang sudah ada di codebase ini
// buat tabel yang belum di-generate types-nya (lihat cekYatimPiatu di workOrderService.ts).
//
// Pola upload foto SAMA PERSIS QCChecklistTab.tsx (compressImageNp + uploadToR2 + grid 3
// kolom + FotoZoomViewerPekerja) - operator sudah familiar. Path foto proyek-luar/{id}/...
//
// PANTAU HARIAN (24 Okt 2026, keputusan user): admin memantau tiap hari, tidak menunggu laporan disimpan. Bukti: 7 dari 12
// laporan nyata disimpan 1-3 hari sesudah tanggal kerja, isinya hanya di memori HP sampai "Simpan Laporan". Sekarang:
//  - "Mulai laporan" (RPC mulai_laporan_proyek_luar) langsung membuat laporan; satu laporan per operator per proyek per
//    tanggal (memanggil lagi = membuka laporan yang sama, tidak dobel). "Lanjutkan proyek" = nama proyek Berlangsung sendiri,
//    dipakai persis sama (laporan beberapa hari tergabung rapi di Unduh Word admin). Tanggal bawaan = HARI KERJA WIB.
//  - Catatan tersimpan otomatis (CatatanProyekLuarOtomatis + lib/drafCatatanProyekLuar: draf di HP, cek bentrok, kirim ulang
//    saat sinyal kembali). Foto diunggah SAAT DIPILIH (antrean foto tetap berlaku). Tidak ada tombol "Simpan Laporan".
//  - Operator boleh mengubah catatan & menghapus foto laporannya sendiri selama Berlangsung (RPC, jejak + log).
// ─────────────────────────────────────────────────────────────────────────────
type StagedFoto={file:File,previewUrl:string};

export function ProyekLuarView({user}:{user:any}){
  const[mode,setMode]=useState<"list"|"form"|"arsip">("list");
  const[loading,setLoading]=useState(true);
  const[galatMuat,setGalatMuat]=useState<string|null>(null);
  const[laporanList,setLaporanList]=useState<any[]>([]);
  const[expandedId,setExpandedId]=useState<number|null>(null);
  const[search,setSearch]=useState("");
  const[fotoViewer,setFotoViewer]=useState<{fotos:FotoViewerPekerja[],startIndex:number,label:string}|null>(null);
  const namaOperator=user.nama||user.name||"Operator";

  const fetchLaporan=async()=>{
    // .range() defensif (audit egress Agu 2026) - proyek_luar punya kolom foto JSONB, histori
    // laporan operator bisa terus bertambah - cukup tampilkan yang terbaru.
    const{data,error}=await supabase.from("proyek_luar" as any).select("*").eq("pekerja_id",user.id).order("created_at",{ascending:false}).order("id",{ascending:false}).range(0,99);
    if(error){console.error("[Proyek Luar] gagal memuat laporan:",error);setGalatMuat(error.message||"gagal memuat");setLoading(false);return;}
    setGalatMuat(null);setLaporanList(data||[]);setLoading(false);
  };
  useSaatFotoAntreanTertempel(()=>{fetchLaporan();}); // (18 Okt 2026) foto dari antrean HP tertempel -> muat ulang
  useEffect(()=>{
    fetchLaporan();
    const ch=supabase.channel("realtime-proyek-luar-"+user.id)
      .on("postgres_changes",{event:"*",schema:"public",table:"proyek_luar",filter:"pekerja_id=eq."+user.id},fetchLaporan)
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[user.id]);

  // Draf catatan yang tertunda (sinyal putus) dikirim saat layar ini dibuka, sinyal kembali, atau aplikasi aktif lagi.
  const[jmlDraf,setJmlDraf]=useState(()=>Object.keys(bacaSemuaDraf()).length);
  const terbukaRef=useRef<number|null>(null);
  const kirimDrafRef=useRef<()=>void>(()=>{});
  const[mengirimDraf,setMengirimDraf]=useState(false);
  useEffect(()=>{terbukaRef.current=expandedId;},[expandedId]);
  useEffect(()=>{
    const hitung=()=>setJmlDraf(Object.keys(bacaSemuaDraf()).length);
    const kirim=async()=>{
      if(document.visibilityState!=="visible")return;
      setMengirimDraf(true);
      const h=await kirimSemuaDraf(terbukaRef.current).finally(()=>setMengirimDraf(false));
      if(h.terkirim.length)fetchLaporan();
      if(h.ditolak.length)alert(`${h.ditolak.length} catatan tidak bisa disimpan:\n${h.ditolak.map(d=>"• "+(d.error?.message||d.error)).join("\n")}`);
    };
    kirimDrafRef.current=kirim;
    kirim();
    window.addEventListener("online",kirim);document.addEventListener("visibilitychange",kirim);window.addEventListener(EVENT_DRAF_CATATAN_PL,hitung);
    return()=>{window.removeEventListener("online",kirim);document.removeEventListener("visibilitychange",kirim);window.removeEventListener(EVENT_DRAF_CATATAN_PL,hitung);};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[user.id]);

  // ── Mulai laporan (langsung tersimpan) ──
  const[formMulai,setFormMulai]=useState(()=>({namaLokasi:"",tanggal:hariKerjaWib()}));
  const[memulai,setMemulai]=useState(false);
  const proyekLanjut=useMemo(()=>{
    const m=new Map<string,any>();
    for(const l of laporanList){
      if(l.is_archived||l.status!=="berlangsung")continue;
      const k=normalNamaPL(l.nama_lokasi);
      if(!m.has(k)||String(l.tanggal)>String(m.get(k).tanggal))m.set(k,l);
    }
    return[...m.values()].sort((a,b)=>String(b.tanggal).localeCompare(String(a.tanggal))).slice(0,8);
  },[laporanList]);
  const mulaiLaporan=async(namaLokasi:string,tanggal:string)=>{
    if(!namaLokasi.trim()){alert("Nama/lokasi proyek wajib diisi");return;}
    if(!tanggal){alert("Tanggal wajib diisi");return;}
    if(memulai)return;
    setMemulai(true);
    try{
      const{data,error}=await supabase.rpc("mulai_laporan_proyek_luar" as any,{p_pekerja_id:user.id,p_operator_nama:namaOperator,p_divisi:user.divisi,p_nama_lokasi:namaLokasi,p_tanggal:tanggal} as any);
      if(error||!data){alertGagalSimpan(error||new Error("tidak ada data"),"Mulai laporan Proyek Luar",{aksi:"mulai laporan proyek luar",ulangi:"Mulai laporan",catatanKoneksi:"Laporan BELUM dibuat - coba lagi saat sinyal ada."});return;}
      const r:any=data;
      setLaporanList(prev=>[r,...prev.filter(x=>x.id!==r.id)]);
      setFormMulai({namaLokasi:"",tanggal:hariKerjaWib()});
      setSearch("");setMode("list");setExpandedId(r.id);
      fetchLaporan();
    }finally{setMemulai(false);}
  };

  // Foto/video (6 Okt 2026) - satu file gagal tidak menggagalkan yang lain, TAPI yang gagal
  // DIKEMBALIKAN (dulu catch{} kosong: hilang diam-diam, operator mengira sudah tersimpan).
  // (18 Okt 2026, antrean foto) gagal karena sinyal -> disimpan di HP & ditempel otomatis nanti (`antre`);
  // foto yang terunggah DITEMPEL lewat RPC tambah_foto_dokumentasi (tempelFotoProyek), bukan menulis ulang array.
  const[progresFoto,setProgresFoto]=useState(""); // (19 Okt 2026) "12/40" saat unggah banyak foto
  const uploadStagedFoto=async(laporanId:number,staged:StagedFoto[],label:string)=>{
    const hasil:any[]=[];
    const berkas:{foto:any,file:File,s:StagedFoto}[]=[];
    const gagal:{s:StagedFoto,alasan:string}[]=[];
    const antre:StagedFoto[]=[];
    // (19 Okt 2026) unggah PARALEL 3 + progres "12/40", ulang per foto, yang sudah terunggah tidak diunggah ulang
    const hasilUnggah=await unggahBanyak(staged.map(x=>x.file),`proyek-luar/${laporanId}`,{tujuan:{jenis:"proyek_luar",id:laporanId},label,operator:namaOperator},
      {onProgres:(n,total)=>setProgresFoto(`${n}/${total}`)});
    setProgresFoto("");
    hasilUnggah.forEach((h,i)=>{
      const s=staged[i];
      if(h.status==="ok"){const m=h.media;const foto={url:m.url,mime:m.mime,name:m.name,...(m.thumb?{thumb:m.thumb}:{}),uploaded_at:new Date().toISOString()};hasil.push(foto);berkas.push({foto,file:s.file,s});}
      else if(h.status==="diantrekan")antre.push(s);
      else{console.error("Upload dokumentasi Proyek Luar gagal:",s.file.name,h.alasan);gagal.push({s,alasan:h.alasan});}
    });
    return{hasil,berkas,gagal,antre};
  };
  const tempelFotoProyek=(laporanId:number,berkas:{foto:any,file:File}[],label:string)=>
    tempelAtauAntrekan({jenis:"proyek_luar",id:laporanId},berkas.map(b=>({foto:b.foto,file:b.file})),{label,operator:namaOperator});
  const pesanGagalUpload=(gagal:{s:StagedFoto,alasan:string}[])=>
    `${gagal.length} foto/video gagal diunggah:\n${gagal.map(g=>"• "+g.s.file.name+" - "+g.alasan).join("\n")}`;

  // ── Aksi di laporan (foto diunggah SAAT DIPILIH, ganti status, arsip, hapus foto) ──
  // File yang gagal diunggah (bukan karena sinyal) disimpan per laporan -> tombol "Ulangi unggah".
  const[gagalUnggah,setGagalUnggah]=useState<{id:number;items:StagedFoto[]}|null>(null);
  const[mengunggahId,setMengunggahId]=useState<number|null>(null);
  const unggahFotoKeLaporan=async(laporan:any,items:StagedFoto[])=>{
    if(items.length===0||mengunggahId!=null)return;
    if(items.length>MAKS_FOTO_PER_SIMPAN){alert(pesanMelebihiBatasFoto(items.length));items.forEach(s=>URL.revokeObjectURL(s.previewUrl));return;} // (19 Okt 2026)
    setMengunggahId(laporan.id);
    try{
      const label=`Proyek Luar ${String(laporan.nama_lokasi||laporan.id)}`;
      const{hasil:fotoBaru,berkas,gagal,antre}=await uploadStagedFoto(laporan.id,items,label);
      let sisa=gagal.map(g=>g.s);
      let jmlAntre=antre.length;
      if(fotoBaru.length>0){
        const t=await tempelFotoProyek(laporan.id,berkas,label);
        jmlAntre+=t.diantrekan.length;
        if(t.error){
          alertGagalSimpan(t.error,`Tambah foto Proyek Luar ${laporan.id}`,{aksi:"simpan foto/video",ulangi:"Ulangi unggah"});
          sisa=[...sisa,...berkas.filter(b=>t.gagal.includes(b.foto)).map(b=>b.s)];
        }
      }
      if(gagal.length>0)alert(pesanGagalUpload(gagal)+'\n\nFile yang gagal masih tersimpan - tekan "Ulangi unggah" untuk mengulang.'+(jmlAntre?`\n\n${jmlAntre} foto lain ${PESAN_DIANTREKAN}.`:""));
      else if(jmlAntre>0)alert(`Sinyal putus - ${jmlAntre} foto/video ${PESAN_DIANTREKAN}.`);
      items.filter(s=>!sisa.includes(s)).forEach(s=>URL.revokeObjectURL(s.previewUrl));
      setGagalUnggah(sisa.length?{id:laporan.id,items:sisa}:null);
    }finally{setMengunggahId(null);}
    fetchLaporan();
  };
  const hapusFoto=async(laporan:any,f:any)=>{
    if(!confirm("Hapus foto ini dari laporan?\n\nFoto tetap tercatat di riwayat (admin bisa memulihkan)."))return;
    const{data,error}=await supabase.rpc("hapus_foto_proyek_luar" as any,{p_id:laporan.id,p_url:f.url,p_oleh:namaOperator,p_pekerja_id:user.id,p_admin:false} as any);
    if(error){alertGagalSimpan(error,`Hapus foto Proyek Luar ${laporan.id}`,{aksi:"hapus foto proyek luar",catatanServer:"Foto belum terhapus. Laporan yang sudah Selesai tidak bisa diubah dari aplikasi ini.",catatanKoneksi:"Foto BELUM terhapus - coba lagi saat sinyal kembali."});return;}
    setLaporanList(prev=>prev.map((x:any)=>x.id===laporan.id?{...x,...(data as any)}:x));
  };
  const ubahStatus=async(laporan:any,statusBaru:string)=>{
    const{data,error}=await supabase.from("proyek_luar" as any).update({status:statusBaru,updated_at:new Date().toISOString()}).eq("id",laporan.id).select("id");
    if(error||!data?.length){alertGagalSimpan(error||new Error("0 baris berubah"),`Ubah status Proyek Luar ${laporan.id}`,{aksi:"ubah status proyek luar"});return;}
    fetchLaporan();
  };
  const toggleArsip=async(laporan:any)=>{
    const{data,error}=await supabase.from("proyek_luar" as any).update({is_archived:!laporan.is_archived,updated_at:new Date().toISOString()}).eq("id",laporan.id).select("id");
    if(error||!data?.length){alertGagalSimpan(error||new Error("0 baris berubah"),`Arsip Proyek Luar ${laporan.id}`,{aksi:"arsip proyek luar"});return;}
    fetchLaporan();
  };

  const statusStyle:any={
    berlangsung:{bg:"#fffbeb",color:"#d97706",label:"Berlangsung"},
    selesai:{bg:"#f0fdf4",color:"#16a34a",label:"Selesai"},
  };
  const drafAda=bacaSemuaDraf(); // jmlDraf (state) memicu render ulang saat draf berubah

  return(
    <div style={{padding:16}}>
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        <button onClick={()=>setMode("list")} style={{flex:1,padding:"10px",borderRadius:10,border:"none",cursor:"pointer",
          fontSize:12.5,fontWeight:700,background:mode==="list"?"#1d4ed8":"#e2e8f0",color:mode==="list"?"#fff":"#64748b"}}>
          📋 Daftar Laporan
        </button>
        <button onClick={()=>{setFormMulai(f=>({...f,tanggal:f.namaLokasi?f.tanggal:hariKerjaWib()}));setMode("form");}} style={{flex:1,padding:"10px",borderRadius:10,border:"none",cursor:"pointer",
          fontSize:12.5,fontWeight:700,background:mode==="form"?"#1d4ed8":"#e2e8f0",color:mode==="form"?"#fff":"#64748b"}}>
          ➕ Mulai Laporan
        </button>
        <button onClick={()=>setMode("arsip")} style={{flex:1,padding:"10px",borderRadius:10,border:"none",cursor:"pointer",
          fontSize:12.5,fontWeight:700,background:mode==="arsip"?"#1d4ed8":"#e2e8f0",color:mode==="arsip"?"#fff":"#64748b"}}>
          🗄️ Arsip
        </button>
      </div>

      {jmlDraf>0&&(
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,fontSize:12,color:"#b45309",background:"#fffbeb",border:"1px solid #fde68a",borderRadius:10,padding:"8px 10px",marginBottom:12}}>
          <span>⏳ {jmlDraf} catatan belum terkirim - aman di HP ini, dikirim otomatis saat sinyal kembali.</span>
          <button onClick={()=>kirimDrafRef.current()} disabled={mengirimDraf} style={{flexShrink:0,border:0,background:"#d97706",color:"#fff",borderRadius:7,padding:"5px 9px",fontSize:11.5,fontWeight:700,cursor:"pointer"}}>{mengirimDraf?"Mengirim...":"Kirim sekarang"}</button>
        </div>
      )}

      {mode==="form"?(
        <SectionCard icon="🏗" title="Mulai Laporan Proyek Luar">
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{fontSize:12,color:"#475569",background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:10,padding:"8px 10px",lineHeight:1.45}}>
              Setelah dimulai, catatan & foto <b>langsung tersimpan</b> dan terlihat admin. Tidak perlu tombol simpan - tambahkan kapan saja selama Berlangsung.
            </div>
            {proyekLanjut.length>0&&(
              <div>
                <label style={{fontSize:11,fontWeight:700,color:"#64748b",display:"block",marginBottom:6}}>Lanjutkan proyek (tanggal {formMulai.tanggal})</label>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {proyekLanjut.map(p=>{
                    const sudah=laporanList.some(l=>!l.is_archived&&l.tanggal===formMulai.tanggal&&normalNamaPL(l.nama_lokasi)===normalNamaPL(p.nama_lokasi));
                    return(
                      <button key={p.id} onClick={()=>mulaiLaporan(p.nama_lokasi,formMulai.tanggal)} disabled={memulai}
                        style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,padding:"10px 12px",borderRadius:10,border:"1.5px solid #e2e8f0",
                          background:"#fff",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
                        <span style={{minWidth:0}}>
                          <span style={{display:"block",fontWeight:700,fontSize:13,color:"#1e293b"}}>{p.nama_lokasi}</span>
                          <span style={{display:"block",fontSize:11,color:"#94a3b8"}}>terakhir {p.tanggal}</span>
                        </span>
                        <span style={{flexShrink:0,fontSize:11.5,fontWeight:700,color:"#2563eb"}}>{sudah?"Buka laporan":"Lanjutkan ▶"}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div>
              <label style={{fontSize:11,fontWeight:700,color:"#64748b",display:"block",marginBottom:4}}>{proyekLanjut.length?"Atau proyek baru - Nama/Lokasi Proyek":"Nama/Lokasi Proyek"}</label>
              <input value={formMulai.namaLokasi} onChange={e=>setFormMulai({...formMulai,namaLokasi:e.target.value})} placeholder="mis. Pabrik ABC, Gresik"
                style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid #e2e8f0",fontSize:13,fontFamily:"inherit",boxSizing:"border-box"}}/>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:700,color:"#64748b",display:"block",marginBottom:4}}>Tanggal Pengerjaan</label>
              <input type="date" value={formMulai.tanggal} max={hariKerjaWib()} onChange={e=>setFormMulai({...formMulai,tanggal:e.target.value})}
                style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid #e2e8f0",fontSize:13,fontFamily:"inherit",boxSizing:"border-box"}}/>
              <div style={{fontSize:10.5,color:"#94a3b8",marginTop:4}}>Hari kerja: pukul 00.00-06.59 masih dihitung tanggal kemarin.</div>
            </div>
            <button onClick={()=>mulaiLaporan(formMulai.namaLokasi,formMulai.tanggal)} disabled={memulai}
              style={{width:"100%",padding:13,fontSize:14,fontWeight:700,color:"#fff",background:"#1d4ed8",
                border:"none",borderRadius:10,cursor:memulai?"default":"pointer",fontFamily:"inherit",opacity:memulai?.7:1}}>
              {memulai?"Memulai...":"Mulai Laporan"}
            </button>
          </div>
        </SectionCard>
      ):(()=>{
        const isArsip=mode==="arsip";
        const q=search.trim().toLowerCase();
        const filteredLaporan=laporanList.filter(l=>{
          const matchQ=!q||(l.nama_lokasi||"").toLowerCase().includes(q)||(l.operator_nama||"").toLowerCase().includes(q);
          if(!matchQ)return false;
          return isArsip?l.is_archived:(q?true:!l.is_archived);
        });
        return(
        <SectionCard icon={isArsip?"🗄️":"📋"} title={isArsip?"Arsip Laporan":"Laporan Saya"} subtitle={loading?"Memuat...":`${filteredLaporan.length} laporan`}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari nama lokasi / operator..."
            style={{width:"100%",padding:"9px 12px",borderRadius:10,border:"1.5px solid #e2e8f0",fontSize:13,fontFamily:"inherit",boxSizing:"border-box",marginBottom:12}}/>
          {galatMuat&&(
            <div style={{fontSize:12,color:"#b91c1c",background:"#fef2f2",border:"1px solid #fecaca",borderRadius:10,padding:"8px 10px",marginBottom:10}}>
              ⚠ Gagal memuat laporan ({galatMuat}). <button onClick={()=>fetchLaporan()} style={{border:0,background:"none",color:"#b91c1c",fontWeight:700,textDecoration:"underline",padding:0,cursor:"pointer"}}>Coba lagi</button>
            </div>
          )}
          {loading?(
            <div style={{textAlign:"center",padding:20,color:"#94a3b8",fontSize:12}}>Memuat...</div>
          ):filteredLaporan.length===0?(galatMuat?null:
            <EmptyState title={isArsip?"Belum ada laporan diarsip":"Belum ada laporan"} description={isArsip?"Laporan yang diarsipkan akan muncul di sini.":(q?"Tidak ada laporan yang cocok.":'Mulai laporan proyek luar pertama Anda lewat tab "Mulai Laporan".')} variant="box-paper"/>
          ):filteredLaporan.map(l=>{
            const isExp=expandedId===l.id;
            const st=statusStyle[l.status]||statusStyle.berlangsung;
            const fotoList:any[]=l.foto||[];
            const bisaUbah=l.status==="berlangsung"&&!l.is_archived;
            const jejak=jejakUbahCatatanPL(l);
            const tertunda=!!drafAda[String(l.id)];
            const gagalIni=gagalUnggah&&gagalUnggah.id===l.id?gagalUnggah.items:[];
            return(
              <div key={l.id} style={{border:"1px solid #f1f5f9",borderRadius:12,marginBottom:8,overflow:"hidden"}}>
                <div onClick={()=>setExpandedId(isExp?null:l.id)} style={{padding:"12px 14px",cursor:"pointer",background:isExp?"#f8fafc":"#fff",
                  display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                  <div style={{minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>{l.nama_lokasi}</div>
                    <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>📅 {l.tanggal} · {fotoList.length} foto{aktivitasPL(l)?` · diperbarui ${labelWaktuPL(aktivitasPL(l))}`:""}</div>
                    {tertunda&&<div style={{fontSize:10.5,color:"#b45309",fontWeight:700,marginTop:2}}>⏳ catatan belum terkirim</div>}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                    {l.is_archived&&<span style={{background:"#f1f5f9",color:"#64748b",borderRadius:20,padding:"3px 10px",fontSize:10.5,fontWeight:700}}>Arsip</span>}
                    <span style={{background:st.bg,color:st.color,borderRadius:20,padding:"3px 10px",fontSize:10.5,fontWeight:700}}>{st.label}</span>
                    <span style={{fontSize:12,color:"#94a3b8"}}>{isExp?"▼":"▶"}</span>
                  </div>
                </div>
                {isExp&&(
                  <div style={{padding:"12px 14px",borderTop:"1px solid #f1f5f9"}}>
                    {bisaUbah?(
                      <CatatanProyekLuarOtomatis key={l.id} laporan={l} user={user}
                        onTersimpan={(data:any)=>setLaporanList(prev=>prev.map((x:any)=>x.id===l.id?{...x,...data}:x))}/>
                    ):(
                      l.catatan&&<div style={{fontSize:12.5,color:"#475569",marginBottom:6,lineHeight:1.5,whiteSpace:"pre-wrap"}}>{l.catatan}</div>
                    )}
                    {jejak&&<div style={{fontSize:11,color:"#94a3b8",marginBottom:10}}>Diubah oleh {jejak.oleh} · {labelWaktuPL(jejak.pada)}</div>}
                    {fotoList.length>0&&(
                      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginBottom:12}}>
                        {fotoList.map((f:any,fi:number)=>(
                          <div key={f.url||fi} style={{position:"relative",aspectRatio:"1",borderRadius:8,overflow:"hidden",background:"#f1f5f9"}}>
                            <div onClick={()=>setFotoViewer({fotos:fotoList,startIndex:fi,label:l.nama_lokasi})} style={{width:"100%",height:"100%",cursor:"pointer"}}>
                              <ThumbMedia url={f.url} thumb={f.thumb} video={isVideoFoto(f)}/>
                            </div>
                            {bisaUbah&&f.url&&<button onClick={()=>hapusFoto(l,f)} aria-label="Hapus foto" style={{position:"absolute",top:3,right:3,width:22,height:22,borderRadius:99,
                              background:"rgba(15,23,42,0.65)",color:"#fff",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                              <i className="ti ti-x" style={{fontSize:12}}/>
                            </button>}
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8,gap:8}}>
                      {bisaUbah?(
                        <MediaPickerSheet allowVideo onFiles={(files)=>{
                            const dipilih=Array.from(files).map(file=>({file,previewUrl:URL.createObjectURL(file)}));
                            unggahFotoKeLaporan(l,dipilih);
                          }} triggerStyle={{display:"flex",alignItems:"center",gap:4,cursor:"pointer",color:"#2563eb",fontSize:11.5,fontWeight:700}}>
                          <i className="ti ti-camera-plus" style={{fontSize:13}}/> {mengunggahId===l.id?(progresFoto?`Mengunggah ${progresFoto}`:"Mengunggah..."):"Tambah Foto"}
                        </MediaPickerSheet>
                      ):<span/>}
                      <div style={{display:"flex",gap:8}}>
                        {l.status==="berlangsung"?(
                          <button onClick={()=>ubahStatus(l,"selesai")} style={{fontSize:11,fontWeight:700,color:"#16a34a",background:"#f0fdf4",
                            border:"1px solid #bbf7d0",borderRadius:8,padding:"6px 12px",cursor:"pointer"}}>
                            Tandai Selesai
                          </button>
                        ):(
                          <button onClick={()=>ubahStatus(l,"berlangsung")} style={{fontSize:11,fontWeight:700,color:"#d97706",background:"#fffbeb",
                            border:"1px solid #fde68a",borderRadius:8,padding:"6px 12px",cursor:"pointer"}}>
                            Buka Lagi
                          </button>
                        )}
                        <button onClick={()=>toggleArsip(l)} style={{fontSize:11,fontWeight:700,color:"#64748b",background:"#f8fafc",
                          border:"1px solid #e2e8f0",borderRadius:8,padding:"6px 12px",cursor:"pointer"}}>
                          {l.is_archived?"Batalkan Arsip":"Arsipkan"}
                        </button>
                      </div>
                    </div>
                    {gagalIni.length>0&&(
                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        <span style={{fontSize:11,color:"#b91c1c"}}>{gagalIni.length} foto gagal diunggah</span>
                        <button onClick={()=>unggahFotoKeLaporan(l,gagalIni)} disabled={mengunggahId!=null}
                          style={{fontSize:11,fontWeight:700,color:"#fff",background:"#1d4ed8",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer"}}>
                          {mengunggahId===l.id?(progresFoto?`Mengunggah ${progresFoto}`:"Mengunggah..."):"Ulangi unggah"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </SectionCard>
        );
      })()}

      {fotoViewer&&<FotoZoomViewerPekerja fotos={fotoViewer.fotos} startIndex={fotoViewer.startIndex} label={fotoViewer.label} onClose={()=>setFotoViewer(null)}/>}
    </div>
  );
}
