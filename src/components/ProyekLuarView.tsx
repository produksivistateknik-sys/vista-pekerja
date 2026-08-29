import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { compressImageNp } from "../lib/fotoHelpers";
import { uploadToR2 } from "../lib/r2Client";
import { FotoZoomViewerPekerja, type FotoViewerPekerja } from "./FotoZoomViewerPekerja";
import { MediaPickerSheet } from "./ui/MediaPickerSheet";
import { SectionCard, EmptyState } from "./ui/Primitives";

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
// kolom + FotoZoomViewerPekerja) - operator sudah familiar. Alur simpan foto: insert baris
// dulu (dapat id asli), BARU upload foto pakai id itu di path (proyek-luar/{id}/...), lalu
// update kolom foto - biar path foto konsisten nunjuk ke laporan yang benar dari awal.
// ─────────────────────────────────────────────────────────────────────────────
type StagedFoto={file:File,previewUrl:string};

export function ProyekLuarView({user}:{user:any}){
  const[mode,setMode]=useState<"list"|"form">("list");
  const[loading,setLoading]=useState(true);
  const[laporanList,setLaporanList]=useState<any[]>([]);
  const[expandedId,setExpandedId]=useState<number|null>(null);
  const[fotoViewer,setFotoViewer]=useState<{fotos:FotoViewerPekerja[],startIndex:number,label:string}|null>(null);

  const fetchLaporan=async()=>{
    setLoading(true);
    // .limit() defensif (audit egress Agu 2026) - proyek_luar punya kolom foto JSONB, histori
    // laporan operator bisa terus bertambah - cukup tampilkan yang terbaru.
    const{data}=await supabase.from("proyek_luar" as any).select("*").eq("pekerja_id",user.id).order("created_at",{ascending:false}).limit(100);
    setLaporanList(data||[]);
    setLoading(false);
  };
  useEffect(()=>{
    fetchLaporan();
    const ch=supabase.channel("realtime-proyek-luar-"+user.id)
      .on("postgres_changes",{event:"*",schema:"public",table:"proyek_luar",filter:"pekerja_id=eq."+user.id},fetchLaporan)
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[user.id]);

  // ── Form buat laporan baru ──
  const blankForm={namaLokasi:"",tanggal:new Date().toISOString().slice(0,10),catatan:"",status:"berlangsung"};
  const[form,setForm]=useState(blankForm);
  const[stagedFoto,setStagedFoto]=useState<StagedFoto[]>([]);
  const[saving,setSaving]=useState(false);

  const pilihFoto=(fileList:FileList|null)=>{
    if(!fileList||fileList.length===0)return;
    const dipilih=Array.from(fileList).map(file=>({file,previewUrl:URL.createObjectURL(file)}));
    setStagedFoto(prev=>[...prev,...dipilih]);
  };
  const batalkanFotoStaged=(idx:number)=>{
    setStagedFoto(prev=>{const arr=[...prev];URL.revokeObjectURL(arr[idx]?.previewUrl);arr.splice(idx,1);return arr;});
  };
  const resetForm=()=>{
    setForm(blankForm);
    stagedFoto.forEach(s=>URL.revokeObjectURL(s.previewUrl));
    setStagedFoto([]);
  };

  const uploadStagedFoto=async(laporanId:number,staged:StagedFoto[])=>{
    const hasil:any[]=[];
    for(const s of staged){
      try{
        const blob=await compressImageNp(s.file);
        const key=`proyek-luar/${laporanId}/${Date.now()}_${Math.random().toString(36).slice(2,8)}.jpg`;
        const publicUrl=await uploadToR2(blob,key,"image/jpeg");
        hasil.push({url:publicUrl,uploaded_at:new Date().toISOString()});
      }catch{ /* satu foto gagal - lanjut foto lain, jangan gagalkan semua */ }
    }
    return hasil;
  };

  const simpanLaporanBaru=async()=>{
    if(!form.namaLokasi.trim()){alert("Nama/lokasi proyek wajib diisi");return;}
    if(!form.tanggal){alert("Tanggal wajib diisi");return;}
    setSaving(true);
    try{
      const{data,error}=await supabase.from("proyek_luar" as any).insert({
        nama_lokasi:form.namaLokasi.trim(),
        tanggal:form.tanggal,
        catatan:form.catatan.trim()||null,
        status:form.status,
        pekerja_id:user.id,
        operator_nama:user.nama||user.name||"Operator",
        divisi:user.divisi,
      }).select().single();
      if(error||!data){alert("Gagal simpan: "+(error?.message||"unknown error"));setSaving(false);return;}
      if(stagedFoto.length>0){
        const fotoBaru=await uploadStagedFoto((data as any).id,stagedFoto);
        if(fotoBaru.length>0)await supabase.from("proyek_luar" as any).update({foto:fotoBaru}).eq("id",(data as any).id);
      }
      resetForm();
      setMode("list");
      fetchLaporan();
    }catch(err:any){
      alert("Terjadi kesalahan: "+err.message);
    }
    setSaving(false);
  };

  // ── Aksi di laporan yang sudah ada (tambah foto, ganti status) ──
  const[stagedFotoTambahan,setStagedFotoTambahan]=useState<StagedFoto[]>([]);
  const[savingTambahan,setSavingTambahan]=useState(false);
  const tambahFotoKeLaporan=async(laporan:any)=>{
    if(stagedFotoTambahan.length===0)return;
    setSavingTambahan(true);
    const fotoBaru=await uploadStagedFoto(laporan.id,stagedFotoTambahan);
    if(fotoBaru.length>0){
      const newFoto=[...(laporan.foto||[]),...fotoBaru];
      await supabase.from("proyek_luar" as any).update({foto:newFoto,updated_at:new Date().toISOString()}).eq("id",laporan.id);
    }
    stagedFotoTambahan.forEach(s=>URL.revokeObjectURL(s.previewUrl));
    setStagedFotoTambahan([]);
    setSavingTambahan(false);
    fetchLaporan();
  };
  const ubahStatus=async(laporan:any,statusBaru:string)=>{
    await supabase.from("proyek_luar" as any).update({status:statusBaru,updated_at:new Date().toISOString()}).eq("id",laporan.id);
    fetchLaporan();
  };

  const statusStyle:any={
    berlangsung:{bg:"#fffbeb",color:"#d97706",label:"Berlangsung"},
    selesai:{bg:"#f0fdf4",color:"#16a34a",label:"Selesai"},
  };

  return(
    <div style={{padding:16}}>
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        <button onClick={()=>setMode("list")} style={{flex:1,padding:"10px",borderRadius:10,border:"none",cursor:"pointer",
          fontSize:12.5,fontWeight:700,background:mode==="list"?"#1d4ed8":"#e2e8f0",color:mode==="list"?"#fff":"#64748b"}}>
          📋 Daftar Laporan
        </button>
        <button onClick={()=>setMode("form")} style={{flex:1,padding:"10px",borderRadius:10,border:"none",cursor:"pointer",
          fontSize:12.5,fontWeight:700,background:mode==="form"?"#1d4ed8":"#e2e8f0",color:mode==="form"?"#fff":"#64748b"}}>
          ➕ Buat Laporan
        </button>
      </div>

      {mode==="form"?(
        <SectionCard icon="🏗" title="Laporan Proyek Luar Baru">
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div>
              <label style={{fontSize:11,fontWeight:700,color:"#64748b",display:"block",marginBottom:4}}>Nama/Lokasi Proyek</label>
              <input value={form.namaLokasi} onChange={e=>setForm({...form,namaLokasi:e.target.value})} placeholder="mis. Pabrik ABC, Gresik"
                style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid #e2e8f0",fontSize:13,fontFamily:"inherit",boxSizing:"border-box"}}/>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:700,color:"#64748b",display:"block",marginBottom:4}}>Tanggal Pengerjaan</label>
              <input type="date" value={form.tanggal} onChange={e=>setForm({...form,tanggal:e.target.value})}
                style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid #e2e8f0",fontSize:13,fontFamily:"inherit",boxSizing:"border-box"}}/>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:700,color:"#64748b",display:"block",marginBottom:4}}>Catatan/Deskripsi Pekerjaan</label>
              <textarea value={form.catatan} onChange={e=>setForm({...form,catatan:e.target.value})} rows={3} placeholder="Deskripsi pekerjaan yang dilakukan..."
                style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid #e2e8f0",fontSize:13,fontFamily:"inherit",boxSizing:"border-box",resize:"vertical" as const}}/>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:700,color:"#64748b",display:"block",marginBottom:4}}>Status</label>
              <div style={{display:"flex",gap:8}}>
                {["berlangsung","selesai"].map(s=>(
                  <button key={s} onClick={()=>setForm({...form,status:s})}
                    style={{flex:1,padding:"10px",borderRadius:10,border:`2px solid ${form.status===s?statusStyle[s].color:"#e2e8f0"}`,
                      background:form.status===s?statusStyle[s].bg:"#f8fafc",color:form.status===s?statusStyle[s].color:"#64748b",
                      cursor:"pointer",fontWeight:700,fontSize:12.5,fontFamily:"inherit"}}>
                    {statusStyle[s].label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                <label style={{fontSize:11,fontWeight:700,color:"#64748b"}}>Dokumentasi Foto ({stagedFoto.length})</label>
                <MediaPickerSheet onFiles={pilihFoto} triggerStyle={{display:"flex",alignItems:"center",gap:4,cursor:"pointer",color:"#2563eb",fontSize:11,fontWeight:700}}>
                  <i className="ti ti-plus" style={{fontSize:12}}/> Tambah
                </MediaPickerSheet>
              </div>
              {stagedFoto.length>0&&(
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
                  {stagedFoto.map((s,i)=>(
                    <div key={i} style={{position:"relative",aspectRatio:"1",borderRadius:8,overflow:"hidden",background:"#f1f5f9"}}>
                      <img src={s.previewUrl} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                      <button onClick={()=>batalkanFotoStaged(i)} style={{position:"absolute",top:3,right:3,width:18,height:18,borderRadius:99,
                        background:"rgba(15,23,42,0.6)",color:"#fff",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                        <i className="ti ti-x" style={{fontSize:10}}/>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button onClick={simpanLaporanBaru} disabled={saving}
              style={{width:"100%",padding:13,fontSize:14,fontWeight:700,color:"#fff",background:"#1d4ed8",
                border:"none",borderRadius:10,cursor:saving?"default":"pointer",fontFamily:"inherit",opacity:saving?.7:1}}>
              {saving?"Menyimpan...":"Simpan Laporan"}
            </button>
          </div>
        </SectionCard>
      ):(
        <SectionCard icon="📋" title="Laporan Saya" subtitle={loading?"Memuat...":`${laporanList.length} laporan`}>
          {loading?(
            <div style={{textAlign:"center",padding:20,color:"#94a3b8",fontSize:12}}>Memuat...</div>
          ):laporanList.length===0?(
            <EmptyState title="Belum ada laporan" description={'Buat laporan proyek luar pertama Anda lewat tab "Buat Laporan".'} variant="box-paper"/>
          ):laporanList.map(l=>{
            const isExp=expandedId===l.id;
            const st=statusStyle[l.status]||statusStyle.berlangsung;
            const fotoList:any[]=l.foto||[];
            return(
              <div key={l.id} style={{border:"1px solid #f1f5f9",borderRadius:12,marginBottom:8,overflow:"hidden"}}>
                <div onClick={()=>setExpandedId(isExp?null:l.id)} style={{padding:"12px 14px",cursor:"pointer",background:isExp?"#f8fafc":"#fff",
                  display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                  <div style={{minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>{l.nama_lokasi}</div>
                    <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>📅 {l.tanggal} · {fotoList.length} foto</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                    <span style={{background:st.bg,color:st.color,borderRadius:20,padding:"3px 10px",fontSize:10.5,fontWeight:700}}>{st.label}</span>
                    <span style={{fontSize:12,color:"#94a3b8"}}>{isExp?"▼":"▶"}</span>
                  </div>
                </div>
                {isExp&&(
                  <div style={{padding:"12px 14px",borderTop:"1px solid #f1f5f9"}}>
                    {l.catatan&&<div style={{fontSize:12.5,color:"#475569",marginBottom:12,lineHeight:1.5}}>{l.catatan}</div>}
                    {fotoList.length>0&&(
                      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginBottom:12}}>
                        {fotoList.map((f:any,fi:number)=>(
                          <div key={fi} onClick={()=>setFotoViewer({fotos:fotoList,startIndex:fi,label:l.nama_lokasi})}
                            style={{aspectRatio:"1",borderRadius:8,overflow:"hidden",cursor:"pointer",background:"#f1f5f9"}}>
                            <img src={f.url} loading="lazy" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                      <MediaPickerSheet onFiles={(files)=>{
                          const dipilih=Array.from(files).map(file=>({file,previewUrl:URL.createObjectURL(file)}));
                          setStagedFotoTambahan(dipilih);
                        }} triggerStyle={{display:"flex",alignItems:"center",gap:4,cursor:"pointer",color:"#2563eb",fontSize:11.5,fontWeight:700}}>
                        <i className="ti ti-camera-plus" style={{fontSize:13}}/> Tambah Foto
                      </MediaPickerSheet>
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
                    </div>
                    {stagedFotoTambahan.length>0&&(
                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        <span style={{fontSize:11,color:"#94a3b8"}}>{stagedFotoTambahan.length} foto siap diupload</span>
                        <button onClick={()=>tambahFotoKeLaporan(l)} disabled={savingTambahan}
                          style={{fontSize:11,fontWeight:700,color:"#fff",background:"#1d4ed8",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer"}}>
                          {savingTambahan?"Mengupload...":"Upload"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </SectionCard>
      )}

      {fotoViewer&&<FotoZoomViewerPekerja fotos={fotoViewer.fotos} startIndex={fotoViewer.startIndex} label={fotoViewer.label} onClose={()=>setFotoViewer(null)}/>}
    </div>
  );
}
