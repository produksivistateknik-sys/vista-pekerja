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
import { aktivitasPL, labelWaktuPL, jejakUbahCatatanPL, entriAktifPL } from "../lib/proyekLuarPantau";
import { bacaSemuaDraf, kirimSemuaDraf, kunciEntri, EVENT_DRAF_CATATAN_PL } from "../lib/drafCatatanProyekLuar";
import { CatatanProyekLuarOtomatis } from "./CatatanProyekLuarOtomatis";

// ─────────────────────────────────────────────────────────────────────────────
// PROYEK LUAR (30 Agu 2026) - laporan/dokumentasi pekerjaan operator di proyek eksternal,
// BERDIRI SENDIRI (tidak terkait WO/panel manapun). Cuma muncul untuk divisi
// qc/wiring_ctrl/wiring_pwr/assembling (lihat App.tsx menuTiles).
//
// Pola upload foto SAMA PERSIS QCChecklistTab.tsx (unggahBanyak + antrean foto + grid 3 kolom + FotoZoomViewerPekerja).
// Path foto proyek-luar/{proyekId}/...
//
// PANTAU HARIAN (24 Okt 2026): catatan tersimpan otomatis (CatatanProyekLuarOtomatis + lib/drafCatatanProyekLuar: draf di
// HP, cek bentrok, kirim ulang saat sinyal kembali), foto diunggah SAAT DIPILIH. Tidak ada tombol "Simpan Laporan".
//
// MULTI-HARI (25 Okt 2026, migration 20261025010000, keputusan user): 1 PROYEK (nama, lokasi, divisi, status) dibuat sekali,
// isinya ENTRI per hari (proyek_luar_entri). Daftar = proyek DIVISI SENDIRI (kode divisi sama persis), siapa pun pembuatnya.
//  - "+ Tambah pekerjaan" (tanggal bisa dipilih, bawaan HARI KERJA WIB, tidak boleh masa depan) -> RPC buka_entri_proyek_luar:
//    satu entri per proyek + tanggal + operator; memanggil lagi = membuka entri yang sama (tidak dobel).
//  - Penulis entri boleh mengubah catatan, menambah/menghapus foto, dan menghapus entrinya selama proyek Berlangsung.
//  - Tandai Selesai: hanya pembuat proyek (atau admin di vista-teknik). Membuka kembali: hanya admin.
//  - Hapus proyek: pembuat, selama Berlangsung & belum ada entri operator lain. Semua hapus = hapus LUNAK (admin bisa memulihkan).
//  Server memeriksa ulang semua aturan (RPC); tampilan di sini hanya menyembunyikan tombol yang pasti ditolak.
// ─────────────────────────────────────────────────────────────────────────────
type StagedFoto={file:File,previewUrl:string};

// .range() + urutan stabil (batas 1000 baris Supabase) - daftar id dipotong per 200 (URL tetap pendek).
async function muatEntriProyek(ids:number[]):Promise<any[]>{
  const hasil:any[]=[];
  for(let i=0;i<ids.length;i+=200){
    const potong=ids.slice(i,i+200);
    for(let dari=0;;dari+=1000){
      const{data,error}=await supabase.from("proyek_luar_entri" as any).select("*").in("proyek_id",potong).is("dihapus_pada",null).order("id").range(dari,dari+999);
      if(error)throw error;
      hasil.push(...(data||[]));
      if(!data||data.length<1000)break;
    }
  }
  return hasil;
}

