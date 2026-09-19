import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "../lib/supabase";
import { PCT_STEPS } from "../lib/panelTypes";
import { TODAY } from "../lib/dateHelpers";
import { withRetry } from "../lib/koneksi";
import { mergePanelChecklist } from "../lib/checklistHelpers";
import { upsertComponentProcessProgress, cekPasangKomponenSiapArsip } from "../lib/componentProcessProgress";
import { fetchAllPanels, isKomponenRelevant, PASANG_KOMPONEN_TAHAP_KOMPONEN_NAMA } from "../lib/panelHelpers";
import { getUrgensiPanel, fmtTanggalDeadlineNp } from "../lib/progressHelpers";
import { compressImageNp, hapusFotoDariStorage } from "../lib/fotoHelpers";
import { uploadToR2 } from "../lib/r2Client";
import { FotoZoomViewerPekerja, type FotoViewerPekerja } from "./FotoZoomViewerPekerja";
import { MediaPickerSheet } from "./ui/MediaPickerSheet";

export type KomponenPasangTugas={
  seksi:"assembling_luar"|"wiring_control";
  label:string;icon:string;color:string;
  tahap:"ASSEMBLING"|"WIRING";
  fotoBucket:string;
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
export function KomponenPasangView({user,tugas,registerBackHandler}:{user:any,tugas:KomponenPasangTugas,registerBackHandler?:(fn:(()=>boolean)|null)=>void}){
  // BUG FIX (14 Agu 2026): checklist[kode].fotoPemasangan itu 1 array yang dipakai BERSAMA
  // Assembling Luar & Wiring Control buat komponen tahap (Box Control/Pintu) - tapi masing-masing
  // nyimpen snapshot arsipnya sendiri (seksi=assembling_luar vs seksi=wiring_control), di WAKTU
  // yang beda-beda. Kalau seksi A archive duluan lalu ada foto baru diupload, snapshot seksi B
  // (kalau udah pernah archive lebih dulu juga) jadi basi permanen - dua Arsip tab nunjukin
  // jumlah foto beda buat komponen fisik yang sama. siblingSeksi dipakai buat ikut nyegerin
  // foto di row arsip seksi sebelah kalau ada, biar dua-duanya tetap sinkron (non-tahap kayak
  // Groundplate gak punya sibling row sama sekali, lookup-nya otomatis no-op).
  const siblingSeksi=tugas.seksi==="assembling_luar"?"wiring_control":"assembling_luar";
  const[panelsRaw,setPanelsRaw]=useState<any[]>([]);
  const[woMap,setWoMap]=useState<Record<number,any>>({});
  const[kodeNamaMap,setKodeNamaMap]=useState<Record<string,string>>({});
  const[relevanSet,setRelevanSet]=useState<Set<string>>(new Set());
  const[hasMappingSet,setHasMappingSet]=useState<Set<string>>(new Set());
  const[loading,setLoading]=useState(true);
  const[search,setSearch]=useState("");
  const[selectedWoId,setSelectedWoId]=useState<number|null>(null);
  // Navigasi Kembali per-level (7 Sep 2026) - lapor ke App.tsx cara mundur 1 langkah dari sini
  // (Detail -> Daftar Proyek), biar header "Kembali" di App.tsx gak langsung skip ke grid menu.
  useEffect(()=>{
    registerBackHandler?.(()=>{
      if(selectedWoId){setSelectedWoId(null);return true;}
      return false;
    });
    return()=>registerBackHandler?.(null);
  },[selectedWoId]);
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

  // silent (5 Sep 2026, fix pola sama RiwayatGudangTab.tsx) - listener panels di bawah dipicu
  // progress SEMUA divisi (paling sering berubah di seluruh sistem), termasuk aksi "Simpan
  // Progress" milik sendiri - tanpa ini, list berkedip tiap kali ada progress masuk dari mana
  // pun.
  const fetchData=async(silent=false)=>{
    if(!silent)setLoading(true);
    const[panels,{data:bomRows},{data:relevanRows}]=await Promise.all([
      // Narrow select (audit egress Agu 2026) - checklist WAJIB full (ini core data view ini),
      // tapi ~12 kolom JSON histori divisi lain (qc_checklist, nameplate/yellowmark/qs/
      // warehouse/busbar dll) gak kepakai sama sekali di sini.
      fetchAllPanels("id,wo_id,nama,tipe,checklist,pasang_komponen_photos"),
      supabase.from("bom_master").select("kode_komponen,nama_komponen,tipe_panel"),
      supabase.from("bom_proses_relevan").select("*"),
    ]);
    // AUDIT FIX (13 Sep 2026, "nama komponen salah/ketuker") - dulu kMap cuma di-key pakai
    // kode_komponen doang, TANPA tipe_panel. bom_master itu SATU tabel BERISI SEMUA tipe panel
    // sekaligus, dan kode yang SAMA (mis. "WM.7") berarti KOMPONEN FISIK BEDA TOTAL tergantung
    // tipenya (WM_MS vs WM_POLY dst) - row terakhir yang kebetulan dikembalikan query "menang"
    // menimpa row tipe lain, jadi nama yang tampil ke operator bisa acak/salah, ketuker dari tipe
    // panel yang gak nyambung sama panel yang lagi dilihat. Dicek live 13 Sep 2026: 0 baris
    // bom_master tanpa tipe_panel, 0 duplikat kombinasi (tipe_panel,kode_komponen) - key gabungan
    // ini aman dipakai, gak ada celah row yang kehilangan nama.
    const kMap:Record<string,string>={};
    (bomRows||[]).forEach((b:any)=>{kMap[`${b.tipe_panel}|${b.kode_komponen}`]=b.nama_komponen;});
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
    if(!silent)setLoading(false);
  };

  useEffect(()=>{
    fetchData();
  },[tugas.seksi]);

  // Filter server-side by id=in.(...) (audit egress 6 Sep 2026) - dulu subscribe TANPA filter,
  // jadi PANEL APAPUN berubah di SELURUH sistem (bukan cuma yang relevan ke seksi ini) bikin
  // Postgres broadcast SELURUH row (termasuk checklist, bisa puluhan KB) ke client ini, lanjut
  // refetch SEMUA panel (query checklist lagi) - dikali banyak operator yang buka tab ini
  // sepanjang hari, ini kontributor egress terbesar yang ketemu (audit egress 6 Sep 2026).
  // Filter di-scope ke panel yang LAGI TAMPIL di panelsRaw, channel di-buat ULANG tiap daftar
  // panel itu berubah (bukan tiap checklist-nya berubah - panelIdsKey cuma berubah kalau ada
  // panel baru/hilang dari daftar, jauh lebih jarang drpd tiap keystroke qty).
  const panelIdsKey=useMemo(()=>[...new Set(panelsRaw.map((p:any)=>p.id))].sort((a,b)=>a-b).join(","),[panelsRaw]);
  const refetchTimer=useRef<any>(null);
  useEffect(()=>{
    if(!panelIdsKey)return;
    const ch=supabase.channel(`realtime-komponen-pasang-${tugas.seksi}`)
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"panels",filter:`id=in.(${panelIdsKey})`},()=>{
        if(refetchTimer.current)clearTimeout(refetchTimer.current);
        refetchTimer.current=setTimeout(()=>{fetchData(true);},500);
      })
      .subscribe();
    return()=>{supabase.removeChannel(ch);if(refetchTimer.current)clearTimeout(refetchTimer.current);};
  },[tugas.seksi,panelIdsKey]);

  // Timer kerja (18 Sep 2026, FITUR BARU - upgrade Pasang Komponen ke model "proses biasa",
  // sama kayak Potong/Bending/dst) - dulu TANPA timer sama sekali (lihat komentar header file
  // "TANPA operator/timer, sama kayak QS"). fcs_timer_kerja SUDAH punya kolom `tahap` (dipakai
  // BUSBAR) - reuse langsung, proses="PASANG KOMPONEN", tahap=tugas.tahap (ASSEMBLING/WIRING),
  // TIDAK ADA perubahan skema/migrasi data. Model SEDERHANA dibanding OperatorView (single
  // operator per sesi, bukan multi-worker bulk-assign) - konsisten sama sisa komponen ini yang
  // memang single-user, gak perlu direplikasi kompleksitas assign-banyak-orang OperatorView.
  const[timerAktif,setTimerAktif]=useState<Record<string,any>>({});
  const[timerLoading,setTimerLoading]=useState<string|null>(null);
  const[,forceTimerTick]=useState(0);
  const fetchTimerAktif=async()=>{
    const{data,error}=await supabase.from("fcs_timer_kerja").select("*")
      .eq("pekerja_id",user.id).eq("proses","PASANG KOMPONEN").eq("tahap",tugas.tahap).is("selesai",null);
    if(error){console.error("gagal ambil timer aktif:",error);return;}
    const map:Record<string,any>={};
    (data||[]).forEach((t:any)=>{map[`${t.panel_id}_${t.kode_komponen}`]=t;});
    setTimerAktif(map);
  };
  useEffect(()=>{
    fetchTimerAktif();
    const ch=supabase.channel(`realtime-timer-komponen-pasang-${tugas.seksi}-${user.id}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"fcs_timer_kerja",filter:`pekerja_id=eq.${user.id}`},fetchTimerAktif)
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[tugas.seksi,user.id]);
  // Tick ringan tiap 5 detik SAAT ada timer aktif - biar durasi berjalan kelihatan nge-tick,
  // bukan beku sampai event realtime/aksi lain memicu re-render (pola sama persis RencanaHarian).
  useEffect(()=>{
    if(Object.keys(timerAktif).length===0)return;
    const iv=setInterval(()=>forceTimerTick(v=>v+1),5000);
    return()=>clearInterval(iv);
  },[Object.keys(timerAktif).length>0]);

  const mulaiTimer=async(panelId:number,kode:string)=>{
    const tKey=`${panelId}_${kode}`;
    setTimerLoading(tKey);
    try{
      const tanggal=TODAY;
      // Scope-by-tanggal (BUG FIX 16 Sep 2026, sama pola OperatorView.startTimer) - timer "aktif"
      // dari HARI LAIN yang ketinggalan jalan gak boleh ke-nyambung diam-diam ke sesi hari ini.
      const{data:existing}=await withRetry(()=>supabase.from("fcs_timer_kerja").select("*")
        .eq("pekerja_id",user.id).eq("panel_id",panelId).eq("kode_komponen",kode).eq("proses","PASANG KOMPONEN")
        .eq("tahap",tugas.tahap).eq("tanggal",tanggal).is("selesai",null).order("mulai",{ascending:false}).limit(1).maybeSingle());
      if(existing){setTimerAktif(prev=>({...prev,[tKey]:existing}));return;}
      const{data,error}=await withRetry(async()=>{
        const hasil=await supabase.from("fcs_timer_kerja").insert({
          pekerja_id:user.id,panel_id:panelId,kode_komponen:kode,proses:"PASANG KOMPONEN",tahap:tugas.tahap,tanggal,mulai:new Date().toISOString(),
        }).select().single();
        // BUG FIX (20 Sep 2026) - constraint DB fcs_timer_kerja_satu_aktif (migration terkait,
        // partial unique index) jadi jaring pengaman terakhir kalau cek `existing` di atas lolos
        // gara-gara race (attempt retry sebelumnya belum ke-commit pas attempt ini jalan - sama
        // pola OperatorView.startTimer). INSERT kedua yang bentrok gagal unique_violation (23505)
        // - itu bukan kegagalan beneran, fetch & pakai baris yang udah ada, jangan alert error.
        if(hasil.error?.code==="23505"){
          const{data:sudahAda}=await supabase.from("fcs_timer_kerja").select("*")
            .eq("pekerja_id",user.id).eq("panel_id",panelId).eq("kode_komponen",kode).eq("proses","PASANG KOMPONEN")
            .eq("tahap",tugas.tahap).eq("tanggal",tanggal).is("selesai",null).order("mulai",{ascending:false}).limit(1).maybeSingle();
          if(sudahAda)return{data:sudahAda,error:null};
        }
        return hasil;
      });
      if(error){alert("Gagal mulai timer: "+error.message);return;}
      setTimerAktif(prev=>({...prev,[tKey]:data}));
    }catch(err:any){
      alert("Gagal mulai timer - koneksi bermasalah, coba lagi.\n("+(err?.message||"unknown error")+")");
    }finally{
      setTimerLoading(null);
    }
  };
  const selesaiTimer=async(panelId:number,kode:string)=>{
    const tKey=`${panelId}_${kode}`;
    const timer=timerAktif[tKey];
    if(!timer)return;
    setTimerLoading(tKey);
    try{
      const{error}=await withRetry(()=>supabase.from("fcs_timer_kerja").update({selesai:new Date().toISOString()}).eq("id",timer.id));
      if(error){alert("Gagal selesai-in timer: "+error.message);return;}
      setTimerAktif(prev=>{const n={...prev};delete n[tKey];return n;});
    }catch(err:any){
      alert("Gagal selesai-in timer - koneksi bermasalah, coba lagi.\n("+(err?.message||"unknown error")+")");
    }finally{
      setTimerLoading(null);
    }
  };

  // Komponen relevan buat seksi ini di 1 panel: qty>0, relevan ke proses "PASANG KOMPONEN", dan
  // pembagian tugasnya TEGAS TERPISAH per divisi (dikonfirmasi user 18 Sep 2026, investigasi bug
  // WM.4 "stuck 50%" berulang di TRANS ICON SURABAYA/CJI): Wiring Control CUMA Pintu/Box Control,
  // Assembling Luar CUMA komponen selain itu (Dudukan ACB/Groundplate/Dudukan Capacitor/Detuned
  // Reaktor dst). SEBELUMNYA cabang assembling_luar `return true` TANPA exclude Pintu/Box Control -
  // itu sebabnya Assembling Luar (operator GILANG, beberapa WO) sempat kelihatan & bisa submit
  // progress ASSEMBLING ke Pintu/Box Control padahal bukan tugasnya, mengkontaminasi data
  // checklist[kode].pasangKomponenTahap.ASSEMBLING - lihat komentar di updatePctLive soal data lama
  // itu SENGAJA dibiarkan (gak dihapus), cuma gak dipakai lagi di perhitungan combined progress.
  const komponenRelevanPanel=(panel:any):{kode:string,nama:string,isTahap:boolean}[]=>{
    // Lookup nama WAJIB pakai key gabungan tipe_panel+kode (lihat komentar fetchData di atas) -
    // panel.tipe SELALU ada di scope closure sini, jadi aman langsung dipakai per-panel.
    const namaKode=(kode:string)=>kodeNamaMap[`${panel.tipe}|${kode}`]||kode;
    return Object.entries(panel.checklist||{}).filter(([kode,cl]:any)=>{
      if(!((cl?.qty||0)>0))return false;
      if(!isKomponenRelevant(kode,panel.tipe,"PASANG KOMPONEN",relevanSet,hasMappingSet))return false;
      const nama=namaKode(kode);
      const isTahapNama=PASANG_KOMPONEN_TAHAP_KOMPONEN_NAMA.includes(nama);
      if(tugas.seksi==="wiring_control")return isTahapNama;
      return !isTahapNama; // assembling_luar: TIDAK PERNAH Pintu/Box Control
    }).map(([kode]:any)=>({kode,nama:namaKode(kode),isTahap:PASANG_KOMPONEN_TAHAP_KOMPONEN_NAMA.includes(namaKode(kode))}));
  };

  const getProgress=(panel:any,kode:string,isTahap:boolean):number=>{
    const cl=panel.checklist?.[kode];
    if(isTahap)return cl?.pasangKomponenTahap?.[tugas.tahap]?.progress||0;
    return cl?.progress?.["PASANG KOMPONEN"]||0;
  };

  // PCT_STEPS klik - persist LANGSUNG ke checklist (live), TIDAK checkpoint/archive - sama
  // persis format Wiring Control yang sudah ada (updatePctManualPasangKomponenTahap dulu).
  // BUG FIX (14 Agu 2026): komponen tahap (Box Control/Pintu) ditulis BERSAMA oleh Assembling
  // Luar dan Wiring Control ke field checklist[kode].pasangKomponenTahap yang SAMA - sebelumnya
  // fungsi ini pakai `panel` dari closure lokal (state React, bisa basi) tanpa refetch dulu,
  // beda dari simpanProgress yang SENGAJA refetch fresh justru karena sadar risiko ini ("biar
  // gak nimpa balik perubahan operator lain"). Kalau 2 operator (Assembling & Wiring) klik step
  // di komponen yang sama nyaris bersamaan sebelum realtime sempat sinkron, kontribusi yang satu
  // bisa ketimpa balik ke nilai lama. Refetch fresh dulu, sama kayak pola simpanProgress.
  const updatePctLive=async(panel:any,kode:string,isTahap:boolean,pct:number)=>{
    const{data:freshRow}=await supabase.from("panels").select("checklist").eq("id",panel.id).single();
    const freshChecklist=freshRow?.checklist||panel.checklist;
    const cl=freshChecklist[kode]||{qty:0,progress:{},progressByDate:{}};
    // Siapa yang klik step ini (7 Sep 2026) - dulu updatePctLive sama sekali gak nyimpen identitas
    // operator, cuma progress polos. Kolom "Operator" di Rencana Harian jadi gak pernah punya data
    // buat komponen yang progressnya cuma disentuh lewat klik step (belum sempat "Simpan Progress"
    // yang baru nulis ke progress_checkpoint_log). lastOperator per-tahap (bukan 1 field global per
    // kode) - WIRING & ASSEMBLING bisa dikerjakan orang berbeda, progress-nya sendiri emang udah
    // dipecah per tahap (pasangKomponenTahap), jadi identitasnya ikut dipecah sama.
    const lastOperator={nama:user.nama,ts:new Date().toISOString()};
    let newCl:any;
    if(isTahap){
      const tahapState=cl.pasangKomponenTahap||{};
      const newTahap={...tahapState,[tugas.tahap]:{...tahapState[tugas.tahap],progress:pct,lastOperator}};
      // FIX (18 Sep 2026): dulu combined = rata-rata ASSEMBLING+WIRING (hitungProgressBusbarGabungan) -
      // SALAH, karena Pintu/Box Control CUMA tugas Wiring Control (dikonfirmasi user, lihat komentar
      // panjang di komponenRelevanPanel di atas). Assembling Luar sekarang di-exclude dari daftar
      // tugasnya utk 2 nama ini, jadi field ASSEMBLING gak akan pernah lagi dapet data baru - combined
      // progress yang dibaca Detail Progres/Renhar ("PASANG KOMPONEN") SEHARUSNYA murni ikut WIRING,
      // bukan dirata-rata sama ASSEMBLING (yang kalau kosong dianggap 0, bikin macet di 50% padahal
      // Wiring Control-nya udah genuinely 100%). Data pasangKomponenTahap.ASSEMBLING lama yang kadung
      // ada (dari sebelum fix ini) DIBIARKAN apa adanya (gak dihapus) - cuma gak dipakai di sini lagi.
      const combined=newTahap.WIRING?.progress||0;
      newCl={...cl,pasangKomponenTahap:newTahap,progress:{...(cl.progress||{}),"PASANG KOMPONEN":combined},
        progressByDate:{...(cl.progressByDate||{}),"PASANG KOMPONEN":{...((cl.progressByDate||{})["PASANG KOMPONEN"]||{}),[TODAY]:combined}}};
    } else {
      newCl={...cl,progress:{...(cl.progress||{}),"PASANG KOMPONEN":pct},
        pasangKomponenLastOperator:lastOperator,
        progressByDate:{...(cl.progressByDate||{}),"PASANG KOMPONEN":{...((cl.progressByDate||{})["PASANG KOMPONEN"]||{}),[TODAY]:pct}}};
    }
    const newChecklist={...freshChecklist,[kode]:newCl};
    setPanelsRaw(prev=>prev.map((p:any)=>p.id===panel.id?{...p,checklist:newChecklist}:p));
    await withRetry(()=>mergePanelChecklist(panel.id,{[kode]:newCl}));
    // FASE 2 (21 Sep 2026) - DUAL-WRITE ke component_process_progress, checklist di atas TETAP
    // sumber kebenaran yang dibaca semua consumer lama (Task Monitoring dkk BELUM diubah).
    // Best-effort SENGAJA (console.error, TIDAK alert/blok operator) - checklist di atas sudah
    // berhasil tersimpan sebelum baris ini, tabel baru ini masih 0 consumer di fase ini, jadi
    // kegagalannya TIDAK BOLEH bikin operator kehilangan progress yang sebenarnya sudah tersimpan.
    // sudahDisimpan100 SELALU false di sini (updatePctLive bukan aksi arsip) - biar konsisten
    // sama logika `sudahDiarsip` checklist lama (pct berubah lagi -> otomatis dianggap "belum
    // diarsip ulang" sampai simpanProgress dipanggil lagi).
    const ccpTahap=isTahap?tugas.tahap:null;
    upsertComponentProcessProgress({
      panelId:panel.id,kode,proses:"PASANG KOMPONEN",tahap:ccpTahap,pct,
      qtyTotal:cl.qty||0,photos:newCl.fotoPemasangan||cl.fotoPemasangan||[],
      operatorNama:lastOperator.nama,operatorAt:lastOperator.ts,sudahDisimpan100:false,
      updatedBy:user.nama,
    }).then(({error})=>{if(error)console.error("dual-write component_process_progress gagal (updatePctLive):",error);});
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
    if((clNow?.fotoPemasangan||[]).length===0){
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
      const{error:panelErr}=await withRetry(()=>mergePanelChecklist(panel.id,{[kode]:newChecklist[kode]}));
      if(panelErr)throw panelErr;
      setPanelsRaw(prev=>prev.map((p:any)=>p.id===panel.id?{...p,checklist:newChecklist}:p));

      // Dua galeri foto koeksis (8 Agu 2026): fotoPemasangan per-komponen (baru, WAJIB diisi
      // sebelum Simpan Progress - lihat gate di atas) + pasang_komponen_photos umum per-panel
      // (galeri lama sebelum tab ini per-komponen, TETAP dipertahankan biar foto2 lama gak
      // hilang dari tampilan - operator masih bisa nambah foto ke situ juga kalau perlu).
      // Snapshot KEDUANYA ke arsip biar bukti foto lengkap gak keputus di histori.
      const wo=woMap[panel.wo_id];
      const archiveData=isTahap
        ?{pasangKomponenTahap:{[tugas.tahap]:freshCl.pasangKomponenTahap?.[tugas.tahap]||{progress:pct,sudahDisimpan100:pct>=100}},
           fotoPemasangan:freshCl.fotoPemasangan||[],pasang_komponen_photos:panel.pasang_komponen_photos||[]}
        :{progress:pct,fotoPemasangan:freshCl.fotoPemasangan||[],pasang_komponen_photos:panel.pasang_komponen_photos||[]};
      const{error:arsipErr}=await withRetry(()=>supabase.from("panel_seksi_archived").upsert({
        panel_id:panel.id,wo_id:panel.wo_id||null,seksi:tugas.seksi,kode,komponen_nama:nama,data:archiveData,
        panel_nama:panel.nama,panel_tipe:panel.tipe,proyek_snapshot:wo?.proyek||null,wo_number_snapshot:wo?.wo||null,
        diarsipkan_pada:new Date().toISOString(),diarsipkan_oleh:user.nama,
      },{onConflict:"panel_id,seksi,kode"}));
      if(arsipErr)throw arsipErr;
      // FASE 2 (21 Sep 2026) - DUAL-WRITE ke component_process_progress, sinkron sama
      // panel_seksi_archived di atas (checkpoint FINAL, bukan cuma progress berjalan kayak
      // updatePctLive - makanya sudahDisimpan100 dihitung dari combined>=100 di sini, sama
      // persis rumus archiveData.pasangKomponenTahap[...].sudahDisimpan100 barusan). Best-effort
      // (console.error, TIDAK throw) - panel_seksi_archived di atas SUDAH berhasil tersimpan,
      // kegagalan tabel baru ini gak boleh bikin operator kehilangan arsip yang sebenarnya
      // sudah sukses.
      const ccpTahap=isTahap?tugas.tahap:null;
      const{error:ccpErr}=await upsertComponentProcessProgress({
        panelId:panel.id,kode,proses:"PASANG KOMPONEN",tahap:ccpTahap,pct:combined,
        qtyTotal:freshCl.qty||0,photos:freshCl.fotoPemasangan||[],
        operatorNama:user.nama,operatorAt:new Date().toISOString(),sudahDisimpan100:combined>=100,
        updatedBy:user.nama,
      });
      if(ccpErr)console.error("dual-write component_process_progress gagal (simpanProgress):",ccpErr);
      // Validasi konsistensi (bukan gate keras - lihat komentar cekPasangKomponenSiapArsip) -
      // cuma dijalankan pas beneran arsip final (combined>=100), console.warn kalau ternyata
      // gak sinkron (harusnya gak pernah kejadian selama dual-write di atas sukses, ini jaring
      // pengaman deteksi drift, bukan pengganti alur arsip panel_seksi_archived yang sudah ada -
      // tombol "Arsipkan Komponen" TETAP tombol yang sama, WO-072 restructuring, bukan tombol baru).
      if(combined>=100){
        cekPasangKomponenSiapArsip(panel.id,kode).then(siap=>{
          if(siap===false)console.warn(`component_process_progress belum konsisten utk panel ${panel.id} kode ${kode} - archiveData tersimpan tapi status blm 'done' semua`);
        });
      }
      // BUG FIX (14 Agu 2026): kalau seksi sebelah (lihat siblingSeksi di atas) udah pernah
      // archive komponen yang SAMA duluan, sekalian segerin foto di row-nya juga - biar gak
      // ketinggalan snapshot foto lama walau progress tahap dia sendiri gak berubah.
      const{data:siblingRow}=await supabase.from("panel_seksi_archived").select("data").eq("panel_id",panel.id).eq("seksi",siblingSeksi).eq("kode",kode).maybeSingle();
      if(siblingRow){
        await withRetry(()=>supabase.from("panel_seksi_archived").update({data:{...siblingRow.data,fotoPemasangan:freshCl.fotoPemasangan||[]}}).eq("panel_id",panel.id).eq("seksi",siblingSeksi).eq("kode",kode));
      }
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
      const gagal:typeof staged=[];
      // Tiap foto punya try-catch SENDIRI (bukan satu try besar buat seluruh loop) - kalau foto
      // ke-2 dari 3 gagal kompres/upload, foto ke-1 yang udah kepalang naik + foto ke-3 gak ikut
      // batal. Foto yang gagal DIKUMPULKAN (bukan cuma di-skip) biar tetap nangkring di
      // stagedFoto - dulu di sini staged dihapus tanpa syarat abis loop, jadi foto yang gagal
      // upload (storage penuh/network) ikut hilang dari layar seolah berhasil tersimpan.
      const folderFoto=tugas.fotoBucket.replace(/-photos$/,"");
      const objectPathPrefix=key.startsWith("panelfoto_")?`${pathPrefix}/panelfoto`:pathPrefix;
      for(const s of staged){
        try{
          const blob=await compressImageNp(s.file);
          const objectKey=`${folderFoto}/${objectPathPrefix}/${Date.now()}_${Math.random().toString(36).slice(2,8)}.jpg`;
          const publicUrl=await uploadToR2(blob,objectKey,"image/jpeg");
          fotoTerupload.push({url:publicUrl,uploaded_by:user.nama,uploaded_at:new Date().toISOString()});
        }catch(fotoErr:any){
          gagal.push(s);
        }
      }
      if(key.startsWith("panelfoto_")){
        const newFoto=[...(panel.pasang_komponen_photos||[]),...fotoTerupload];
        await supabase.from("panels").update({pasang_komponen_photos:newFoto}).eq("id",panel.id);
        setPanelsRaw(prev=>prev.map((p:any)=>p.id===panel.id?{...p,pasang_komponen_photos:newFoto}:p));
      } else {
        // BUG FIX (18 Sep 2026, dilaporkan user - foto "hilang" di CIMORY CITEUREUP) - dulu
        // key.split("_")[1], cuma ambil potongan PERTAMA setelah underscore. key dibentuk
        // `${panel.id}_${kode}` - buat kode yang TIPE panelnya sendiri mengandung underscore
        // (WM_SS/WM_MS/WM_POLY, jadi kode aslinya WM_SS.2 dst), split("_")[1] motong di
        // underscore kode itu sendiri ("422_WM_SS.2" -> "WM" doang, bukan "WM_SS.2") - foto
        // kesimpen ke kode HANTU "WM" (gak pernah ada di BOM, gak punya qty/progress), bukan ke
        // kode asli - dari sisi galeri per-komponen kelihatan "foto gak muncul" krn nyari di
        // kode yang bener tapi datanya nyasar ke kode lain. slice(indexOf+1) ambil SEMUA
        // setelah underscore PERTAMA - aman krn panel.id numerik gak pernah punya underscore.
        const kode=key.slice(key.indexOf("_")+1);
        const cl=panel.checklist?.[kode]||{};
        const newFoto=[...(cl.fotoPemasangan||[]),...fotoTerupload];
        const newEntry={...cl,fotoPemasangan:newFoto};
        await mergePanelChecklist(panel.id,{[kode]:newEntry});
        setPanelsRaw(prev=>prev.map((p:any)=>p.id===panel.id?{...p,checklist:{...p.checklist,[kode]:newEntry}}:p));
      }
      // Cuma revoke+buang staged foto yang BERHASIL diupload. Yang gagal tetap di stagedFoto[key]
      // (di-filter by reference dari state TERKINI, bukan snapshot awal, biar aman kalau operator
      // sempat nambah foto lain pas upload masih jalan) - operator tinggal tap Simpan lagi buat retry.
      const berhasilSet=new Set(staged.filter(s=>!gagal.includes(s)));
      staged.forEach(s=>{if(berhasilSet.has(s))URL.revokeObjectURL(s.previewUrl);});
      setStagedFoto(prev=>{
        const sisa=(prev[key]||[]).filter(s=>!berhasilSet.has(s));
        const next={...prev};
        if(sisa.length>0)next[key]=sisa;else delete next[key];
        return next;
      });
      if(gagal.length>0){
        alert(`${gagal.length} dari ${staged.length} foto GAGAL diupload (kemungkinan storage penuh atau koneksi bermasalah). Foto yang gagal TETAP ada di layar - coba tap Simpan lagi.`);
      }
    }catch(err:any){
      alert("Terjadi kesalahan: "+err.message);
    }
    setSavingKey(null);
  };
  // PERBAIKAN (14 Agu 2026): sebelumnya begitu komponen "sudah diarsip" (progress sekarang match
  // sama yang terakhir diarsip), seluruh card-nya hilang dari accordion (lihat relevanBelumArsip
  // di render) - termasuk kalau progress kecapai 100% lewat klik step PCT_STEPS yang SAMA SEKALI
  // gak mewajibkan foto (beda dari tombol Simpan Progress yang sudah wajib >=1 foto). Komponen
  // itu jadi terkunci selamanya tanpa dokumentasi. Fungsi ini APPEND-ONLY: foto baru ditambah ke
  // live checklist DAN dipatch ke snapshot arsip (data.fotoPemasangan) biar ikut nongol di tab
  // Arsip juga - TANPA menyentuh progress/status/foto lama sama sekali (gak ada hapus/ganti).
  const simpanFotoArsipTambahan=async(panel:any,kode:string,key:string)=>{
    const staged=stagedFoto[key]||[];
    if(staged.length===0)return;
    setSavingKey("foto_"+key);
    try{
      const fotoTerupload:any[]=[];
      const gagal:typeof staged=[];
      const folderFoto=tugas.fotoBucket.replace(/-photos$/,"");
      for(const s of staged){
        try{
          const blob=await compressImageNp(s.file);
          const objectKey=`${folderFoto}/${panel.id}/${kode}/${Date.now()}_${Math.random().toString(36).slice(2,8)}.jpg`;
          const publicUrl=await uploadToR2(blob,objectKey,"image/jpeg");
          fotoTerupload.push({url:publicUrl,uploaded_by:user.nama,uploaded_at:new Date().toISOString()});
        }catch(fotoErr:any){
          gagal.push(s);
        }
      }
      if(fotoTerupload.length>0){
        const cl=panel.checklist?.[kode]||{};
        const newFotoLive=[...(cl.fotoPemasangan||[]),...fotoTerupload];
        const newEntry={...cl,fotoPemasangan:newFotoLive};
        await mergePanelChecklist(panel.id,{[kode]:newEntry});
        setPanelsRaw(prev=>prev.map((p:any)=>p.id===panel.id?{...p,checklist:{...p.checklist,[kode]:newEntry}}:p));

        const{data:arsipRow}=await supabase.from("panel_seksi_archived").select("data").eq("panel_id",panel.id).eq("seksi",tugas.seksi).eq("kode",kode).maybeSingle();
        if(arsipRow){
          const newFotoArsip=[...(arsipRow.data?.fotoPemasangan||[]),...fotoTerupload];
          await supabase.from("panel_seksi_archived").update({data:{...arsipRow.data,fotoPemasangan:newFotoArsip}}).eq("panel_id",panel.id).eq("seksi",tugas.seksi).eq("kode",kode);
        }
        // BUG FIX (14 Agu 2026): sama kayak di simpanProgress - sekalian tambahin foto baru ini
        // ke row arsip seksi sebelah juga kalau ada, biar gak divergen (lihat siblingSeksi).
        const{data:siblingRow}=await supabase.from("panel_seksi_archived").select("data").eq("panel_id",panel.id).eq("seksi",siblingSeksi).eq("kode",kode).maybeSingle();
        if(siblingRow){
          const newFotoSibling=[...(siblingRow.data?.fotoPemasangan||[]),...fotoTerupload];
          await supabase.from("panel_seksi_archived").update({data:{...siblingRow.data,fotoPemasangan:newFotoSibling}}).eq("panel_id",panel.id).eq("seksi",siblingSeksi).eq("kode",kode);
        }
      }
      const berhasilSet=new Set(staged.filter(s=>!gagal.includes(s)));
      staged.forEach(s=>{if(berhasilSet.has(s))URL.revokeObjectURL(s.previewUrl);});
      setStagedFoto(prev=>{
        const sisa=(prev[key]||[]).filter(s=>!berhasilSet.has(s));
        const next={...prev};
        if(sisa.length>0)next[key]=sisa;else delete next[key];
        return next;
      });
      if(gagal.length>0){
        alert(`${gagal.length} dari ${staged.length} foto GAGAL diupload (kemungkinan storage penuh atau koneksi bermasalah). Foto yang gagal TETAP ada di layar - coba tap Simpan lagi.`);
      }
    }catch(err:any){
      alert("Terjadi kesalahan: "+err.message);
    }
    setSavingKey(null);
  };
  const hapusFotoTersimpan=async(panel:any,kode:string|null,fotoUrl:string)=>{
    if(!window.confirm("Hapus foto ini?"))return;
    await hapusFotoDariStorage(tugas.fotoBucket,fotoUrl);
    if(kode===null){
      const newFoto=(panel.pasang_komponen_photos||[]).filter((f:any)=>f.url!==fotoUrl);
      await supabase.from("panels").update({pasang_komponen_photos:newFoto}).eq("id",panel.id);
      setPanelsRaw(prev=>prev.map((p:any)=>p.id===panel.id?{...p,pasang_komponen_photos:newFoto}:p));
    } else {
      const cl=panel.checklist?.[kode as string]||{};
      const newFoto=(cl.fotoPemasangan||[]).filter((f:any)=>f.url!==fotoUrl);
      const newEntry={...cl,fotoPemasangan:newFoto};
      await mergePanelChecklist(panel.id,{[kode as string]:newEntry});
      setPanelsRaw(prev=>prev.map((p:any)=>p.id===panel.id?{...p,checklist:{...p.checklist,[kode as string]:newEntry}}:p));
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
          //
          // BUG FIX (18 Sep 2026, dilaporkan operator - "0/1 komponen selesai" tapi badge
          // "Sudah Diarsip" nongol bareng, operator BUNTU gak ada tombol apa pun buat lanjut)
          // - dulu "sudah diarsip" cuma cek arsipPctR===pctR (progress SEKARANG sama persis
          // kayak yang PERNAH diarsip), TANPA pctR>=100. Asumsi awal (komentar 7-14 Agu di atas)
          // "arsip pasti berarti 100%" - valid waktu itu, TAPI jebol kalau ada baris
          // panel_seksi_archived BASI dari bug versi trigger DB lama (dicek live: snapshot-nya
          // nunjukin progress <100, mis. WM.4 panel PP-LANTAI 16B/15B tersimpan 90% bukan 100%
          // - lihat investigasi auto-archive). Begitu progress live balik ke angka yang SAMA
          // kayak snapshot basi itu, PCT_STEPS+Simpan Progress HILANG TOTAL dari UI (masuk
          // relevanArsip, versi ringkas tanpa kontrol edit) - operator gak punya cara APA PUN
          // menaikkan progress lagi, padahal jelas-jelas belum 100%. Tambah &&pctR>=100 -
          // "sudah diarsip" (dan kontrol edit ikut disembunyikan) SEKARANG WAJIB genuinely
          // 100%, gak cukup cuma "kebetulan sama kayak arsip".
          const relevanBelumArsip=relevan.filter(r=>{
            const pctR=getProgress(p,r.kode,r.isTahap);
            const arsipPctR=arsipMap[`${p.id}|${r.kode}`];
            return !(arsipPctR!==undefined&&arsipPctR===pctR&&pctR>=100);
          });
          // PERBAIKAN (14 Agu 2026): komponen yang sudah diarsip TETAP dirender (bukan lenyap
          // total) - versi ringkas tanpa PCT_STEPS/Simpan Progress, cuma buat nambah foto
          // dokumentasi susulan kalau kemarin ke-100% tanpa foto sama sekali (lihat
          // simpanFotoArsipTambahan di atas).
          const relevanArsip=relevan.filter(r=>{
            const pctR=getProgress(p,r.kode,r.isTahap);
            const arsipPctR=arsipMap[`${p.id}|${r.kode}`];
            return arsipPctR!==undefined&&arsipPctR===pctR&&pctR>=100;
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
                  {relevanBelumArsip.map(r=>{
                    const pct=getProgress(p,r.kode,r.isTahap);
                    const key=`${p.id}_${r.kode}`;
                    const saving=savingKey===key;
                    const fotoKodeArr=p.checklist?.[r.kode]?.fotoPemasangan||[];
                    const stagedKodeFoto=stagedFoto[key]||[];
                    // BUG FIX (7 Agu 2026): "sudah diarsip" = pct sekarang PERSIS sama kayak pct
                    // terakhir yang diarsip - kalau progress berubah lagi (naik/turun), otomatis
                    // gak dianggap "sudah" lagi, tombol Simpan Progress aktif lagi.
                    // BUG FIX (18 Sep 2026) - tambah &&pct>=100, samakan sama relevanBelumArsip/
                    // relevanArsip di atas (satu sumber logika, CLAUDE.md B.1) - lihat komentar
                    // lengkap di deklarasi relevanBelumArsip. Baris ini praktiknya gak pernah true
                    // di dalam loop relevanBelumArsip (kondisinya kebalikan dari filter yang
                    // nentuin masuk sini), tetap disamakan biar gak ada 2 sumber kebenaran beda
                    // kalau ada yang refactor salah satu doang nanti.
                    const arsipPct=arsipMap[`${p.id}|${r.kode}`];
                    const sudahDiarsip=arsipPct!==undefined&&arsipPct===pct&&pct>=100;
                    return(
                      <div key={r.kode} style={{border:"1.5px solid #eef0f3",borderRadius:12,padding:"12px 13px",background:pct>=100?"#f0fdf4":"#fafbfc"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                          <span style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>{r.nama}</span>
                          <span style={{fontSize:11,fontWeight:800,color:pct>=100?"#16a34a":tugas.color}}>{pct}%</span>
                        </div>
                        {(()=>{
                          const tKey=`${p.id}_${r.kode}`;
                          const timer=timerAktif[tKey];
                          const tLoading=timerLoading===tKey;
                          let durasiLabel="";
                          if(timer){
                            const menit=(Date.now()-new Date(timer.mulai).getTime())/60000;
                            const jam=Math.floor(menit/60);
                            const sisaMenit=Math.round(menit%60);
                            durasiLabel=jam>0?`${jam}j ${sisaMenit}m`:menit>=1?`${Math.round(menit)}m`:`${Math.max(0,Math.round(menit*60))}d`;
                          }
                          return(
                            <button disabled={tLoading}
                              onClick={()=>timer?selesaiTimer(p.id,r.kode):mulaiTimer(p.id,r.kode)}
                              style={{width:"100%",marginBottom:10,fontSize:13,fontWeight:700,border:"none",borderRadius:10,padding:"11px 14px",minHeight:44,
                                cursor:tLoading?"not-allowed":"pointer",
                                background:timer?"#fef2f2":"#f0fdf4",color:timer?"#dc2626":"#16a34a"}}>
                              {tLoading?"...":timer?`⏹ Selesai ${durasiLabel}`:"▶ Mulai Kerja"}
                            </button>
                          );
                        })()}
                        <div style={{display:"flex",gap:6,marginBottom:10}}>
                          {PCT_STEPS.map((s:number)=>{
                            const reached=pct>=s;
                            // BUG FIX (7 Agu 2026): "isNext" (highlight langkah berikutnya) cuma
                            // masuk akal kalau progress SUDAH mulai (pct>0) - kalau komponen belum
                            // disentuh sama sekali (pct===0), langkah 25% jangan ikut ke-highlight,
                            // kelihatan kayak "udah kepilih" padahal belum ada kerjaan sama sekali.
                            const isNext=pct>0&&s===PCT_STEPS.find((x:number)=>x>pct);
                            const prevStep=PCT_STEPS[PCT_STEPS.indexOf(s)-1]||0;
                            // PERBAIKAN (14 Agu 2026): soft reminder, BUKAN hard block - klik
                            // step 100% tanpa foto sama sekali sebelumnya bisa lolos diam-diam
                            // (trigger DB auto-archive begitu progress 100%, gak peduli ada foto
                            // atau belum). Cuma muncul pas NAIK ke 100% (bukan pas turun/undo),
                            // dan cuma kalau memang belum ada foto tersimpan sama sekali.
                            const handleStepClick=()=>{
                              const target=reached?prevStep:s;
                              if(s===100&&!reached&&fotoKodeArr.length===0){
                                if(!window.confirm("Belum ada foto dokumentasi untuk komponen ini. Yakin tandai selesai?"))return;
                              }
                              updatePctLive(p,r.kode,r.isTahap,target);
                            };
                            return(
                              <button key={s} onClick={handleStepClick}
                                style={{flex:1,minWidth:36,padding:"8px 3px",borderRadius:8,border:"none",cursor:"pointer",
                                  background:reached?tugas.color:isNext?`${tugas.color}14`:"#f1f5f9",
                                  color:reached?"#fff":isNext?tugas.color:"#94a3b8",
                                  fontWeight:700,fontSize:10.5}}>
                                {reached?"✓":`${s}%`}
                              </button>
                            );
                          })}
                        </div>
                        <>
                            <div style={{display:"flex",alignItems:"center",gap:5,fontSize:9.5,fontWeight:700,color:"#94a3b8",marginBottom:6,letterSpacing:0.3}}>
                              <i className="ti ti-camera" style={{fontSize:11}}/> FOTO PEMASANGAN (WAJIB)
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
                        {/* BUG FIX+FITUR (18 Sep 2026) - dulu trigger DB panels_auto_archive_seksi()
                            OTOMATIS insert ke panel_seksi_archived begitu progress tahap ini
                            genuinely 100% (TANPA operator sadar/putuskan) - trigger itu SEKARANG
                            DIHAPUS (migration terkait) buat bagian assembling_luar/wiring_control,
                            operator yang mutusin sendiri kapan komponen ini "beneran selesai &
                            siap diarsipkan". Tombol ini REUSE simpanProgress() apa adanya (fungsi
                            itu MEMANG SUDAH upsert ke panel_seksi_archived, gak berubah sama
                            sekali, satu sumber logika CLAUDE.md B.1) - cuma label/ikon beda pas
                            pct>=100 ("📦 Arsipkan Komponen", negasin ini aksi FINAL) vs pct<100
                            ("💾 Simpan Progress", checkpoint biasa) - biar operator sadar bedanya. */}
                        <button onClick={()=>simpanProgress(p,r.kode,r.nama,r.isTahap)} disabled={saving||pct===0||sudahDiarsip}
                          style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,width:"100%",
                            background:sudahDiarsip?"#dcfce7":saving||pct===0?"#cbd5e1":tugas.color,
                            color:sudahDiarsip?"#16a34a":"#fff",border:"none",borderRadius:10,padding:"10px 10px",fontSize:12,fontWeight:700,
                            cursor:saving||pct===0||sudahDiarsip?"not-allowed":"pointer"}}>
                          <i className={saving?"ti ti-loader-2":sudahDiarsip?"ti ti-circle-check-filled":pct>=100?"ti ti-archive":"ti ti-device-floppy"} style={{fontSize:14}}/>
                          {saving?"Menyimpan...":sudahDiarsip?"✅ Sudah Diarsip":pct>=100?"📦 Arsipkan Komponen":"Simpan Progress"}
                        </button>
                      </div>
                    );
                  })}
                  {relevanArsip.length>0&&(
                    <div style={{display:"flex",flexDirection:"column" as const,gap:10}}>
                      {relevanBelumArsip.length>0&&(
                        <div style={{fontSize:9.5,fontWeight:800,color:"#94a3b8",letterSpacing:0.4}}>SUDAH DIARSIP</div>
                      )}
                      {relevanArsip.map(r=>{
                        const key=`${p.id}_${r.kode}`;
                        const fotoKodeArr=p.checklist?.[r.kode]?.fotoPemasangan||[];
                        const stagedKodeFoto=stagedFoto[key]||[];
                        const savingFoto=savingKey==="foto_"+key;
                        return(
                          <div key={r.kode} style={{border:"1.5px solid #eef0f3",borderRadius:12,padding:"12px 13px",background:"#f8faf9"}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                              <span style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>{r.nama}</span>
                              <span style={{display:"flex",alignItems:"center",gap:4,fontSize:10.5,fontWeight:800,color:"#16a34a",background:"#dcfce7",borderRadius:20,padding:"3px 9px"}}>
                                <i className="ti ti-circle-check-filled" style={{fontSize:12}}/> Sudah Diarsip
                              </span>
                            </div>
                            <div style={{display:"flex",alignItems:"center",gap:5,fontSize:9.5,fontWeight:700,color:"#94a3b8",marginBottom:6,letterSpacing:0.3}}>
                              <i className="ti ti-camera" style={{fontSize:11}}/> FOTO PEMASANGAN
                            </div>
                            {fotoKodeArr.length===0&&stagedKodeFoto.length===0?(
                              <div style={{fontSize:11,color:"#cbd5e1",padding:"2px 0 8px",fontStyle:"italic" as const}}>Belum ada foto</div>
                            ):(
                              <div style={{display:"flex",flexWrap:"wrap" as const,gap:6,marginBottom:8}}>
                                {fotoKodeArr.map((f:any,fi:number)=>(
                                  <img key={`saved_${fi}`} onClick={()=>setFotoViewer({fotos:fotoKodeArr,startIndex:fi,label:`${r.nama}_${p.nama}`})}
                                    src={f.url} loading="lazy" style={{width:52,height:52,borderRadius:8,objectFit:"cover" as const,border:"1px solid #eef0f3",cursor:"pointer"}}/>
                                ))}
                                {stagedKodeFoto.map((s,si)=>(
                                  <div key={`staged_${si}`} style={{position:"relative" as const}}>
                                    <img src={s.previewUrl} style={{width:52,height:52,borderRadius:8,objectFit:"cover" as const,border:"1.5px dashed #16a34a"}}/>
                                    <button onClick={()=>batalkanFotoStaged(key,si)}
                                      style={{position:"absolute" as const,top:-6,right:-6,width:18,height:18,borderRadius:99,background:"#dc2626",color:"#fff",border:"2px solid #fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                                      <i className="ti ti-x" style={{fontSize:10}}/>
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div style={{display:"flex",gap:6,flexWrap:"wrap" as const}}>
                              <MediaPickerSheet disabled={savingFoto}
                                triggerStyle={{display:"inline-flex",alignItems:"center",gap:4,fontSize:11,fontWeight:700,color:"#16a34a",background:"#16a34a0f",border:"1px dashed #16a34a55",borderRadius:8,padding:"7px 11px",cursor:"pointer"}}
                                onFiles={(files)=>pilihFotoStaged(key,files)}>
                                + Tambah Foto
                              </MediaPickerSheet>
                              {stagedKodeFoto.length>0&&(
                                <button onClick={()=>simpanFotoArsipTambahan(p,r.kode,key)} disabled={savingFoto}
                                  style={{fontSize:11,fontWeight:700,color:"#fff",background:"#16a34a",border:"none",borderRadius:8,padding:"7px 12px",cursor:"pointer"}}>
                                  {savingFoto?"⏳ Menyimpan...":"💾 Simpan Foto"}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {/* Galeri umum panel (lama, sebelum tab ini per-komponen) - TETAP dipertahankan
                      biar foto yang udah pernah ke-upload gak hilang dari tampilan, operator
                      masih bisa nambah foto umum ke sini kapan saja (8 Agu 2026). */}
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
