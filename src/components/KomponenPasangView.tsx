import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { PCT_STEPS } from "../lib/panelTypes";
import { TODAY } from "../lib/dateHelpers";
import { withRetry } from "../lib/koneksi";
import { fetchAllPanels, isKomponenRelevant, hitungProgressBusbarGabungan, PASANG_KOMPONEN_TAHAP_KOMPONEN_NAMA, PASANG_KOMPONEN_URUTAN_TAHAP } from "../lib/panelHelpers";
import { getUrgensiPanel, fmtTanggalDeadlineNp } from "../lib/progressHelpers";
import { compressImageNp, hapusFotoDariStorage } from "../lib/fotoHelpers";
import { FotoZoomViewerPekerja, type FotoViewerPekerja } from "./FotoZoomViewerPekerja";
import { MediaPickerSheet } from "./ui/MediaPickerSheet";

export type KomponenPasangTugas={
  seksi:"assembling_luar"|"wiring_control";
  label:string;icon:string;color:string;
  tahap:"ASSEMBLING"|"WIRING";
  fotoBucket:string;
  fotoScope:"panel"|"kode"; // panel = pasang_komponen_photos (shared 1 galeri/panel), kode = fotoPemasangan (per-komponen)
};

// ─────────────────────────────────────────────────────────────────────────────
// KOMPONEN PASANG VIEW - tab "Komponen" (Wiring Control/Assembling Luar), GANTI section
// "Kontribusi Pasang Komponen" yang dulu nempel di card OperatorView (dihapus 7 Agu 2026).
// Navigasi 3 level SAMA PERSIS pola KomponenProgressView (Tab QS/Warehouse): Proyek -> Panel ->
// Detail (accordion). Beda dari QS/Warehouse yang 1 progress+foto FLAT per panel, di sini BISA
// ada beberapa komponen relevan per panel (Box Control/Pintu = tahap ASSEMBLING/WIRING dari
// checklist[kode].pasangKomponenTahap, komponen lain di Assembling Luar mis. Groundplate = progress
// polos checklist[kode].progress["PASANG KOMPONEN"]) - jadi Level 3 nampilin LIST kartu komponen,
// bukan 1 widget tunggal. TANPA operator/timer (sama kayak QS) - simpan progress = klik Simpan
// Progress, archive ke panel_seksi_archived (ON CONFLICT panel_id,seksi,kode - constraint yang
// sama dipakai trigger panels_auto_archive_seksi()) langsung berapapun persennya.
// ─────────────────────────────────────────────────────────────────────────────
export function KomponenPasangView({user,tugas}:{user:any,tugas:KomponenPasangTugas}){
  const[panelsRaw,setPanelsRaw]=useState<any[]>([]);
  const[woMap,setWoMap]=useState<Record<number,any>>({});
  const[kodeNamaMap,setKodeNamaMap]=useState<Record<string,string>>({});
  const[relevanSet,setRelevanSet]=useState<Set<string>>(new Set());
  const[hasMappingSet,setHasMappingSet]=useState<Set<string>>(new Set());
  const[loading,setLoading]=useState(true);
  const[search,setSearch]=useState("");
  const[selectedWoId,setSelectedWoId]=useState<number|null>(null);
  const[expandedPanel,setExpandedPanel]=useState<Set<number>>(new Set());
  const togglePanel=(panelId:number)=>{
    setExpandedPanel(prev=>{
      const next=new Set(prev);
      if(next.has(panelId))next.delete(panelId);else next.add(panelId);
      return next;
    });
  };

  const[savingKey,setSavingKey]=useState<string|null>(null);
  const[stagedFoto,setStagedFoto]=useState<Record<string,{file:File,previewUrl:string}[]>>({});
  const[fotoViewer,setFotoViewer]=useState<{fotos:FotoViewerPekerja[],startIndex:number,label:string}|null>(null);

  // BUG FIX (7 Agu 2026): sebelumnya gak ada cara tau "komponen ini progress-nya SAMA PERSIS
  // kayak yang udah diarsip" - tombol Simpan Progress selalu aktif walau gak ada yang berubah,
  // termasuk komponen yang progress-nya 100% dari SEBELUM fitur arsip ini ada (kejadian nyata:
  // Groundplate LP-LOCKER, history 2026-08-01, jauh sebelum tab ini dibangun - gak pernah diarsip
  // karena belum ada mekanismenya waktu itu). arsipMap dipakai buat nunjukin "✅ Sudah Diarsip"
  // begitu pct saat ini == pct yang terakhir diarsip - tombol otomatis aktif lagi kalau progress
  // berubah lagi (gak match arsip lama).
  const[arsipMap,setArsipMap]=useState<Record<string,number>>({});
  const fetchArsip=async()=>{
    const{data}=await supabase.from("panel_seksi_archived").select("panel_id,kode,data").eq("seksi",tugas.seksi);
    const map:Record<string,number>={};
    (data||[]).forEach((r:any)=>{
      const pctTahap=r.data?.pasangKomponenTahap?.[tugas.tahap]?.progress;
      const pct=typeof pctTahap==="number"?pctTahap:r.data?.progress;
      if(typeof pct==="number")map[`${r.panel_id}|${r.kode}`]=pct;
    });
    setArsipMap(map);
  };
  useEffect(()=>{
    fetchArsip();
    const ch=supabase.channel(`realtime-arsip-komponen-${tugas.seksi}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"panel_seksi_archived",filter:`seksi=eq.${tugas.seksi}`},fetchArsip)
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[tugas.seksi]);

  const fetchData=async()=>{
    setLoading(true);
    const[panels,{data:bomRows},{data:relevanRows}]=await Promise.all([
      fetchAllPanels(),
      supabase.from("bom_master").select("kode_komponen,nama_komponen"),
      supabase.from("bom_proses_relevan").select("*"),
    ]);
    const kMap:Record<string,string>={};
    (bomRows||[]).forEach((b:any)=>{kMap[b.kode_komponen]=b.nama_komponen;});
    const rSet=new Set<string>(),hSet=new Set<string>();
    (relevanRows||[]).forEach((r:any)=>{
      rSet.add(r.kode_komponen+"|"+r.tipe_panel+"|"+r.jenis_pekerjaan);
      hSet.add(r.kode_komponen+"|"+r.tipe_panel);
    });
    const woIds=[...new Set((panels||[]).map((p:any)=>p.wo_id).filter(Boolean))];
    const{data:wos}=woIds.length>0?await supabase.from("work_orders").select("id,wo,proyek,target,is_archived").in("id",woIds):{data:[]};
    const wMap:Record<number,any>={};
    (wos||[]).forEach((w:any)=>{wMap[w.id]=w;});
    setPanelsRaw((panels||[]).filter((p:any)=>!wMap[p.wo_id]?.is_archived));
    setWoMap(wMap);
    setKodeNamaMap(kMap);
    setRelevanSet(rSet);
    setHasMappingSet(hSet);
    setLoading(false);
  };

  useEffect(()=>{
    fetchData();
    const ch=supabase.channel(`realtime-komponen-pasang-${tugas.seksi}`)
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"panels"},()=>fetchData())
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[tugas.seksi]);

  // Komponen relevan buat seksi ini di 1 panel: qty>0, relevan ke proses "PASANG KOMPONEN", dan
  // (khusus wiring_control) cuma Box Control/Pintu - Wiring Control cuma kontribusi ke komponen
  // yang punya tahap WIRING, gak pernah ke komponen lain (Groundplate dst itu Assembling Luar aja).
  const komponenRelevanPanel=(panel:any):{kode:string,nama:string,isTahap:boolean}[]=>{
    return Object.entries(panel.checklist||{}).filter(([kode,cl]:any)=>{
      if(!((cl?.qty||0)>0))return false;
      if(!isKomponenRelevant(kode,panel.tipe,"PASANG KOMPONEN",relevanSet,hasMappingSet))return false;
      const nama=kodeNamaMap[kode]||kode;
      if(tugas.seksi==="wiring_control")return PASANG_KOMPONEN_TAHAP_KOMPONEN_NAMA.includes(nama);
      return true;
    }).map(([kode]:any)=>({kode,nama:kodeNamaMap[kode]||kode,isTahap:PASANG_KOMPONEN_TAHAP_KOMPONEN_NAMA.includes(kodeNamaMap[kode]||kode)}));
  };

  const getProgress=(panel:any,kode:string,isTahap:boolean):number=>{
    const cl=panel.checklist?.[kode];
    if(isTahap)return cl?.pasangKomponenTahap?.[tugas.tahap]?.progress||0;
    return cl?.progress?.["PASANG KOMPONEN"]||0;
  };

  // PCT_STEPS klik - persist LANGSUNG ke checklist (live), TIDAK checkpoint/archive - sama
  // persis format Wiring Control yang sudah ada (updatePctManualPasangKomponenTahap dulu).
  const updatePctLive=async(panel:any,kode:string,isTahap:boolean,pct:number)=>{
    const cl=panel.checklist?.[kode]||{qty:0,progress:{},progressByDate:{}};
    let newCl:any;
    if(isTahap){
      const tahapState=cl.pasangKomponenTahap||{};
      const newTahap={...tahapState,[tugas.tahap]:{...tahapState[tugas.tahap],progress:pct}};
      const combined=hitungProgressBusbarGabungan(newTahap,PASANG_KOMPONEN_URUTAN_TAHAP);
      newCl={...cl,pasangKomponenTahap:newTahap,progress:{...(cl.progress||{}),"PASANG KOMPONEN":combined},
        progressByDate:{...(cl.progressByDate||{}),"PASANG KOMPONEN":{...((cl.progressByDate||{})["PASANG KOMPONEN"]||{}),[TODAY]:combined}}};
    } else {
      newCl={...cl,progress:{...(cl.progress||{}),"PASANG KOMPONEN":pct},
        progressByDate:{...(cl.progressByDate||{}),"PASANG KOMPONEN":{...((cl.progressByDate||{})["PASANG KOMPONEN"]||{}),[TODAY]:pct}}};
    }
    const newChecklist={...panel.checklist,[kode]:newCl};
    setPanelsRaw(prev=>prev.map((p:any)=>p.id===panel.id?{...p,checklist:newChecklist}:p));
    await withRetry(()=>supabase.from("panels").update({checklist:newChecklist}).eq("id",panel.id));
  };

  // "Simpan Progress" - commit checkpoint+history (fresh-refetch checklist biar gak nimpa balik
  // perubahan operator lain ke kode LAIN di panel yang sama, sama pola simpanProgressTahapPasangKomponen)
  // + upsert ke panel_seksi_archived (ON CONFLICT panel_id,seksi,kode - update entry lama kalau
  // udah pernah diarsip, BUKAN insert baru) - berapapun persennya, gak nunggu 100%.
  const simpanProgress=async(panel:any,kode:string,nama:string,isTahap:boolean)=>{
    const key=`${panel.id}_${kode}`;
    const pct=getProgress(panelsRaw.find((p:any)=>p.id===panel.id)||panel,kode,isTahap);
    if(pct===0){alert("Progress masih 0%, belum ada yang bisa disimpan.");return;}
    const clNow=panel.checklist?.[kode];
    if(tugas.fotoScope==="kode"&&(clNow?.fotoPemasangan||[]).length===0){
      alert("Belum bisa disimpan - upload minimal 1 foto pemasangan dulu.");
      return;
    }
    setSavingKey(key);
    try{
      const{data:freshRow}=await supabase.from("panels").select("checklist").eq("id",panel.id).single();
      const freshChecklist=freshRow?.checklist||panel.checklist;
      const freshCl=freshChecklist[kode]||{};
      const combined=isTahap?(freshCl.progress?.["PASANG KOMPONEN"]||pct):pct;
      const prevHist=freshCl.history?.["PASANG KOMPONEN"]||[];
      const existIdx=prevHist.findIndex((h:any)=>h.tanggal===TODAY);
      const newChecklist={...freshChecklist};
      if(existIdx>=0){
        const updatedHist=[...prevHist];
        updatedHist[existIdx]={...updatedHist[existIdx],pct:combined,ts:new Date().toISOString()};
        newChecklist[kode]={...freshCl,history:{...(freshCl.history||{}),"PASANG KOMPONEN":updatedHist}};
      } else {
        const newEntry={pct:combined,tanggal:TODAY,ts:new Date().toISOString()};
        newChecklist[kode]={...freshCl,history:{...(freshCl.history||{}),"PASANG KOMPONEN":[...prevHist,newEntry]}};
      }
      const{error:cpErr}=await withRetry(()=>supabase.from("progress_checkpoint_log").insert({
        panel_id:panel.id,kode_komponen:kode,proses:"PASANG KOMPONEN",checkpoint:combined,pekerja_nama:user.nama,tanggal:TODAY,
      }));
      if(cpErr)throw cpErr;
      const{error:panelErr}=await withRetry(()=>supabase.from("panels").update({checklist:newChecklist}).eq("id",panel.id));
      if(panelErr)throw panelErr;
      setPanelsRaw(prev=>prev.map((p:any)=>p.id===panel.id?{...p,checklist:newChecklist}:p));

      const wo=woMap[panel.wo_id];
      const archiveData=isTahap
        ?{pasangKomponenTahap:{[tugas.tahap]:freshCl.pasangKomponenTahap?.[tugas.tahap]||{progress:pct,sudahDisimpan100:pct>=100}},
           ...(tugas.fotoScope==="panel"?{pasang_komponen_photos:panel.pasang_komponen_photos||[]}:{fotoPemasangan:freshCl.fotoPemasangan||[]})}
        :{progress:pct,pasang_komponen_photos:panel.pasang_komponen_photos||[]};
      const{error:arsipErr}=await withRetry(()=>supabase.from("panel_seksi_archived").upsert({
        panel_id:panel.id,wo_id:panel.wo_id||null,seksi:tugas.seksi,kode,komponen_nama:nama,data:archiveData,
        panel_nama:panel.nama,panel_tipe:panel.tipe,proyek_snapshot:wo?.proyek||null,wo_number_snapshot:wo?.wo||null,
        diarsipkan_pada:new Date().toISOString(),diarsipkan_oleh:user.nama,
      },{onConflict:"panel_id,seksi,kode"}));
      if(arsipErr)throw arsipErr;
      // BUG FIX (8 Agu 2026): update arsipMap OPTIMISTIC di sini (jangan nunggu round-trip
      // realtime) - biar begitu operator dismiss alert, kartu ini LANGSUNG hilang dari
      // accordion (lihat filter relevanBelumArsip di render), sesuai spek awal "Simpan ->
      // komponen langsung hilang dari card aktif, masuk arsip" - bukan cuma nunjukin badge
      // "Sudah Diarsip" doang sambil kartu tetap nangkring di situ.
      setArsipMap(prev=>({...prev,[`${panel.id}|${kode}`]:pct}));
      alert("Progress tersimpan & diarsipkan.");
    }catch(err:any){
      alert("Gagal simpan: "+(err?.message||"koneksi bermasalah, coba lagi."));
    }
    setSavingKey(null);
  };

  const pilihFotoStaged=(key:string,fileList:FileList|null)=>{
    if(!fileList||fileList.length===0)return;
    const dipilih=Array.from(fileList).map(file=>({file,previewUrl:URL.createObjectURL(file)}));
    setStagedFoto(prev=>({...prev,[key]:[...(prev[key]||[]),...dipilih]}));
  };
  const batalkanFotoStaged=(key:string,idx:number)=>{
    setStagedFoto(prev=>{
      const arr=prev[key]||[];
      URL.revokeObjectURL(arr[idx]?.previewUrl);
      return{...prev,[key]:arr.filter((_,i)=>i!==idx)};
    });
  };
  const simpanFotoStaged=async(panel:any,key:string,pathPrefix:string)=>{
    const staged=stagedFoto[key]||[];
    if(staged.length===0)return;
    setSavingKey("foto_"+key);
    try{
      const fotoTerupload:any[]=[];
      for(const s of staged){
        const blob=await compressImageNp(s.file);
        const path=`${pathPrefix}/${Date.now()}_${Math.random().toString(36).slice(2,8)}.jpg`;
        const{error:upErr}=await supabase.storage.from(tugas.fotoBucket).upload(path,blob,{contentType:"image/jpeg"});
        if(upErr){alert(`Gagal upload salah satu foto: ${upErr.message}`);continue;}
        const{data:urlData}=supabase.storage.from(tugas.fotoBucket).getPublicUrl(path);
        fotoTerupload.push({url:urlData.publicUrl,uploaded_by:user.nama,uploaded_at:new Date().toISOString()});
      }
      if(tugas.fotoScope==="panel"){
        const newFoto=[...(panel.pasang_komponen_photos||[]),...fotoTerupload];
        await supabase.from("panels").update({pasang_komponen_photos:newFoto}).eq("id",panel.id);
        setPanelsRaw(prev=>prev.map((p:any)=>p.id===panel.id?{...p,pasang_komponen_photos:newFoto}:p));
      } else {
        const kode=key.split("_")[1];
        const cl=panel.checklist?.[kode]||{};
        const newFoto=[...(cl.fotoPemasangan||[]),...fotoTerupload];
        const newChecklist={...panel.checklist,[kode]:{...cl,fotoPemasangan:newFoto}};
        await supabase.from("panels").update({checklist:newChecklist}).eq("id",panel.id);
        setPanelsRaw(prev=>prev.map((p:any)=>p.id===panel.id?{...p,checklist:newChecklist}:p));
      }
      staged.forEach(s=>URL.revokeObjectURL(s.previewUrl));
      setStagedFoto(prev=>{const next={...prev};delete next[key];return next;});
    }catch(err:any){
      alert("Terjadi kesalahan: "+err.message);
    }
    setSavingKey(null);
  };
  const hapusFotoTersimpan=async(panel:any,kode:string|null,fotoUrl:string)=>{
    if(!window.confirm("Hapus foto ini?"))return;
    await hapusFotoDariStorage(tugas.fotoBucket,fotoUrl);
    if(tugas.fotoScope==="panel"){
      const newFoto=(panel.pasang_komponen_photos||[]).filter((f:any)=>f.url!==fotoUrl);
      await supabase.from("panels").update({pasang_komponen_photos:newFoto}).eq("id",panel.id);
      setPanelsRaw(prev=>prev.map((p:any)=>p.id===panel.id?{...p,pasang_komponen_photos:newFoto}:p));
    } else {
      const cl=panel.checklist?.[kode as string]||{};
      const newFoto=(cl.fotoPemasangan||[]).filter((f:any)=>f.url!==fotoUrl);
      const newChecklist={...panel.checklist,[kode as string]:{...cl,fotoPemasangan:newFoto}};
      await supabase.from("panels").update({checklist:newChecklist}).eq("id",panel.id);
      setPanelsRaw(prev=>prev.map((p:any)=>p.id===panel.id?{...p,checklist:newChecklist}:p));
    }
  };

  const urutanLevelNp:Record<string,number>={telat:0,mendesak:1,perhatian:2,normal:3};

  const projectGroups=useMemo(()=>{
    const groups:Record<string,{wo:any,panels:any[],totalKomponen:number,selesai:number}>={};
    panelsRaw.forEach((p:any)=>{
      const relevan=komponenRelevanPanel(p);
      if(relevan.length===0)return;
      const woId=String(p.wo_id);
      if(!groups[woId])groups[woId]={wo:woMap[p.wo_id],panels:[],totalKomponen:0,selesai:0};
      groups[woId].panels.push(p);
      relevan.forEach(r=>{
        groups[woId].totalKomponen++;
        if(getProgress(p,r.kode,r.isTahap)>=100)groups[woId].selesai++;
      });
    });
    return Object.entries(groups).map(([woId,g])=>({woId:Number(woId),...g})).sort((a,b)=>{
      const aDone=a.selesai===a.totalKomponen;
      const bDone=b.selesai===b.totalKomponen;
      if(aDone!==bDone)return aDone?1:-1;
      const uA=getUrgensiPanel(a.wo?.target);const uB=getUrgensiPanel(b.wo?.target);
      const lvA=urutanLevelNp[uA.level]??3;const lvB=urutanLevelNp[uB.level]??3;
      if(lvA!==lvB)return lvA-lvB;
      if(uA.hari!==null&&uB.hari!==null)return uA.hari-uB.hari;
      return 0;
    });
  },[panelsRaw,woMap,relevanSet,hasMappingSet,kodeNamaMap]);

  const filteredProjects=projectGroups.filter((g:any)=>
    !search||g.wo?.proyek?.toLowerCase().includes(search.toLowerCase())||g.wo?.wo?.toLowerCase().includes(search.toLowerCase())
  );

  const selectedProject=projectGroups.find((g:any)=>g.woId===selectedWoId);
  const warnaUrgMap:Record<string,{bg:string,color:string}>={telat:{bg:"#fef2f2",color:"#dc2626"},mendesak:{bg:"#fff7ed",color:"#ea580c"},perhatian:{bg:"#fefce8",color:"#ca8a04"}};

  if(!selectedWoId){
    const totalSemua=projectGroups.reduce((s,g)=>s+g.totalKomponen,0);
    const selesaiSemua=projectGroups.reduce((s,g)=>s+g.selesai,0);
    return(
      <div style={{padding:"14px 14px 28px",background:"#f8fafc",minHeight:"100%"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,padding:"14px 16px",borderRadius:16,
          background:`linear-gradient(135deg,${tugas.color},${tugas.color}cc)`,boxShadow:`0 6px 18px ${tugas.color}33`}}>
          <div style={{width:42,height:42,borderRadius:12,background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>
            {tugas.icon}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{color:"#fff",fontWeight:800,fontSize:15}}>{tugas.label}</div>
            <div style={{color:"rgba(255,255,255,0.85)",fontSize:11.5,marginTop:1}}>{selesaiSemua}/{totalSemua} komponen selesai · {projectGroups.length} proyek</div>
          </div>
        </div>

        <div style={{position:"relative" as const,marginBottom:14}}>
          <i className="ti ti-search" style={{position:"absolute" as const,left:13,top:"50%",transform:"translateY(-50%)",fontSize:16,color:"#94a3b8"}}/>
          <input value={search} onChange={(e:any)=>setSearch(e.target.value)} placeholder="Cari proyek atau WO..."
            style={{width:"100%",height:42,padding:"0 14px 0 38px",border:"1.5px solid #e2e8f0",borderRadius:12,fontSize:13.5,outline:"none",background:"#fff",boxSizing:"border-box" as const,color:"#1e293b"}}/>
        </div>

        {loading?(
          <div style={{textAlign:"center",padding:40,color:"#94a3b8"}}>
            <i className="ti ti-loader-2" style={{fontSize:26,display:"block",marginBottom:8}}/>
            Memuat data...
          </div>
        ):filteredProjects.length===0?(
          <div style={{textAlign:"center",padding:40,color:"#94a3b8"}}>
            <i className="ti ti-folder-x" style={{fontSize:32,display:"block",marginBottom:8}}/>
            Tidak ada proyek
          </div>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {filteredProjects.map((g:any)=>{
              const allDone=g.selesai===g.totalKomponen;
              const pctWo=g.totalKomponen>0?Math.round((g.selesai/g.totalKomponen)*100):0;
              const urg=getUrgensiPanel(g.wo?.target);
              const w=warnaUrgMap[urg.level];
              return(
                <div key={g.woId} onClick={()=>setSelectedWoId(g.woId)}
                  style={{position:"relative" as const,background:"#fff",borderRadius:16,padding:"14px 16px 14px 20px",cursor:"pointer",
                    opacity:allDone?0.72:1,border:"1.5px solid #eef0f3",boxShadow:"0 1px 3px rgba(15,23,42,0.05)",overflow:"hidden"}}>
                  <div style={{position:"absolute" as const,left:0,top:0,bottom:0,width:4,background:allDone?"#16a34a":tugas.color}}/>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:10}}>
                    <div style={{minWidth:0,flex:1}}>
                      <div style={{fontWeight:800,fontSize:15,color:"#0f172a",whiteSpace:"nowrap" as const,overflow:"hidden",textOverflow:"ellipsis"}}>{g.wo?.proyek}</div>
                      <div style={{fontSize:11,fontWeight:600,color:"#64748b",marginTop:3}}>
                        WO {g.wo?.wo}{g.wo?.target?` · Deadline ${fmtTanggalDeadlineNp(g.wo.target)}`:""}
                      </div>
                    </div>
                    {urg.label&&urg.level!=="normal"&&w?(
                      <span style={{fontSize:9,fontWeight:800,background:w.bg,color:w.color,borderRadius:20,padding:"4px 9px",whiteSpace:"nowrap" as const,flexShrink:0}}>
                        {urg.level==="telat"?"⚠ ":"⏰ "}{urg.label}
                      </span>
                    ):(
                      <i className="ti ti-chevron-right" style={{fontSize:18,color:"#cbd5e1",flexShrink:0,marginTop:2}}/>
                    )}
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                    <span style={{fontSize:11,fontWeight:700,color:allDone?"#16a34a":"#64748b"}}>
                      {allDone?"✓ Semua selesai":`${g.selesai}/${g.totalKomponen} komponen selesai`}
                    </span>
                    <span style={{fontSize:11,fontWeight:800,color:allDone?"#16a34a":tugas.color}}>{pctWo}%</span>
                  </div>
                  <div style={{height:6,borderRadius:99,background:"#f1f5f9",overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${pctWo}%`,borderRadius:99,background:allDone?"#16a34a":tugas.color,transition:"width .35s ease"}}/>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return(
    <div style={{padding:"14px 14px 28px",background:"#f8fafc",minHeight:"100%"}}>
      <button onClick={()=>setSelectedWoId(null)}
        style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:tugas.color,fontWeight:700,fontSize:13,cursor:"pointer",marginBottom:12,padding:0}}>
        <i className="ti ti-arrow-left" style={{fontSize:16}}/> Kembali ke Daftar Proyek
      </button>

      <div style={{background:"#fff",borderRadius:16,padding:16,marginBottom:14,border:"1.5px solid #eef0f3",boxShadow:"0 1px 3px rgba(15,23,42,0.05)"}}>
        <div style={{fontWeight:800,fontSize:16.5,color:"#0f172a"}}>{selectedProject?.wo?.proyek}</div>
        <div style={{fontSize:11.5,fontWeight:600,color:"#64748b",marginTop:3}}>
          WO {selectedProject?.wo?.wo}{selectedProject?.wo?.target?` · Deadline ${fmtTanggalDeadlineNp(selectedProject.wo.target)}`:""}
        </div>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {(selectedProject?.panels||[]).map((p:any)=>{
          const relevan=komponenRelevanPanel(p);
          const selesaiPanel=relevan.filter(r=>getProgress(p,r.kode,r.isTahap)>=100).length;
          const allDonePanel=selesaiPanel===relevan.length;
          // BUG FIX (8 Agu 2026): komponen yang progress-nya SAMA PERSIS kayak yang terakhir
          // diarsip HILANG dari accordion (sesuai spek "Simpan -> langsung hilang dari card
          // aktif") - header panel (selesaiPanel/relevan.length) TETAP hitung dari `relevan`
          // penuh, cuma isi accordion-nya yang difilter.
          const relevanBelumArsip=relevan.filter(r=>{
            const pctR=getProgress(p,r.kode,r.isTahap);
            const arsipPctR=arsipMap[`${p.id}|${r.kode}`];
            return !(arsipPctR!==undefined&&arsipPctR===pctR);
          });
          const expanded=expandedPanel.has(p.id);
          const fotoPanelArr=p.pasang_komponen_photos||[];
          const stagedPanelKey=`panelfoto_${p.id}`;
          const stagedPanel=stagedFoto[stagedPanelKey]||[];
          const savingPanelFoto=savingKey==="foto_"+stagedPanelKey;
          return(
            <div key={p.id} style={{background:"#fff",borderRadius:14,border:"1.5px solid #eef0f3",overflow:"hidden",
              boxShadow:expanded?"0 6px 18px rgba(15,23,42,0.07)":"0 1px 2px rgba(15,23,42,0.03)",transition:"box-shadow .15s"}}>
              <div onClick={()=>togglePanel(p.id)}
                style={{display:"flex",alignItems:"center",gap:11,padding:"13px 15px",cursor:"pointer"}}>
                <div style={{width:38,height:38,borderRadius:11,background:allDonePanel?"#dcfce7":"#eff6ff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <i className={`ti ${allDonePanel?"ti-circle-check-filled":"ti-tool"}`} style={{fontSize:18,color:allDonePanel?"#16a34a":"#2563eb"}}/>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:800,fontSize:14.5,color:"#0f172a",whiteSpace:"nowrap" as const,overflow:"hidden",textOverflow:"ellipsis"}}>{p.nama}</div>
                  <div style={{fontSize:10.5,fontWeight:600,color:allDonePanel?"#16a34a":"#64748b",marginTop:1}}>{selesaiPanel}/{relevan.length} komponen selesai</div>
                </div>
                <i className={`ti ti-chevron-down`} style={{fontSize:16,color:"#cbd5e1",flexShrink:0,transition:"transform .2s",transform:expanded?"rotate(180deg)":"none"}}/>
              </div>
              {expanded&&(
                <div style={{padding:"2px 15px 16px",borderTop:"1px solid #f1f5f9",display:"flex",flexDirection:"column" as const,gap:12,marginTop:12}}>
                  {relevanBelumArsip.length===0&&relevan.length>0&&(
                    <div style={{textAlign:"center" as const,padding:"16px 0",color:"#16a34a",fontSize:12,fontWeight:700}}>
                      ✅ Semua komponen sudah diarsip
                    </div>
                  )}
                  {relevanBelumArsip.map(r=>{
                    const pct=getProgress(p,r.kode,r.isTahap);
                    const key=`${p.id}_${r.kode}`;
                    const saving=savingKey===key;
                    const fotoKodeArr=p.checklist?.[r.kode]?.fotoPemasangan||[];
                    const stagedKodeFoto=stagedFoto[key]||[];
                    // BUG FIX (7 Agu 2026): "sudah diarsip" = pct sekarang PERSIS sama kayak pct
                    // terakhir yang diarsip - kalau progress berubah lagi (naik/turun), otomatis
                    // gak dianggap "sudah" lagi, tombol Simpan Progress aktif lagi.
                    const arsipPct=arsipMap[`${p.id}|${r.kode}`];
                    const sudahDiarsip=arsipPct!==undefined&&arsipPct===pct;
                    return(
                      <div key={r.kode} style={{border:"1.5px solid #eef0f3",borderRadius:12,padding:"12px 13px",background:pct>=100?"#f0fdf4":"#fafbfc"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                          <span style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>{r.nama}</span>
                          <span style={{fontSize:11,fontWeight:800,color:pct>=100?"#16a34a":tugas.color}}>{pct}%</span>
                        </div>
                        <div style={{display:"flex",gap:6,marginBottom:tugas.fotoScope==="kode"?10:0}}>
                          {PCT_STEPS.map((s:number)=>{
                            const reached=pct>=s;
                            // BUG FIX (7 Agu 2026): "isNext" (highlight langkah berikutnya) cuma
                            // masuk akal kalau progress SUDAH mulai (pct>0) - kalau komponen belum
                            // disentuh sama sekali (pct===0), langkah 25% jangan ikut ke-highlight,
                            // kelihatan kayak "udah kepilih" padahal belum ada kerjaan sama sekali.
                            const isNext=pct>0&&s===PCT_STEPS.find((x:number)=>x>pct);
                            const prevStep=PCT_STEPS[PCT_STEPS.indexOf(s)-1]||0;
                            return(
                              <button key={s} onClick={()=>updatePctLive(p,r.kode,r.isTahap,reached?prevStep:s)}
                                style={{flex:1,minWidth:36,padding:"8px 3px",borderRadius:8,border:"none",cursor:"pointer",
                                  background:reached?tugas.color:isNext?`${tugas.color}14`:"#f1f5f9",
                                  color:reached?"#fff":isNext?tugas.color:"#94a3b8",
                                  fontWeight:700,fontSize:10.5}}>
                                {reached?"✓":`${s}%`}
                              </button>
                            );
                          })}
                        </div>
                        {tugas.fotoScope==="kode"&&(
                          <>
                            <div style={{display:"flex",alignItems:"center",gap:5,fontSize:9.5,fontWeight:700,color:"#94a3b8",marginBottom:6,letterSpacing:0.3}}>
                              <i className="ti ti-camera" style={{fontSize:11}}/> FOTO PEMASANGAN {r.isTahap&&tugas.tahap==="WIRING"?"(WAJIB)":""}
                            </div>
                            {fotoKodeArr.length===0&&stagedKodeFoto.length===0?(
                              <div style={{fontSize:11,color:"#cbd5e1",padding:"2px 0 8px",fontStyle:"italic" as const}}>Belum ada foto</div>
                            ):(
                              <div style={{display:"flex",flexWrap:"wrap" as const,gap:6,marginBottom:8}}>
                                {fotoKodeArr.map((f:any,fi:number)=>(
                                  <div key={`saved_${fi}`} style={{position:"relative" as const}}>
                                    <img onClick={()=>setFotoViewer({fotos:fotoKodeArr,startIndex:fi,label:`${r.nama}_${p.nama}`})}
                                      src={f.url} loading="lazy" style={{width:52,height:52,borderRadius:8,objectFit:"cover" as const,border:"1px solid #eef0f3",cursor:"pointer"}}/>
                                    <button onClick={(e:any)=>{e.stopPropagation();hapusFotoTersimpan(p,r.kode,f.url);}}
                                      style={{position:"absolute" as const,top:-6,right:-6,width:18,height:18,borderRadius:99,background:"#dc2626",color:"#fff",border:"2px solid #fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                                      <i className="ti ti-trash" style={{fontSize:10}}/>
                                    </button>
                                  </div>
                                ))}
                                {stagedKodeFoto.map((s,si)=>(
                                  <div key={`staged_${si}`} style={{position:"relative" as const}}>
                                    <img src={s.previewUrl} style={{width:52,height:52,borderRadius:8,objectFit:"cover" as const,border:`1.5px dashed ${tugas.color}`}}/>
                                    <button onClick={()=>batalkanFotoStaged(key,si)}
                                      style={{position:"absolute" as const,top:-6,right:-6,width:18,height:18,borderRadius:99,background:"#dc2626",color:"#fff",border:"2px solid #fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                                      <i className="ti ti-x" style={{fontSize:10}}/>
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div style={{display:"flex",gap:6,flexWrap:"wrap" as const,marginBottom:10}}>
                              <MediaPickerSheet disabled={saving}
                                triggerStyle={{display:"inline-flex",alignItems:"center",gap:4,fontSize:11,fontWeight:700,color:tugas.color,background:`${tugas.color}0f`,border:`1px dashed ${tugas.color}55`,borderRadius:8,padding:"7px 11px",cursor:"pointer"}}
                                onFiles={(files)=>pilihFotoStaged(key,files)}>
                                + Tambah Foto
                              </MediaPickerSheet>
                              {stagedKodeFoto.length>0&&(
                                <button onClick={()=>simpanFotoStaged(p,key,`${p.id}/${r.kode}`)} disabled={savingKey==="foto_"+key}
                                  style={{fontSize:11,fontWeight:700,color:"#fff",background:tugas.color,border:"none",borderRadius:8,padding:"7px 12px",cursor:"pointer"}}>
                                  {savingKey==="foto_"+key?"⏳ Menyimpan...":"💾 Simpan Foto"}
                                </button>
                              )}
                            </div>
                          </>
                        )}
                        <button onClick={()=>simpanProgress(p,r.kode,r.nama,r.isTahap)} disabled={saving||pct===0||sudahDiarsip}
                          style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,width:"100%",
                            background:sudahDiarsip?"#dcfce7":saving||pct===0?"#cbd5e1":tugas.color,
                            color:sudahDiarsip?"#16a34a":"#fff",border:"none",borderRadius:10,padding:"10px 10px",fontSize:12,fontWeight:700,
                            cursor:saving||pct===0||sudahDiarsip?"not-allowed":"pointer"}}>
                          <i className={saving?"ti ti-loader-2":sudahDiarsip?"ti ti-circle-check-filled":"ti ti-device-floppy"} style={{fontSize:14}}/>
                          {saving?"Menyimpan...":sudahDiarsip?"✅ Sudah Diarsip":"Simpan Progress"}
                        </button>
                      </div>
                    );
                  })}
                  {tugas.fotoScope==="panel"&&(
                    <div style={{border:"1.5px solid #eef0f3",borderRadius:12,padding:"12px 13px",background:"#fafbfc"}}>
                      <div style={{display:"flex",alignItems:"center",gap:5,fontSize:9.5,fontWeight:700,color:"#94a3b8",marginBottom:8,letterSpacing:0.3}}>
                        <i className="ti ti-camera" style={{fontSize:11}}/> FOTO PEMASANGAN PANEL (SEMUA KOMPONEN)
                      </div>
                      {fotoPanelArr.length===0&&stagedPanel.length===0?(
                        <div style={{fontSize:11,color:"#cbd5e1",padding:"2px 0 10px",fontStyle:"italic" as const}}>Belum ada foto</div>
                      ):(
                        <div style={{display:"flex",flexWrap:"wrap" as const,gap:8,marginBottom:12}}>
                          {fotoPanelArr.map((f:any,fi:number)=>(
                            <div key={`saved_${fi}`} style={{position:"relative" as const}}>
                              <img onClick={()=>setFotoViewer({fotos:fotoPanelArr,startIndex:fi,label:p.nama})}
                                src={f.url} loading="lazy" style={{width:62,height:62,borderRadius:10,objectFit:"cover" as const,border:"1px solid #eef0f3",cursor:"pointer"}}/>
                              <button onClick={(e:any)=>{e.stopPropagation();hapusFotoTersimpan(p,null,f.url);}}
                                style={{position:"absolute" as const,top:-6,right:-6,width:18,height:18,borderRadius:99,background:"#dc2626",color:"#fff",border:"2px solid #fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                                <i className="ti ti-trash" style={{fontSize:10}}/>
                              </button>
                            </div>
                          ))}
                          {stagedPanel.map((s,si)=>(
                            <div key={`staged_${si}`} style={{position:"relative" as const}}>
                              <img src={s.previewUrl} style={{width:62,height:62,borderRadius:10,objectFit:"cover" as const,border:`1.5px dashed ${tugas.color}`}}/>
                              <button onClick={()=>batalkanFotoStaged(stagedPanelKey,si)}
                                style={{position:"absolute" as const,top:-6,right:-6,width:19,height:19,borderRadius:99,background:"#dc2626",color:"#fff",border:"2px solid #fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                                <i className="ti ti-x" style={{fontSize:10}}/>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <MediaPickerSheet disabled={savingPanelFoto}
                        triggerStyle={{display:"inline-flex",alignItems:"center",gap:5,fontSize:11.5,fontWeight:700,color:tugas.color,background:`${tugas.color}0f`,border:`1.5px dashed ${tugas.color}55`,borderRadius:10,padding:"9px 13px",cursor:"pointer"}}
                        onFiles={(files)=>pilihFotoStaged(stagedPanelKey,files)}>
                        <i className="ti ti-camera-plus" style={{fontSize:14}}/> Tambah Foto
                      </MediaPickerSheet>
                      {stagedPanel.length>0&&(
                        <button onClick={()=>simpanFotoStaged(p,stagedPanelKey,`${p.id}`)} disabled={savingPanelFoto}
                          style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginTop:12,width:"100%",
                            background:savingPanelFoto?"#cbd5e1":tugas.color,color:"#fff",border:"none",borderRadius:11,padding:"11px 10px",fontSize:12.5,fontWeight:700,cursor:"pointer"}}>
                          {savingPanelFoto?"Menyimpan...":"💾 Simpan Foto"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {fotoViewer&&(
        <FotoZoomViewerPekerja fotos={fotoViewer.fotos} startIndex={fotoViewer.startIndex} label={fotoViewer.label} onClose={()=>setFotoViewer(null)}/>
      )}
    </div>
  );
}