export function ProyekLuarView({user}:{user:any}){
  const[mode,setMode]=useState<"list"|"form"|"arsip">("list");
  const[loading,setLoading]=useState(true);
  const[galatMuat,setGalatMuat]=useState<string|null>(null);
  const[proyekList,setProyekList]=useState<any[]>([]);
  const[entriList,setEntriList]=useState<any[]>([]);
  const[expandedId,setExpandedId]=useState<number|null>(null);
  const[search,setSearch]=useState("");
  const[fotoViewer,setFotoViewer]=useState<{fotos:FotoViewerPekerja[],startIndex:number,label:string}|null>(null);
  const namaOperator=user.nama||user.name||"Operator";

  const fetchLaporan=async()=>{
    try{
      const{data,error}=await supabase.from("proyek_luar" as any).select("*").eq("divisi",user.divisi).is("dihapus_pada",null)
        .order("aktivitas_pada",{ascending:false}).order("id",{ascending:false}).range(0,199);
      if(error)throw error;
      const p:any[]=data||[];
      const e=await muatEntriProyek(p.map(x=>Number(x.id)));
      setProyekList(p);setEntriList(e);setGalatMuat(null);
    }catch(err:any){
      console.error("[Proyek Luar] gagal memuat proyek/entri:",err);
      setGalatMuat(err?.message||"gagal memuat");
    }finally{setLoading(false);}
  };
  useSaatFotoAntreanTertempel(()=>{fetchLaporan();}); // (18 Okt 2026) foto dari antrean HP tertempel -> muat ulang
  useEffect(()=>{
    fetchLaporan();
    const ch=supabase.channel("realtime-proyek-luar-"+user.divisi+"-"+user.id)
      .on("postgres_changes",{event:"*",schema:"public",table:"proyek_luar",filter:"divisi=eq."+user.divisi},fetchLaporan)
      .on("postgres_changes",{event:"*",schema:"public",table:"proyek_luar_entri",filter:"divisi=eq."+user.divisi},fetchLaporan)
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[user.id,user.divisi]);

  // Draf catatan yang tertunda (sinyal putus) dikirim saat layar ini dibuka, sinyal kembali, atau aplikasi aktif lagi.
  const[jmlDraf,setJmlDraf]=useState(()=>Object.keys(bacaSemuaDraf()).length);
  const terbukaRef=useRef<Set<string>>(new Set());   // kunci draf entri yang kotaknya sedang terbuka (mengirim sendiri)
  const kirimDrafRef=useRef<()=>void>(()=>{});
  const[mengirimDraf,setMengirimDraf]=useState(false);
  useEffect(()=>{
    const hitung=()=>setJmlDraf(Object.keys(bacaSemuaDraf()).length);
    const kirim=async()=>{
      if(document.visibilityState!=="visible")return;
      setMengirimDraf(true);
      const terbuka=[...terbukaRef.current];
      const h=await kirimSemuaDraf(terbuka.length===1?terbuka[0]:null).finally(()=>setMengirimDraf(false));
      if(h.terkirim.length)fetchLaporan();
      if(h.ditolak.length)alert(`${h.ditolak.length} catatan tidak bisa disimpan:\n${h.ditolak.map(d=>"• "+(d.error?.message||d.error)).join("\n")}`);
    };
    kirimDrafRef.current=kirim;
    kirim();
    window.addEventListener("online",kirim);document.addEventListener("visibilitychange",kirim);window.addEventListener(EVENT_DRAF_CATATAN_PL,hitung);
    return()=>{window.removeEventListener("online",kirim);document.removeEventListener("visibilitychange",kirim);window.removeEventListener(EVENT_DRAF_CATATAN_PL,hitung);};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[user.id]);

  const entriPer=useMemo(()=>{
    const m=new Map<number,any[]>();
    for(const e of entriList){const k=Number(e.proyek_id);if(!m.has(k))m.set(k,[]);m.get(k)!.push(e);}
    return m;
  },[entriList]);
  useEffect(()=>{ // kotak catatan yang sedang terbuka = entri milik sendiri di proyek yang dibuka
    terbukaRef.current=new Set(entriAktifPL(entriPer.get(Number(expandedId))).filter(e=>Number(e.pekerja_id)===Number(user.id)).map(e=>kunciEntri(Number(e.id))));
  },[expandedId,entriPer,user.id]);

  // ── Proyek baru ──
  const[formBaru,setFormBaru]=useState(()=>({nama:"",lokasi:"",tanggal:hariKerjaWib()}));
  const[memulai,setMemulai]=useState(false);
  const buatProyek=async()=>{
    if(!formBaru.nama.trim()){alert("Nama proyek wajib diisi");return;}
    if(!formBaru.lokasi.trim()){alert("Lokasi proyek wajib diisi");return;}
    if(!formBaru.tanggal){alert("Tanggal wajib diisi");return;}
    if(memulai)return;
    setMemulai(true);
    try{
      const{data,error}=await supabase.rpc("buat_proyek_luar" as any,{p_pekerja_id:user.id,p_operator_nama:namaOperator,p_divisi:user.divisi,
        p_nama:formBaru.nama,p_lokasi:formBaru.lokasi,p_tanggal:formBaru.tanggal} as any);
      if(error||!data){alertGagalSimpan(error||new Error("tidak ada data"),"Buat proyek luar",{aksi:"buat proyek luar",ulangi:"Buat Proyek",catatanKoneksi:"Proyek BELUM dibuat - coba lagi saat sinyal ada."});return;}
      const r:any=data;
      setFormBaru({nama:"",lokasi:"",tanggal:hariKerjaWib()});
      setSearch("");setMode("list");setExpandedId(Number(r.proyek?.id));
      await fetchLaporan();
    }finally{setMemulai(false);}
  };

  // ── Tambah pekerjaan (entri hari) ──
  const[tglTambah,setTglTambah]=useState<Record<number,string>>({});
  const[membukaEntri,setMembukaEntri]=useState<number|null>(null);
  const tambahPekerjaan=async(p:any)=>{
    const tanggal=tglTambah[p.id]||hariKerjaWib();
    if(membukaEntri!=null)return;
    setMembukaEntri(p.id);
    try{
      const{error}=await supabase.rpc("buka_entri_proyek_luar" as any,{p_proyek_id:p.id,p_pekerja_id:user.id,p_operator_nama:namaOperator,p_divisi:user.divisi,p_tanggal:tanggal} as any);
      if(error){alertGagalSimpan(error,`Tambah pekerjaan Proyek Luar ${p.id}`,{aksi:"tambah pekerjaan proyek luar",ulangi:"Tambah pekerjaan",catatanKoneksi:"Pekerjaan BELUM ditambahkan - coba lagi saat sinyal ada."});return;}
      await fetchLaporan();
    }finally{setMembukaEntri(null);}
  };

  // Foto/video (6 Okt 2026) - satu file gagal tidak menggagalkan yang lain, TAPI yang gagal DIKEMBALIKAN.
  // (18 Okt 2026, antrean foto) gagal karena sinyal -> disimpan di HP & ditempel otomatis nanti (`antre`);
  // foto yang terunggah DITEMPEL lewat RPC tambah_foto_dokumentasi (tujuan proyek_luar_entri), bukan menulis ulang array.
  const[progresFoto,setProgresFoto]=useState(""); // (19 Okt 2026) "12/40" saat unggah banyak foto
  const uploadStagedFoto=async(proyekId:number,entriId:number,staged:StagedFoto[],label:string)=>{
    const hasil:any[]=[];
    const berkas:{foto:any,file:File,s:StagedFoto}[]=[];
    const gagal:{s:StagedFoto,alasan:string}[]=[];
    const antre:StagedFoto[]=[];
    const hasilUnggah=await unggahBanyak(staged.map(x=>x.file),`proyek-luar/${proyekId}`,{tujuan:{jenis:"proyek_luar_entri",id:entriId},label,operator:namaOperator},
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
  const pesanGagalUpload=(gagal:{s:StagedFoto,alasan:string}[])=>
    `${gagal.length} foto/video gagal diunggah:\n${gagal.map(g=>"• "+g.s.file.name+" - "+g.alasan).join("\n")}`;
  const[gagalUnggah,setGagalUnggah]=useState<{id:number;items:StagedFoto[]}|null>(null);
  const[mengunggahId,setMengunggahId]=useState<number|null>(null);
  const unggahFotoKeEntri=async(p:any,e:any,items:StagedFoto[])=>{
    if(items.length===0||mengunggahId!=null)return;
    if(items.length>MAKS_FOTO_PER_SIMPAN){alert(pesanMelebihiBatasFoto(items.length));items.forEach(s=>URL.revokeObjectURL(s.previewUrl));return;}
    setMengunggahId(e.id);
    try{
      const label=`Proyek Luar ${String(p.nama_lokasi||p.id)} ${e.tanggal}`;
      const{hasil:fotoBaru,berkas,gagal,antre}=await uploadStagedFoto(p.id,e.id,items,label);
      let sisa=gagal.map(g=>g.s);
      let jmlAntre=antre.length;
      if(fotoBaru.length>0){
        const t=await tempelAtauAntrekan({jenis:"proyek_luar_entri",id:e.id},berkas.map(b=>({foto:b.foto,file:b.file})),{label,operator:namaOperator});
        jmlAntre+=t.diantrekan.length;
        if(t.error){
          alertGagalSimpan(t.error,`Tambah foto Proyek Luar entri ${e.id}`,{aksi:"simpan foto/video",ulangi:"Ulangi unggah"});
          sisa=[...sisa,...berkas.filter(b=>t.gagal.includes(b.foto)).map(b=>b.s)];
        }
      }
      if(gagal.length>0)alert(pesanGagalUpload(gagal)+'\n\nFile yang gagal masih tersimpan - tekan "Ulangi unggah" untuk mengulang.'+(jmlAntre?`\n\n${jmlAntre} foto lain ${PESAN_DIANTREKAN}.`:""));
      else if(jmlAntre>0)alert(`Sinyal putus - ${jmlAntre} foto/video ${PESAN_DIANTREKAN}.`);
      items.filter(s=>!sisa.includes(s)).forEach(s=>URL.revokeObjectURL(s.previewUrl));
      setGagalUnggah(sisa.length?{id:e.id,items:sisa}:null);
    }finally{setMengunggahId(null);}
    fetchLaporan();
  };
  const hapusFoto=async(e:any,f:any)=>{
    if(!confirm("Hapus foto ini?\n\nFoto tetap tercatat di riwayat (admin bisa memulihkan)."))return;
    const{data,error}=await supabase.rpc("hapus_foto_entri_proyek_luar" as any,{p_entri_id:e.id,p_url:f.url,p_oleh:namaOperator,p_pekerja_id:user.id,p_admin:false} as any);
    if(error){alertGagalSimpan(error,`Hapus foto Proyek Luar entri ${e.id}`,{aksi:"hapus foto proyek luar",catatanServer:"Foto belum terhapus. Proyek yang sudah Selesai tidak bisa diubah dari aplikasi ini.",catatanKoneksi:"Foto BELUM terhapus - coba lagi saat sinyal kembali."});return;}
    setEntriList(prev=>prev.map((x:any)=>x.id===e.id?{...x,...(data as any)}:x));
  };
  const hapusEntri=async(e:any)=>{
    if(!confirm(`Hapus pekerjaan tanggal ${e.tanggal}?\n\nCatatan & foto hari itu disembunyikan (admin masih bisa memulihkan).`))return;
    const{error}=await supabase.rpc("hapus_entri_proyek_luar" as any,{p_entri_id:e.id,p_oleh:namaOperator,p_pekerja_id:user.id,p_admin:false} as any);
    if(error){alertGagalSimpan(error,`Hapus entri Proyek Luar ${e.id}`,{aksi:"hapus entri proyek luar",catatanServer:"Pekerjaan belum terhapus."});return;}
    fetchLaporan();
  };
  const hapusProyek=async(p:any)=>{
    if(!confirm(`Hapus proyek "${p.nama_lokasi}"?\n\nProyek disembunyikan (admin masih bisa memulihkan).`))return;
    const{error}=await supabase.rpc("hapus_proyek_luar" as any,{p_proyek_id:p.id,p_oleh:namaOperator,p_pekerja_id:user.id,p_admin:false} as any);
    if(error){alertGagalSimpan(error,`Hapus Proyek Luar ${p.id}`,{aksi:"hapus proyek luar",catatanServer:"Proyek belum terhapus."});return;}
    setExpandedId(null);fetchLaporan();
  };
  const tandaiSelesai=async(p:any)=>{
    if(!confirm(`Tandai proyek "${p.nama_lokasi}" Selesai?\n\nSetelah Selesai, pekerjaan tidak bisa ditambah lagi (hanya admin yang bisa membuka kembali).`))return;
    const{error}=await supabase.rpc("ubah_status_proyek_luar" as any,{p_proyek_id:p.id,p_status:"selesai",p_oleh:namaOperator,p_pekerja_id:user.id,p_admin:false} as any);
    if(error){alertGagalSimpan(error,`Selesai Proyek Luar ${p.id}`,{aksi:"tandai selesai proyek luar"});return;}
    fetchLaporan();
  };
  const toggleArsip=async(p:any)=>{
    const{data,error}=await supabase.from("proyek_luar" as any).update({is_archived:!p.is_archived,updated_at:new Date().toISOString()}).eq("id",p.id).select("id");
    if(error||!data?.length){alertGagalSimpan(error||new Error("0 baris berubah"),`Arsip Proyek Luar ${p.id}`,{aksi:"arsip proyek luar"});return;}
    fetchLaporan();
  };

  const statusStyle:any={
    berlangsung:{bg:"#fffbeb",color:"#d97706",label:"Berlangsung"},
    selesai:{bg:"#f0fdf4",color:"#16a34a",label:"Selesai"},
  };
  const drafAda=bacaSemuaDraf(); // jmlDraf (state) memicu render ulang saat draf berubah
  const hk=hariKerjaWib();

  const blokEntri=(p:any,e:any)=>{
    const milik=Number(e.pekerja_id)===Number(user.id);
    const bisaUbah=milik&&p.status==="berlangsung";
    const fotoList:any[]=Array.isArray(e.foto)?e.foto:[];
    const jejak=jejakUbahCatatanPL(e);
    const gagalIni=gagalUnggah&&gagalUnggah.id===e.id?gagalUnggah.items:[];
    return(
      <div key={e.id} style={{border:"1px solid #e2e8f0",borderRadius:10,padding:10,marginBottom:10,background:bisaUbah?"#fff":"#f8fafc"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8,marginBottom:6}}>
          <span style={{fontWeight:700,fontSize:12.5,color:"#1e293b"}}>📅 {e.tanggal}{e.tanggal===hk&&<span style={{marginLeft:6,fontSize:10,fontWeight:800,color:"#16a34a"}}>HARI INI</span>}</span>
          <span style={{fontSize:10.5,color:"#94a3b8",textAlign:"right"}}>{milik?"Anda":e.operator_nama} · diperbarui {labelWaktuPL(e.aktivitas_pada)}</span>
        </div>
        {bisaUbah?(
          <CatatanProyekLuarOtomatis key={e.id} entri={e} user={user}
            onTersimpan={(data:any)=>setEntriList(prev=>prev.map((x:any)=>x.id===e.id?{...x,...data}:x))}/>
        ):(
          e.catatan?<div style={{fontSize:12.5,color:"#475569",marginBottom:6,lineHeight:1.5,whiteSpace:"pre-wrap"}}>{e.catatan}</div>
            :<div style={{fontSize:12,color:"#94a3b8",marginBottom:6}}>Belum ada catatan.</div>
        )}
        {jejak&&<div style={{fontSize:11,color:"#94a3b8",marginBottom:8}}>Diubah oleh {jejak.oleh} · {labelWaktuPL(jejak.pada)}</div>}
        {fotoList.length>0&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginBottom:8}}>
            {fotoList.map((f:any,fi:number)=>(
              <div key={f.url||fi} style={{position:"relative",aspectRatio:"1",borderRadius:8,overflow:"hidden",background:"#f1f5f9"}}>
                <div onClick={()=>setFotoViewer({fotos:fotoList,startIndex:fi,label:`${p.nama_lokasi} ${e.tanggal}`})} style={{width:"100%",height:"100%",cursor:"pointer"}}>
                  <ThumbMedia url={f.url} thumb={f.thumb} video={isVideoFoto(f)}/>
                </div>
                {bisaUbah&&f.url&&<button onClick={()=>hapusFoto(e,f)} aria-label="Hapus foto" style={{position:"absolute",top:3,right:3,width:22,height:22,borderRadius:99,
                  background:"rgba(15,23,42,0.65)",color:"#fff",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <i className="ti ti-x" style={{fontSize:12}}/>
                </button>}
              </div>
            ))}
          </div>
        )}
        {bisaUbah&&(
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
            <MediaPickerSheet allowVideo onFiles={(files)=>{
                const dipilih=Array.from(files).map(file=>({file,previewUrl:URL.createObjectURL(file)}));
                unggahFotoKeEntri(p,e,dipilih);
              }} triggerStyle={{display:"flex",alignItems:"center",gap:4,cursor:"pointer",color:"#2563eb",fontSize:11.5,fontWeight:700}}>
              <i className="ti ti-camera-plus" style={{fontSize:13}}/> {mengunggahId===e.id?(progresFoto?`Mengunggah ${progresFoto}`:"Mengunggah..."):"Tambah Foto"}
            </MediaPickerSheet>
            <button onClick={()=>hapusEntri(e)} style={{border:0,background:"none",padding:0,color:"#b91c1c",fontSize:11.5,fontWeight:700,cursor:"pointer"}}>Hapus pekerjaan ini</button>
          </div>
        )}
        {gagalIni.length>0&&(
          <div style={{display:"flex",gap:8,alignItems:"center",marginTop:8}}>
            <span style={{fontSize:11,color:"#b91c1c"}}>{gagalIni.length} foto gagal diunggah</span>
            <button onClick={()=>unggahFotoKeEntri(p,e,gagalIni)} disabled={mengunggahId!=null}
              style={{fontSize:11,fontWeight:700,color:"#fff",background:"#1d4ed8",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer"}}>
              {mengunggahId===e.id?(progresFoto?`Mengunggah ${progresFoto}`:"Mengunggah..."):"Ulangi unggah"}
            </button>
          </div>
        )}
      </div>
    );
  };

  return(
    <div style={{padding:16}}>
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        <button onClick={()=>setMode("list")} style={{flex:1,padding:"10px",borderRadius:10,border:"none",cursor:"pointer",
          fontSize:12.5,fontWeight:700,background:mode==="list"?"#1d4ed8":"#e2e8f0",color:mode==="list"?"#fff":"#64748b"}}>
          📋 Daftar Proyek
        </button>
        <button onClick={()=>{setFormBaru(f=>({...f,tanggal:f.nama?f.tanggal:hariKerjaWib()}));setMode("form");}} style={{flex:1,padding:"10px",borderRadius:10,border:"none",cursor:"pointer",
          fontSize:12.5,fontWeight:700,background:mode==="form"?"#1d4ed8":"#e2e8f0",color:mode==="form"?"#fff":"#64748b"}}>
          ➕ Proyek Baru
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
        <SectionCard icon="🏗" title="Proyek Luar Baru">
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{fontSize:12,color:"#475569",background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:10,padding:"8px 10px",lineHeight:1.45}}>
              Proyek dibuat <b>sekali</b>. Hari berikutnya buka proyeknya di <b>Daftar Proyek</b> lalu tekan <b>+ Tambah pekerjaan</b>. Catatan & foto langsung tersimpan dan terlihat admin.
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:700,color:"#64748b",display:"block",marginBottom:4}}>Nama Proyek</label>
              <input value={formBaru.nama} onChange={e=>setFormBaru({...formBaru,nama:e.target.value})} placeholder="mis. Panel LVMDP Cold Storage"
                style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid #e2e8f0",fontSize:13,fontFamily:"inherit",boxSizing:"border-box"}}/>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:700,color:"#64748b",display:"block",marginBottom:4}}>Lokasi</label>
              <input value={formBaru.lokasi} onChange={e=>setFormBaru({...formBaru,lokasi:e.target.value})} placeholder="mis. Nganjuk, Jawa Timur"
                style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid #e2e8f0",fontSize:13,fontFamily:"inherit",boxSizing:"border-box"}}/>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:700,color:"#64748b",display:"block",marginBottom:4}}>Tanggal Pekerjaan Pertama</label>
              <input type="date" value={formBaru.tanggal} max={hk} onChange={e=>setFormBaru({...formBaru,tanggal:e.target.value})}
                style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid #e2e8f0",fontSize:13,fontFamily:"inherit",boxSizing:"border-box"}}/>
              <div style={{fontSize:10.5,color:"#94a3b8",marginTop:4}}>Hari kerja: pukul 00.00-06.59 masih dihitung tanggal kemarin.</div>
            </div>
            <button onClick={buatProyek} disabled={memulai}
              style={{width:"100%",padding:13,fontSize:14,fontWeight:700,color:"#fff",background:"#1d4ed8",
                border:"none",borderRadius:10,cursor:memulai?"default":"pointer",fontFamily:"inherit",opacity:memulai?.7:1}}>
              {memulai?"Membuat...":"Buat Proyek"}
            </button>
          </div>
        </SectionCard>
      ):(()=>{
        const isArsip=mode==="arsip";
        const q=search.trim().toLowerCase();
        const daftar=proyekList.filter(p=>{
          const es=entriPer.get(Number(p.id))||[];
          const teks=`${p.nama_lokasi||""} ${p.lokasi||""} ${p.dibuat_oleh||""} ${es.map(e=>e.operator_nama).join(" ")}`.toLowerCase();
          if(q&&!teks.includes(q))return false;
          return isArsip?p.is_archived:(q?true:!p.is_archived);
        });
        return(
        <SectionCard icon={isArsip?"🗄️":"📋"} title={isArsip?"Arsip Proyek":"Proyek Divisi Saya"} subtitle={loading?"Memuat...":`${daftar.length} proyek`}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari nama proyek / lokasi / operator..."
            style={{width:"100%",padding:"9px 12px",borderRadius:10,border:"1.5px solid #e2e8f0",fontSize:13,fontFamily:"inherit",boxSizing:"border-box",marginBottom:12}}/>
          {galatMuat&&(
            <div style={{fontSize:12,color:"#b91c1c",background:"#fef2f2",border:"1px solid #fecaca",borderRadius:10,padding:"8px 10px",marginBottom:10}}>
              ⚠ Gagal memuat proyek ({galatMuat}). <button onClick={()=>fetchLaporan()} style={{border:0,background:"none",color:"#b91c1c",fontWeight:700,textDecoration:"underline",padding:0,cursor:"pointer"}}>Coba lagi</button>
            </div>
          )}
          {loading?(
            <div style={{textAlign:"center",padding:20,color:"#94a3b8",fontSize:12}}>Memuat...</div>
          ):daftar.length===0?(galatMuat?null:
            <EmptyState title={isArsip?"Belum ada proyek diarsip":"Belum ada proyek"} description={isArsip?"Proyek yang diarsipkan akan muncul di sini.":(q?"Tidak ada proyek yang cocok.":'Buat proyek pertama lewat tab "Proyek Baru".')} variant="box-paper"/>
          ):daftar.map(p=>{
            const isExp=expandedId===p.id;
            const st=statusStyle[p.status]||statusStyle.berlangsung;
            const es=entriAktifPL(entriPer.get(Number(p.id)));
            const tertunda=es.some(e=>drafAda[kunciEntri(Number(e.id))]);
            const pembuat=Number(p.dibuat_pekerja_id)===Number(user.id);
            const tgl=tglTambah[p.id]||hk;
            const sudahAda=es.some(e=>e.tanggal===tgl&&Number(e.pekerja_id)===Number(user.id));
            const adaOrangLain=es.some(e=>Number(e.pekerja_id)!==Number(user.id));
            return(
              <div key={p.id} style={{border:"1px solid #f1f5f9",borderRadius:12,marginBottom:8,overflow:"hidden"}}>
                <div onClick={()=>setExpandedId(isExp?null:p.id)} style={{padding:"12px 14px",cursor:"pointer",background:isExp?"#f8fafc":"#fff",
                  display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                  <div style={{minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>{p.nama_lokasi}</div>
                    <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>📍 {p.lokasi||p.nama_lokasi} · {es.length} hari{es[0]?` · terakhir ${es[0].tanggal}`:""}{aktivitasPL(p)?` · diperbarui ${labelWaktuPL(aktivitasPL(p))}`:""}</div>
                    {tertunda&&<div style={{fontSize:10.5,color:"#b45309",fontWeight:700,marginTop:2}}>⏳ catatan belum terkirim</div>}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                    {p.is_archived&&<span style={{background:"#f1f5f9",color:"#64748b",borderRadius:20,padding:"3px 10px",fontSize:10.5,fontWeight:700}}>Arsip</span>}
                    <span style={{background:st.bg,color:st.color,borderRadius:20,padding:"3px 10px",fontSize:10.5,fontWeight:700}}>{st.label}</span>
                    <span style={{fontSize:12,color:"#94a3b8"}}>{isExp?"▼":"▶"}</span>
                  </div>
                </div>
                {isExp&&(
                  <div style={{padding:"12px 14px",borderTop:"1px solid #f1f5f9"}}>
                    <div style={{fontSize:11,color:"#94a3b8",marginBottom:10}}>Dibuat oleh {pembuat?"Anda":(p.dibuat_oleh||p.operator_nama)}{p.status==="selesai"&&p.selesai_oleh?` · Selesai oleh ${p.selesai_oleh}`:""}</div>
                    {p.status==="berlangsung"?(
                      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:12}}>
                        <input type="date" value={tgl} max={hk} onChange={e=>setTglTambah(t=>({...t,[p.id]:e.target.value}))}
                          style={{flex:"0 0 auto",padding:"8px 10px",borderRadius:10,border:"1.5px solid #e2e8f0",fontSize:12.5,fontFamily:"inherit"}}/>
                        <button onClick={()=>tambahPekerjaan(p)} disabled={membukaEntri!=null||sudahAda}
                          style={{flex:1,padding:"9px 10px",borderRadius:10,border:0,background:sudahAda?"#e2e8f0":"#1d4ed8",color:sudahAda?"#64748b":"#fff",fontSize:12.5,fontWeight:700,cursor:sudahAda?"default":"pointer",fontFamily:"inherit"}}>
                          {membukaEntri===p.id?"Membuka...":sudahAda?"Sudah ada - isi di bawah":tgl===hk?"+ Tambah pekerjaan hari ini":`+ Tambah pekerjaan ${tgl}`}
                        </button>
                      </div>
                    ):(
                      <div style={{fontSize:11.5,color:"#16a34a",background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"6px 10px",marginBottom:12}}>Proyek Selesai - pekerjaan tidak bisa ditambah. Hanya admin yang bisa membuka kembali.</div>
                    )}
                    {es.length===0&&<div style={{fontSize:12,color:"#94a3b8",marginBottom:10}}>Belum ada pekerjaan.</div>}
                    {es.map(e=>blokEntri(p,e))}
                    <div style={{display:"flex",gap:8,justifyContent:"flex-end",flexWrap:"wrap"}}>
                      {p.status==="berlangsung"&&pembuat&&(
                        <button onClick={()=>tandaiSelesai(p)} style={{fontSize:11,fontWeight:700,color:"#16a34a",background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"6px 12px",cursor:"pointer"}}>Tandai Selesai</button>
                      )}
                      <button onClick={()=>toggleArsip(p)} style={{fontSize:11,fontWeight:700,color:"#64748b",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:8,padding:"6px 12px",cursor:"pointer"}}>
                        {p.is_archived?"Batalkan Arsip":"Arsipkan"}
                      </button>
                      {p.status==="berlangsung"&&pembuat&&!adaOrangLain&&(
                        <button onClick={()=>hapusProyek(p)} style={{fontSize:11,fontWeight:700,color:"#b91c1c",background:"#fff",border:"1px solid #fecaca",borderRadius:8,padding:"6px 12px",cursor:"pointer"}}>Hapus proyek</button>
                      )}
                    </div>
                    {p.status==="berlangsung"&&!pembuat&&<div style={{fontSize:10.5,color:"#94a3b8",marginTop:6,textAlign:"right"}}>Tandai Selesai hanya oleh pembuat proyek ({p.dibuat_oleh||p.operator_nama}) atau admin.</div>}
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
