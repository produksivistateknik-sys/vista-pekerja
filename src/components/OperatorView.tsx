import { useState, useMemo, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { PANEL_TYPES, PCT_STEPS, QTY_DIVISI, PROSES_COLOR, PRIORITAS_COLOR, DIVISI_CONFIG, QC_ITEMS } from "../lib/panelTypes";
import { getLocalDateStr, TODAY, addDays, fmtDate, fmtShort } from "../lib/dateHelpers";
import { withRetry } from "../lib/koneksi";
import { mergePanelChecklist } from "../lib/checklistHelpers";
import {
  timerKey, BUSBAR_TAHAP_LABEL,
  getUrutanTahapBusbar, hitungProgressBusbarGabungan, getFlatOperatorIds, getProgressOnDate,
  getLatestProgress, getFirstCompletionDate, pColor, pBg, renderNamaKomponen,
  computeProsesStatus, getRelevantProsesForKode, getBestProgressMap, type ProsesStatus,
  PASANG_KOMPONEN_TAHAP_KOMPONEN_NAMA,
} from "../lib/panelHelpers";
import { STATUS_TUGAS_NP } from "../lib/progressHelpers";
import { Badge, Card, Lbl, Inp, Btn } from "./ui/Primitives";
import { WoUrgentBanner } from "./WoUrgentBanner";

// Warna status pipeline (readiness per-komponen, dari computeProsesStatus) - cermin dari
// STATUS_PIPELINE_STYLE di RencanaHarian.tsx Vista Teknik, biar konsisten dilihat operator vs admin.
const STATUS_PIPELINE_STYLE:Record<ProsesStatus,{bg:string,color:string,border:string}>={
  "NOT YET":{bg:"#f1f5f9",color:"#64748b",border:"#e2e8f0"},
  "TO DO":{bg:"#eff6ff",color:"#2563eb",border:"#bfdbfe"},
  "IN PROGRESS":{bg:"#fffbeb",color:"#d97706",border:"#fde68a"},
  "DONE":{bg:"#f0fdf4",color:"#16a34a",border:"#bbf7d0"},
};
const STATUS_PIPELINE_LABEL:Record<ProsesStatus,string>={
  "NOT YET":"Not Yet","TO DO":"To Do","IN PROGRESS":"In Progress","DONE":"Done",
};

// ─────────────────────────────────────────────────────────────────────────────
// OPERATOR VIEW - dipisah dari App.tsx (Sprint 6, komponen terbesar ~3700 baris)
// ─────────────────────────────────────────────────────────────────────────────
export function OperatorView({user,viewMode}:any){
  void viewMode; // dipake nanti buat render mobile vs desktop
  const wsKey=`vista_pekerja_ws_${user.divisi}_${user.sub_bagian||""}_${user.id||user.username||user.nama||""}`;
  // Kalau app dibuka/reload jam 00:00-06:59 DAN sesi kerja sebelumnya (localStorage) tercatat
  // shift 2 di tanggal KEMARIN (belum ganti hari), hari kerja-nya tetap dianggap kemarin -
  // biar shift 2 yang kerja lewat tengah malam (HP di-lock/di-background OS lalu reload) gak
  // ke-hitung sebagai hari baru di Rencana Harian.
  const hariKerjaAwal=(()=>{
    try{
      const saved=JSON.parse(localStorage.getItem(wsKey)||"{}");
      const jamSekarang=new Date().getHours();
      const kemarin=addDays(TODAY,-1);
      if(jamSekarang<7&&saved.shift==="2"&&saved.tanggal===kemarin)return kemarin;
    }catch{}
    return TODAY;
  })();
  const [viewDate,setViewDate]=useState(hariKerjaAwal);
  const [bomPanelTypes,setBomPanelTypes]=useState<any>({});
  useEffect(()=>{
    Promise.all([
      supabase.from("bom_master").select("*"),
      supabase.from("panel_type_meta").select("*"),
      supabase.from("panel_wp_meta").select("*"),
    ]).then(([bomRes,typeMetaRes,wpMetaRes]:any)=>{
      const data=bomRes.data;
      if(!data||data.length===0)return;
      const grouped:any={};
      data.forEach((b:any)=>{
        if(!grouped[b.tipe_panel])grouped[b.tipe_panel]={};
        if(!grouped[b.tipe_panel][b.wp])grouped[b.tipe_panel][b.wp]=[];
        grouped[b.tipe_panel][b.wp].push({kode:b.kode_komponen,nama:b.nama_komponen,urutan:b.urutan});
      });
      const result:any={};
      Object.entries(grouped).forEach(([tipe,wpMap]:any)=>{
        const origCfg=(PANEL_TYPES as any)[tipe];
        if(origCfg){
          // Tipe udah dikenal config statis - perilaku lama, cuma refresh nama/kode komponen tiap WP.
          const wps=origCfg.wps.map((origWp:any)=>{
            const items=(wpMap[origWp.wp]||[]).sort((a:any,b:any)=>String(a.kode).localeCompare(String(b.kode),undefined,{numeric:true}));
            return{...origWp,items:items.length>0?items:origWp.items};
          });
          result[tipe]={...origCfg,wps};
          return;
        }
        // Tipe BARU yang belum pernah ditambahin ke PANEL_TYPES statis (mis. WM_SS) - dulu ke-skip
        // total di sini gara-gara origCfg undefined, jadi panel tipe ini invisible di app operator
        // sama sekali (task-nya gak pernah muncul walau udah dijadwalkan & dirilis beres di Vista
        // Teknik). Sekarang bangun config-nya langsung dari bom_master+panel_type_meta+
        // panel_wp_meta - sama persis pola buildPanelTypesFromBom yang udah kepake di Vista Teknik.
        const typeMeta=(typeMetaRes.data||[]).find((m:any)=>m.tipe_panel===tipe);
        const wpMetas=(wpMetaRes.data||[]).filter((m:any)=>m.tipe_panel===tipe).slice().sort((a:any,b:any)=>String(a.wp).localeCompare(String(b.wp)));
        if(wpMetas.length===0)return;
        const wps=wpMetas.map((wpMeta:any)=>{
          const items=(wpMap[wpMeta.wp]||[]).slice().sort((a:any,b:any)=>{
            const ua=Number(a.urutan)||0,ub=Number(b.urutan)||0;
            if(ua!==ub)return ua-ub;
            return String(a.kode).localeCompare(String(b.kode),undefined,{numeric:true});
          }).map((it:any)=>({kode:it.kode,nama:it.nama}));
          return{wp:wpMeta.wp,color:wpMeta.color,range:wpMeta.range_label,items};
        });
        result[tipe]={label:typeMeta?.label||tipe,wps};
      });
      setBomPanelTypes(result);
    });
  },[]);
  // BUG FIX (7 Agu 2026): status pipeline (computeProsesStatus) butuh tau proses APA AJA yang
  // relevan buat kode+tipe_panel ini, biar gak nge-gate ke proses yang gak relevan (progress-nya
  // permanen 0 walau kerjaan sebenernya udah lanjut). Sumbernya bom_proses_relevan - tabel sama
  // yang dipakai wizard BOM di Vista Teknik (KapasitasPekerjaanTab) buat nentuin kolom "-" di
  // Detail Progres. Di-fetch sekali di sini (lokal, gak ada infra global-state di repo ini) -
  // pola sama kayak fetch bom_master/panel_type_meta/panel_wp_meta di atas.
  const [prosesRelevanSet,setProsesRelevanSet]=useState<Set<string>>(new Set());
  const [prosesRelevanHasMapping,setProsesRelevanHasMapping]=useState<Set<string>>(new Set());
  useEffect(()=>{
    supabase.from("bom_proses_relevan").select("*").then(({data}:any)=>{
      const relevanSet=new Set<string>();
      const hasMappingSet=new Set<string>();
      (data||[]).forEach((r:any)=>{
        relevanSet.add(r.kode_komponen+"|"+r.tipe_panel+"|"+r.jenis_pekerjaan);
        hasMappingSet.add(r.kode_komponen+"|"+r.tipe_panel);
      });
      setProsesRelevanSet(relevanSet);
      setProsesRelevanHasMapping(hasMappingSet);
    });
  },[]);
  // Fetch+realtime arsip Pasang Komponen (buat badge "Sudah di arsip") DIHAPUS dari sini (7 Agu
  // 2026) - progress Pasang Komponen (termasuk archive-nya) full pindah ke tab "Komponen"
  // terpisah (KomponenPasangView.tsx), gak lagi ditampilkan/diedit dari OperatorView.
  const getEffCfg=(tipe:string)=>(bomPanelTypes?.[tipe]?.wps?.length>0)?bomPanelTypes[tipe]:(PANEL_TYPES as any)[tipe];
  const [shift,setShift]=useState(()=>{
    try{
      const saved=JSON.parse(localStorage.getItem(wsKey)||"{}");
      return saved.tanggal===hariKerjaAwal&&saved.shift?saved.shift:"1";
    }catch{return "1";}
  });
  const [shiftSet,setShiftSet]=useState(()=>{
    try{
      const saved=JSON.parse(localStorage.getItem(wsKey)||"{}");
      return saved.tanggal===hariKerjaAwal?!!saved.shiftSet:false;
    }catch{return false;}
  });
  useEffect(()=>{
    // Simpan hariKerjaAwal (tanggal sesi kerja sesungguhnya), BUKAN viewDate - viewDate bisa
    // berubah bebas kalau operator navigasi lihat hari lain (tombol prev/next), dan itu gak
    // boleh ikut nimpa/ngerusak status shift sesi kerja yang sebenarnya lagi berjalan.
    try{localStorage.setItem(wsKey,JSON.stringify({tanggal:hariKerjaAwal,shift,shiftSet}));}catch{}
  },[shift,shiftSet,wsKey,hariKerjaAwal]);
  useEffect(()=>{
    // localStorage dishare otomatis antar tab SATU browser/device (native), tapi React state di
    // tab lain gak otomatis ke-refresh - kalau operator buka 2 tab & ganti shift di tab A, tab B
    // tetep mikir shift lama sampai reload manual. Dengerin event "storage" bawaan browser (cuma
    // fire di tab LAIN, bukan tab yang nulis sendiri) buat nyamain shift/shiftSet live antar tab.
    // Gak nyentuh viewDate (itu murni navigasi lihat-lihat, bukan status sesi kerja).
    const onStorage=(e:StorageEvent)=>{
      if(e.key!==wsKey||!e.newValue)return;
      try{
        const saved=JSON.parse(e.newValue);
        if(saved.tanggal===hariKerjaAwal){
          if(saved.shift)setShift(saved.shift);
          setShiftSet(!!saved.shiftSet);
        }
      }catch{}
    };
    window.addEventListener("storage",onStorage);
    return()=>window.removeEventListener("storage",onStorage);
  },[wsKey,hariKerjaAwal]);
  const [catatan,setCatatan]=useState<Record<string,string>>({});
  const [savedNote,setSavedNote]=useState<Record<string,boolean>>({});
  const [lockMsg,setLockMsg]=useState(false);
  const [pernahDikunci,setPernahDikunci]=useState(false);
  const [lockedCells,setLockedCells]=useState<Record<string,boolean>>({});
  const [fProyek,setFProyek]=useState("ALL");
  const [fPanel,setFPanel]=useState("ALL");
  const [statusFilter,setStatusFilter]=useState<"ALL"|ProsesStatus>("ALL");
  const [renhar,setRenhar]=useState<any[]>([]);
  const [panelsMap,setPanelsMap]=useState<Record<number,any>>({});
  // Sinkron manual (bukan lewat dependency effect) biar useEffect subscribe realtime renhar
  // gak perlu depend ke panelsMap - kalau iya, channel-nya bakal resubscribe terus-menerus.
  const panelsMapRef=useRef<Record<number,any>>({});
  useEffect(()=>{panelsMapRef.current=panelsMap;},[panelsMap]);
  const [loadingData,setLoadingData]=useState(false);
  const [pekerjaList,setPekerjaList]=useState<any[]>([]);
  const [woTargetMap,setWoTargetMap]=useState<Record<number,string>>({});
  const [wiringInfoMap,setWiringInfoMap]=useState<Record<string,any>>({});
  const [komponenInfoMap,setKomponenInfoMap]=useState<Record<string,any>>({});
  const [selectedKomponen,setSelectedKomponen]=useState<Record<string,string[]>>(()=>{
    try{
      const saved=JSON.parse(localStorage.getItem(wsKey+"_komp")||"{}");
      return saved.tanggal===TODAY&&saved.data?saved.data:{};
    }catch{return {};}
  });
  useEffect(()=>{
    try{localStorage.setItem(wsKey+"_komp",JSON.stringify({tanggal:TODAY,data:selectedKomponen}));}catch{}
  },[selectedKomponen,wsKey]);
  // Sistem Section (POTONG/RENDAM/PAINTING - lihat simpanSectionPaintingRendam). carryOverPct =
  // snapshot progress SEBELUM collect, dipasang begitu komponen dikonfirmasi collect - biar badge
  // "Lanjutan X%" nunjukin angka BEKU dari section sebelumnya, bukan ikut berubah pas qty diketik
  // ulang di section yang lagi jalan. sectionMulaiMap = timestamp lokal "Mulai" pertama kali buat
  // section yang lagi terbuka (persisted per proses+tanggal, direset begitu section disimpan) -
  // dipakai buat rentang waktu di Tab Review Potong/Painting.
  const [carryOverPct,setCarryOverPct]=useState<Record<string,number>>(()=>{
    try{
      const saved=JSON.parse(localStorage.getItem(wsKey+"_carryOverPct")||"{}");
      return saved.tanggal===TODAY&&saved.data?saved.data:{};
    }catch{return {};}
  });
  useEffect(()=>{
    try{localStorage.setItem(wsKey+"_carryOverPct",JSON.stringify({tanggal:TODAY,data:carryOverPct}));}catch{}
  },[carryOverPct,wsKey]);
  const [sectionMulaiMap,setSectionMulaiMap]=useState<Record<string,string>>(()=>{
    try{
      const saved=JSON.parse(localStorage.getItem(wsKey+"_sectionMulai")||"{}");
      return saved.tanggal===TODAY&&saved.data?saved.data:{};
    }catch{return {};}
  });
  useEffect(()=>{
    try{localStorage.setItem(wsKey+"_sectionMulai",JSON.stringify({tanggal:TODAY,data:sectionMulaiMap}));}catch{}
  },[sectionMulaiMap,wsKey]);
  const [komponenPopup,setKomponenPopup]=useState<{proses:string,panelId:number}|null>(null);
  const [tempSelectedKomponen,setTempSelectedKomponen]=useState<string[]>([]);
  // Khusus BENDING/STEL mobile: titik awal pilih komponen dibalik jadi Jenis Komponen -> Panel
  // (bukan Panel -> Komponen). Sumber datanya tetap selectedKomponen yang sama persis.
  const [komponenPopupJenis,setKomponenPopupJenis]=useState<{proses:string,namaKomponen:string}|null>(null);
  const [tempSelectedPanelJenis,setTempSelectedPanelJenis]=useState<number[]>([]);
  // Flash "Tersimpan" sesaat di tombol Simpan Progress buat proses yg blm ada feedback visual saat disimpan <100%.
  const [savedFlash,setSavedFlash]=useState<Record<string,boolean>>({});
  // Guard double-submit tombol "Simpan {tahap}" BUSBAR (audit "Gagal Simpan Progress", 1 Sep 2026) -
  // dulu tombol ini gak pernah di-disable selama request jalan, beda dgn tombol Mulai/Selesai yang
  // sudah pakai timerLoading. Karena simpanProgressTahapBusbar bisa makan waktu lama (2 request
  // berurutan, masing2 sampai 3x retry) dan pesan errornya sendiri nyuruh "tekan lagi", operator bisa
  // tap dobel pas request pertama masih jalan - dua panggilan konkuren insert checkpoint log dobel +
  // rebutan lock di row panels yang sama, bikin request yg sebenarnya cuma agak lambat kelewat timeout
  // dan dilaporkan sebagai "koneksi lambat/putus" padahal akarnya race condition di klien.
  const [savingTahap,setSavingTahap]=useState<Record<string,boolean>>({});
  const PROSES_FLASH_TERSIMPAN=["FINISHING","RENDAM","PAINTING","WIRING CONTROL","WIRING POWER","RAKIT","PASANG KOMPONEN","BUSBAR"];

  // Auto-scroll + highlight kartu accordion begitu popup Konfirmasi ditutup, biar operator
  // langsung lihat hasil konfirmasinya tanpa perlu scroll manual cari sendiri.
  const accordionRefs=useRef<Record<string,HTMLDivElement|null>>({});
  const [highlightGroup,setHighlightGroup]=useState<string|null>(null);
  const scrollDanHighlightGroup=(proses:string,groupKey:string)=>{
    if(!groupKey)return;
    const key=`${proses}_${groupKey}`;
    // Double rAF - nunggu React selesai render & browser selesai paint dulu abis setSelectedKomponen,
    // baru elemen kartunya PASTI ada di DOM sebelum di-scrollIntoView.
    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        const el=accordionRefs.current[key];
        if(!el)return;
        el.scrollIntoView({behavior:"smooth",block:"center"});
        setHighlightGroup(key);
        setTimeout(()=>setHighlightGroup(prev=>prev===key?null:prev),2500);
      });
    });
  };

  const getUrgensi=(woId:number)=>{
    const target=woTargetMap[woId];
    if(!target)return{level:"normal",label:"",hari:null};
    const hari=Math.ceil((new Date(target).getTime()-new Date().getTime())/86400000);
    if(hari<0)return{level:"telat",label:`Telat ${Math.abs(hari)}hr`,hari};
    if(hari<=3)return{level:"mendesak",label:`H-${hari}`,hari};
    if(hari<=7)return{level:"perhatian",label:`H-${hari}`,hari};
    return{level:"normal",label:`H-${hari}`,hari};
  };
  const [operatorModal,setOperatorModal]=useState<any>(null);
  const [terakhirKerjaPekerjaId,setTerakhirKerjaPekerjaId]=useState<number|null>(null);

  useEffect(()=>{
    if(!operatorModal){setTerakhirKerjaPekerjaId(null);return;}
    const task=renhar.find((r:any)=>r.id===operatorModal.taskId);
    if(!task){setTerakhirKerjaPekerjaId(null);return;}
    const panelId=task.panel_id||task.panelId;
    supabase.from("fcs_timer_kerja").select("pekerja_id,mulai")
      .eq("panel_id",panelId).eq("kode_komponen",operatorModal.kode).eq("proses",task.proses)
      .order("mulai",{ascending:false}).limit(1).then(({data})=>{
        setTerakhirKerjaPekerjaId(data&&data.length>0?data[0].pekerja_id:null);
      });
  },[operatorModal]);
  const [timerAktif,setTimerAktif]=useState<Record<string,any>>({});

  // Reminder timer kerja yang udah lama jalan tanpa update progress (dikirim server-side lewat
  // cron timer-reminder-check tiap 30 menit ke fcs_notifikasi tipe='timer_reminder') - routing
  // ke device yang tepat dilakukan DI SINI (client), bukan di server, karena satu device/tablet
  // divisi bisa dipakai bareng beberapa pekerja_id (operator "pilih sendiri di tablet") - jadi
  // yang relevan buat ditampilin adalah SEMUA reminder yang proses-nya masuk divisi/sub_bagian
  // sesi ini, bukan cocokin ke satu pekerja_id spesifik. Non-blocking (poin #4) - cuma banner
  // kecil yang bisa diabaikan, bukan modal wajib direspon.
  const prosesTermasukDivisi=(proses:string,divisi:string):boolean=>{
    const dcfg=DIVISI_CONFIG[divisi];
    if(!dcfg)return false;
    if(dcfg.proses&&dcfg.proses.includes(proses))return true;
    if(dcfg.subBagianProses)return Object.values(dcfg.subBagianProses).some((arr:any)=>arr.includes(proses));
    return false;
  };
  const [timerReminders,setTimerReminders]=useState<any[]>([]);
  useEffect(()=>{
    const fetchReminders=async()=>{
      const{data}=await supabase.from("fcs_notifikasi").select("*").eq("tipe","timer_reminder").eq("dibaca",false).order("created_at",{ascending:false});
      setTimerReminders((data||[]).filter((n:any)=>prosesTermasukDivisi(n.proses,user.divisi)));
    };
    fetchReminders();
    const ch=supabase.channel("realtime-timer-reminder-"+user.divisi)
      .on("postgres_changes",{event:"*",schema:"public",table:"fcs_notifikasi",filter:"tipe=eq.timer_reminder"},fetchReminders)
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[user.divisi]);

  const dismissReminder=async(id:number)=>{
    setTimerReminders(prev=>prev.filter(r=>r.id!==id)); // optimistic, non-blocking
    await supabase.from("fcs_notifikasi").update({dibaca:true}).eq("id",id);
  };
  // "Selesai, saya lupa matikan" - operasi inti SAMA PERSIS kayak stopTimer() (update `selesai`
  // by id, progress terakhir yang tercatat gak disentuh sama sekali) - dipanggil langsung by
  // timer_id (bukan lewat state timerAktif lokal, karena reminder ini bisa muncul buat timer
  // yang kartunya lagi gak ke-load di state saat ini) - tapi TETAP sinkronin timerAktif kalau
  // kebetulan key-nya lagi ke-load, biar UI kartu yang lagi kebuka gak nunjukin timer aktif palsu.
  // AUDIT FIX (7 Agu 2026): sebelumnya TANPA retry & TANPA cek error - kalau update gagal
  // (network drop/timeout), reminder tetap di-dismiss & state lokal tetap dianggap "selesai"
  // secara optimistic walau row di DB tetap selesai=NULL - ini salah satu jalur ghost timer yang
  // paling gak kelihatan (operator gak pernah tau timer-nya sebenarnya masih nyangkut). Sekarang
  // dibungkus withRetry + cek error, SAMA PERSIS pola stopTimer() - reminder cuma di-dismiss kalau
  // update beneran sukses.
  const selesaikanDariReminder=async(reminder:any)=>{
    try{
      const{error}=await withRetry(()=>supabase.from("fcs_timer_kerja").update({selesai:new Date().toISOString()}).eq("id",reminder.timer_id).is("selesai",null));
      if(error){
        alert("Gagal selesai-in timer: "+error.message);
        return;
      }
      const key=timerKey(reminder.panel_id,reminder.kode_komponen,reminder.proses,reminder.pekerja_id);
      setTimerAktif(prev=>{const n={...prev};delete n[key];return n;});
      await dismissReminder(reminder.id);
    }catch(err:any){
      alert("Gagal selesai-in timer - koneksi bermasalah, coba lagi.\n("+(err?.message||"unknown error")+")");
    }
  };

  const [timerPernahMulai,setTimerPernahMulai]=useState<Record<string,boolean>>({});
  const [timerSelesaiHariIni,setTimerSelesaiHariIni]=useState<Record<string,boolean>>({});
  const [timerDurasiSelesai,setTimerDurasiSelesai]=useState<Record<string,number>>({});
  const [timerLoading,setTimerLoading]=useState<string|null>(null);
  const [, setTimerTick]=useState(0);
  useEffect(()=>{
    // Maksa re-render tiap detik SELAMA ada timer yang lagi jalan, biar durasi timer
    // keliatan jalan live kayak stopwatch beneran (30 detik kayak sebelumnya kerasa
    // beku/patah-patah, baru "loncat" pas render lain kepicu). Interval cuma nyala
    // pas ada timer aktif - kalau gak ada, gak jalan sama sekali (hemat, gak nguras
    // baterai/CPU pas nganggur).
    if(Object.keys(timerAktif).length===0)return;
    const iv=setInterval(()=>setTimerTick(t=>t+1),1000);
    return ()=>clearInterval(iv);
  },[timerAktif]);
  const [tempPekerjaIds,setTempPekerjaIds]=useState<number[]>([]);
  const [bulkAssignProses,setBulkAssignProses]=useState<string|null>(null);
  const [expandedPanel,setExpandedPanel]=useState<Record<string,string|null>>({});
  const [bulkAssignGroupKey,setBulkAssignGroupKey]=useState<string|null>(null);
  const [tempBulkPekerjaIds,setTempBulkPekerjaIds]=useState<number[]>([]);
  // Khusus BUSBAR: bulk-assign HARUS pilih satu tahap spesifik dulu (bukan ke-4 tahap sekaligus)
  // - alur kerja lapangan-nya per-tahap secara terpisah (misal fabrikasi banyak part sekaligus
  // dalam satu sesi, plating/pasang biasanya sesi lain/orang lain) - beda dari proses lain yang
  // satu operator ngerjain satu komponen utuh dari awal sampai akhir.
  const [bulkAssignTahap,setBulkAssignTahap]=useState<string|null>(null);

  const cfg=DIVISI_CONFIG[user.divisi];
  const isQtyBased=QTY_DIVISI.includes(user.divisi);
  const PROSES_CARD_MODE:Record<string,string>={
    POTONG:'qty',RENDAM:'qty',PAINTING:'qty',
    BENDING:'qty',STEL:'qty',FINISHING:'qty',RAKIT:'qty',"PASANG KOMPONEN":'qty',
    "WIRING CONTROL":'timer',"WIRING POWER":'timer',BUSBAR:'timer',
  };
  // REVISI (5 Agu 2026): Box Control/Pintu punya progress PASANG KOMPONEN gabungan 2 kontribusi
  // terpisah - ASSEMBLING (Assembling Luar, tampil di kartu PASANG KOMPONEN biasa) dan WIRING
  // (operator Wiring Control). Kontribusi WIRING tadinya sub-section kecil nempel di kartu
  // WIRING CONTROL, sekarang (5 Agu 2026 sore) jadi band Card terpisah sendiri - lihat render
  // "Kontribusi Pasang Komponen" tepat setelah {myProses.map(...)} di bawah.
  // progress["WIRING CONTROL"] (kerja kabel beneran) TETAP independen, gak kesentuh sama sekali.
  // PASANG_KOMPONEN_TAHAP_KOMPONEN_NAMA/PASANG_KOMPONEN_URUTAN_TAHAP di-import dari panelHelpers
  // (7 Agu 2026) - dipakai bareng KomponenPasangView (tab "Komponen" baru).
  // Proses qty-mode yang qty-nya dikunci sampai operator klik Mulai (biar gak bisa keisi
  // tanpa operator ter-assign). RENDAM/PAINTING/RAKIT/PASANG KOMPONEN dulu gak ada di sini -
  // itu lubang yang sama persis kayak bug "operator kosong padahal 100%" yang udah diperbaiki
  // buat POTONG/BENDING/STEL. FINISHING sengaja gak dikasih auto-assign (harus eksplisit Pilih
  // Operator dulu baru bisa Mulai, baru qty kebuka) - itu udah aman by design.
  const PROSES_QTY_LOCK_SEBELUM_MULAI=["POTONG","BENDING","STEL","FINISHING","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN"];
  const PROSES_AUTO_ASSIGN_SAAT_QTY=["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN"];
  const myProses:string[]=(user.sub_bagian&&cfg.subBagianProses?.[user.sub_bagian])||cfg.proses||[];

  // Ambil semua timer aktif (lintas tanggal) + semua timer hari ini (aktif maupun sudah selesai).
  // BUG FIX (Sprint 3, 5 Agu 2026): dulu .select("*") tanpa .range() - fcs_timer_kerja bukan
  // tabel kecil (sudah ribuan baris dari histori timer semua operator lintas divisi/panel, filter
  // "selesai IS NULL" di sini juga gak dibatasi tanggal sama sekali), jadi rawan kena cap diam-diam
  // 1000 baris Supabase begitu jumlahnya lewat itu - persis kelas bug renhar/activity_log yang
  // sudah pernah kejadian. Dipakai bareng di 2 useEffect (load awal + refresh abis realtime event).
  const refreshTimerData=async()=>{
    let all:any[]=[];
    let from=0;
    const step=1000;
    while(true){
      const{data}=await supabase.from("fcs_timer_kerja").select("*").or(`selesai.is.null,tanggal.eq.${viewDate}`).range(from,from+step-1);
      if(!data)break;
      all=all.concat(data);
      if(data.length<step)break;
      from+=step;
    }
    const mapAktif:Record<string,any>={};
    const mapPernahMulai:Record<string,boolean>={};
    const mapSelesaiHariIni:Record<string,boolean>={};
    const mapDurasiSelesai:Record<string,number>={};
    all.forEach((t:any)=>{
      const key=timerKey(t.panel_id,t.kode_komponen,t.proses,t.pekerja_id,t.tahap);
      if(!t.selesai&&t.tanggal===viewDate)mapAktif[key]=t;
      mapPernahMulai[key]=true;
      if(t.tanggal===viewDate&&t.selesai){
        mapSelesaiHariIni[key]=true;
        mapDurasiSelesai[key]=(mapDurasiSelesai[key]||0)+Number(t.durasi_menit||0);
      }
    });
    setTimerAktif(mapAktif);
    setTimerPernahMulai(mapPernahMulai);
    setTimerSelesaiHariIni(mapSelesaiHariIni);
    setTimerDurasiSelesai(mapDurasiSelesai);
  };

  // Versi TARGETED refreshTimerData - cuma re-query 1 kombinasi panel+kode+proses+pekerja
  // (bukan seluruh tabel) (audit egress Agu 2026). Dipakai di handler realtime fcs_timer_kerja:
  // channel-nya gak ada filter (timer siapapun di divisi manapun bisa relevan buat auto-assign/
  // status di layar operator lain), tapi SEBELUM ini tiap event apapun di tabel itu (mulai/stop
  // timer siapapun, dimana pun) bikin SEMUA operator yang OperatorView-nya kebuka nge-refetch
  // ULANG SELURUH tabel fcs_timer_kerja (ribuan baris). Sekarang cuma re-query kombinasi kolom
  // yang berubah - hasilnya sama persis (query sama, cuma di-scope ke 1 key) tapi jauh lebih kecil.
  const refreshTimerKey=async(panelId:number,kode:string,proses:string,pekerjaId:number,tahap?:string|null)=>{
    if(!panelId||!kode||!proses||!pekerjaId)return;
    const key=timerKey(panelId,kode,proses,pekerjaId,tahap);
    let q=supabase.from("fcs_timer_kerja").select("*")
      .eq("panel_id",panelId).eq("kode_komponen",kode).eq("proses",proses).eq("pekerja_id",pekerjaId)
      .or(`selesai.is.null,tanggal.eq.${viewDate}`);
    q=tahap?q.eq("tahap",tahap):q.is("tahap",null);
    const{data}=await q;
    const rows=data||[];
    let aktif:any=null,pernahMulai=false,selesaiHariIni=false,durasiSelesai=0;
    rows.forEach((t:any)=>{
      if(!t.selesai&&t.tanggal===viewDate)aktif=t;
      pernahMulai=true;
      if(t.tanggal===viewDate&&t.selesai){
        selesaiHariIni=true;
        durasiSelesai+=Number(t.durasi_menit||0);
      }
    });
    setTimerAktif(prev=>{const n={...prev};if(aktif)n[key]=aktif;else delete n[key];return n;});
    if(pernahMulai)setTimerPernahMulai(prev=>({...prev,[key]:true}));
    setTimerSelesaiHariIni(prev=>{const n={...prev};if(selesaiHariIni)n[key]=true;else delete n[key];return n;});
    setTimerDurasiSelesai(prev=>{const n={...prev};if(durasiSelesai>0)n[key]=durasiSelesai;else delete n[key];return n;});
  };

  // Load data dari Supabase
  useEffect(()=>{
    setPernahDikunci(false);
    loadData();
    // load semua pekerja untuk kolom OPERATOR
    supabase.from("pekerja").select("id,nama,divisi").then(({data})=>setPekerjaList(data??[]));
    refreshTimerData();

    const renharChannel=supabase.channel("realtime-renhar-pekerja")
      // REVERT filter:"divisi=eq...." (30 Agu 2026) - sempat ditambah buat motong payload
      // realtime server-side, tapi terbukti lewat tes langsung ke DB: event DELETE renhar TIDAK
      // PERNAH sampai ke client sama sekali begitu filter ini aktif (renhar gak di-set REPLICA
      // IDENTITY FULL, jadi payload "old" pas DELETE cuma bawa {id}, gak ada `divisi` buat
      // dicocokkan filter-nya - Supabase diam-diam buang event yang gak lolos filter). Efeknya:
      // operator gak pernah lihat task ke-hapus lewat realtime lagi. Dibatalkan - Realtime Egress
      // cuma 0.3% dari total tagihan, gak sebanding sama risiko silent-drop ini.
      .on("postgres_changes",{event:"*",schema:"public",table:"renhar"},(payload:any)=>{
        // Merge tertarget - JANGAN loadData() penuh di sini. loadData() bikin loadingData=true
        // yang ganti SELURUH layar jadi spinner - dan karena tulisan operator sendiri (Mulai/
        // Pilih Operator) ke tabel renhar ini JUGA nge-trigger event ini (echo ke diri sendiri),
        // dulu tiap klik Mulai/Pilih Operator kerasa kayak "restart" penuh di HP operator.
        if(payload.eventType==="DELETE"){
          const oldRow=payload.old;
          if(oldRow?.id)setRenhar(prev=>prev.filter((t:any)=>t.id!==oldRow.id));
          return;
        }
        const row=payload.new;
        if(!row||row.tanggal!==viewDate||row.divisi!==user.divisi)return;
        setRenhar(prev=>{
          const exists=prev.some((t:any)=>t.id===row.id);
          return exists?prev.map((t:any)=>t.id===row.id?row:t):[...prev,row];
        });
        // Task baru bisa referensiin panel yang belum ke-load - fetch panel itu aja kalau perlu.
        const panelId=row.panel_id||row.panelId;
        if(panelId&&!panelsMapRef.current[panelId]){
          supabase.from("panels").select("*").eq("id",panelId).maybeSingle().then(({data})=>{
            if(data)setPanelsMap(prev=>prev[data.id]?prev:{...prev,[data.id]:data});
          });
        }
      })
      .subscribe();
    return()=>{supabase.removeChannel(renharChannel);};
  },[viewDate,user.divisi]);

  useEffect(()=>{
    const timerChannel=supabase.channel("realtime-timer-kerja-pekerja")
      .on("postgres_changes",{event:"*",schema:"public",table:"fcs_timer_kerja"},(payload:any)=>{
        // refreshTimerKey (bukan refreshTimerData penuh) - lihat komentar di definisinya.
        const row=payload.new||payload.old;
        if(row?.panel_id)refreshTimerKey(row.panel_id,row.kode_komponen,row.proses,row.pekerja_id,row.tahap);
        else refreshTimerData(); // fallback: DELETE tanpa REPLICA IDENTITY FULL cuma bawa id, gak cukup buat targeted query
      })
      .subscribe();
    // Kalau HP di-background (pindah app lain / kunci layar) lama, socket realtime bisa diam2
    // putus - event fcs_timer_kerja yang kejadian pas offline itu kelewat, timerAktif bisa
    // nyangkut di state basi (ghost timer di UI) sampai ada event lain yang gak sengaja
    // nge-trigger refetch. refreshTimerData() silent (gak ada spinner/loadingData), jadi aman
    // dipanggil tiap kali tab balik aktif tanpa bikin UI kedip-kedip kayak loadData() penuh.
    const onVisible=()=>{
      if(document.visibilityState==="visible")refreshTimerData();
    };
    document.addEventListener("visibilitychange",onVisible);
    return()=>{
      supabase.removeChannel(timerChannel);
      document.removeEventListener("visibilitychange",onVisible);
    };
  },[viewDate]);

  const loadData=async()=>{
    setLoadingData(true);
    // ambil renhar berdasarkan divisi dan tanggal
    const {data:renharData}=await supabase.from("renhar").select("*")
      .eq("tanggal",viewDate).eq("divisi",user.divisi);
    const tasks=renharData??[];
    setRenhar(tasks);

    // ambil panels
    const panelIds=[...new Set(tasks.map((t:any)=>t.panel_id||t.panelId).filter(Boolean))];
    if(panelIds.length>0){
      const {data:panels}=await supabase.from("panels").select("*").in("id",panelIds as any);
      const map:Record<number,any>={};
      (panels??[]).forEach((p:any)=>{map[p.id]=p;});
      setPanelsMap(map);
    } else {
      setPanelsMap({});
    }

    // ambil target tanggal WO untuk hitung urgensi/deadline
    const woIds=[...new Set(tasks.map((t:any)=>t.wo_id||t.woId).filter(Boolean))];
    if(woIds.length>0){
      const{data:wos}=await supabase.from("work_orders").select("id,target").in("id",woIds as any);
      const targetMap:Record<number,string>={};
      (wos??[]).forEach((w:any)=>{targetMap[w.id]=w.target;});
      setWoTargetMap(targetMap);
    } else {
      setWoTargetMap({});
    }
    // Ambil info wiring (CREATE BY, CREATE ON, TARGET SELESAI) dari fcs_schedule dan raw_schedule
    const wiringProses=["WIRING CONTROL","WIRING POWER"];
    const wiringTasks=tasks.filter((t:any)=>wiringProses.includes(t.proses));
    if(wiringTasks.length>0){
      const wiringPanelIds=[...new Set(wiringTasks.map((t:any)=>t.panel_id||t.panelId).filter(Boolean))];
      const wiringProsesNames=[...new Set(wiringTasks.map((t:any)=>t.proses))];
      const[{data:fcsData},{data:rawData}]=await Promise.all([
        supabase.from("fcs_schedule").select("panel_id,jenis_pekerjaan,kode_komponen,qty_total,generated_by,created_at")
          .in("panel_id",wiringPanelIds as any).in("jenis_pekerjaan",wiringProsesNames),
        supabase.from("raw_schedule").select("panel_id,proses,schedule")
          .in("panel_id",wiringPanelIds as any).in("proses",wiringProsesNames),
      ]);
      const infoMap:Record<string,any>={};
      (fcsData||[]).forEach((row:any)=>{
        const key=`${row.panel_id}_${row.jenis_pekerjaan}`;
        if(!infoMap[key])infoMap[key]={bobot:row.kode_komponen,jumlahOrang:row.qty_total,createdBy:row.generated_by,createdAt:row.created_at,targetSelesai:null};
      });
      (rawData||[]).forEach((row:any)=>{
        const key=`${row.panel_id}_${row.proses}`;
        let lastTgl:string|null=null;
        Object.entries(row.schedule||{}).forEach(([tgl,entries]:any)=>{
          (entries||[]).forEach((e:any)=>{
            (e.komponen||[]).forEach((k:string)=>{
              if(k.startsWith("__wiring_")){if(!lastTgl||tgl>lastTgl)lastTgl=tgl;}
            });
          });
        });
        if(lastTgl&&infoMap[key])infoMap[key].targetSelesai=lastTgl;
      });
      setWiringInfoMap(infoMap);
    } else {
      setWiringInfoMap({});
    }

    // Ambil info komponen (CREATE BY, CREATE ON, TARGET SELESAI) untuk proses biasa
    const nonWiringProses=["POTONG","BENDING","STEL","FINISHING","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","BUSBAR"];
    const nonWiringTasks=tasks.filter((t:any)=>nonWiringProses.includes(t.proses));
    if(nonWiringTasks.length>0){
      const nwPanelIds=[...new Set(nonWiringTasks.map((t:any)=>t.panel_id||t.panelId).filter(Boolean))];
      const nwProsesNames=[...new Set(nonWiringTasks.map((t:any)=>t.proses))];
      const[{data:fcsDtNw},{data:rawDtNw}]=await Promise.all([
        supabase.from("fcs_schedule").select("panel_id,jenis_pekerjaan,kode_komponen,generated_by,created_at")
          .in("panel_id",nwPanelIds as any).in("jenis_pekerjaan",nwProsesNames),
        supabase.from("raw_schedule").select("panel_id,proses,schedule")
          .in("panel_id",nwPanelIds as any).in("proses",nwProsesNames),
      ]);
      const kompMap:Record<string,any>={};
      (fcsDtNw||[]).forEach((row:any)=>{
        const key=`${row.panel_id}_${row.jenis_pekerjaan}_${row.kode_komponen}`;
        if(!kompMap[key])kompMap[key]={createdBy:row.generated_by,createdAt:row.created_at,targetSelesai:null};
      });
      (rawDtNw||[]).forEach((row:any)=>{
        Object.entries(row.schedule||{}).forEach(([tgl,entries]:any)=>{
          (entries||[]).forEach((e:any)=>{
            (e.komponen||[]).forEach((k:string)=>{
              if(k.startsWith("__wiring_"))return;
              const key=`${row.panel_id}_${row.proses}_${k}`;
              if(!kompMap[key])kompMap[key]={createdBy:e.createdBy||null,createdAt:e.createdAt||null,targetSelesai:null};
              else if(!kompMap[key].createdBy&&e.createdBy){kompMap[key].createdBy=e.createdBy;kompMap[key].createdAt=e.createdAt;}
              if(!kompMap[key].targetSelesai||tgl>kompMap[key].targetSelesai)kompMap[key].targetSelesai=tgl;
            });
          });
        });
      });
      setKomponenInfoMap(kompMap);
    } else {
      setKomponenInfoMap({});
    }
    setLoadingData(false);
  };

  // ── Realtime listener untuk panels (qty update dari Vista Teknik) ──
  // Depend ke renhar (bukan panelsMap!) - panelsMap berubah tiap qty diketik lokal,
  // kalau jadi dependency effect ini bakal resubscribe terus-menerus dan bikin race
  // condition antara update lokal vs echo dari server (progress bisa "balik" gak 100%).
  // BUG FIX (8 Agu 2026): dulu di sini ada logic "rescale" progress pakai rasio qty-lama/qty-
  // baru begitu qty berubah (mis. progress 80% dari 4/5, admin kurangin qty ke 3 -> rasio
  // 5/3≈1.67 -> progress otomatis "dibulatkan" jadi 100%) - progress OTOMATIS ke-timpa TANPA
  // siapapun sadar/konfirmasi, kebalikan dari yang seharusnya (qty dikurangi di bawah progress
  // yang udah ada harus di-WARNING ke admin dulu, bukan di-override diam-diam - itu sekarang
  // ditangani di ManajemenWO.tsx saveQtyEdit). checklist dari server (payload.new) sudah APA
  // ADANYA sesuai yang ditulis admin - gak perlu dimanipulasi lagi di sini, tinggal dipakai.
  useEffect(()=>{
    const panelIds=[...new Set(renhar.map((t:any)=>t.panel_id||t.panelId).filter(Boolean))];
    if(!panelIds.length) return;

    const channel=supabase.channel('realtime-panels-pekerja')
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'panels'},
        (payload:any)=>{
          const updated=payload.new;
          if(!panelIds.includes(updated.id)) return;
          setPanelsMap(prev=>({...prev,[updated.id]:updated}));
        }
      )
      .subscribe();
    return()=>{supabase.removeChannel(channel);};
  },[renhar]);

  const todayTasks=useMemo(()=>{
    const urutanLevel:Record<string,number>={telat:0,mendesak:1,perhatian:2,normal:3};
    return [...renhar].sort((a:any,b:any)=>{
      const woIdA=a.wo_id||a.woId;const woIdB=b.wo_id||b.woId;
      const uA=getUrgensi(woIdA);const uB=getUrgensi(woIdB);
      const lvA=urutanLevel[uA.level]??3;const lvB=urutanLevel[uB.level]??3;
      if(lvA!==lvB)return lvA-lvB;
      if(uA.hari!==null&&uB.hari!==null)return uA.hari-uB.hari;
      return 0;
    });
  },[renhar,woTargetMap]);
  const proyekList=[...new Set(todayTasks.map((t:any)=>t.proyek))];
  const panelList=[...new Set(todayTasks.filter((t:any)=>fProyek==="ALL"||t.proyek===fProyek).map((t:any)=>t.panel))];

  const filteredTasks=useMemo(()=>todayTasks.filter((t:any)=>
    (fProyek==="ALL"||t.proyek===fProyek)&&
    (fPanel==="ALL"||t.panel===fPanel)
  ),[todayTasks,fProyek,fPanel]);

  const tasksByProses=useMemo(()=>{
    const g:Record<string,any[]>={};
    filteredTasks.forEach((t:any)=>{
      if(!g[t.proses])g[t.proses]=[];
      g[t.proses].push(t);
    });
    return g;
  },[filteredTasks]);

  const isCellLocked=(panelId:number,kode:string,proses:string)=>
    !!lockedCells[`${panelId}_${kode}_${proses}_${viewDate}_${shift}`];

  const getLockedFloor=(panelId:number,kode:string,proses:string)=>{
    const panel=panelsMap[panelId];
    const qtyByDate=panel?.checklist?.[kode]?.qtyProsesByDate?.[proses]||{};
    const pastDates=Object.keys(qtyByDate).filter((d:string)=>d<viewDate);
    if(!pastDates.length)return 0;
    return Math.max(...pastDates.map((d:string)=>qtyByDate[d]||0));
  };

  // Debounce penulisan qty ke Supabase per (panelId_kode_proses) - biar gak nembak 1 request
  // per keystroke yang bisa race sama echo realtime dan bikin input kerasa "reset".
  const qtyWriteTimers=useRef<Record<string,any>>({});
  // Antrian promise per taskId - biar panggilan updatePekerjaPerKomponenBatch yang nembak
  // nyaris bersamaan (misal ngetik qty komponen A lalu buru-buru ke komponen B sebelum React
  // sempat re-render) gak jalan interleaved dan saling timpa, tapi antre satu-satu.
  const pekerjaPerKomponenQueue=useRef<Record<number,Promise<any>>>({});

  // Update qty proses ke local state (instan) + Supabase (di-debounce di background)
  const updateQtyProses=(panelId:number,kode:string,proses:string,val:number)=>{
    if(isCellLocked(panelId,kode,proses))return;
    const floor=getLockedFloor(panelId,kode,proses);
    const panel=panelsMap[panelId];
    if(!panel)return;
    const cl=panel.checklist?.[kode]||{qty:0,qtyProses:{},progress:{},progressByDate:{},qtyProsesByDate:{}};
    const qtyKomp=cl.qty||0;
    const qtyProses=Math.min(Math.max(Number(val)||0,floor),qtyKomp);
    const pct=qtyKomp>0?Math.min(100,Math.round((qtyProses/qtyKomp)*100)):0;
    const newChecklist={
      ...panel.checklist,
      [kode]:{
        ...cl,
        qtyProses:{...(cl.qtyProses||{}),[proses]:qtyProses},
        qtyProsesByDate:{
          ...(cl.qtyProsesByDate||{}),
          [proses]:{...((cl.qtyProsesByDate||{})[proses]||{}),[viewDate]:qtyProses}
        },
        progressByDate:{
          ...(cl.progressByDate||{}),
          [proses]:{...((cl.progressByDate||{})[proses]||{}),[viewDate]:pct}
        },
        progress:{...(cl.progress||{}),[proses]:pct},
      }
    };
    // update local instan - responsif tanpa jeda, gak nunggu network
    setPanelsMap(prev=>({...prev,[panelId]:{...panel,checklist:newChecklist}}));

    // penulisan ke Supabase di-debounce - cuma 1 request yang akhirnya dikirim per jeda ngetik
    const debounceKey=`${panelId}_${kode}_${proses}`;
    if(qtyWriteTimers.current[debounceKey])clearTimeout(qtyWriteTimers.current[debounceKey]);
    qtyWriteTimers.current[debounceKey]=setTimeout(async()=>{
      delete qtyWriteTimers.current[debounceKey];
      await mergePanelChecklist(panelId,{[kode]:newChecklist[kode]});
      // FIX akar masalah "operator kosong" (audit investigasi-operator-kosong.md) - path INI
      // (ketik qty manual) persist LANGSUNG ke DB kayak PCT_STEPS lama, gak lewat "Kunci
      // Progress" yang nyatet progress_checkpoint_log - jadi progress bisa kesimpen tanpa jejak
      // operator SAMA SEKALI. Catat checkpoint di sini juga, sama persis pola updatePctManual.
      if(pct>0){
        const task=todayTasks.find((t:any)=>(t.panel_id||t.panelId)===panelId&&t.proses===proses&&(t.komponen||[]).includes(kode));
        const idsKomp=(task?.pekerja_per_komponen||{})[kode]||[];
        const workerObjs=idsKomp.map((wid:number)=>pekerjaList.find((p:any)=>p.id===wid)).filter(Boolean);
        const pekerjaNamaLog=workerObjs.length>0?workerObjs.map((w:any)=>w.nama).join(', '):user.nama;
        await supabase.from('progress_checkpoint_log').insert({
          panel_id:panelId,kode_komponen:kode,proses,checkpoint:pct,pekerja_nama:pekerjaNamaLog,tanggal:viewDate,
        });
      }
    },600);
  };

  const isWiringProses=(pr:string)=>pr==="WIRING CONTROL"||pr==="WIRING POWER";

  const canEditProgressKomponen=(task:any,kode:string,panelId:number,proses:string):boolean=>{
    if(proses==="PACKING"){
      const panel=panelsMap[panelId];
      const cl=panel?.qc_checklist||{};
      return QC_ITEMS.every(item=>cl[item.key]?.status==="lolos");
    }
    // BUSBAR sekarang punya alur & kartu sendiri (per-tahap, lihat simpanProgressTahapBusbar) -
    // gerbang lama (generic PCT_STEPS/canEditProgressKomponen) sengaja dimatiin buat BUSBAR
    // biar gak ke-pakai keliru sama jalur lama (pekerja_per_komponen buat BUSBAR sekarang
    // berbentuk object per-tahap, bukan array flat - gak kompatibel sama pengecekan generic ini).
    if(proses==="BUSBAR")return false;
    if(!isWiringProses(proses))return true;
    const ids=(task?.pekerja_per_komponen||{})[kode]||[];
    if(ids.length===0)return false;
    // Boleh ubah persentase selama timer lagi aktif ATAU udah pernah di-Selesai-in hari ini -
    // biar operator yang udah stop timer duluan tetap bisa catat progress, bukan cuma pas timer jalan.
    return ids.some((pid:number)=>!!timerAktif[`${panelId}_${kode}_${proses}_${pid}`]||!!timerSelesaiHariIni[`${panelId}_${kode}_${proses}_${pid}`]);
  };

  const canLockKomponen=(task:any,kode:string,panelId:number,proses:string):boolean=>{
    if(proses==="BUSBAR")return false;
    if(!isWiringProses(proses))return true;
    const ids=(task?.pekerja_per_komponen||{})[kode]||[];
    if(ids.length===0)return false;
    return ids.some((pid:number)=>timerSelesaiHariIni[`${panelId}_${kode}_${proses}_${pid}`]);
  };

  const startTimer=async(pekerjaId:number,panelId:number,kode:string,proses:string,tanggal:string,tahap?:string)=>{
    const key=timerKey(panelId,kode,proses,pekerjaId,tahap);
    setTimerLoading(key);
    try{
      let q=supabase.from("fcs_timer_kerja")
        .select("*").eq("pekerja_id",pekerjaId).eq("panel_id",panelId)
        .eq("kode_komponen",kode).eq("proses",proses).is("selesai",null);
      q=tahap?q.eq("tahap",tahap):q.is("tahap",null);
      const{data:existing}=await withRetry(()=>q.order("mulai",{ascending:false}).limit(1).maybeSingle());
      if(existing){
        setTimerAktif(prev=>({...prev,[key]:existing}));
        setTimerPernahMulai(prev=>({...prev,[key]:true}));
        return;
      }
      const{data,error}=await withRetry(()=>supabase.from("fcs_timer_kerja").insert({
        pekerja_id:pekerjaId,panel_id:panelId,kode_komponen:kode,proses,tanggal,mulai:new Date().toISOString(),tahap:tahap||null
      }).select().single());
      if(error){
        alert("Gagal mulai timer: "+error.message);
        return;
      }
      if(data){
        setTimerAktif(prev=>({...prev,[key]:data}));
        setTimerPernahMulai(prev=>({...prev,[key]:true}));
      }
    }catch(err:any){
      alert("Gagal mulai timer - koneksi bermasalah, coba lagi.\n("+(err?.message||"unknown error")+")");
    }finally{
      setTimerLoading(null);
    }
  };

  const stopTimer=async(pekerjaId:number,panelId:number,kode:string,proses:string,tahap?:string)=>{
    const key=timerKey(panelId,kode,proses,pekerjaId,tahap);
    const timer=timerAktif[key];
    if(!timer)return;
    setTimerLoading(key);
    try{
      const{error}=await withRetry(()=>supabase.from("fcs_timer_kerja").update({selesai:new Date().toISOString()}).eq("id",timer.id));
      if(error){
        alert("Gagal selesai-in timer: "+error.message);
        return;
      }
      setTimerAktif(prev=>{const n={...prev};delete n[key];return n;});
      setTimerSelesaiHariIni(prev=>({...prev,[key]:true}));
      // Cek apakah progress sudah 100% dan lebih cepat dari rencana - kirim notifikasi
      if(!tahap)await cekDanKirimNotifikasiAvailable(pekerjaId,panelId,kode,proses);
    }catch(err:any){
      alert("Gagal selesai-in timer - koneksi bermasalah, coba lagi.\n("+(err?.message||"unknown error")+")");
    }finally{
      setTimerLoading(null);
    }
  };

  // AUDIT FIX (7 Agu 2026): safety net ghost timer - dicek langsung ke data live, 14 dari 15
  // timer "aktif" di Timer Aktif tab ternyata ghost (progress komponen udah 100% tersimpan,
  // timer-nya gak pernah ke-stop - root cause: simpan-progress dan stop-timer itu 2 tombol/2 aksi
  // TERPISAH, gak atomik, operator bisa berhasil simpan progress 100% tanpa timer ikut ke-stop
  // kalau lupa/gagal klik Selesai). Dipanggil SETELAH progress berhasil tersimpan (bukan di dalam
  // try/catch yang sama) - REUSE stopTimer() apa adanya, gak ada logic stop baru. Kegagalan di
  // sini best-effort, gak boleh dianggap gagalin progress yang udah kesimpen di atas.
  const autoStopTimerJikaSelesai=async(panelId:number,kode:string,proses:string,pct:number,operatorIds:number[],tahap?:string)=>{
    if(pct<100)return;
    for(const pid of operatorIds){
      if(timerAktif[timerKey(panelId,kode,proses,pid,tahap)]){
        try{await stopTimer(pid,panelId,kode,proses,tahap);}catch{/* best-effort, progress utama udah aman */}
      }
    }
  };

  const cekDanKirimNotifikasiAvailable=async(pekerjaId:number,panelId:number,kode:string,proses:string)=>{
    const panel=panelsMap[panelId];
    if(!panel)return;
    const pct=panel.checklist?.[kode]?.progress?.[proses]||0;
    if(pct<100)return;
    // Cari tanggal TERJAUH di mana komponen ini sudah di-assign manual di raw_schedule
    // (ini jadi acuan "rencana selesai" - bukan dari rentangTanggal lagi, tapi dari assignment manual planner)
    const{data:rawRows}=await supabase.from("raw_schedule").select("schedule").eq("panel_id",panelId).eq("proses",proses);
    let tanggalRencanaSelesai:string|null=null;
    for(const row of rawRows||[]){
      for(const[tglKey,entries] of Object.entries(row.schedule||{}) as [string,any[]][]){
        for(const entry of entries){
          if((entry.komponen||[]).includes(kode)){
            if(!tanggalRencanaSelesai||tglKey>tanggalRencanaSelesai)tanggalRencanaSelesai=tglKey;
          }
        }
      }
    }
    if(!tanggalRencanaSelesai)return;
    const hariIni=getLocalDateStr();
    if(hariIni>=tanggalRencanaSelesai)return; // tidak lebih cepat, tidak perlu notifikasi
    const pekerja=pekerjaList.find((p:any)=>p.id===pekerjaId);
    const allItems=getEffCfg(panel.tipe)?.wps.flatMap((w:any)=>w.items)||[];
    const namaKomponen=allItems.find((it:any)=>it.kode===kode)?.nama||kode;
    await supabase.from("fcs_notifikasi").insert({
      tipe:"available",pekerja_id:pekerjaId,pekerja_nama:pekerja?.nama||"",
      panel_id:panelId,panel_nama:panel.nama,kode_komponen:kode,nama_komponen:namaKomponen,proses,
      tanggal_rencana_selesai:tanggalRencanaSelesai,tanggal_aktual_selesai:hariIni,
    });
  };

    // Gabungin semua kode per taskId jadi SATU map sebelum ditulis, biar gak saling overwrite.
    // Dua lapis proteksi race:
    // 1. Serialisasi per taskId lewat pekerjaPerKomponenQueue - panggilan yang nembak nyaris
    //    bersamaan (bulk ATAU satu-satu dari qty onChange) diantre, gak jalan interleaved.
    // 2. Base map buat merge diambil FRESH dari DB (bukan renhar di state lokal yang bisa
    //    lag dari render), biar gak ketinggalan tulisan dari panggilan lain yang barusan lewat.
    const updatePekerjaPerKomponenBatch=async(rowsToAssign:any[],getPekerjaIds:(r:any)=>number[])=>{
      const byTask=new Map<number,any[]>();
      rowsToAssign.forEach(r=>{
        if(!byTask.has(r.task.id))byTask.set(r.task.id,[]);
        byTask.get(r.task.id)!.push(r);
      });
      for(const[taskId,rowsSatuTask] of byTask){
        const prevInQueue=pekerjaPerKomponenQueue.current[taskId]||Promise.resolve();
        const thisWrite=prevInQueue.then(async()=>{
          const{data:fresh}=await supabase.from("renhar").select("pekerja_per_komponen").eq("id",taskId).maybeSingle();
          const baseMap=fresh?.pekerja_per_komponen||{};
          const newMap={...baseMap};
          rowsSatuTask.forEach(r=>{
            if(r.tahap){
              // BUSBAR per-tahap: merge ke object nested, JANGAN timpa tahap lain yang udah keisi.
              // WAJIB baca existing dari newMap (akumulator yang lagi jalan), BUKAN baseMap (state
              // awal sebelum batch ini) - kalau baca dari baseMap, beberapa tahap dari KODE YANG
              // SAMA dalam SATU batch (kejadian nyata pas bulk-assign operator BUSBAR sekaligus ke
              // semua tahap) bakal saling timpa satu sama lain, cuma tahap TERAKHIR yang keselamet.
              // AUDIT FIX (5 Agu 2026): kalau existing MASIH array flat (kasus PASANG KOMPONEN
              // Box Control/Pintu yang udah punya operator dari SEBELUM fitur tahap ASSEMBLING/
              // WIRING ada), dulu langsung dibuang diganti objek tahap kosong - operator lama
              // HILANG PERMANEN kalau tahap WIRING kebetulan disimpan duluan sebelum ASSEMBLING
              // sempat di-resave manual. Sekarang migrasi dulu: array flat lama jadi tahap
              // "ASSEMBLING" (tahap yang eksis duluan secara historis, konsisten sama
              // getPasangKomponenOperatorIds di sisi baca) sebelum tahap yang lagi disimpan
              // di-merge di atasnya.
              const existingRaw=newMap[r.kode];
              const existingForKode=Array.isArray(existingRaw)?{ASSEMBLING:existingRaw}:((existingRaw&&typeof existingRaw==="object")?existingRaw:{});
              newMap[r.kode]={...existingForKode,[r.tahap]:getPekerjaIds(r)};
            } else {
              newMap[r.kode]=getPekerjaIds(r);
            }
          });
          const{error}=await supabase.from("renhar").update({pekerja_per_komponen:newMap}).eq("id",taskId);
          if(!error){
            setRenhar(prev=>prev.map((t:any)=>t.id===taskId?{...t,pekerja_per_komponen:newMap}:t));
          }
        });
        pekerjaPerKomponenQueue.current[taskId]=thisWrite;
        await thisWrite;
      }
    };
    // Assign SATU komponen (dipanggil dari modal "Pilih Operator" per-komponen individual di
    // tabel desktop) - didelegasikan ke versi batch yang udah dibenerin (serialisasi + fetch
    // fresh dari DB sebelum merge), biar gak ada lagi jalur terpisah yang masih rawan stale-
    // closure race (baca renhar state lokal yang bisa lag, nimpa balik assignment kode lain
    // di task yang sama kalau ada penulisan lain yang nyaris bersamaan).
    const updatePekerjaPerKomponen=async(taskId:number,kode:string,pekerjaIds:number[])=>{
      await updatePekerjaPerKomponenBatch([{task:{id:taskId},kode}],()=>pekerjaIds);
    };
    // Assign operator KHUSUS SATU TAHAP BUSBAR - beda operator per tahap boleh keisi
    // bersamaan (gak saling timpa), lihat catatan nested-merge di updatePekerjaPerKomponenBatch.
    const updateOperatorBusbarTahap=async(taskId:number,kode:string,tahap:string,pekerjaIds:number[])=>{
      await updatePekerjaPerKomponenBatch([{task:{id:taskId},kode,tahap}],()=>pekerjaIds);
    };
    // Assign operator + LANGSUNG start timer buat SATU tahap spesifik (misal FABRIKASI) di SEMUA
    // komponen dalam satu grup BUSBAR sekaligus - satu kali pilih tahap+operator, gak perlu klik
    // Mulai satu-satu per panel lagi. Sengaja per-SATU-tahap (bukan ke-4 sekaligus) karena alur
    // kerja lapangan-nya emang gitu: fabrikasi banyak part dalam satu sesi, plating/pasang
    // biasanya sesi/orang lain - beda dari proses lain yang satu operator ngerjain satu komponen
    // utuh dari awal sampai akhir.
    const bulkAssignBusbarOperatorAndStart=async(rowsGroup:any[],tahap:string,pekerjaIds:number[])=>{
      const flatRows=rowsGroup.map((r:any)=>({task:r.task,kode:r.kode,tahap}));
      await updatePekerjaPerKomponenBatch(flatRows,()=>pekerjaIds);
      for(const r of rowsGroup){
        for(const pid of pekerjaIds){
          await startTimer(pid,r.panelId,r.kode,"BUSBAR",viewDate,tahap);
        }
      }
    };

    const bulkAssignAndStart=async(_proses:string,rowsToAssign:any[],pekerjaIds:number[])=>{
      // Cuma assign operator, TIDAK auto-start timer.
      // Operator klik tombol Mulai manual satu-satu per komponen.
      await updatePekerjaPerKomponenBatch(rowsToAssign,()=>pekerjaIds);
    };

    const bulkAssignAndStartDesktop=async(proses:string,rowsToAssign:any[],pekerjaIds:number[])=>{
      // Khusus desktop: assign operator SEKALIGUS start timer buat semua baris terkumpul.
      await updatePekerjaPerKomponenBatch(rowsToAssign,()=>pekerjaIds);
      for(const r of rowsToAssign){
        for(const pid of pekerjaIds){
          await startTimer(pid,r.panelId,r.kode,proses,viewDate);
        }
      }
    };

    const bulkStopDesktop=async(proses:string,rowsToStop:any[])=>{
      for(const r of rowsToStop){
        const idsKomp=(r.task.pekerja_per_komponen||{})[r.kode]||[];
        for(const pid of idsKomp){
          const key=`${r.panelId}_${r.kode}_${proses}_${pid}`;
          if(timerAktif[key]){
            await stopTimer(pid,r.panelId,r.kode,proses);
          }
        }
      }
    };

    // Khusus POTONG: operator = pekerja yang lagi login (gak ada picker), assign + start timer sekaligus.
    const startUntukUserSendiri=async(proses:string,rowsToAssign:any[])=>{
      await updatePekerjaPerKomponenBatch(rowsToAssign,()=>[user.id]);
      for(const r of rowsToAssign){
        await startTimer(user.id,r.panelId,r.kode,proses,viewDate);
      }
    };

  const updatePctManual=async(panelId:number,kode:string,proses:string,pct:number)=>{
    const panel=panelsMap[panelId];
    if(!panel)return;
    const cl=panel.checklist?.[kode]||{qty:0,qtyProses:{},progress:{},progressByDate:{}};
    const newChecklist={
      ...panel.checklist,
      [kode]:{
        ...cl,
        progressByDate:{
          ...(cl.progressByDate||{}),
          [proses]:{...((cl.progressByDate||{})[proses]||{}),[viewDate]:pct}
        },
        progress:{...(cl.progress||{}),[proses]:pct},
      }
    };
    // Optimistic - UI langsung kepake sebelum nunggu server, biar responsif walau koneksi lambat.
    // Kalau ternyata gagal walau udah di-retry, state lokal ini SENGAJA gak di-revert (biar angka
    // yang udah dipilih user gak hilang/harus pilih ulang) - cuma dikasih tau lewat alert.
    setPanelsMap(prev=>({...prev,[panelId]:{...panel,checklist:newChecklist}}));
    try{
      const{error}=await withRetry(()=>mergePanelChecklist(panelId,{[kode]:newChecklist[kode]}));
      if(error)throw error;
      // FIX akar masalah "operator kosong": PCT_STEPS ini persist LANGSUNG ke DB seketika diklik,
      // gak lewat "Kunci Progress" (lockSingleKomponen) yang baru nyatet progress_checkpoint_log -
      // jadi progress bisa kesimpen tanpa jejak operator SAMA SEKALI. Catat checkpoint di sini juga,
      // tiap kali persentase >0% disimpan, biar selalu ada yang bisa ditelusuri di Rencana Harian.
      if(pct>0){
        const task=todayTasks.find((t:any)=>(t.panel_id||t.panelId)===panelId&&t.proses===proses&&(t.komponen||[]).includes(kode));
        const idsKomp=(task?.pekerja_per_komponen||{})[kode]||[];
        const workerObjs=idsKomp.map((wid:number)=>pekerjaList.find((p:any)=>p.id===wid)).filter(Boolean);
        const pekerjaNamaLog=workerObjs.length>0?workerObjs.map((w:any)=>w.nama).join(', '):user.nama;
        await withRetry(()=>supabase.from('progress_checkpoint_log').insert({
          panel_id:panelId,kode_komponen:kode,proses,checkpoint:pct,pekerja_nama:pekerjaNamaLog,tanggal:viewDate,
        }));
      }
    }catch{
      alert("Gagal simpan progress ke server - koneksi lambat. Pilihan Anda TETAP ADA di layar, coba ulangi pilih persentasenya lagi kalau belum tersimpan.");
    }
  };

  // Foto Pemasangan Wiring Control/Assembling Luar (state+handler upload/hapus) DIHAPUS dari
  // sini (7 Agu 2026) - pindah ke tab "Komponen" terpisah (KomponenPasangView.tsx).

  // Kunci progress — simpan ke Supabase
  // Kunci progress SATU komponen aja (dipanggil dari tombol per kartu di mobile)
  const lockSingleKomponen=async(panelId:number,kode:string,proses:string):Promise<boolean>=>{
    const panel=panelsMap[panelId];
    if(!panel)return false;
    const task=todayTasks.find((t:any)=>(t.panel_id||t.panelId)===panelId&&t.proses===proses&&(t.komponen||[]).includes(kode));
    if(!task)return false;
    if(!canLockKomponen(task,kode,panelId,proses)){alert('Belum bisa dikunci - pastikan timer sudah pernah dijalankan hari ini.');return false;}
    const cl=panel.checklist?.[kode];
    if(!cl||cl.qty===0)return false;
    const pct=getProgressOnDate(cl,proses,viewDate);
    if(pct===0){alert('Progress masih 0%, belum ada yang bisa dikunci.');return false;}
    const newChecklist={...panel.checklist};
    const prevHist=cl.history?.[proses]||[];
    const existIdx=prevHist.findIndex((h:any)=>h.tanggal===viewDate&&String(h.shift)===String(shift));
    const idsKomp=(task.pekerja_per_komponen||{})[kode]||[];
    const workerObjs=idsKomp.map((wid:number)=>pekerjaList.find((p:any)=>p.id===wid)).filter(Boolean);
    const pekerjaNamaLog=workerObjs.length>0?workerObjs.map((w:any)=>w.nama).join(', '):user.nama;
    const checkpointEntry={panel_id:panelId,kode_komponen:kode,proses,checkpoint:pct,pekerja_nama:pekerjaNamaLog,tanggal:viewDate};
    if(existIdx>=0){
      if(prevHist[existIdx].pct===pct)return true;
      const updatedHist=[...prevHist];
      updatedHist[existIdx]={...updatedHist[existIdx],pct,ts:new Date().toISOString()};
      newChecklist[kode]={...cl,history:{...(cl.history||{}),[proses]:updatedHist}};
    } else {
      const newEntry={pct,tanggal:viewDate,shift,ts:new Date().toISOString()};
      newChecklist[kode]={...cl,history:{...(cl.history||{}),[proses]:[...prevHist,newEntry]}};
      // TIDAK setLockedCells - biar qty tetap bisa diedit lanjut, cuma checkpoint aja yang disimpan
    }
    // Retry singkat dulu, BARU update state lokal kalau beneran sukses (bukan optimistic di sini -
    // ini aksi "kunci"/final, konsisten sama prinsip timer: confirm ke server dulu).
    try{
      const{error:cpErr}=await withRetry(()=>supabase.from('progress_checkpoint_log').insert([checkpointEntry]));
      if(cpErr)throw cpErr;
      const{error:panelErr}=await withRetry(()=>mergePanelChecklist(panelId,{[kode]:newChecklist[kode]}));
      if(panelErr)throw panelErr;
    }catch{
      alert('Gagal simpan progress ke server - koneksi lambat/putus. Coba tekan Kunci Progress lagi.');
      return false;
    }
    setPanelsMap((prev:any)=>({...prev,[panelId]:{...panel,checklist:newChecklist}}));
    await autoStopTimerJikaSelesai(panelId,kode,proses,pct,idsKomp);
    if((proses==='WIRING CONTROL'||proses==='WIRING POWER')&&pct>=100){
      // Best-effort - progress utama udah kesimpen di atas, ini cuma beres-beres jadwal, gak
      // perlu ngeblok/gagal-in seluruh aksi kalau bagian ini yang kena koneksi lemot.
      // BUG FIX (5 Agu 2026): dua masalah dalam 1 root cause yang sama -
      // (a) tanggal yang SUDAH LEWAT dulu ikut dibersihkan juga, padahal proses lain gak pernah
      //     nge-prune riwayat lamanya sama sekali - itu sebabnya Rencana Harian kehilangan jejak
      //     WIRING yang udah selesai. Sekarang tanggal < TODAY dibiarkan utuh, gak disentuh.
      // (b) token __wiring_{n}org_{bobot} (badge bobot, nempel di array komponen yang sama
      //     dengan kode asli) gak ikut dihapus begitu SEMUA kode asli di entry itu udah selesai -
      //     entry jadi "isinya cuma token doang", gak pernah kehitung kosong (length>0), jadi
      //     nyangkut selamanya di raw_schedule dan bikin baris Raw Schedule kelihatan kosong pas
      //     dirender (token gak bisa di-resolve ke nama/qty komponen asli). Sekarang token ikut
      //     dibersihkan begitu gak ada lagi kode asli yang nemenin di entry itu.
      try{
        const{data:rawRows}=await withRetry(()=>supabase.from('raw_schedule').select('id,schedule').eq('panel_id',panelId).eq('proses',proses));
        for(const row of rawRows||[]){
          let berubah=false;
          const newSchedule:any={};
          for(const[tglKey,entries] of Object.entries(row.schedule||{}) as [string,any[]][]){
            if(tglKey<TODAY){newSchedule[tglKey]=entries;continue;}
            const newEntries=entries.map((entry:any)=>{
              const filteredKomp=(entry.komponen||[]).filter((k:string)=>k!==kode);
              const sisaKodeAsli=filteredKomp.filter((k:string)=>!k.startsWith('__wiring_'));
              const finalKomp=sisaKodeAsli.length>0?filteredKomp:sisaKodeAsli;
              if(finalKomp.length!==(entry.komponen||[]).length)berubah=true;
              return{...entry,komponen:finalKomp};
            }).filter((entry:any)=>(entry.komponen||[]).length>0);
            if(newEntries.length>0)newSchedule[tglKey]=newEntries;
          }
          if(berubah){
            await withRetry(()=>supabase.from('raw_schedule').update({schedule:newSchedule}).eq('id',row.id));
          }
        }
      }catch{ /* best-effort, progress utama sudah aman */ }
    }

    // FITUR (7 Agu 2026): auto-arsip Pasang Komponen Assembling Luar buat komponen NON-tahap
    // (mis. Groundplate) - format-nya SAMA PERSIS sama Wiring Control: PCT_STEPS cuma persist
    // live (updatePctManual), tombol "Simpan Progress" ini (lockSingleKomponen, sudah ada dari
    // awal buat proses lain juga) yang jadi titik commit tunggal - archive di sini, BUKAN di
    // tiap klik persentase. Komponen tahap (Box Control/Pintu) DIKECUALIKAN - itu udah punya
    // jalur sendiri (simpanProgressTahapPasangKomponen, tombol Simpan Progress terpisah di card
    // Kontribusi Assembling Luar/Wiring Control), jangan dobel-archive dari sini pakai progress
    // gabungan yang salah konteks. Best-effort, gak boleh gagalin progress utama yang udah
    // kesimpen di atas.
    if(proses==="PASANG KOMPONEN"&&user.sub_bagian==="Assembling Luar"){
      const itemNama=getEffCfg(panel.tipe)?.wps.flatMap((w:any)=>w.items).find((it:any)=>it.kode===kode)?.nama||kode;
      if(!PASANG_KOMPONEN_TAHAP_KOMPONEN_NAMA.includes(itemNama)){
        try{
          const{data:woRow}=panel.wo_id?await supabase.from("work_orders").select("wo").eq("id",panel.wo_id).maybeSingle():{data:null};
          const{error:arsipErr}=await withRetry(()=>supabase.from("panel_seksi_archived").upsert({
            panel_id:panelId,wo_id:panel.wo_id||null,seksi:"assembling_luar",kode,komponen_nama:itemNama,
            data:{progress:pct,pasang_komponen_photos:panel.pasang_komponen_photos||[]},
            panel_nama:panel.nama,panel_tipe:panel.tipe,proyek_snapshot:task.proyek||null,wo_number_snapshot:woRow?.wo||null,
            diarsipkan_pada:new Date().toISOString(),diarsipkan_oleh:user.nama,
          },{onConflict:"panel_id,seksi,kode"}));
          if(arsipErr)throw arsipErr;
          const selKey=`${proses}_${panelId}`;
          setSelectedKomponen((prev:any)=>({...prev,[selKey]:(prev[selKey]||[]).filter((k:string)=>k!==kode)}));
        }catch{ /* best-effort, progress utama udah kesimpen */ }
      }
    }

    return true;
  };

  // ── BUSBAR: alur khusus 3-4 tahap berurutan (FABRIKASI->PLATING->[HEATSHRINK->]PASANG) ──
  // Semua tahap (4/3) berdiri sendiri-sendiri, gak ada lagi konsep "tahap aktif" - operator
  // bebas kerjakan tahap manapun kapan saja, gak ada urutan/estafet wajib.
  const getBusbarTahapState=(cl:any,kode:string)=>{
    const urutan=getUrutanTahapBusbar(kode);
    const fresh:any={};
    urutan.forEach((t:string)=>{fresh[t]=cl?.busbarTahap?.[t]||{progress:0,sudahDisimpan100:false};});
    return fresh;
  };
  // Update progress tahap AKTIF secara live (tiap klik PCT_STEPS) - langsung ke-refleksi ke
  // progress.BUSBAR gabungan juga, tapi belum bikin checkpoint log / pindah tahap (itu baru
  // kejadian pas "Simpan Progress" diklik).
  const updatePctManualBusbarTahap=async(panelId:number,kode:string,tahap:string,pct:number)=>{
    const panel=panelsMap[panelId];
    if(!panel)return;
    const cl=panel.checklist?.[kode]||{qty:0,qtyProses:{},progress:{},progressByDate:{}};
    const urutan=getUrutanTahapBusbar(kode);
    const busbarTahapState=getBusbarTahapState(cl,kode);
    // FIX (audit "Simpan Fabrikasi diam tanpa reaksi", 1 Sep 2026) - dulu cuma progress yang
    // di-overwrite di sini, sudahDisimpan100 dibiarkan nempel dari state lama. Kalau operator
    // gak sengaja nge-tap step pertama pas udah 100% (progress jatuh ke 0 lewat toggle-turun di
    // handler klik PCT_STEPS), badge checklist tetap ijo (sudahDisimpan100 masih true) padahal
    // tombol Simpan jadi disabled (pctTahap===0) - keliatan kayak tombol "mati" tanpa reaksi.
    // Sekarang sudahDisimpan100 ikut disinkronkan tiap progress berubah, bukan cuma pas Simpan.
    const newBusbarTahap={...busbarTahapState,[tahap]:{...busbarTahapState[tahap],progress:pct,sudahDisimpan100:pct>=100}};
    const combined=hitungProgressBusbarGabungan(newBusbarTahap,urutan);
    const newChecklist={
      ...panel.checklist,
      [kode]:{
        ...cl,
        busbarTahap:newBusbarTahap,
        progressByDate:{...(cl.progressByDate||{}),BUSBAR:{...((cl.progressByDate||{}).BUSBAR||{}),[viewDate]:combined}},
        progress:{...(cl.progress||{}),BUSBAR:combined},
      }
    };
    // Sama kayak updatePctManual - optimistic, gak di-revert kalau retry akhirnya tetap gagal.
    setPanelsMap(prev=>({...prev,[panelId]:{...panel,checklist:newChecklist}}));
    try{
      const{error}=await withRetry(()=>mergePanelChecklist(panelId,{[kode]:newChecklist[kode]}));
      if(error)throw error;
      // FIX akar masalah "operator kosong" (audit investigasi-operator-kosong.md) - SAMA kayak
      // updatePctManual (non-BUSBAR): tahap ini persist LANGSUNG ke progress.BUSBAR gabungan
      // seketika diklik, TIDAK nunggu "Simpan Progress" - jadi kalau user gak sempat/lupa klik
      // Simpan, progress udah kesimpen permanen tanpa jejak operator sama sekali. Catat
      // checkpoint di sini juga tiap kali progress gabungan BUSBAR berubah.
      if(combined>0){
        const task=todayTasks.find((t:any)=>(t.panel_id||t.panelId)===panelId&&t.proses==="BUSBAR"&&(t.komponen||[]).includes(kode));
        const idsKomp=(task?.pekerja_per_komponen||{})[kode]||[];
        const flatIds=Array.isArray(idsKomp)?idsKomp:(idsKomp&&typeof idsKomp==="object"?Object.values(idsKomp).flat():[]);
        const workerObjs=(flatIds as number[]).map((wid:number)=>pekerjaList.find((p:any)=>p.id===wid)).filter(Boolean);
        const pekerjaNamaLog=workerObjs.length>0?workerObjs.map((w:any)=>w.nama).join(', '):user.nama;
        await withRetry(()=>supabase.from('progress_checkpoint_log').insert({
          panel_id:panelId,kode_komponen:kode,proses:"BUSBAR",checkpoint:combined,pekerja_nama:pekerjaNamaLog,tanggal:viewDate,
        }));
      }
    }catch{
      alert("Gagal simpan progress ke server - koneksi lambat. Pilihan Anda TETAP ADA di layar, coba ulangi pilih persentasenya lagi kalau belum tersimpan.");
    }
  };
  const canSimpanBusbarTahap=(task:any,panelId:number,kode:string,tahap:string):boolean=>{
    const ids=(task?.pekerja_per_komponen||{})[kode]?.[tahap]||[];
    if(ids.length===0)return false;
    return ids.some((pid:number)=>!!timerAktif[timerKey(panelId,kode,"BUSBAR",pid,tahap)]||!!timerSelesaiHariIni[timerKey(panelId,kode,"BUSBAR",pid,tahap)]);
  };
  // Simpan Progress SATU tahap tertentu (dipilih eksplisit lewat parameter tahap) - gak ada
  // lagi auto-pindah/estafet, tiap tahap berdiri sendiri dan bisa disimpan kapan saja.
  const simpanProgressTahapBusbar=async(panelId:number,kode:string,tahap:string):Promise<boolean>=>{
    const savingKey=`${panelId}_${kode}_BUSBAR_${tahap}`;
    if(savingTahap[savingKey])return false; // guard double-submit - request sebelumnya masih jalan
    const panel=panelsMap[panelId];
    // AUDIT (1 Sep 2026): 3 guard di bawah ini dulu return false TANPA jejak apa pun (gak ada
    // alert, gak ada console) - kalau kena, tombol Simpan keliatan "diam aja" tanpa reaksi sama
    // sekali, bikin bug ini nyaris mustahil didiagnosis dari laporan operator. Sekarang minimal
    // ke-log ke console biar ketauan guard mana yang kena kalau terulang.
    if(!panel){console.warn('[simpanProgressTahapBusbar] panel tidak ditemukan di panelsMap',{panelId,kode,tahap});return false;}
    const task=todayTasks.find((t:any)=>(t.panel_id||t.panelId)===panelId&&t.proses==="BUSBAR"&&(t.komponen||[]).includes(kode));
    if(!task){console.warn('[simpanProgressTahapBusbar] task BUSBAR hari ini tidak ditemukan di todayTasks',{panelId,kode,tahap});return false;}
    const cl=panel.checklist?.[kode];
    if(!cl){console.warn('[simpanProgressTahapBusbar] checklist komponen tidak ditemukan',{panelId,kode,tahap});return false;}
    const urutan=getUrutanTahapBusbar(kode);
    const busbarTahapState=getBusbarTahapState(cl,kode);
    if(!canSimpanBusbarTahap(task,panelId,kode,tahap)){
      alert('Belum bisa disimpan - pastikan operator sudah dipilih dan timer sudah pernah dijalankan buat tahap ini.');
      return false;
    }
    const pctTahap=busbarTahapState[tahap]?.progress||0;
    if(pctTahap===0){alert('Progress tahap ini masih 0%, belum ada yang bisa disimpan.');return false;}

    setSavingTahap(prev=>({...prev,[savingKey]:true}));
    try{
    const newBusbarTahap={
      ...busbarTahapState,
      [tahap]:{...busbarTahapState[tahap],progress:pctTahap,sudahDisimpan100:pctTahap>=100},
    };
    const combined=hitungProgressBusbarGabungan(newBusbarTahap,urutan);

    const prevHist=cl.history?.BUSBAR||[];
    const existIdx=prevHist.findIndex((h:any)=>h.tanggal===viewDate&&String(h.shift)===String(shift));
    const idsKomp=(task.pekerja_per_komponen||{})[kode]?.[tahap]||[];
    const workerObjs=idsKomp.map((wid:number)=>pekerjaList.find((p:any)=>p.id===wid)).filter(Boolean);
    const pekerjaNamaLog=workerObjs.length>0?workerObjs.map((w:any)=>w.nama).join(', '):user.nama;
    const checkpointEntry={panel_id:panelId,kode_komponen:kode,proses:"BUSBAR",checkpoint:combined,pekerja_nama:pekerjaNamaLog,tanggal:viewDate};

    const newChecklist={...panel.checklist};
    const patchBase={busbarTahap:newBusbarTahap,progress:{...(cl.progress||{}),BUSBAR:combined},progressByDate:{...(cl.progressByDate||{}),BUSBAR:{...((cl.progressByDate||{}).BUSBAR||{}),[viewDate]:combined}}};
    if(existIdx>=0){
      const updatedHist=[...prevHist];
      updatedHist[existIdx]={...updatedHist[existIdx],pct:combined,ts:new Date().toISOString()};
      newChecklist[kode]={...cl,...patchBase,history:{...(cl.history||{}),BUSBAR:updatedHist}};
    } else {
      const newEntry={pct:combined,tanggal:viewDate,shift,ts:new Date().toISOString()};
      newChecklist[kode]={...cl,...patchBase,history:{...(cl.history||{}),BUSBAR:[...prevHist,newEntry]}};
    }

    try{
      const{error:cpErr}=await withRetry(()=>supabase.from('progress_checkpoint_log').insert([checkpointEntry]));
      if(cpErr)throw cpErr;
      const{error:panelErr}=await withRetry(()=>mergePanelChecklist(panelId,{[kode]:newChecklist[kode]}));
      if(panelErr)throw panelErr;
    }catch{
      alert('Gagal simpan progress ke server - koneksi lambat/putus. Coba tekan Simpan Progress lagi.');
      return false;
    }
    setPanelsMap((prev:any)=>({...prev,[panelId]:{...panel,checklist:newChecklist}}));
    await autoStopTimerJikaSelesai(panelId,kode,"BUSBAR",pctTahap,idsKomp,tahap);
    return true;
    }finally{
      setSavingTahap(prev=>({...prev,[savingKey]:false}));
    }
  };

  // PASANG KOMPONEN tahap (Box Control/Pintu: getPasangKomponenTahapState/
  // updatePctManualPasangKomponenTahap/simpanProgressTahapPasangKomponen dst) DIHAPUS dari sini
  // (7 Agu 2026) - pindah total ke tab "Komponen" terpisah (KomponenPasangView.tsx), termasuk
  // upsert arsip + uncollect-nya. Data yang dibaca/ditulis SAMA PERSIS (checklist[kode].
  // pasangKomponenTahap), gak ada migrasi data.

  // Sistem Section - dipakai POTONG, RENDAM, PAINTING (section counter TERPISAH per proses,
  // karena semuanya sudah tampil sebagai band/card sendiri-sendiri).
  // SENGAJA gak reuse lockSingleKomponen: fungsi itu nge-UPDATE entry history yang sudah ada
  // buat tanggal+shift yang sama (existIdx merge) - cocok buat checkpoint-per-hari biasa, tapi
  // SALAH buat section, karena 1 komponen yang lanjut di 2 section beda di hari yang sama HARUS
  // jadi 2 entry history terpisah (masing-masing section number-nya sendiri), bukan ketimpa jadi
  // 1. Nomor section dihitung dari section tertinggi yang sudah ada hari ini DI SHIFT AKTIF ini
  // (baca dari panelsMap yang sudah termuat) - TIDAK ada tabel/counter terpisah. BUG FIX (7 Agu
  // 2026): dulu cuma filter tanggal, section ikut lanjut nomor lintas shift (Shift 2 nerusin
  // nomor terakhir Shift 1) - sekarang di-scope juga ke shift aktif (variabel `shift`, dari
  // state sesi kerja yang sudah ada), Shift 2 selalu mulai dari Section 1 baru.
  const simpanSectionPaintingRendam=async(proses:string,rows:any[])=>{
    const eligible=rows.filter((r:any)=>r.pct>0);
    if(eligible.length===0){alert("Belum ada progress yang bisa disimpan.");return;}
    // Stop semua timer yang masih jalan buat komponen-komponen ini dulu.
    for(const r of eligible){
      const idsKomp=(r.task.pekerja_per_komponen||{})[r.kode]||[];
      for(const pid of idsKomp){
        if(timerAktif[timerKey(r.panelId,r.kode,proses,pid)])await stopTimer(pid,r.panelId,r.kode,proses);
      }
    }
    let maxSection=0;
    Object.values(panelsMap).forEach((p:any)=>{
      Object.values(p.checklist||{}).forEach((cl:any)=>{
        (cl?.history?.[proses]||[]).forEach((h:any)=>{
          if(h.tanggal===viewDate&&String(h.shift)===String(shift)&&typeof h.section==="number"&&h.section>maxSection)maxSection=h.section;
        });
      });
    });
    const sectionNum=maxSection+1;
    const sectionMulaiKey=`${proses}_${viewDate}`;
    const sectionMulai=sectionMulaiMap[sectionMulaiKey]||new Date().toISOString();
    const nowIso=new Date().toISOString();
    // BUG FIX (5 Agu 2026): dulu tiap komponen nulis update() checklist sendiri-sendiri, dibangun
    // dari panelsMap yang sama/stale (dibaca sekali di awal fungsi, gak ikut ke-update oleh
    // iterasi sebelumnya) - kalau 2+ komponen ada di PANEL YANG SAMA, komponen yang diproses
    // belakangan bakal nimpa balik hasil tulis komponen sebelumnya di panel itu (ketauan dari
    // laporan Groundplate hilang, Box Control yang selamat - dua-duanya di panel SILO AGING).
    // Sekarang digrup per panel dulu, SATU update checklist per panel yang udah nyakup SEMUA
    // komponen eligible di panel itu sekaligus - gak ada lagi tulisan yang saling timpa.
    const byPanel=new Map<number,any[]>();
    eligible.forEach((r:any)=>{
      if(!byPanel.has(r.panelId))byPanel.set(r.panelId,[]);
      byPanel.get(r.panelId)!.push(r);
    });
    let gagal=0;
    for(const[panelId,panelRows] of byPanel){
      const panel=panelsMap[panelId];
      if(!panel){gagal+=panelRows.length;continue;}
      const newChecklist={...panel.checklist};
      const checkpointEntries:any[]=[];
      panelRows.forEach((r:any)=>{
        const cl=newChecklist[r.kode];
        if(!cl)return;
        const prevHist=cl.history?.[proses]||[];
        const newEntry={pct:r.pct,tanggal:viewDate,shift,ts:nowIso,section:sectionNum,sectionMulai};
        newChecklist[r.kode]={...cl,history:{...(cl.history||{}),[proses]:[...prevHist,newEntry]}};
        const idsKomp=(r.task.pekerja_per_komponen||{})[r.kode]||[];
        const workerObjs=idsKomp.map((wid:number)=>pekerjaList.find((p:any)=>p.id===wid)).filter(Boolean);
        const pekerjaNamaLog=workerObjs.length>0?workerObjs.map((w:any)=>w.nama).join(", "):user.nama;
        checkpointEntries.push({panel_id:r.panelId,kode_komponen:r.kode,proses,checkpoint:r.pct,pekerja_nama:pekerjaNamaLog,tanggal:viewDate});
      });
      const partial:Record<string,any>={};
      panelRows.forEach((r:any)=>{ if(newChecklist[r.kode])partial[r.kode]=newChecklist[r.kode]; });
      try{
        const{error:cpErr}=await withRetry(()=>supabase.from("progress_checkpoint_log").insert(checkpointEntries));
        if(cpErr)throw cpErr;
        const{error:panelErr}=await withRetry(()=>mergePanelChecklist(Number(panelId),partial));
        if(panelErr)throw panelErr;
        setPanelsMap((prev:any)=>({...prev,[panelId]:{...prev[panelId],checklist:newChecklist}}));
      }catch{
        gagal+=panelRows.length;
      }
    }
    if(gagal>0){
      alert(`${gagal} komponen gagal tersimpan (koneksi bermasalah) - sisanya sudah tersimpan sebagai Section ${sectionNum}. Coba klik Simpan Progress lagi buat yang gagal.`);
      return;
    }
    // Section ditutup - bersihin koleksi & carry-over snapshot punya proses ini, siap collect lagi buat section berikutnya.
    setSelectedKomponen((prev:any)=>{
      const next={...prev};
      Object.keys(next).forEach(key=>{if(key.startsWith(`${proses}_`))delete next[key];});
      return next;
    });
    setCarryOverPct((prev:any)=>{
      const next={...prev};
      eligible.forEach((r:any)=>{delete next[`${proses}_${r.panelId}_${r.kode}`];});
      return next;
    });
    setSectionMulaiMap((prev:any)=>{
      const next={...prev};
      delete next[sectionMulaiKey];
      return next;
    });
    alert(`Section ${sectionNum} tersimpan (${eligible.length} komponen).`);
  };

  const lockProgress=async()=>{
    let count=0;
    const newLocked={...lockedCells};
    const checkpointLogEntries:any[]=[];
    const panelGagal:string[]=[];

    for(const [panelId,panel] of Object.entries(panelsMap)){
      const relatedTasks=todayTasks.filter((t:any)=>(t.panel_id||t.panelId)===Number(panelId));
      if(!relatedTasks.length)continue;
      const newChecklist={...panel.checklist};
      const processed=new Set();
      const touchedKode=new Set<string>();

      relatedTasks.forEach((task:any)=>{
        (task.komponen||[]).forEach((kode:string)=>{
          const cl=newChecklist[kode];
          if(!cl||cl.qty===0)return;
          myProses.forEach(pr=>{
            if(task.proses!==pr)return;
            const cellKey=`${kode}_${pr}`;
            if(processed.has(cellKey))return;
            if(!canLockKomponen(task,kode,Number(panelId),pr))return;
            const pct=getProgressOnDate(cl,pr,viewDate);
            if(pct===0)return;
            const prevHist=cl.history?.[pr]||[];
            const existIdx=prevHist.findIndex((h:any)=>h.tanggal===viewDate&&String(h.shift)===String(shift));
            if(existIdx>=0){
              if(prevHist[existIdx].pct!==pct){
                const updatedHist=[...prevHist];
                updatedHist[existIdx]={...updatedHist[existIdx],pct,ts:new Date().toISOString()};
                newChecklist[kode]={...cl,history:{...(cl.history||{}),[pr]:updatedHist}};
                touchedKode.add(kode);
                const idsKomp=(task.pekerja_per_komponen||{})[kode]||[];
                const workerObjs=idsKomp.map((wid:number)=>pekerjaList.find((p:any)=>p.id===wid)).filter(Boolean);
                const pekerjaNamaLog=workerObjs.length>0?workerObjs.map((w:any)=>w.nama).join(", "):user.nama;
                checkpointLogEntries.push({
                  panel_id:Number(panelId),
                  kode_komponen:kode,
                  proses:pr,
                  checkpoint:pct,
                  pekerja_nama:pekerjaNamaLog,
                  tanggal:viewDate,
                });
              }
              processed.add(cellKey);
              return;
            }
            const newEntry={pct,tanggal:viewDate,shift,ts:new Date().toISOString()};
            newChecklist[kode]={
              ...cl,
              history:{...(cl.history||{}),[pr]:[...prevHist,newEntry]}
            };
            touchedKode.add(kode);
            newLocked[`${panelId}_${kode}_${pr}_${viewDate}_${shift}`]=true;
            processed.add(cellKey);
            count++;
            {
              const idsKomp=(task.pekerja_per_komponen||{})[kode]||[];
              const workerObjs=idsKomp.map((wid:number)=>pekerjaList.find((p:any)=>p.id===wid)).filter(Boolean);
              const pekerjaNamaLog=workerObjs.length>0?workerObjs.map((w:any)=>w.nama).join(", "):user.nama;
              checkpointLogEntries.push({
                panel_id:Number(panelId),
                kode_komponen:kode,
                proses:pr,
                checkpoint:pct,
                pekerja_nama:pekerjaNamaLog,
                tanggal:viewDate,
              });
            }
          });
        });
      });

      // simpan ke Supabase - termasuk busbar_progress
      const busbarTasks=relatedTasks.filter((t:any)=>t.proses==="BUSBAR");
      let busbarProgressUpdate:any=null;
      if(busbarTasks.length>0){
        const newBusbarProgress={...(panel.busbar_progress||{})};
        busbarTasks.forEach((t:any)=>{
          (t.komponen||[]).forEach((komp:string)=>{
            // Progress busbar disimpan di checklist dengan key nama komponen
            const cl=newChecklist[komp]||panel.checklist?.[komp];
            const pct=cl?.progress?.["BUSBAR"]||getProgressOnDate(cl,"BUSBAR",viewDate)||0;
            newBusbarProgress[komp]=pct;
          });
        });
        busbarProgressUpdate=newBusbarProgress;
      }
      // Retry singkat; kalau tetap gagal, checklist panel ini DILEWATI (bukan dianggap sukses) -
      // angka yang udah dipilih user tetap ada di panelsMap dari langkah pilih persentase
      // sebelumnya (updatePctManual/dkk), cuma checkpoint "terkunci"-nya yang belum tersimpan.
      const partial:Record<string,any>={};
      touchedKode.forEach(kode=>{ partial[kode]=newChecklist[kode]; });
      try{
        if(Object.keys(partial).length>0){
          const{error}=await withRetry(()=>mergePanelChecklist(Number(panelId),partial));
          if(error)throw error;
        }
        if(busbarProgressUpdate){
          const{error}=await withRetry(()=>supabase.from("panels").update({busbar_progress:busbarProgressUpdate}).eq("id",Number(panelId)));
          if(error)throw error;
        }
      }catch{
        panelGagal.push(panel.nama||("Panel #"+panelId));
        continue;
      }
      setPanelsMap(prev=>({...prev,[panelId]:{...panel,checklist:newChecklist,
        ...(busbarProgressUpdate?{busbar_progress:busbarProgressUpdate}:{})}}));

      // Bersihkan komponen yang sudah 100% selesai dari raw_schedule (khusus WIRING CONTROL/POWER)
      // Best-effort - checklist utama panel ini sudah aman tersimpan di atas.
      // BUG FIX (5 Agu 2026): sama persis pola fix di lockSingleKomponen - (a) tanggal < TODAY
      // dibiarkan utuh (jangan hapus jejak riwayat), (b) token __wiring_ ikut dibersihkan begitu
      // gak ada lagi kode asli yang tersisa di entry itu (biar gak nyangkut jadi "row kosong").
      try{
        for(const proses of myProses){
          if(proses!=="WIRING CONTROL"&&proses!=="WIRING POWER")continue;
          const komponenSelesai=Object.keys(newChecklist).filter(kode=>
            (newChecklist[kode]?.progress?.[proses]||0)>=100
          );
          if(komponenSelesai.length===0)continue;
          const{data:rawRows}=await withRetry(()=>supabase.from("raw_schedule").select("id,schedule").eq("panel_id",Number(panelId)).eq("proses",proses));
          for(const row of rawRows||[]){
            let berubah=false;
            const newSchedule:any={};
            for(const[tglKey,entries] of Object.entries(row.schedule||{}) as [string,any[]][]){
              if(tglKey<TODAY){newSchedule[tglKey]=entries;continue;}
              const newEntries=entries.map((entry:any)=>{
                const filteredKomp=(entry.komponen||[]).filter((k:string)=>!komponenSelesai.includes(k));
                const sisaKodeAsli=filteredKomp.filter((k:string)=>!k.startsWith('__wiring_'));
                const finalKomp=sisaKodeAsli.length>0?filteredKomp:sisaKodeAsli;
                if(finalKomp.length!==(entry.komponen||[]).length)berubah=true;
                return{...entry,komponen:finalKomp};
              }).filter((entry:any)=>(entry.komponen||[]).length>0);
              if(newEntries.length>0)newSchedule[tglKey]=newEntries;
            }
            if(berubah){
              await withRetry(()=>supabase.from("raw_schedule").update({schedule:newSchedule}).eq("id",row.id));
            }
          }
        }
      }catch{ /* best-effort, checklist utama sudah aman */ }
    }

    // simpan checkpoint log - siapa nyampein checkpoint berapa, buat riwayat kontribusi per operator
    // Best-effort - progress utama sudah aman tersimpan di atas, ini cuma histori kontribusi.
    if(checkpointLogEntries.length>0){
      try{ await withRetry(()=>supabase.from("progress_checkpoint_log").insert(checkpointLogEntries)); }catch{ /* best-effort */ }
    }

    // simpan catatan ke tabel kendala - 1 baris per (proses, panel) supaya bisa dikelompokkan per proyek/panel
    // Cek dulu kendala yang sudah ada hari ini biar gak dobel kalau isinya sama pas dikunci ulang
    const { data: existingKendalaHariIni } = await supabase.from("kendala")
      .select("proses,panel_id,catatan")
      .eq("tanggal",viewDate)
      .eq("operator",user.nama);
    const existingKendalaMap=new Map();
    (existingKendalaHariIni||[]).forEach((e:any)=>{
      existingKendalaMap.set(e.proses+"|"+e.panel_id,e.catatan);
    });

    const kendalaLogged=new Set();
    for(const task of todayTasks){
      const proses=task.proses;
      if(!catatan[proses]?.trim())continue;
      const panelIdTask=task.panel_id||task.panelId;
      const comboKey=proses+"|"+panelIdTask;
      if(kendalaLogged.has(comboKey))continue;
      kendalaLogged.add(comboKey);
      const catatanTrim=catatan[proses].trim();
      if(existingKendalaMap.get(comboKey)===catatanTrim)continue;
      try{
        await withRetry(()=>supabase.from("kendala").insert({
          divisi:user.divisi,
          divisi_label:cfg.label,
          tanggal:viewDate,
          proses,
          catatan:catatanTrim,
          operator:user.nama,
          ts:new Date().toISOString(),
          proyek:task.proyek||null,
          panel:task.panel||null,
          panel_id:panelIdTask||null,
        }));
      }catch{ /* best-effort, gak blok progress utama kalau cuma catatan kendala yang gagal */ }
    }

    // Hitung busbar tasks juga
    const busbarCount=todayTasks.filter((t:any)=>t.proses==="BUSBAR").length;
    if(count>0||busbarCount>0||Object.keys(catatan).some(k=>catatan[k]?.trim())){
      setLockedCells(newLocked);
      if(panelGagal.length===0){
        setLockMsg(true);
        setTimeout(()=>setLockMsg(false),2500);
      }else{
        alert("Sebagian progress berhasil dikunci. GAGAL simpan "+panelGagal.length+" panel (koneksi lambat/putus): "+panelGagal.join(", ")+" - data yang sudah dipilih TETAP ADA, coba tekan Kunci Progress lagi.");
      }
    }
    // Selalu set pernahDikunci=true setiap kali tombol diklik (terlepas ada perubahan atau tidak)
    setPernahDikunci(true);
  };

  const thS:any={background:"#1e3a8a",color:"#fff",padding:"7px 8px",fontWeight:700,fontSize:10,
    whiteSpace:"nowrap",letterSpacing:.3,textAlign:"center",borderRight:"1px solid #ffffff15",
    position:"sticky",top:0,zIndex:3};

  // ── Setup shift screen ──
  if(!shiftSet){
    return(
      <div style={{padding:20,maxWidth:480,margin:"0 auto"}} className="fi">
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:24}}>
          <div style={{width:48,height:48,borderRadius:12,background:cfg.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>{cfg.icon}</div>
          <div>
            <div style={{fontWeight:800,fontSize:17,color:"#1e293b"}}>{cfg.label}</div>
            <div style={{fontSize:12,color:"#64748b"}}>Setup sesi kerja hari ini</div>
          </div>
        </div>
        <Card>
          <div style={{marginBottom:16}}>
            <Lbl>Tanggal</Lbl>
            <Inp type="date" value={viewDate} onChange={(e:any)=>setViewDate(e.target.value)}/>
          </div>
          <div style={{marginBottom:16}}>
            <Lbl>Shift</Lbl>
            <div style={{display:"flex",gap:10}}>
              {["1","2"].map(s=>(
                <button key={s} onClick={()=>setShift(s)}
                  style={{flex:1,padding:"12px",borderRadius:10,border:`2px solid ${shift===s?cfg.color:"#e2e8f0"}`,
                    background:shift===s?cfg.color+"18":"#f8fafc",color:shift===s?cfg.color:"#64748b",
                    cursor:"pointer",fontWeight:800,fontSize:16,transition:"all .15s"}}>
                  Shift {s}
                </button>
              ))}
            </div>
          </div>
          <Btn color={cfg.color} style={{width:"100%",padding:13,fontSize:15}} onClick={()=>setShiftSet(true)}>
            Mulai Kerja →
          </Btn>
        </Card>
      </div>
    );
  }

  // ── No tasks ──
  if(loadingData){
    return(
      <div style={{padding:40,textAlign:"center",color:"#64748b"}}>
        <div style={{fontSize:24,marginBottom:8}}>⏳</div>
        <div style={{fontWeight:600}}>Memuat data...</div>
      </div>
    );
  }

  if(todayTasks.length===0){
    return(
      <div style={{padding:16,maxWidth:520,margin:"0 auto"}} className="fi">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:36,height:36,borderRadius:10,background:cfg.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{cfg.icon}</div>
            <div>
              <div style={{fontWeight:700,fontSize:14,color:"#1e293b"}}>{user.nama} — Shift {shift}</div>
              <div style={{fontSize:11,color:"#64748b"}}>{fmtDate(viewDate)}</div>
            </div>
          </div>
          <button onClick={()=>setShiftSet(false)}
            style={{fontSize:11,color:"#94a3b8",background:"none",border:"1px solid #e2e8f0",borderRadius:6,padding:"4px 10px",cursor:"pointer"}}>
            Ganti Shift
          </button>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:20,background:"#fff",borderRadius:12,padding:"10px 14px",border:"1.5px solid #e2e8f0"}}>
          <button onClick={()=>setViewDate(addDays(viewDate,-1))} style={{width:34,height:34,borderRadius:8,border:"1px solid #e2e8f0",background:"#f8fafc",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",color:"#475569"}}>‹</button>
          <div style={{flex:1,textAlign:"center"}}>
            <div style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>{fmtDate(viewDate)}</div>
            {viewDate===TODAY&&<div style={{fontSize:11,color:"#2563eb",fontWeight:600}}>Hari Ini</div>}
          </div>
          <button onClick={()=>setViewDate(addDays(viewDate,1))} style={{width:34,height:34,borderRadius:8,border:"1px solid #e2e8f0",background:"#f8fafc",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",color:"#475569"}}>›</button>
        </div>
        <div style={{textAlign:"center",padding:"40px 20px"}}>
          <div style={{fontSize:40,marginBottom:10}}>📋</div>
          <div style={{fontWeight:700,fontSize:15,color:"#1e293b",marginBottom:6}}>Tidak ada jadwal</div>
          <div style={{fontSize:13,color:"#94a3b8",marginBottom:16}}>Belum ada rencana kerja untuk tanggal ini</div>
        </div>
      </div>
    );
  }

  // ── Main tabel ──
  return(
    <div style={{padding:16}} className="fi">
      {/* Reminder timer lama - non-blocking, bisa diabaikan (poin #4), gak nutup layar */}
      {timerReminders.length>0&&(
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
          {timerReminders.map(r=>(
            <div key={r.id} style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:10,padding:"10px 12px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
              <span style={{fontSize:18,flexShrink:0}}>⏰</span>
              <div style={{flex:1,minWidth:180}}>
                <div style={{fontSize:12.5,fontWeight:700,color:"#92400e"}}>{r.catatan}</div>
                <div style={{fontSize:10.5,color:"#a16207"}}>{r.panel_nama} · {r.pekerja_nama}</div>
              </div>
              <div style={{display:"flex",gap:6,flexShrink:0}}>
                <button onClick={()=>dismissReminder(r.id)}
                  style={{fontSize:11,fontWeight:700,color:"#92400e",background:"#fef3c7",border:"1px solid #fde68a",borderRadius:8,padding:"7px 12px",cursor:"pointer"}}>
                  Ya, masih dikerjakan
                </button>
                <button onClick={()=>selesaikanDariReminder(r)}
                  style={{fontSize:11,fontWeight:700,color:"#fff",background:"#d97706",border:"none",borderRadius:8,padding:"7px 12px",cursor:"pointer"}}>
                  Selesai, saya lupa matikan
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:40,height:40,borderRadius:10,background:cfg.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{cfg.icon}</div>
          <div>
            <div style={{fontWeight:800,fontSize:15,color:"#1e293b"}}>{cfg.label} — {fmtDate(viewDate)}</div>
            <div style={{fontSize:12,color:"#64748b"}}>Shift {shift} · {todayTasks.length} tugas</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:4,background:"#fff",borderRadius:8,padding:"4px 8px",border:"1px solid #e2e8f0"}}>
            <button onClick={()=>setViewDate(addDays(viewDate,-1))} style={{width:26,height:26,borderRadius:6,border:"none",background:"#f8fafc",cursor:"pointer",fontSize:14,color:"#475569"}}>‹</button>
            <span style={{fontSize:11,fontWeight:600,color:"#475569",padding:"0 4px"}}>{fmtShort(viewDate)}</span>
            <button onClick={()=>setViewDate(addDays(viewDate,1))} style={{width:26,height:26,borderRadius:6,border:"none",background:"#f8fafc",cursor:"pointer",fontSize:14,color:"#475569"}}>›</button>
          </div>
          <button onClick={()=>setShiftSet(false)}
            style={{fontSize:11,color:"#94a3b8",background:"none",border:"1px solid #e2e8f0",borderRadius:6,padding:"5px 10px",cursor:"pointer"}}>
            Ganti Shift
          </button>
        </div>
      </div>

      <WoUrgentBanner/>

      {/* stats per proses */}
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        {myProses.map(pr=>{
          const tasks=tasksByProses[pr]||[];
          if(!tasks.length)return null;
          const totalKomp=tasks.reduce((a:number,t:any)=>{
            const panel=panelsMap[t.panel_id||t.panelId];
            return a+(t.komponen||[]).filter((k:string)=>(panel?.checklist?.[k]?.qty||0)>0).length;
          },0);
          const doneKomp=tasks.reduce((a:number,t:any)=>{
            const panel=panelsMap[t.panel_id||t.panelId];
            return a+(t.komponen||[]).filter((k:string)=>getLatestProgress(panel?.checklist?.[k],pr)>=100).length;
          },0);
          const pc=PROSES_COLOR[pr]||"#64748b";
          return(
            <div key={pr} style={{background:"#fff",borderRadius:8,padding:"6px 12px",border:`1.5px solid ${pc}30`,
              borderLeft:`3px solid ${pc}`,display:"flex",gap:8,alignItems:"center"}}>
              <span style={{fontSize:11,fontWeight:700,color:pc}}>{pr}</span>
              <span style={{fontSize:11,color:"#94a3b8"}}>{doneKomp}/{totalKomp} komponen</span>
            </div>
          );
        })}
      </div>

      {/* filter */}
      {(proyekList.length>1||panelList.length>1)&&(
        <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center",
          background:"#fff",borderRadius:10,padding:"8px 12px",border:"1px solid #e2e8f0"}}>
          <span style={{fontSize:11,color:"#94a3b8",fontWeight:600}}>Filter:</span>
          {proyekList.length>1&&(
            <select value={fProyek} onChange={e=>{setFProyek(e.target.value);setFPanel("ALL");}}
              style={{padding:"4px 10px",borderRadius:8,border:"1.5px solid #e2e8f0",
                background:"#f8fafc",fontSize:11,fontWeight:600,color:"#475569",cursor:"pointer"}}>
              <option value="ALL">Semua Proyek</option>
              {proyekList.map((p:any)=><option key={p} value={p}>{p}</option>)}
            </select>
          )}
          {panelList.length>1&&(
            <select value={fPanel} onChange={e=>setFPanel(e.target.value)}
              style={{padding:"4px 10px",borderRadius:8,border:"1.5px solid #e2e8f0",
                background:"#f8fafc",fontSize:11,fontWeight:600,color:"#475569",cursor:"pointer",maxWidth:220}}>
              <option value="ALL">Semua Panel</option>
              {panelList.map((p:any)=><option key={p} value={p}>{p}</option>)}
            </select>
          )}
          {(fProyek!=="ALL"||fPanel!=="ALL")&&(
            <button onClick={()=>{setFProyek("ALL");setFPanel("ALL");}}
              style={{padding:"4px 10px",borderRadius:8,border:"1px solid #fecaca",
                background:"#fef2f2",color:"#dc2626",fontSize:11,fontWeight:600,cursor:"pointer"}}>
              ✕ Reset
            </button>
          )}
        </div>
      )}

      {/* tabel per proses */}
      {myProses.map(proses=>{
        const tasks=tasksByProses[proses]||[];
        if(!tasks.length)return null;
        const pc=PROSES_COLOR[proses]||"#64748b";

        const rows:any[]=[];
        // Safety-net: kalau ada 2 renhar row yang kebetulan sama-sama punya kode komponen yang
        // sama buat panel+proses ini (mis. bug dobel-insert lama, atau data yang belum sempat
        // dibersihin), jangan sampai nongol jadi 2 row/card - ambil yang pertama ketemu aja.
        const seenRowKeys=new Set<string>();
        tasks.forEach((task:any)=>{
          const panelId=task.panel_id||task.panelId;
          const panel=panelsMap[panelId];
          if(!panel)return;
          const panelCfg=getEffCfg(panel.tipe);
          if(!panelCfg)return;
          const allItems=panelCfg.wps.flatMap((w:any)=>w.items);
          const priColor=PRIORITAS_COLOR[task.prioritas||"Sedang"]||"#64748b";

          (task.komponen||[]).forEach((kode:string,ki:number)=>{
            // Handle token wiring khusus: __wiring_{org}org_{bobot}
            if(kode.startsWith("__wiring_")){
              // Token wiring cuma buat ekstrak badge bobot/jumlah orang (via wiringInfoMap di row komponen real).
              // Gak bikin baris sendiri lagi - komponen real di bawah yang jadi baris (per-komponen tracking).
              return;
            }
            const rowKey=`${panelId}_${kode}`;
            if(seenRowKeys.has(rowKey))return;
            seenRowKeys.add(rowKey);
            const isBusbarKomp=proses==="BUSBAR";
            const item=allItems.find((it:any)=>it.kode===kode);
            // Untuk BUSBAR, komponen adalah nama langsung (H-BUS, INCOMING, dll)
            if(!item&&!isBusbarKomp)return;
            const busbarItem=isBusbarKomp?{kode,nama:kode}:null;
            const cl=panel.checklist?.[kode]||{qty:0,qtyProses:{},progress:{},progressByDate:{},qtyProsesByDate:{}};
            const qtyKomp=isBusbarKomp?0:cl.qty||0;
            // BUG FIX (5 Agu 2026): komponen dengan qty 0 (kode ada di BOM/task.komponen tapi gak
            // dibutuhkan buat panel ini) sempat lolos tampil sebagai baris pekerjaan - ketauan dari
            // laporan PANEL MCC SILO AGING (Sekatan Samping/Belakang/Kupingan Tutup Belakang, qty=0
            // di checklist) muncul di PAINTING. Root cause di raw_schedule (kode-nya di-assign manual
            // ke jadwal biarpun qty=0), TAPI filter di sini yang seharusnya jaga-jaga malah gak ada -
            // affect SEMUA proses/divisi yang lewat loop ini (dicek: PACKING/BUSBAR/PAINTING/RENDAM/
            // BENDING/RAKIT/POTONG/QC TEST semua kena di data hari ini). BUSBAR dikecualikan - proses
            // itu emang gak punya konsep qty per-komponen sama sekali (qtyKomp selalu 0 by design).
            if(!isBusbarKomp&&qtyKomp<=0)return;
            const qtyProses=isBusbarKomp?0:cl.qtyProsesByDate?.[proses]?.[viewDate]??cl.qtyProses?.[proses]??0;
            const pct=isBusbarKomp?(cl.progress?.[proses]||0):getProgressOnDate(cl,proses,viewDate);
            const wpDef=isBusbarKomp?null:panelCfg.wps.find((w:any)=>w.items.some((it:any)=>it.kode===kode));
            const wInfoLookup=wiringInfoMap[`${panelId}_${proses}`];
            const wiringBadge=wInfoLookup&&wInfoLookup.bobot?wInfoLookup:null;
            // Sudah disimpan (klik "Simpan Progress") hari ini dengan pct 100 - bukan cuma qty kebetulan penuh.
            const sudahDisimpan100=(cl.history?.[proses]||[]).some((h:any)=>h.tanggal===viewDate&&h.pct===100);
            // Timer pernah dimulai (walau udah di-stop lagi) - buat gating input qty di POTONG/BENDING/STEL/FINISHING.
            const idsKompRow=getFlatOperatorIds(task,kode);
            const sudahPernahMulai=idsKompRow.some((pid:number)=>!!timerPernahMulai[`${panelId}_${kode}_${proses}_${pid}`]);
            const relevantProsesKode=getRelevantProsesForKode(kode,panel.tipe,prosesRelevanSet,prosesRelevanHasMapping);
            const pipelineStatus=computeProsesStatus(getBestProgressMap(cl),proses,relevantProsesKode);
            rows.push({task,panel,panelId,item:item||busbarItem,kode,qtyKomp,qtyProses,pct,priColor,ki,wpDef,
              isFirst:ki===0,rowCount:(task.komponen||[]).length,isBusbar:isBusbarKomp,
              aktualSelesai:getFirstCompletionDate(cl,proses),wiringBadge,sudahDisimpan100,sudahPernahMulai,pipelineStatus});
          });
        });

        // Urutkan per WP (ascending, WP1 dulu) lalu per urutan komponen dalam WP itu (kolom
        // `urutan` bom_master, sudah kepake buat nyusun panelCfg.wps.items di getEffCfg - di sini
        // tinggal REUSE lewat wpDef.items.findIndex, gak query/hitung ulang). BUSBAR (wpDef null,
        // by-design gak punya struktur WP) sengaja gak ikut kena urut ulang - urutan relatifnya
        // dipertahankan (Array.sort JS stabil). Angka WP diambil dari digit di label ("WP2"->2,
        // bukan localeCompare string biar "WP10" gak nyalip ke depan "WP2").
        const wpSortNum=(wp:any)=>{
          const m=String(wp||"").match(/(\d+)/);
          return m?parseInt(m[1],10):999;
        };
        rows.sort((a:any,b:any)=>{
          const wpA=wpSortNum(a.wpDef?.wp),wpB=wpSortNum(b.wpDef?.wp);
          if(wpA!==wpB)return wpA-wpB;
          const idxA=a.wpDef?.items?.findIndex((it:any)=>it.kode===a.kode)??999;
          const idxB=b.wpDef?.items?.findIndex((it:any)=>it.kode===b.kode)??999;
          return idxA-idxB;
        });

        const isDone=(r:any)=>r.pct===100;
        const isDrilldownProses=["WIRING CONTROL","WIRING POWER","BUSBAR"].includes(proses);
        const PROSES_KUMPUL_DULU_DESKTOP=["POTONG","RENDAM","PAINTING"];
        // Mobile: titik awal pilih komponen dibalik jadi Jenis Komponen -> Panel buat proses ini.
        const PROSES_PILIH_PER_KOMPONEN=["BENDING","STEL","FINISHING","RENDAM","PAINTING","BUSBAR","RAKIT","PASANG KOMPONEN"];
        const visibleRowsPraStatus=(isDrilldownProses||viewMode==='mobile'||PROSES_KUMPUL_DULU_DESKTOP.includes(proses))?rows.filter((r:any)=>(selectedKomponen[`${proses}_${r.panelId}`]||[]).includes(r.kode)):rows;
        // SCOPE FIX (6 Agu 2026): filter status pipeline itu buat GRID KOMPONEN sebelum collect
        // (chip "jenis komponen"/"panel" di bawah), BUKAN buat area kartu yang udah di-collect ini.
        // visibleRows balik ke murni collect-state kayak semula, gak lagi dipengaruhi statusFilter -
        // begitu operator collect suatu komponen, dia tetap kelihatan di sini apapun tab filter yang
        // lagi aktif. chipSourceRows (dipakai di grid picker di bawah) yang nanggung filtering-nya.
        const visibleRows=visibleRowsPraStatus;
        // Sumber grid picker (chip jenis komponen/panel) SEBELUM collect - filter status di sini,
        // bukan collect-state. "Semua" nunjukin semua rows kayak biasa.
        const chipSourceRows=statusFilter==="ALL"?rows:rows.filter((r:any)=>r.pipelineStatus===statusFilter);
        // AUDIT FIX (6 Agu 2026): komponen NOT YET yang KEBETULAN udah punya timer aktif (mis. dari
        // sebelum fitur status pipeline ini ada, atau dari operator lain di kode yang sama) TIDAK
        // BOLEH ikut di-lock - dicek langsung ke data live: ada 8 timer aktif hari ini di komponen
        // yang kebaca NOT YET, kalau di-lock operator gak akan bisa STOP timer itu sama sekali
        // lewat card manapun. Prefix match ke timerAktif (bukan exact key) biar nangkep operator ID
        // apapun/tahap apapun (BUSBAR/WIRING dual-tahap punya suffix tahap di timerKey-nya).
        const rowHasActiveTimer=(r:any)=>Object.keys(timerAktif).some(k=>k.startsWith(`${r.panelId}_${r.kode}_${proses}_`));
        // Target aksi massal (Mulai/Simpan Semua/dst) - NOT YET dikeluarkan, KECUALI yang udah
        // punya timer aktif (biar "Selesai Semua" bisa tetap jangkau & stop timer itu). Kartu NOT
        // YET udah di-disable (pointerEvents:none) individual dengan pengecualian yang sama, tapi
        // tombol aksi massal ini beroperasi di luar kartu jadi butuh exclude terpisah - kalau gak,
        // "Simpan Semua Progress" bisa nyimpen progress komponen yang harusnya belum boleh
        // dikerjakan sama sekali.
        const bulkTargetRows=visibleRows.filter((r:any)=>r.pipelineStatus!=="NOT YET"||rowHasActiveTimer(r));
      const isWiringProses=["WIRING CONTROL","WIRING POWER"].includes(proses);
      // Proses yang operatornya dipilih per-kartu individual (bukan bulk satu grup sekaligus) -
      // WIRING udah dari revisi sebelumnya, RAKIT/PASANG KOMPONEN nyusul sekarang. Dipisah dari
      // isWiringProses karena itu masih dipakai buat hal lain yang genuinely wiring-only
      // (badge bobot/jumlah orang, gating PCT_STEPS desktop) yang gak boleh ikut kena.
      const operatorPerKartu=isWiringProses||proses==="RAKIT"||proses==="PASANG KOMPONEN";
      // Pasang Komponen khusus Assembling Luar pakai mode persentase-check (25/50/75/100),
      // bukan input qty - scoped ke sub_bagian ini aja, gak ganggu proses lain atau
      // sub-bagian lain kalau nanti PASANG KOMPONEN di-assign ke tempat lain juga.
      const cardMode=(proses==="PASANG KOMPONEN"&&user.sub_bagian==="Assembling Luar")?'pct':(PROSES_CARD_MODE[proses]||'qty');

        return(
          <Card key={proses} style={{marginBottom:20,padding:0,overflow:"hidden"}}>
            <div style={{background:pc,padding:"10px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontWeight:800,fontSize:14,color:"#fff"}}>{proses}</div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <span style={{fontSize:12,color:"#ffffff99"}}>Shift {shift}</span>
                <span style={{background:"#ffffff22",color:"#fff",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>
                  {visibleRows.filter((r:any)=>isDone(r)).length}/{visibleRows.length} selesai
                </span>
              </div>
            </div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap" as const,padding:"8px 16px",background:"#f8fafc",borderBottom:"1px solid #f1f5f9"}}>
              {(["ALL","NOT YET","TO DO","IN PROGRESS","DONE"] as const).map(s=>{
                // BUG FIX (6 Agu 2026): dulu hitung dari visibleRowsPraStatus (dibatasin ke
                // komponen yang UDAH DI-COLLECT operator) - sebelum collect apapun, itu selalu
                // kosong, jadi semua tab kelihatan (0) walau datanya sendiri (pipelineStatus per
                // row) sebenernya udah bener dihitung dari awal fetch. Hitungan tab harus nyerminin
                // SEMUA komponen relevan di proses ini (rows, gak dibatasin status collect) -
                // rendering kartu tetap lewat visibleRows/visibleRowsPraStatus seperti biasa,
                // cuma angka di tab ini yang perlu lihat gambaran penuh.
                const cnt=s==="ALL"?rows.length:rows.filter((r:any)=>r.pipelineStatus===s).length;
                const sc=s==="ALL"?"#475569":STATUS_PIPELINE_STYLE[s].color;
                const isSel=statusFilter===s;
                return(
                  <button key={s} onClick={()=>setStatusFilter(isSel?"ALL":s)}
                    style={{padding:"4px 11px",borderRadius:20,border:`1.5px solid ${isSel?sc:"#e2e8f0"}`,background:isSel?sc+"18":"#fff",color:isSel?sc:"#64748b",cursor:"pointer",fontSize:10.5,fontWeight:700}}>
                    {s==="ALL"?"Semua":STATUS_PIPELINE_LABEL[s]} ({cnt})
                  </button>
                );
              })}
            </div>
            {(isDrilldownProses||viewMode==='mobile'||PROSES_KUMPUL_DULU_DESKTOP.includes(proses))&&(
              viewMode==='mobile'&&PROSES_PILIH_PER_KOMPONEN.includes(proses)?(
              <div style={{display:"flex",flexWrap:"wrap",gap:8,padding:"10px 16px",background:"#f8fafc",borderBottom:"1px solid #f1f5f9"}}>
                {(()=>{
                  const seenNama=new Set();
                  const jenisList:any[]=[];
                  chipSourceRows.forEach((r:any)=>{
                    const nama=r.item?.nama||r.kode;
                    if(!seenNama.has(nama)){
                      seenNama.add(nama);
                      jenisList.push({namaKomponen:nama});
                    }
                  });
                  if(jenisList.length===0&&statusFilter!=="ALL"){
                    return(
                      <div style={{fontSize:11,color:"#94a3b8",padding:"4px 0"}}>
                        Gak ada komponen dengan status "{STATUS_PIPELINE_LABEL[statusFilter as ProsesStatus]}" di proses ini.
                      </div>
                    );
                  }
                  return jenisList.map((jg:any)=>{
                    const groupRows=chipSourceRows.filter((r:any)=>(r.item?.nama||r.kode)===jg.namaKomponen);
                    const panelCount=new Set(groupRows.map((r:any)=>r.panelId)).size;
                    const selRows=groupRows.filter((r:any)=>(selectedKomponen[`${proses}_${r.panelId}`]||[]).includes(r.kode));
                    const selCount=selRows.length;
                    const belumDikerjakanCount=selRows.filter((r:any)=>(r.pct||0)===0).length;
                    const dikerjakanRows=selRows.filter((r:any)=>(r.pct||0)>0&&(r.pct||0)<100);
                    const dikerjakanCount=dikerjakanRows.length;
                    const dikerjakanPcs=dikerjakanRows.reduce((s:number,r:any)=>s+(r.qtyProses||0),0);
                    const selesaiCount=selRows.filter((r:any)=>(r.pct||0)>=100).length;
                    // Sama kayak panelSudahTuntas versi lama, cuma sekarang di-agregat per jenis komponen.
                    const groupAllRows=groupRows.filter((r:any)=>r.qtyKomp>0);
                    const groupSudahTuntas=groupAllRows.length>0&&groupAllRows.every((r:any)=>r.pct===100&&r.sudahDisimpan100);
                    return(
                      <button key={jg.namaKomponen} disabled={groupSudahTuntas}
                        onClick={()=>{setKomponenPopupJenis({proses,namaKomponen:jg.namaKomponen});setTempSelectedPanelJenis(selRows.map((r:any)=>r.panelId));}}
                        style={{display:"flex",flexDirection:"column",alignItems:"flex-start",gap:2,
                          padding:"6px 12px",borderRadius:8,border:groupSudahTuntas?"1px solid #e2e8f0":selCount>0?"1.5px solid #6366f1":"1px solid #e2e8f0",
                          background:groupSudahTuntas?"#f8fafc":selCount>0?"#eef2ff":"#fff",
                          cursor:groupSudahTuntas?"not-allowed":"pointer",textAlign:"left",opacity:groupSudahTuntas?0.5:1}}>
                        <span style={{fontSize:9,color:"#94a3b8"}}>{panelCount} panel</span>
                        <span style={{fontSize:12,fontWeight:700,color:"#1e293b"}}>{jg.namaKomponen}</span>
                        {groupSudahTuntas?(
                          <span style={{fontSize:9,color:"#16a34a",fontWeight:600}}>✅ Selesai semua</span>
                        ):selCount>0?(
                          <span style={{fontSize:9,color:"#4f46e5",fontWeight:600,display:"flex",gap:6,flexWrap:"wrap" as const}}>
                            {belumDikerjakanCount>0&&<span>{belumDikerjakanCount} belum</span>}
                            {dikerjakanCount>0&&<span>{dikerjakanCount} dikerjakan{dikerjakanPcs>0?` (${dikerjakanPcs}pcs)`:""}</span>}
                            {selesaiCount>0&&<span style={{color:"#16a34a"}}>{selesaiCount} selesai</span>}
                          </span>
                        ):(
                          <span style={{fontSize:9,color:"#94a3b8",fontWeight:600}}>+ Pilih Panel</span>
                        )}
                      </button>
                    );
                  });
                })()}
              </div>
              ):(
              <div style={{display:"flex",flexWrap:"wrap",gap:8,padding:"10px 16px",background:"#f8fafc",borderBottom:"1px solid #f1f5f9"}}>
                {(()=>{
                  const seenPanel=new Set();
                  const panelList:any[]=[];
                  chipSourceRows.forEach((r:any)=>{
                    if(!seenPanel.has(r.panelId)){
                      seenPanel.add(r.panelId);
                      panelList.push({panelId:r.panelId,panel:r.panel,proyek:r.task.proyek});
                    }
                  });
                  if(panelList.length===0&&statusFilter!=="ALL"){
                    return(
                      <div style={{fontSize:11,color:"#94a3b8",padding:"4px 0"}}>
                        Gak ada komponen dengan status "{STATUS_PIPELINE_LABEL[statusFilter as ProsesStatus]}" di proses ini.
                      </div>
                    );
                  }
                  return panelList.map((pg:any)=>{
                    const panelKey=`${proses}_${pg.panelId}`;
                    const selKodeList=selectedKomponen[panelKey]||[];
                    const selCount=selKodeList.length;
                    const selRows=chipSourceRows.filter((r:any)=>r.panelId===pg.panelId&&selKodeList.includes(r.kode));
                    const belumDikerjakanCount=selRows.filter((r:any)=>(r.pct||0)===0).length;
                    const dikerjakanRows=selRows.filter((r:any)=>(r.pct||0)>0&&(r.pct||0)<100);
                    const dikerjakanCount=dikerjakanRows.length;
                    const dikerjakanPcs=dikerjakanRows.reduce((s:number,r:any)=>s+(r.qtyProses||0),0);
                    const selesaiCount=selRows.filter((r:any)=>(r.pct||0)>=100).length;
                    // Panel di-disable kalau SEMUA komponen relevannya (qtyKomp>0) di proses ini
                    // udah 100% DAN sudah disimpan - gak ada kerjaan tersisa. Berlaku semua
                    // proses yang make popup ini (dulu cuma POTONG/BENDING/STEL, proses lain
                    // yang lewat sini - RAKIT/PASANG KOMPONEN/WIRING CONTROL/WIRING POWER/BUSBAR -
                    // gak pernah dapet efek ini).
                    const panelAllRows=chipSourceRows.filter((r:any)=>r.panelId===pg.panelId&&r.qtyKomp>0);
                    const panelSudahTuntas=panelAllRows.length>0&&panelAllRows.every((r:any)=>r.pct===100&&r.sudahDisimpan100);
                    return(
                      <button key={pg.panelId} disabled={panelSudahTuntas}
                        onClick={()=>{setKomponenPopup({proses,panelId:pg.panelId});setTempSelectedKomponen(selectedKomponen[panelKey]||[]);}}
                        style={{display:"flex",flexDirection:"column",alignItems:"flex-start",gap:2,
                          padding:"6px 12px",borderRadius:8,border:panelSudahTuntas?"1px solid #e2e8f0":selCount>0?"1.5px solid #6366f1":"1px solid #e2e8f0",
                          background:panelSudahTuntas?"#f8fafc":selCount>0?"#eef2ff":"#fff",
                          cursor:panelSudahTuntas?"not-allowed":"pointer",textAlign:"left",opacity:panelSudahTuntas?0.5:1}}>
                        <span style={{fontSize:9,color:"#94a3b8"}}>{pg.proyek}</span>
                        <span style={{fontSize:12,fontWeight:700,color:"#1e293b"}}>{pg.panel.nama}</span>
                        {panelSudahTuntas?(
                          <span style={{fontSize:9,color:"#16a34a",fontWeight:600}}>✅ Selesai semua</span>
                        ):selCount>0?(
                          <span style={{fontSize:9,color:"#4f46e5",fontWeight:600,display:"flex",gap:6,flexWrap:"wrap" as const}}>
                            {belumDikerjakanCount>0&&<span>{belumDikerjakanCount} belum</span>}
                            {dikerjakanCount>0&&<span>{dikerjakanCount} dikerjakan{dikerjakanPcs>0?` (${dikerjakanPcs}pcs)`:""}</span>}
                            {selesaiCount>0&&<span style={{color:"#16a34a"}}>{selesaiCount} selesai</span>}
                          </span>
                        ):(
                          <span style={{fontSize:9,color:"#94a3b8",fontWeight:600}}>+ Pilih Komponen</span>
                        )}
                      </button>
                    );
                  });
                })()}
              </div>
              )
            )}
            {komponenPopup&&komponenPopup.proses===proses&&(()=>{
              const panelRows=rows.filter((r:any)=>r.panelId===komponenPopup.panelId);
              const panelInfo=panelRows[0];
              return(
                <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:16}}
                  onClick={()=>setKomponenPopup(null)}>
                  <div onClick={(e:any)=>e.stopPropagation()} style={{background:"#fff",borderRadius:12,border:"1.5px solid #e2e8f0",width:"100%",maxWidth:400,maxHeight:"80vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>
                    <div style={{padding:"14px 16px",borderBottom:"1.5px solid #e2e8f0",display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10}}>
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:600,color:"#64748b"}}>{panelInfo?.task.proyek}</div>
                        <div style={{fontSize:17,fontWeight:800,color:"#1e293b",marginTop:1}}>{panelInfo?.panel.nama}</div>
                        <div style={{fontSize:11,color:"#94a3b8",marginTop:4}}>Pilih komponen yang mau dikerjakan</div>
                      </div>
                      <button onClick={()=>setKomponenPopup(null)}
                        style={{flexShrink:0,width:28,height:28,borderRadius:99,border:"none",background:"#f1f5f9",color:"#64748b",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700}}>×</button>
                    </div>
                    <div style={{overflowY:"auto",padding:"8px 16px",flex:1}}>
                      {panelRows.map((r:any)=>{
                        const checked=tempSelectedKomponen.includes(r.kode);
                        const panelKeyPopup=`${proses}_${komponenPopup.panelId}`;
                        const alreadyConfirmed=(selectedKomponen[panelKeyPopup]||[]).includes(r.kode);
                        const sudahSelesai=(r.qtyKomp>0||r.isBusbar)&&r.pct===100&&r.sudahDisimpan100;
                        const isDisabled=alreadyConfirmed||sudahSelesai;
                        return(
                          <label key={r.kode} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 4px",borderBottom:"1px solid #f8fafc",
                            cursor:isDisabled?"not-allowed":"pointer",opacity:isDisabled?0.55:1}}>
                            <input type="checkbox" checked={checked} disabled={isDisabled}
                              onChange={()=>{
                                if(isDisabled)return;
                                setTempSelectedKomponen((prev:string[])=>checked?prev.filter(k=>k!==r.kode):[...prev,r.kode]);
                              }}
                              style={{width:16,height:16}}/>
                            <div style={{display:"flex",flexDirection:"column",gap:2,flex:1}}>
                              <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                                <span style={{fontSize:13,fontWeight:600,color:"#374151"}}>{renderNamaKomponen(r.item.nama)}</span>
                                {r.wiringBadge&&(
                                  <span style={{fontSize:9,fontWeight:700,background:"#eef2ff",color:"#4f46e5",borderRadius:6,padding:"1px 6px"}}>
                                    ⚡ {(r.wiringBadge.bobot||"").replace("_"," ")} · {r.wiringBadge.jumlahOrang||"–"}org
                                  </span>
                                )}
                                {isDisabled&&(()=>{
                                  const pct=r.pct||0;
                                  const statusBadgeLabel=pct>=100?"Selesai":pct>0?`Dikerjakan${r.qtyProses?` ${r.qtyProses}pcs`:""}`:"Belum";
                                  const statusBadgeKey=pct>=100?"selesai":pct>0?"proses":"belum";
                                  const statusBadgeColor=STATUS_TUGAS_NP[statusBadgeKey].color;
                                  const statusBadgeBg=STATUS_TUGAS_NP[statusBadgeKey].bg;
                                  return(
                                    <span style={{fontSize:9,fontWeight:700,background:statusBadgeBg,color:statusBadgeColor,borderRadius:6,padding:"1px 6px"}}>
                                      {statusBadgeLabel}
                                    </span>
                                  );
                                })()}
                              </div>
                              <span style={{fontSize:10,color:"#94a3b8",fontFamily:"'DM Mono',monospace"}}>{r.kode}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                    <div style={{display:"flex",gap:8,padding:"12px 16px",borderTop:"1px solid #f1f5f9"}}>
                      <button onClick={()=>setTempSelectedKomponen(panelRows.filter((r:any)=>{
                          const alreadyConfirmed=(selectedKomponen[`${proses}_${komponenPopup.panelId}`]||[]).includes(r.kode);
                          const sudahSelesai=(r.qtyKomp>0||r.isBusbar)&&r.pct===100&&r.sudahDisimpan100;
                          return !alreadyConfirmed&&!sudahSelesai;
                        }).map((r:any)=>r.kode))}
                        style={{fontSize:11,color:"#1d4ed8",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Pilih Semua</button>
                      <button onClick={()=>setTempSelectedKomponen([])}
                        style={{fontSize:11,color:"#dc2626",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Kosongkan</button>
                      <div style={{flex:1}}/>
                      <button onClick={()=>setKomponenPopup(null)}
                        style={{padding:"8px 14px",borderRadius:8,border:"1px solid #e2e8f0",background:"#fff",fontSize:12,fontWeight:600,color:"#64748b",cursor:"pointer"}}>Batal</button>
                      <button onClick={()=>{
                          const panelKeyKonfirmasi=`${proses}_${komponenPopup.panelId}`;
                          const prevSelected=selectedKomponen[panelKeyKonfirmasi]||[];
                          const newlyAdded=tempSelectedKomponen.filter(k=>!prevSelected.includes(k));
                          const targetKode=newlyAdded[0]||tempSelectedKomponen[0];
                          const targetRow=panelRows.find((r:any)=>r.kode===targetKode);
                          setSelectedKomponen((prev:any)=>({...prev,[panelKeyKonfirmasi]:tempSelectedKomponen}));
                          setKomponenPopup(null);
                          // Reset filter status - komponen yang baru dicollect bisa aja statusnya beda
                          // dari filter yang lagi aktif, jangan sampai langsung "ilang" dari layar begitu
                          // dikonfirmasi.
                          setStatusFilter("ALL");
                          if(targetRow)scrollDanHighlightGroup(proses,targetRow.item?.nama||targetRow.kode);
                        }}
                        style={{padding:"8px 14px",borderRadius:8,border:"none",background:"#4f46e5",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer"}}>
                        Konfirmasi ({tempSelectedKomponen.length})
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
            {komponenPopupJenis&&komponenPopupJenis.proses===proses&&(()=>{
              const groupRows=rows.filter((r:any)=>(r.item?.nama||r.kode)===komponenPopupJenis.namaKomponen);
              return(
                <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:16}}
                  onClick={()=>setKomponenPopupJenis(null)}>
                  <div onClick={(e:any)=>e.stopPropagation()} style={{background:"#fff",borderRadius:12,border:"1.5px solid #e2e8f0",width:"100%",maxWidth:400,maxHeight:"80vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>
                    <div style={{padding:"14px 16px",borderBottom:"1.5px solid #e2e8f0",display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10}}>
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:17,fontWeight:800,color:"#1e293b"}}>{komponenPopupJenis.namaKomponen}</div>
                        <div style={{fontSize:11,color:"#94a3b8",marginTop:4}}>Pilih panel yang mau dikerjakan</div>
                      </div>
                      <button onClick={()=>setKomponenPopupJenis(null)}
                        style={{flexShrink:0,width:28,height:28,borderRadius:99,border:"none",background:"#f1f5f9",color:"#64748b",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700}}>×</button>
                    </div>
                    <div style={{overflowY:"auto",padding:"8px 16px",flex:1}}>
                      {groupRows.map((r:any)=>{
                        const checked=tempSelectedPanelJenis.includes(r.panelId);
                        const panelKeyPopup=`${proses}_${r.panelId}`;
                        const alreadyConfirmed=(selectedKomponen[panelKeyPopup]||[]).includes(r.kode);
                        const sudahSelesai=(r.qtyKomp>0||r.isBusbar)&&r.pct===100&&r.sudahDisimpan100;
                        const isDisabled=alreadyConfirmed||sudahSelesai;
                        return(
                          <label key={r.panelId} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 4px",borderBottom:"1px solid #f8fafc",
                            cursor:isDisabled?"not-allowed":"pointer",opacity:isDisabled?0.55:1}}>
                            <input type="checkbox" checked={checked} disabled={isDisabled}
                              onChange={()=>{
                                if(isDisabled)return;
                                setTempSelectedPanelJenis((prev:number[])=>checked?prev.filter(id=>id!==r.panelId):[...prev,r.panelId]);
                              }}
                              style={{width:16,height:16}}/>
                            <div style={{display:"flex",flexDirection:"column",gap:2,flex:1}}>
                              <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                                <span style={{fontSize:13,fontWeight:600,color:"#374151"}}>{r.panel.nama}</span>
                                {r.wiringBadge&&(
                                  <span style={{fontSize:9,fontWeight:700,background:"#eef2ff",color:"#4f46e5",borderRadius:6,padding:"1px 6px"}}>
                                    ⚡ {(r.wiringBadge.bobot||"").replace("_"," ")} · {r.wiringBadge.jumlahOrang||"–"}org
                                  </span>
                                )}
                                {isDisabled&&(()=>{
                                  const pct=r.pct||0;
                                  const statusBadgeLabel=pct>=100?"Selesai":pct>0?`Dikerjakan${r.qtyProses?` ${r.qtyProses}pcs`:""}`:"Belum";
                                  const statusBadgeKey=pct>=100?"selesai":pct>0?"proses":"belum";
                                  const statusBadgeColor=STATUS_TUGAS_NP[statusBadgeKey].color;
                                  const statusBadgeBg=STATUS_TUGAS_NP[statusBadgeKey].bg;
                                  return(
                                    <span style={{fontSize:9,fontWeight:700,background:statusBadgeBg,color:statusBadgeColor,borderRadius:6,padding:"1px 6px"}}>
                                      {statusBadgeLabel}
                                    </span>
                                  );
                                })()}
                              </div>
                              <span style={{fontSize:10,color:"#94a3b8"}}>{r.task.proyek}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                    <div style={{display:"flex",gap:8,padding:"12px 16px",borderTop:"1px solid #f1f5f9"}}>
                      <button onClick={()=>setTempSelectedPanelJenis(groupRows.filter((r:any)=>{
                          const alreadyConfirmed=(selectedKomponen[`${proses}_${r.panelId}`]||[]).includes(r.kode);
                          const sudahSelesai=(r.qtyKomp>0||r.isBusbar)&&r.pct===100&&r.sudahDisimpan100;
                          return !alreadyConfirmed&&!sudahSelesai;
                        }).map((r:any)=>r.panelId))}
                        style={{fontSize:11,color:"#1d4ed8",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Pilih Semua</button>
                      <button onClick={()=>setTempSelectedPanelJenis([])}
                        style={{fontSize:11,color:"#dc2626",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Kosongkan</button>
                      <div style={{flex:1}}/>
                      <button onClick={()=>setKomponenPopupJenis(null)}
                        style={{padding:"8px 14px",borderRadius:8,border:"1px solid #e2e8f0",background:"#fff",fontSize:12,fontWeight:600,color:"#64748b",cursor:"pointer"}}>Batal</button>
                      <button onClick={()=>{
                          if(proses==="POTONG"||proses==="RENDAM"||proses==="PAINTING"){
                            // Snapshot progress SEBELUM collect - badge "Lanjutan X%" pakai angka
                            // beku ini, bukan pct yang ikut berubah pas qty diketik ulang.
                            setCarryOverPct((prevCo:any)=>{
                              const nextCo={...prevCo};
                              groupRows.forEach((r:any)=>{
                                const key=`${proses}_${r.panelId}_${r.kode}`;
                                const wasSelected=(selectedKomponen[`${proses}_${r.panelId}`]||[]).includes(r.kode);
                                const isSel=tempSelectedPanelJenis.includes(r.panelId);
                                if(isSel&&!wasSelected&&r.pct>0)nextCo[key]=r.pct;
                              });
                              return nextCo;
                            });
                          }
                          setSelectedKomponen((prev:any)=>{
                            const next={...prev};
                            groupRows.forEach((r:any)=>{
                              const key=`${proses}_${r.panelId}`;
                              const existing=next[key]||[];
                              const isSel=tempSelectedPanelJenis.includes(r.panelId);
                              const already=existing.includes(r.kode);
                              if(isSel&&!already)next[key]=[...existing,r.kode];
                              else if(!isSel&&already)next[key]=existing.filter((k:string)=>k!==r.kode);
                            });
                            return next;
                          });
                          setKomponenPopupJenis(null);
                          setStatusFilter("ALL");
                          scrollDanHighlightGroup(proses,komponenPopupJenis.namaKomponen);
                        }}
                        style={{padding:"8px 14px",borderRadius:8,border:"none",background:"#4f46e5",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer"}}>
                        Konfirmasi ({tempSelectedPanelJenis.length})
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
            {viewMode==='desktop'&&PROSES_KUMPUL_DULU_DESKTOP.includes(proses)&&bulkTargetRows.length>0&&(
              <div style={{padding:"10px 16px",background:"#f8fafc",borderBottom:"1px solid #f1f5f9"}}>
                {proses==="POTONG"?(
                  <button onClick={()=>startUntukUserSendiri(proses,bulkTargetRows)}
                    style={{padding:"8px 16px",borderRadius:8,border:"none",background:"#16a34a",color:"#fff",fontWeight:700,fontSize:12,cursor:"pointer"}}>
                    ▶ Mulai ({bulkTargetRows.length} komponen)
                  </button>
                ):(
                  <button onClick={()=>{setBulkAssignProses(proses);setTempBulkPekerjaIds([]);}}
                    style={{padding:"8px 16px",borderRadius:8,border:"none",background:"#2563eb",color:"#fff",fontWeight:700,fontSize:12,cursor:"pointer"}}>
                    Pilih Operator & Mulai ({bulkTargetRows.length} komponen)
                  </button>
                )}
                {(()=>{
                  const adaTimerJalan=bulkTargetRows.some((r:any)=>{
                    const idsKomp=(r.task.pekerja_per_komponen||{})[r.kode]||[];
                    return idsKomp.some((pid:number)=>!!timerAktif[`${r.panelId}_${r.kode}_${proses}_${pid}`]);
                  });
                  if(!adaTimerJalan)return null;
                  return(
                    <button onClick={()=>bulkStopDesktop(proses,bulkTargetRows)}
                      style={{marginLeft:8,padding:"8px 16px",borderRadius:8,border:"none",background:"#dc2626",color:"#fff",fontWeight:700,fontSize:12,cursor:"pointer"}}>
                      ⏹ Selesai Semua
                    </button>
                  );
                })()}
                {proses!=="POTONG"&&bulkAssignProses===proses&&viewMode==='desktop'&&(
                  <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
                    onClick={()=>setBulkAssignProses(null)}>
                    <div style={{background:"#fff",borderRadius:14,border:"1.5px solid #e2e8f0",padding:20,width:"100%",maxWidth:380,maxHeight:"80vh",overflowY:"auto"}}
                      onClick={(e:any)=>e.stopPropagation()}>
                      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10,marginBottom:4}}>
                        <div style={{fontWeight:800,fontSize:16,color:"#1e293b"}}>Pilih Operator</div>
                        <button onClick={()=>setBulkAssignProses(null)}
                          style={{flexShrink:0,width:26,height:26,borderRadius:99,border:"none",background:"#f1f5f9",color:"#64748b",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700}}>×</button>
                      </div>
                      <div style={{fontSize:11,color:"#94a3b8",marginBottom:14}}>Operator akan di-assign & timer langsung mulai untuk {bulkTargetRows.length} komponen terkumpul di {proses}.</div>
                      <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:16}}>
                        {pekerjaList.filter((p:any)=>p.divisi===user.divisi).map((p:any)=>{
                          const checked=tempBulkPekerjaIds.includes(p.id);
                          return(
                            <label key={p.id} style={{display:"flex",alignItems:"center",gap:10,border:`1.5px solid ${checked?"#2563eb":"#e2e8f0"}`,borderRadius:10,padding:"10px 12px",cursor:"pointer",background:checked?"#eff6ff":"#fff"}}>
                              <input type="checkbox" checked={checked}
                                onChange={()=>setTempBulkPekerjaIds((prev:number[])=>checked?prev.filter((id:number)=>id!==p.id):[...prev,p.id])}/>
                              <span style={{fontSize:13,fontWeight:600,color:"#1e293b"}}>{p.nama}</span>
                            </label>
                          );
                        })}
                      </div>
                      <div style={{display:"flex",gap:8}}>
                        <button onClick={()=>setBulkAssignProses(null)}
                          style={{flex:1,padding:"10px",borderRadius:10,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#64748b",fontWeight:700,fontSize:13,cursor:"pointer"}}>Batal</button>
                        <button disabled={tempBulkPekerjaIds.length===0}
                          onClick={async()=>{
                            await bulkAssignAndStartDesktop(proses,bulkTargetRows,tempBulkPekerjaIds);
                            setBulkAssignProses(null);
                          }}
                          style={{flex:1,padding:"10px",borderRadius:10,border:"none",
                            background:tempBulkPekerjaIds.length===0?"#94a3b8":"#16a34a",color:"#fff",fontWeight:700,fontSize:13,
                            cursor:tempBulkPekerjaIds.length===0?"not-allowed":"pointer"}}>
                          Mulai ({tempBulkPekerjaIds.length})
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            {viewMode==='mobile'?(
              <div style={{display:"flex",flexDirection:"column",gap:10,padding:"4px 2px"}}>
  {(()=>{
    // Khusus POTONG/BENDING/STEL/WIRING CONTROL/WIRING POWER: kartu detail komponen
    // disembunyikan dari daftar HANYA setelah progress 100% DAN "Simpan Progress" sudah
    // diklik (sudahDisimpan100) - bukan cuma begitu progress kebetulan penuh. visibleRows
    // (header counter) & rows (chip panel) tetap gak ikut difilter, cuma tampilan kartu ini aja.
    const cardListRows=["POTONG","BENDING","STEL","FINISHING","WIRING CONTROL","WIRING POWER","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","BUSBAR"].includes(proses)?visibleRows.filter((r:any)=>!(isDone(r)&&r.sudahDisimpan100)):visibleRows;
    const komponenGroups:Record<string,{namaKomponen:string,rows:any[]}> = {};
    cardListRows.forEach((r:any)=>{
      const key=r.item?.nama||r.kode;
      if(!komponenGroups[key])komponenGroups[key]={namaKomponen:r.item?.nama||r.kode,rows:[]};
      komponenGroups[key].rows.push(r);
    });
    const groups=Object.values(komponenGroups);
    if(groups.length===0){
      // Area ini murni collect-state (gak dipengaruhi statusFilter lagi - lihat visibleRows di
      // atas), jadi cuma 2 kemungkinan: udah collect tapi semua udah selesai, atau emang belum
      // collect apa-apa sama sekali.
      const semuaSudahSelesai=visibleRows.length>0&&cardListRows.length===0;
      return(
        <div style={{textAlign:"center",padding:"24px 10px",color:semuaSudahSelesai?"#16a34a":"#94a3b8",fontSize:12}}>
          {semuaSudahSelesai?"✅ Semua komponen di proses ini sudah selesai.":(
            <>Belum ada komponen dikumpulkan.<br/>Tap panel di atas untuk pilih komponen.</>
          )}
        </div>
      );
    }
    const potongTimerInfo=(()=>{
      if(proses!=="POTONG")return{ada:false,label:""};
      for(const r of bulkTargetRows){
        const idsKomp=(r.task.pekerja_per_komponen||{})[r.kode]||[];
        const runningPid=idsKomp.find((pid:number)=>!!timerAktif[`${r.panelId}_${r.kode}_${proses}_${pid}`]);
        if(runningPid!==undefined){
          const key=`${r.panelId}_${r.kode}_${proses}_${runningPid}`;
          const timer=timerAktif[key];
          const menitBerjalan=(Date.now()-new Date(timer.mulai).getTime())/60000;
          const totalMenit=(timerDurasiSelesai[key]||0)+menitBerjalan;
          const jam=Math.floor(totalMenit/60);
          const menit=Math.round(totalMenit%60);
          const detik=Math.max(0,Math.round(totalMenit*60));
          const label=jam>0?`${jam}j ${menit}m`:totalMenit>=1?`${menit}m`:`${detik}d`;
          return{ada:true,label};
        }
      }
      return{ada:false,label:""};
    })();
    const adaTimerJalanPotong=potongTimerInfo.ada;
    const bulkToolbarPotong=proses==="POTONG"?(
      <div key="bulk-toolbar-potong" style={{display:"flex",gap:8}}>
        <button onClick={()=>adaTimerJalanPotong?bulkStopDesktop(proses,bulkTargetRows):startUntukUserSendiri(proses,bulkTargetRows)}
          style={{flex:1,minHeight:48,padding:"10px",borderRadius:10,border:"none",
            background:adaTimerJalanPotong?"#dc2626":"#16a34a",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>
          {adaTimerJalanPotong?`⏹ Selesai ${potongTimerInfo.label}`:"▶ Mulai"}
        </button>
        <button onClick={()=>simpanSectionPaintingRendam(proses,bulkTargetRows)}
          style={{flex:1,minHeight:48,padding:"10px",borderRadius:10,border:"none",background:"#1d4ed8",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>
          💾 Simpan Progress
        </button>
      </div>
    ):null;
    // RENDAM/PAINTING: sama seperti POTONG (assign + mulai sekaligus buat semua komponen
    // terkumpul), bedanya operatornya masih harus dipilih manual (gak auto = user login).
    const adaTimerJalanAssignMulai=(proses==="RENDAM"||proses==="PAINTING")&&bulkTargetRows.some((r:any)=>{
      const idsKomp=(r.task.pekerja_per_komponen||{})[r.kode]||[];
      return idsKomp.some((pid:number)=>!!timerAktif[`${r.panelId}_${r.kode}_${proses}_${pid}`]);
    });
    const bulkToolbarAssignMulai=(proses==="RENDAM"||proses==="PAINTING")?(
      <div key="bulk-toolbar-assignmulai" style={{display:"flex",flexDirection:"column",gap:8}}>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>{setBulkAssignProses(proses);setTempBulkPekerjaIds([]);}}
            style={{flex:1,minHeight:48,padding:"10px",borderRadius:10,border:"none",background:"#2563eb",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>
            Pilih Operator & Mulai ({bulkTargetRows.length})
          </button>
          {adaTimerJalanAssignMulai&&(
            <button onClick={()=>bulkStopDesktop(proses,bulkTargetRows)}
              style={{flex:1,minHeight:48,padding:"10px",borderRadius:10,border:"none",background:"#dc2626",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>
              ⏹ Selesai Semua
            </button>
          )}
        </div>
        <button onClick={()=>simpanSectionPaintingRendam(proses,bulkTargetRows)}
          style={{minHeight:48,padding:"10px",borderRadius:10,border:"none",background:"#1d4ed8",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>
          💾 Simpan Progress
        </button>
        {bulkAssignProses===proses&&(
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
            onClick={()=>setBulkAssignProses(null)}>
            <div style={{background:"#fff",borderRadius:14,border:"1.5px solid #e2e8f0",padding:20,width:"100%",maxWidth:380,maxHeight:"80vh",overflowY:"auto"}}
              onClick={(e:any)=>e.stopPropagation()}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10,marginBottom:4}}>
                <div style={{fontWeight:800,fontSize:16,color:"#1e293b"}}>Pilih Operator</div>
                <button onClick={()=>setBulkAssignProses(null)}
                  style={{flexShrink:0,width:26,height:26,borderRadius:99,border:"none",background:"#f1f5f9",color:"#64748b",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700}}>×</button>
              </div>
              <div style={{fontSize:11,color:"#94a3b8",marginBottom:14}}>Operator akan di-assign & timer langsung mulai untuk {bulkTargetRows.length} komponen terkumpul di {proses}.</div>
              <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:16}}>
                {pekerjaList.filter((p:any)=>p.divisi===user.divisi).map((p:any)=>{
                  const checked=tempBulkPekerjaIds.includes(p.id);
                  return(
                    <label key={p.id} style={{display:"flex",alignItems:"center",gap:10,border:`1.5px solid ${checked?"#2563eb":"#e2e8f0"}`,borderRadius:10,padding:"10px 12px",cursor:"pointer",background:checked?"#eff6ff":"#fff"}}>
                      <input type="checkbox" checked={checked}
                        onChange={()=>setTempBulkPekerjaIds((prev:number[])=>checked?prev.filter((id:number)=>id!==p.id):[...prev,p.id])}/>
                      <span style={{fontSize:13,fontWeight:600,color:"#1e293b"}}>{p.nama}</span>
                    </label>
                  );
                })}
              </div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>setBulkAssignProses(null)}
                  style={{flex:1,padding:"10px",borderRadius:10,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#64748b",fontWeight:700,fontSize:13,cursor:"pointer"}}>Batal</button>
                <button disabled={tempBulkPekerjaIds.length===0}
                  onClick={async()=>{
                    // Catat waktu mulai section HANYA kalau section ini belum punya (section yang
                    // udah terbuka lanjut collect+mulai lagi TIDAK menggeser waktu mulainya).
                    const sectionMulaiKey=`${proses}_${viewDate}`;
                    if(!sectionMulaiMap[sectionMulaiKey]){
                      setSectionMulaiMap((prev:any)=>({...prev,[sectionMulaiKey]:new Date().toISOString()}));
                    }
                    await bulkAssignAndStartDesktop(proses,bulkTargetRows,tempBulkPekerjaIds);
                    setBulkAssignProses(null);
                  }}
                  style={{flex:1,padding:"10px",borderRadius:10,border:"none",
                    background:tempBulkPekerjaIds.length===0?"#94a3b8":"#16a34a",color:"#fff",fontWeight:700,fontSize:13,
                    cursor:tempBulkPekerjaIds.length===0?"not-allowed":"pointer"}}>
                  Mulai ({tempBulkPekerjaIds.length})
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    ):null;
    return[bulkToolbarPotong,bulkToolbarAssignMulai,...groups.map(group=>{
      const groupKey=group.namaKomponen;
      const isOpen=expandedPanel[proses]===groupKey;
      const panelCount=new Set(group.rows.map((r:any)=>r.panelId)).size;
      const belumAdaOperatorCount=group.rows.filter((r:any)=>{
        if(proses==="BUSBAR"){
          const ppk=(r.task.pekerja_per_komponen||{})[r.kode];
          return!ppk||!Object.values(ppk).some((ids:any)=>Array.isArray(ids)&&ids.length>0);
        }
        return getFlatOperatorIds(r.task,r.kode).length===0;
      }).length;
      const isHighlighted=highlightGroup===`${proses}_${groupKey}`;
      return(
        <div key={groupKey} ref={(el)=>{accordionRefs.current[`${proses}_${groupKey}`]=el;}}
          style={{background:isHighlighted?"#fefce8":"#fff",border:isHighlighted?"1.5px solid #facc15":"1.5px solid #e2e8f0",
            borderRadius:14,overflow:"hidden",transition:"background .6s ease, border-color .6s ease"}}>
          <div onClick={()=>setExpandedPanel(prev=>({...prev,[proses]:isOpen?null:groupKey}))}
            style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",cursor:"pointer",background:isOpen?"#eff6ff":"#fff"}}>
            <div style={{display:"flex",flexDirection:"column",gap:2}}>
              <span style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>{group.namaKomponen}</span>
              <span style={{fontSize:10,color:"#94a3b8"}}>{panelCount} panel · {group.rows.length} komponen{belumAdaOperatorCount>0?` · ${belumAdaOperatorCount} belum ada operator`:""}</span>
            </div>
            <span style={{fontSize:14,color:"#94a3b8",transition:"transform .15s",transform:isOpen?"rotate(180deg)":"none"}}>▾</span>
          </div>
          {isOpen&&(
            <div style={{padding:"0 14px 14px 14px",display:"flex",flexDirection:"column",gap:10}}>
              {proses!=="POTONG"&&proses!=="RENDAM"&&proses!=="PAINTING"&&!operatorPerKartu&&(
                <button onClick={()=>{setBulkAssignProses(proses);setBulkAssignGroupKey(groupKey);setTempBulkPekerjaIds([]);setBulkAssignTahap(null);}}
                  style={{padding:"10px",minHeight:44,borderRadius:10,border:"none",background:"#2563eb",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>
                  {proses==="BUSBAR"?`Mulai Bareng (${group.rows.length} komponen)`:`Pilih Operator (${group.rows.length} komponen)`}
                </button>
              )}
              {proses!=="POTONG"&&proses!=="RENDAM"&&proses!=="PAINTING"&&!operatorPerKartu&&bulkAssignProses===proses&&bulkAssignGroupKey===groupKey&&(
                <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
                  onClick={()=>{setBulkAssignProses(null);setBulkAssignGroupKey(null);setBulkAssignTahap(null);}}>
                  <div style={{background:"#fff",borderRadius:14,border:"1.5px solid #e2e8f0",padding:20,width:"100%",maxWidth:380,maxHeight:"80vh",overflowY:"auto"}}
                    onClick={(e:any)=>e.stopPropagation()}>
                    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10,marginBottom:4}}>
                      <div style={{fontWeight:800,fontSize:16,color:"#1e293b"}}>{proses==="BUSBAR"?"Mulai Bareng - Pilih Tahap & Operator":"Pilih Operator"}</div>
                      <button onClick={()=>{setBulkAssignProses(null);setBulkAssignGroupKey(null);setBulkAssignTahap(null);}}
                        style={{flexShrink:0,width:26,height:26,borderRadius:99,border:"none",background:"#f1f5f9",color:"#64748b",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700}}>×</button>
                    </div>
                    <div style={{fontSize:11,color:"#94a3b8",marginBottom:14}}>
                      {proses==="BUSBAR"
                        ?`Timer bakal LANGSUNG MULAI buat SATU tahap yang dipilih, di SEMUA ${group.rows.length} "${group.namaKomponen}" di ${panelCount} panel sekaligus - gak perlu klik Mulai satu-satu per panel lagi. Cocok buat kerja borongan (misal fabrikasi banyak part sekaligus).`
                        :`Operator akan di-set untuk SEMUA ${group.rows.length} "${group.namaKomponen}" di ${panelCount} panel (menimpa operator lama kalau ada). Timer tetap diklik manual per komponen.`}
                    </div>
                    {proses==="BUSBAR"&&(
                      <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:14}}>
                        <div style={{fontSize:11,fontWeight:700,color:"#475569"}}>Tahap:</div>
                        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                          {getUrutanTahapBusbar(group.rows[0]?.kode).map((t:string)=>(
                            <button key={t} onClick={()=>setBulkAssignTahap(t)}
                              style={{padding:"8px 12px",borderRadius:8,border:`1.5px solid ${bulkAssignTahap===t?"#2563eb":"#e2e8f0"}`,
                                background:bulkAssignTahap===t?"#eff6ff":"#fff",color:bulkAssignTahap===t?"#1d4ed8":"#64748b",fontWeight:700,fontSize:12,cursor:"pointer"}}>
                              {BUSBAR_TAHAP_LABEL[t]}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:16}}>
                      {pekerjaList.filter((p:any)=>p.divisi===user.divisi).map((p:any)=>{
                        const checked=tempBulkPekerjaIds.includes(p.id);
                        return(
                          <label key={p.id} style={{display:"flex",alignItems:"center",gap:10,border:`1.5px solid ${checked?"#2563eb":"#e2e8f0"}`,borderRadius:10,padding:"10px 12px",cursor:"pointer",background:checked?"#eff6ff":"#fff"}}>
                            <input type="checkbox" checked={checked}
                              onChange={()=>setTempBulkPekerjaIds((prev:number[])=>checked?prev.filter((id:number)=>id!==p.id):[...prev,p.id])}/>
                            <span style={{fontSize:13,fontWeight:600,color:"#1e293b"}}>{p.nama}</span>
                          </label>
                        );
                      })}
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>{setBulkAssignProses(null);setBulkAssignGroupKey(null);setBulkAssignTahap(null);}}
                        style={{flex:1,minHeight:44,padding:"10px",borderRadius:10,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#64748b",fontWeight:700,fontSize:13,cursor:"pointer"}}>Batal</button>
                      <button disabled={tempBulkPekerjaIds.length===0||(proses==="BUSBAR"&&!bulkAssignTahap)}
                        onClick={async()=>{
                          if(proses==="BUSBAR"&&bulkAssignTahap)await bulkAssignBusbarOperatorAndStart(group.rows,bulkAssignTahap,tempBulkPekerjaIds);
                          else await bulkAssignAndStart(proses,group.rows,tempBulkPekerjaIds);
                          setBulkAssignProses(null);
                          setBulkAssignGroupKey(null);
                          setBulkAssignTahap(null);
                        }}
                        style={{flex:1,minHeight:44,padding:"10px",borderRadius:10,border:"none",
                          background:(tempBulkPekerjaIds.length===0||(proses==="BUSBAR"&&!bulkAssignTahap))?"#94a3b8":"#16a34a",color:"#fff",fontWeight:700,fontSize:13,
                          cursor:(tempBulkPekerjaIds.length===0||(proses==="BUSBAR"&&!bulkAssignTahap))?"not-allowed":"pointer"}}>
                        {proses==="BUSBAR"?`▶ Mulai (${tempBulkPekerjaIds.length})`:`Simpan (${tempBulkPekerjaIds.length})`}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {group.rows.map((r:any)=>{
                const done=isDone(r);
                const bisaEdit=canEditProgressKomponen(r.task,r.kode,r.panelId,proses);
                const kInfo=r.wiringBadge||komponenInfoMap[`${r.panelId}_${proses}_${r.kode}`]||{};
                const fmtD=(d:string)=>d?new Date(d).toLocaleDateString("id-ID",{day:"numeric",month:"short"}):"–";
                const isBusbarProses=proses==="BUSBAR";
                const idsKomp=isBusbarProses?[]:getFlatOperatorIds(r.task,r.kode);
                const workers=idsKomp.map((id:number)=>pekerjaList.find((p:any)=>p.id===id)).filter(Boolean);
                const busbarUrutan=isBusbarProses?getUrutanTahapBusbar(r.kode):[];
                const busbarTahapState=isBusbarProses?getBusbarTahapState(panelsMap[r.panelId]?.checklist?.[r.kode],r.kode):null;
                const isLocked=r.pipelineStatus==="NOT YET"&&!rowHasActiveTimer(r);
                return(
                  <div key={`${r.task.id}-${r.kode}-m`} style={{background:done?"#f0fdf4":"#fff",
                    border:`1.5px solid ${done?"#bbf7d0":"#e2e8f0"}`,borderRadius:14,padding:"12px 14px",
                    display:"flex",flexDirection:"column",gap:10,
                    opacity:isLocked?0.55:1,
                    pointerEvents:isLocked?"none" as const:"auto" as const}}>
                    {isBusbarProses?(
                      // ── BUSBAR: SEMUA tahap (4/3) tampil sekaligus, masing-masing berdiri sendiri
                      // (operator, timer, persentase, simpan) - gak ada "tahap aktif"/estafet lagi.
                      <div style={{display:"flex",flexDirection:"column",gap:8}}>
                        {busbarUrutan.map((t:string,ti:number)=>{
                          const idsKompTahap=(r.task.pekerja_per_komponen?.[r.kode]?.[t])||[];
                          const workersTahap=idsKompTahap.map((id:number)=>pekerjaList.find((p:any)=>p.id===id)).filter(Boolean);
                          const stTahap=busbarTahapState?.[t]||{progress:0,sudahDisimpan100:false};
                          const pctTahap=stTahap.progress||0;
                          const bisaEditTahap=canSimpanBusbarTahap(r.task,r.panelId,r.kode,t);
                          const timerKeysTahap=workersTahap.map((w:any)=>timerKey(r.panelId,r.kode,"BUSBAR",w.id,t));
                          const anyTimerRunningTahap=timerKeysTahap.some((k:string)=>!!timerAktif[k]);
                          const anyLoadingTahap=timerKeysTahap.some((k:string)=>timerLoading===k);
                          let durasiLabelTahap="";
                          const runningKeyTahap=timerKeysTahap.find((k:string)=>timerAktif[k]);
                          if(runningKeyTahap){
                            const timer=timerAktif[runningKeyTahap];
                            const menitBerjalan=(Date.now()-new Date(timer.mulai).getTime())/60000;
                            const totalMenit=(timerDurasiSelesai[runningKeyTahap]||0)+menitBerjalan;
                            const jam=Math.floor(totalMenit/60);
                            const menit=Math.round(totalMenit%60);
                            const detik=Math.max(0,Math.round(totalMenit*60));
                            durasiLabelTahap=jam>0?`${jam}j ${menit}m`:totalMenit>=1?`${menit}m`:`${detik}d`;
                          }
                          const flashKeyTahap=`${r.panelId}_${r.kode}_BUSBAR_${t}`;
                          const flashingTahap=!!savedFlash[flashKeyTahap];
                          return(
                            <div key={t} style={{border:"1.5px solid #e2e8f0",borderRadius:10,padding:"8px 10px",
                              background:stTahap.sudahDisimpan100?"#f0fdf4":"#fafafa",display:"flex",flexDirection:"column",gap:6}}>
                              <div style={{fontSize:11,fontWeight:800,color:stTahap.sudahDisimpan100?"#16a34a":"#374151"}}>
                                {stTahap.sudahDisimpan100?"✅ ":""}{ti+1}. {BUSBAR_TAHAP_LABEL[t]}
                              </div>
                              {workersTahap.length===0?(
                                <button onClick={()=>{setOperatorModal({taskId:r.task.id,kode:r.kode,tahap:t});setTempPekerjaIds(idsKompTahap);}}
                                  style={{fontSize:11,color:"#2563eb",fontWeight:700,background:"#eff6ff",border:"1.5px dashed #93c5fd",borderRadius:8,padding:"8px 10px",cursor:"pointer",textAlign:"center"}}>
                                  + Pilih Operator {BUSBAR_TAHAP_LABEL[t]}
                                </button>
                              ):(
                                <div style={{display:"flex",flexWrap:"wrap",gap:6,alignItems:"center"}}>
                                  {workersTahap.map((w:any)=>(
                                    <span key={w.id} style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:10,fontWeight:700,
                                      color:DIVISI_CONFIG[w.divisi]?.color||"#64748b",background:DIVISI_CONFIG[w.divisi]?.bg||"#f1f5f9",
                                      borderRadius:20,padding:"3px 8px"}}>
                                      {DIVISI_CONFIG[w.divisi]?.icon} {w.nama}
                                    </span>
                                  ))}
                                  <button onClick={()=>{setOperatorModal({taskId:r.task.id,kode:r.kode,tahap:t});setTempPekerjaIds(idsKompTahap);}}
                                    style={{fontSize:9,color:"#64748b",fontWeight:700,background:"none",border:"1px dashed #cbd5e1",borderRadius:8,padding:"3px 7px",cursor:"pointer"}}>
                                    ✏️ Edit
                                  </button>
                                </div>
                              )}
                              {workersTahap.length>0&&(
                                <button disabled={anyLoadingTahap}
                                  onClick={()=>{
                                    if(anyTimerRunningTahap){
                                      workersTahap.forEach((w:any)=>{
                                        const k=timerKey(r.panelId,r.kode,"BUSBAR",w.id,t);
                                        if(timerAktif[k])stopTimer(w.id,r.panelId,r.kode,"BUSBAR",t);
                                      });
                                    } else {
                                      workersTahap.forEach((w:any)=>startTimer(w.id,r.panelId,r.kode,"BUSBAR",viewDate,t));
                                    }
                                  }}
                                  style={{fontSize:12,fontWeight:700,border:"none",borderRadius:8,padding:"9px 10px",minHeight:38,cursor:anyLoadingTahap?"not-allowed":"pointer",
                                    background:anyTimerRunningTahap?"#fef2f2":"#f0fdf4",color:anyTimerRunningTahap?"#dc2626":"#16a34a"}}>
                                  {anyLoadingTahap?"...":anyTimerRunningTahap?`⏹ Selesai ${durasiLabelTahap}`:"▶ Mulai"}
                                </button>
                              )}
                              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                                {PCT_STEPS.map((s:number)=>{
                                  const reached=pctTahap>=s;
                                  const isNext=s===PCT_STEPS.find((x:number)=>x>pctTahap);
                                  const prevStep=PCT_STEPS[PCT_STEPS.indexOf(s)-1]||0;
                                  return(
                                    <button key={s} disabled={!bisaEditTahap}
                                      onClick={()=>{if(bisaEditTahap)updatePctManualBusbarTahap(r.panelId,r.kode,t,reached?prevStep:s);}}
                                      style={{flex:1,minWidth:36,padding:"7px 3px",borderRadius:7,border:"none",
                                        cursor:bisaEditTahap?"pointer":"not-allowed",
                                        background:reached?pColor(s):isNext?"#eff6ff":"#f1f5f9",
                                        color:reached?"#fff":isNext?pc:"#94a3b8",
                                        fontWeight:700,fontSize:10,outline:isNext&&bisaEditTahap?`2px solid ${pc}`:"none"}}>
                                      {reached?"✓":`${s}%`}
                                    </button>
                                  );
                                })}
                              </div>
                              <button disabled={pctTahap===0||savingTahap[flashKeyTahap]} onClick={async()=>{
                                  const berhasil=await simpanProgressTahapBusbar(r.panelId,r.kode,t);
                                  if(berhasil&&pctTahap<100){
                                    setSavedFlash(prev=>({...prev,[flashKeyTahap]:true}));
                                    setTimeout(()=>setSavedFlash(prev=>({...prev,[flashKeyTahap]:false})),1500);
                                  }
                                }}
                                style={{fontSize:11,fontWeight:700,border:"none",borderRadius:8,padding:"9px 10px",minHeight:38,
                                  cursor:(pctTahap===0||savingTahap[flashKeyTahap])?"not-allowed":"pointer",
                                  background:flashingTahap?"#16a34a":"#eff6ff",color:flashingTahap?"#fff":"#1d4ed8"}}>
                                {savingTahap[flashKeyTahap]?"⏳ Menyimpan...":flashingTahap?"✅ Tersimpan":`💾 Simpan ${BUSBAR_TAHAP_LABEL[t]}`}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ):(
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      {workers.length===0&&(
                        operatorPerKartu?(
                          <button onClick={()=>{setOperatorModal({taskId:r.task.id,kode:r.kode});setTempPekerjaIds(idsKomp);}}
                            style={{fontSize:12,color:"#2563eb",fontWeight:700,background:"#eff6ff",border:"1.5px dashed #93c5fd",borderRadius:10,padding:"10px 12px",cursor:"pointer",textAlign:"center"}}>
                            + Pilih Operator
                          </button>
                        ):(
                          <div style={{fontSize:11,color:"#94a3b8",fontStyle:"italic",padding:"6px 0"}}>
                            {proses==="POTONG"?'Belum dimulai - klik "▶ Mulai Semua" di atas.':'Belum ada operator - klik "Pilih Operator" di atas.'}
                          </div>
                        )
                      )}
                      {workers.length>0&&proses==="POTONG"&&(
                        <div style={{display:"flex",flexWrap:"wrap",gap:6,alignItems:"center"}}>
                          {workers.map((w:any)=>(
                            <span key={w.id} style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:11,fontWeight:700,
                              color:DIVISI_CONFIG[w.divisi]?.color||"#64748b",background:DIVISI_CONFIG[w.divisi]?.bg||"#f1f5f9",
                              borderRadius:20,padding:"4px 10px"}}>
                              {DIVISI_CONFIG[w.divisi]?.icon} {w.nama}
                            </span>
                          ))}
                        </div>
                      )}
                      {workers.length>0&&proses!=="POTONG"&&(()=>{
                        const timerKeys=workers.map((w:any)=>timerKey(r.panelId,r.kode,proses,w.id));
                        const anyTimerRunning=timerKeys.some((k:string)=>!!timerAktif[k]);
                        const anyLoading=timerKeys.some((k:string)=>timerLoading===k);
                        let durasiLabel="";
                        const runningKey=timerKeys.find((k:string)=>timerAktif[k]);
                        if(runningKey){
                          const timer=timerAktif[runningKey];
                          const menitBerjalan=(Date.now()-new Date(timer.mulai).getTime())/60000;
                          const totalMenit=(timerDurasiSelesai[runningKey]||0)+menitBerjalan;
                          const jam=Math.floor(totalMenit/60);
                          const menit=Math.round(totalMenit%60);
                          const detik=Math.max(0,Math.round(totalMenit*60));
                          durasiLabel=jam>0?`${jam}j ${menit}m`:totalMenit>=1?`${menit}m`:`${detik}d`;
                        }
                        return(
                          <div style={{display:"flex",flexDirection:"column",gap:6}}>
                            <div style={{display:"flex",flexWrap:"wrap",gap:6,alignItems:"center"}}>
                              {workers.map((w:any)=>(
                                <span key={w.id} style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:11,fontWeight:700,
                                  color:DIVISI_CONFIG[w.divisi]?.color||"#64748b",background:DIVISI_CONFIG[w.divisi]?.bg||"#f1f5f9",
                                  borderRadius:20,padding:"4px 10px"}}>
                                  {DIVISI_CONFIG[w.divisi]?.icon} {w.nama}
                                </span>
                              ))}
                              {operatorPerKartu&&(
                                <button onClick={()=>{setOperatorModal({taskId:r.task.id,kode:r.kode});setTempPekerjaIds(idsKomp);}}
                                  style={{fontSize:10,color:"#64748b",fontWeight:700,background:"none",border:"1px dashed #cbd5e1",borderRadius:8,padding:"4px 8px",cursor:"pointer"}}>
                                  ✏️ Edit Operator
                                </button>
                              )}
                            </div>
                            <button disabled={anyLoading}
                              onClick={()=>{
                                if(anyTimerRunning){
                                  workers.forEach((w:any)=>{
                                    const k=timerKey(r.panelId,r.kode,proses,w.id);
                                    if(timerAktif[k])stopTimer(w.id,r.panelId,r.kode,proses);
                                  });
                                } else {
                                  workers.forEach((w:any)=>startTimer(w.id,r.panelId,r.kode,proses,viewDate));
                                }
                              }}
                              style={{fontSize:13,fontWeight:700,border:"none",borderRadius:10,padding:"12px 14px",minHeight:44,cursor:anyLoading?"not-allowed":"pointer",
                                background:anyTimerRunning?"#fef2f2":"#f0fdf4",color:anyTimerRunning?"#dc2626":"#16a34a"}}>
                              {anyLoading?"...":anyTimerRunning?`⏹ Selesai ${durasiLabel}`:"▶ Mulai"}
                            </button>
                          </div>
                        );
                      })()}
                      {/* HAPUS (7 Agu 2026): tombol Simpan Progress per-card individual dihapus KHUSUS
                          RENDAM/PAINTING - sistem Section (simpanSectionPaintingRendam, toolbar bulk di
                          atas) udah nyakup simpan semua komponen sekaligus dari r.pct yang sama persis,
                          2 cara simpan buat hal yang sama bikin operator bingung. Proses lain (BENDING/
                          STEL/FINISHING/RAKIT/dll) TETAP pakai tombol ini, gak ada flow section-nya. */}
                      {proses!=="POTONG"&&proses!=="RENDAM"&&proses!=="PAINTING"&&(()=>{
                        const flashKey=`${r.panelId}_${r.kode}_${proses}`;
                        const flashing=!!savedFlash[flashKey];
                        const disabledBtn=r.pct===0;
                        return(
                        <button disabled={disabledBtn} onClick={async()=>{
                            const berhasil=await lockSingleKomponen(r.panelId,r.kode,proses);
                            if(berhasil&&r.pct<100&&PROSES_FLASH_TERSIMPAN.includes(proses)){
                              setSavedFlash(prev=>({...prev,[flashKey]:true}));
                              setTimeout(()=>setSavedFlash(prev=>({...prev,[flashKey]:false})),1500);
                            }
                          }}
                          style={{fontSize:12,fontWeight:700,border:"none",borderRadius:10,padding:"12px 14px",minHeight:44,
                            cursor:disabledBtn?"not-allowed":"pointer",
                            background:flashing?"#16a34a":"#eff6ff",color:flashing?"#fff":"#1d4ed8"}}>
                          {flashing?"✅ Tersimpan":"💾 Simpan Progress"}
                        </button>
                        );
                      })()}
                    </div>
                    )}

                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                      <div style={{display:"flex",flexDirection:"column",gap:3}}>
                        <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                          {r.wpDef&&<span style={{background:r.wpDef.color+"18",color:r.wpDef.color,border:`1px solid ${r.wpDef.color}33`,borderRadius:4,padding:"1px 6px",fontSize:10,fontWeight:700}}>{r.wpDef.wp}</span>}
                          <span style={{background:STATUS_PIPELINE_STYLE[r.pipelineStatus as ProsesStatus].bg,color:STATUS_PIPELINE_STYLE[r.pipelineStatus as ProsesStatus].color,border:`1px solid ${STATUS_PIPELINE_STYLE[r.pipelineStatus as ProsesStatus].border}`,borderRadius:4,padding:"1px 6px",fontSize:9,fontWeight:700}}>{STATUS_PIPELINE_LABEL[r.pipelineStatus as ProsesStatus]}</span>
                          <span style={{fontWeight:700,fontSize:13,color:"#374151"}}>{renderNamaKomponen(r.item.nama)}</span>
                        </div>
                        <div style={{fontSize:11,fontWeight:600,color:"#64748b"}}>{r.task.proyek} · <span style={{color:"#334155",fontWeight:700}}>{r.panel.nama}</span></div>
                        <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                          <span style={{fontSize:10,color:"#94a3b8",fontFamily:"'DM Mono',monospace"}}>{r.kode}</span>
                          <Badge label={r.task.prioritas||"Sedang"} color={r.priColor}/>
                          {cardMode==='timer'&&r.wiringBadge&&(
                            <span style={{background:"#eef2ff",color:"#4f46e5",borderRadius:6,padding:"1px 6px",fontSize:9,fontWeight:700}}>
                              ⚡ {(r.wiringBadge.bobot||"").replace("_"," ")} · {r.wiringBadge.jumlahOrang||"–"}org
                            </span>
                          )}
                        </div>
                      </div>
                      {r.pct===100
                        ?<Badge label="TERCAPAI" color="#16a34a" bg="#dcfce7"/>
                        :r.pct===0
                        ?<Badge label="BELUM MULAI" color="#94a3b8" bg="#f1f5f9"/>
                        :<Badge label="ON PROGRESS" color="#2563eb" bg="#dbeafe"/>
                      }
                    </div>

                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,fontSize:10,color:"#64748b"}}>
                      <div>QTY KOMP: <b style={{color:"#475569"}}>{r.qtyKomp} 🔒</b></div>
                      <div>CREATE BY: <b style={{color:"#475569"}}>{kInfo.createdBy||"–"}</b></div>
                      <div>TARGET: <b style={{color:"#1d4ed8"}}>{fmtD(kInfo.targetSelesai)}</b></div>
                      <div>AKTUAL: <b style={{color:r.pct>=100?"#16a34a":"#94a3b8"}}>{r.pct>=100?fmtD(r.aktualSelesai):"–"}</b></div>
                    </div>

                    {/* Kartu tahap ASSEMBLING (Box Control/Pintu) DIHAPUS (7 Agu 2026) - pindah ke
                        tab "Komponen" terpisah (KomponenPasangView). PASANG KOMPONEN sekarang
                        fallback ke branch pct-mode di bawah (di-null-kan di situ juga - progress
                        Pasang Komponen full pindah ke tab baru, gak lagi diisi dari sini). */}
                    {cardMode==='qty'?(()=>{
                      const locked=isCellLocked(r.panelId,r.kode,proses);
                      const floor=getLockedFloor(r.panelId,r.kode,proses);
                      const qtyLocked=PROSES_QTY_LOCK_SEBELUM_MULAI.includes(proses)&&!r.sudahPernahMulai;
                      const lanjutanPct=(proses==="POTONG"||proses==="RENDAM"||proses==="PAINTING")?carryOverPct[`${proses}_${r.panelId}_${r.kode}`]:undefined;
                      return(
                        <>
                        {lanjutanPct!==undefined&&(
                          <div style={{marginBottom:6}}>
                            <span style={{fontSize:10,fontWeight:700,color:"#7c3aed",background:"#f5f3ff",border:"1px solid #ddd6fe",borderRadius:20,padding:"2px 8px"}}>
                              ↻ Lanjutan {lanjutanPct}%
                            </span>
                          </div>
                        )}
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          {locked?(
                            <span style={{padding:"7px 10px",borderRadius:8,border:"1.5px solid #16a34a",background:"#f0fdf4",fontSize:13,fontWeight:700,color:"#16a34a"}}>{r.qtyProses} 🔒</span>
                          ):(
                            <div style={{display:"flex",flexDirection:"column",gap:2,alignItems:"center"}}>
                              <input type="number" min={floor} max={r.qtyKomp} value={r.qtyProses===0?"":r.qtyProses}
                                onChange={(e:any)=>{
                                  if(PROSES_AUTO_ASSIGN_SAAT_QTY.includes(proses)&&!((r.task.pekerja_per_komponen||{})[r.kode]?.length)){
                                    startUntukUserSendiri(proses,[r]);
                                  }
                                  updateQtyProses(r.panelId,r.kode,proses,Number(e.target.value));
                                }}
                                disabled={r.qtyKomp===0||qtyLocked}
                                placeholder={qtyLocked?"–":undefined}
                                style={{width:78,minHeight:44,padding:"8px",borderRadius:8,
                                  border:`1.5px solid ${r.qtyKomp===0||qtyLocked?"#e2e8f0":floor>0?"#f59e0b":"#2563eb"}`,
                                  background:r.qtyKomp===0||qtyLocked?"#f8fafc":floor>0?"#fffbeb":"#eff6ff",
                                  fontSize:16,textAlign:"center",fontWeight:700,fontFamily:"'DM Mono',monospace",
                                  color:r.qtyKomp===0?"#cbd5e1":floor>0?"#b45309":"#1d4ed8"}}/>
                              {qtyLocked&&<span style={{fontSize:9,color:"#94a3b8",fontWeight:600,whiteSpace:"nowrap"}}>Klik Mulai dulu</span>}
                            </div>
                          )}
                          <div style={{flex:1,background:"#e2e8f0",borderRadius:99,height:8,overflow:"hidden"}}>
                            <div style={{width:`${r.pct}%`,height:"100%",background:pColor(r.pct),borderRadius:99}}/>
                          </div>
                          <span style={{fontWeight:800,color:pColor(r.pct),fontFamily:"'DM Mono',monospace",fontSize:13,minWidth:34}}>{r.pct}%</span>
                        </div>
                        </>
                      );
                    })():(isBusbarProses||proses==="PASANG KOMPONEN")?null:(()=>{
                      return(
                      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                        {PCT_STEPS.map((s:number)=>{
                          const reached=r.pct>=s;
                          const isNext=!done&&s===PCT_STEPS.find((x:number)=>x>r.pct);
                          const prevStep=PCT_STEPS[PCT_STEPS.indexOf(s)-1]||0;
                          return(
                            <button key={s} disabled={!bisaEdit}
                              onClick={()=>{if(bisaEdit)updatePctManual(r.panelId,r.kode,proses,reached?prevStep:s);}}
                              style={{flex:1,minWidth:40,padding:"9px 4px",borderRadius:8,border:"none",
                                cursor:bisaEdit?"pointer":"not-allowed",
                                background:reached?pColor(s):isNext?"#eff6ff":"#f1f5f9",
                                color:reached?"#fff":isNext?pc:"#94a3b8",
                                fontWeight:700,fontSize:11,outline:isNext&&bisaEdit?`2px solid ${pc}`:"none"}}>
                              {reached?"✓":`${s}%`}
                            </button>
                          );
                        })}
                      </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    })];
  })()}
</div>
            ):(
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead>
                  <tr>
                    <th style={{...thS,textAlign:"left",minWidth:40,position:"sticky",left:0,zIndex:4}}>NO</th>
                    <th style={{...thS,textAlign:"left",minWidth:100,position:"sticky",left:40,zIndex:4}}>PROYEK</th>
                    <th style={{...thS,textAlign:"left",minWidth:160,position:"sticky",left:140,zIndex:4}}>NAMA PANEL</th>
                    {false?(
                      <>
                        <th style={{...thS,minWidth:80}}>BOBOT</th>
                        <th style={{...thS,minWidth:60}}>ORANG</th>
                        <th style={{...thS,minWidth:100}}>CREATE BY</th>
                        <th style={{...thS,minWidth:100}}>CREATE ON</th>
                        <th style={{...thS,minWidth:110}}>TARGET SELESAI</th>
                        <th style={{...thS,minWidth:110}}>AKTUAL SELESAI</th>
                      </>
                    ):(
                      <>
                        <th style={{...thS,minWidth:50}}>WP</th>
                        <th style={{...thS,textAlign:"left",minWidth:160}}>KOMPONEN</th>
                        <th style={{...thS,minWidth:50}}>KODE</th>
                        <th style={{...thS,minWidth:70}}>PRIORITAS</th>
                        <th style={{...thS,minWidth:60}}>QTY KOMP</th>
                        {isQtyBased&&<th style={{...thS,minWidth:70}}>QTY PROSES</th>}
                        <th style={{...thS,minWidth:100}}>CREATE BY</th>
                        <th style={{...thS,minWidth:100}}>CREATE ON</th>
                        <th style={{...thS,minWidth:110}}>TARGET SELESAI</th>
                        <th style={{...thS,minWidth:110}}>AKTUAL SELESAI</th>
                      </>
                    )}
                    <th style={{...thS,minWidth:70}}>PROGRESS</th>
                    <th style={{...thS,textAlign:"left",minWidth:140}}>OPERATOR</th>
                    {!isWiringProses&&!isQtyBased&&PCT_STEPS.map(s=>(
                      <th key={s} style={{...thS,minWidth:50,borderBottom:`2px solid ${pc}`}}>{s}%</th>
                    ))}
                    {isWiringProses&&PCT_STEPS.map(s=>(
                      <th key={s} style={{...thS,minWidth:50,borderBottom:`2px solid ${pc}`}}>{s}%</th>
                    ))}
                    <th style={{...thS,minWidth:80}}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((r:any,ri:number)=>{
                    const done=isDone(r);
                    const rBg=done?"#f0fdf4":ri%2===0?"#fff":"#f8fafc";
                    const td:any={padding:"6px 8px",borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",
                      background:rBg,verticalAlign:"middle"};
                    const isLockedRow=r.pipelineStatus==="NOT YET"&&!rowHasActiveTimer(r);
                    return(
                      <tr key={`${r.task.id}-${r.kode}`}
                        style={isLockedRow?{opacity:0.55,pointerEvents:"none" as const}:undefined}>
                        <td style={{...td,position:"sticky",left:0,zIndex:1,textAlign:"center",fontFamily:"'DM Mono',monospace",color:"#94a3b8",fontWeight:700}}>{ri+1}</td>
                        <td style={{...td,position:"sticky",left:40,zIndex:1,fontWeight:600,fontSize:11,color:"#475569",whiteSpace:"nowrap"}}>
                          {(()=>{
                            const urg=getUrgensi(r.task.wo_id||r.task.woId);
                            const warnaMap:Record<string,{bg:string,color:string}>={
                              telat:{bg:"#fef2f2",color:"#dc2626"},
                              mendesak:{bg:"#fff7ed",color:"#ea580c"},
                              perhatian:{bg:"#fefce8",color:"#ca8a04"},
                              normal:{bg:"",color:""},
                            };
                            const w=warnaMap[urg.level];
                            return(
                              <div style={{display:"flex",flexDirection:"column",gap:2}}>
                                <span>{r.task.proyek}</span>
                                {urg.label&&urg.level!=="normal"&&(
                                  <span style={{fontSize:8,fontWeight:700,background:w.bg,color:w.color,borderRadius:4,padding:"1px 5px",width:"fit-content"}}>
                                    {urg.level==="telat"?"⚠️ ":"⏰ "}{urg.label}
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td style={{...td,position:"sticky",left:140,zIndex:1,fontWeight:600,fontSize:11,color:"#1e293b",whiteSpace:"nowrap"}}>
                          <span style={{fontSize:10,color:"#94a3b8",marginRight:4}}>#{r.panel.no_pnl||r.panel.noPnl}</span>{r.panel.nama}
                          {r.task.carryOver&&r.isFirst&&(
                            <span style={{marginLeft:6,background:"#fef9c3",border:"1px solid #fde047",color:"#92400e",
                              borderRadius:4,padding:"1px 6px",fontSize:9,fontWeight:700}}>↩ Lanjutan</span>
                          )}
                        </td>
                        {false?(()=>{
                          const wInfo=wiringInfoMap[`${r.panelId}_${proses}`]||{};
                          const BOBOT_COLOR:any={EASY:"#16a34a",MEDIUM:"#d97706",HARD:"#dc2626",VERY_HARD:"#7c3aed"};
                          const bc=BOBOT_COLOR[wInfo.bobot]||"#6366f1";
                          const fmtDate=(d:string)=>d?new Date(d).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"}):"-";
                          return(
                            <>
                              <td style={{...td,textAlign:"center"}}>
                                <span style={{background:bc+"18",color:bc,border:`1px solid ${bc}33`,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700}}>
                                  {(wInfo.bobot||"–").replace("_"," ")}
                                </span>
                              </td>
                              <td style={{...td,textAlign:"center",fontWeight:700,color:"#475569"}}>{wInfo.jumlahOrang||"–"} org</td>
                              <td style={{...td,fontSize:10,color:"#475569"}}>{wInfo.createdBy||"–"}</td>
                              <td style={{...td,fontSize:10,color:"#64748b"}}>{fmtDate(wInfo.createdAt)}</td>
                              <td style={{...td,fontSize:10,fontWeight:600,color:"#1d4ed8"}}>{fmtDate(wInfo.targetSelesai)}</td>
                              <td style={{...td,fontSize:10,fontWeight:600,color:r.pct>=100?"#16a34a":"#94a3b8"}}>{r.pct>=100?fmtDate(r.aktualSelesai):"-"}</td>
                            </>
                          );
                        })():(
                          <>
                            <td style={{...td,textAlign:"center"}}>
                              <div style={{display:"flex",flexDirection:"column",gap:2,alignItems:"center"}}>
                                {r.wpDef&&<span style={{background:r.wpDef.color+"18",color:r.wpDef.color,border:`1px solid ${r.wpDef.color}33`,borderRadius:4,padding:"1px 6px",fontSize:10,fontWeight:700}}>{r.wpDef.wp}</span>}
                                <span style={{background:STATUS_PIPELINE_STYLE[r.pipelineStatus as ProsesStatus].bg,color:STATUS_PIPELINE_STYLE[r.pipelineStatus as ProsesStatus].color,border:`1px solid ${STATUS_PIPELINE_STYLE[r.pipelineStatus as ProsesStatus].border}`,borderRadius:4,padding:"1px 6px",fontSize:9,fontWeight:700,whiteSpace:"nowrap" as const}}>{STATUS_PIPELINE_LABEL[r.pipelineStatus as ProsesStatus]}</span>
                              </div>
                            </td>
                            <td style={{...td,fontWeight:600,color:"#374151",whiteSpace:"nowrap"}}>
                              {renderNamaKomponen(r.item.nama)}
                              {r.wiringBadge&&(()=>{
                                const BOBOT_COLOR:any={EASY:"#16a34a",MEDIUM:"#d97706",HARD:"#dc2626",VERY_HARD:"#7c3aed"};
                                const bc=BOBOT_COLOR[r.wiringBadge.bobot]||"#6366f1";
                                return(
                                  <span style={{marginLeft:6,background:bc+"18",color:bc,border:`1px solid ${bc}33`,borderRadius:6,padding:"1px 6px",fontSize:9,fontWeight:700,whiteSpace:"nowrap"}}>
                                    ⚡ {(r.wiringBadge.bobot||"").replace("_"," ")} · {r.wiringBadge.jumlahOrang||"–"}org
                                  </span>
                                );
                              })()}
                            </td>
                            <td style={{...td,textAlign:"center",fontFamily:"'DM Mono',monospace",fontSize:10,color:"#94a3b8"}}>{r.kode}</td>
                            <td style={{...td,textAlign:"center"}}>
                              <Badge label={r.task.prioritas||"Sedang"} color={r.priColor}/>
                            </td>
                            <td style={{...td,textAlign:"center"}}>
                              <span style={{fontWeight:800,fontFamily:"'DM Mono',monospace",color:r.qtyKomp===0?"#fca5a5":"#475569",
                                background:r.qtyKomp===0?"#fef2f2":"#f1f5f9",borderRadius:6,padding:"3px 8px",fontSize:12}}>
                                {r.qtyKomp} 🔒
                              </span>
                            </td>
                            {(()=>{
                              const kInfo=r.wiringBadge||komponenInfoMap[`${r.panelId}_${proses}_${r.kode}`]||{};
                              const fmtDate=(d:string)=>d?new Date(d).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"}):"–";
                              const locked=isCellLocked(r.panelId,r.kode,proses);
                              const floor=getLockedFloor(r.panelId,r.kode,proses);
                              const qtyLocked=PROSES_QTY_LOCK_SEBELUM_MULAI.includes(proses)&&!r.sudahPernahMulai;
                              return(
                                <>
                                  {isQtyBased&&(
                                    <td style={{...td,textAlign:"center"}}>
                                      {locked?(
                                        <span style={{width:60,padding:"4px 6px",borderRadius:7,border:"1.5px solid #16a34a",
                                          background:"#f0fdf4",fontSize:12,textAlign:"center",fontWeight:700,
                                          fontFamily:"'DM Mono',monospace",color:"#16a34a",display:"inline-block"}}>
                                          {r.qtyProses} 🔒
                                        </span>
                                      ):(
                                        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                                          <input type="number" min={floor} max={r.qtyKomp} value={r.qtyProses===0?"":r.qtyProses}
                                            onChange={e=>{
                                              if(PROSES_AUTO_ASSIGN_SAAT_QTY.includes(proses)&&!((r.task.pekerja_per_komponen||{})[r.kode]?.length)){
                                                startUntukUserSendiri(proses,[r]);
                                              }
                                              updateQtyProses(r.panelId,r.kode,proses,Number(e.target.value));
                                            }}
                                            disabled={r.qtyKomp===0||qtyLocked}
                                            placeholder={qtyLocked?"–":undefined}
                                            style={{width:60,padding:"4px 6px",borderRadius:7,
                                              border:`1.5px solid ${r.qtyKomp===0||qtyLocked?"#e2e8f0":floor>0?"#f59e0b":"#2563eb"}`,
                                              background:r.qtyKomp===0||qtyLocked?"#f8fafc":floor>0?"#fffbeb":"#eff6ff",
                                              fontSize:12,textAlign:"center",fontWeight:700,
                                              fontFamily:"'DM Mono',monospace",
                                              color:r.qtyKomp===0?"#cbd5e1":floor>0?"#b45309":"#1d4ed8"}}/>
                                          {qtyLocked?(
                                            <span style={{fontSize:9,color:"#94a3b8",fontWeight:600,whiteSpace:"nowrap"}}>Klik Mulai dulu</span>
                                          ):floor>0&&<span style={{fontSize:9,color:"#f59e0b",fontWeight:700}}>min {floor} 🔒</span>}
                                        </div>
                                      )}
                                    </td>
                                  )}
                                  <td style={{...td,fontSize:10,color:"#475569"}}>{kInfo.createdBy||"–"}</td>
                                  <td style={{...td,fontSize:10,color:"#64748b"}}>{fmtDate(kInfo.createdAt)}</td>
                                  <td style={{...td,fontSize:10,fontWeight:600,color:"#1d4ed8"}}>{fmtDate(kInfo.targetSelesai)}</td>
                                  <td style={{...td,fontSize:10,fontWeight:600,color:r.pct>=100?"#16a34a":"#94a3b8"}}>{r.pct>=100?fmtDate(r.aktualSelesai):"–"}</td>
                                </>
                              );
                            })()}
                          </>
                        )}
                        <td style={{...td,textAlign:"center"}}>
                          {isQtyBased?(
                            <div style={{display:"flex",alignItems:"center",gap:5,justifyContent:"center"}}>
                              <div style={{width:50,background:"#e2e8f0",borderRadius:99,height:5,overflow:"hidden"}}>
                                <div style={{width:`${r.pct}%`,height:"100%",background:pColor(r.pct),borderRadius:99}}/>
                              </div>
                              <span style={{fontWeight:800,color:pColor(r.pct),fontFamily:"'DM Mono',monospace",fontSize:11,minWidth:28}}>{r.pct}%</span>
                            </div>
                          ):(
                            <span style={{fontWeight:800,color:pColor(r.pct),fontFamily:"'DM Mono',monospace",fontSize:11}}>{r.pct}%</span>
                          )}
                        </td>
                        {/* OPERATOR */}
                        <td style={{...td,verticalAlign:"middle"}}>
                          {(()=>{
                            const idsKomp=(r.task.pekerja_per_komponen||{})[r.kode]||[];
                            const workers=idsKomp
                              .map((id:number)=>pekerjaList.find((p:any)=>p.id===id))
                              .filter(Boolean);
                            return(
                              <div style={{display:"flex",flexDirection:"column",gap:3}}>
                                {workers.map((w:any)=>{
                                  const key=`${r.panelId}_${r.kode}_${proses}_${w.id}`;
                                  const timer=timerAktif[key];
                                  const loading=timerLoading===key;
                                  let durasiLabel="";
                                  if(timer){
                                    const menitBerjalan=(Date.now()-new Date(timer.mulai).getTime())/60000;
                                    const totalMenit=(timerDurasiSelesai[key]||0)+menitBerjalan;
                                    const jam=Math.floor(totalMenit/60);
                                    const menit=Math.round(totalMenit%60);
                                    const detik=Math.max(0,Math.round(totalMenit*60));
                                    durasiLabel=jam>0?`${jam}j ${menit}m`:totalMenit>=1?`${menit}m`:`${detik}d`;
                                  }
                                  return(
                                    <div key={w.id} style={{display:"flex",alignItems:"center",gap:5,
                                      background:DIVISI_CONFIG[w.divisi]?.bg||"#f1f5f9",
                                      borderRadius:20,padding:"2px 6px 2px 8px",whiteSpace:"nowrap"}}>
                                      <span style={{fontSize:10}}>{DIVISI_CONFIG[w.divisi]?.icon}</span>
                                      <span style={{fontSize:10,fontWeight:700,color:DIVISI_CONFIG[w.divisi]?.color||"#64748b"}}>{w.nama}</span>
                                      <button disabled={loading||proses==="BUSBAR"}
                                        title={proses==="BUSBAR"?"BUSBAR (per-tahap) cuma bisa dikerjakan lewat mobile":undefined}
                                        onClick={()=>timer?stopTimer(w.id,r.panelId,r.kode,proses):startTimer(w.id,r.panelId,r.kode,proses,viewDate)}
                                        style={{fontSize:8,fontWeight:700,border:"none",borderRadius:10,padding:"2px 6px",cursor:(loading||proses==="BUSBAR")?"not-allowed":"pointer",
                                          background:timer?"#fef2f2":"#f0fdf4",color:timer?"#dc2626":"#16a34a"}}>
                                        {loading?"...":proses==="BUSBAR"?"📱 Mobile":timer?`⏹ ${durasiLabel}`:"▶ Mulai"}
                                      </button>
                                    </div>
                                  );
                                })}
                                {proses!=="POTONG"&&(
                                  <button onClick={()=>{setOperatorModal({taskId:r.task.id,kode:r.kode});setTempPekerjaIds(idsKomp);}}
                                    style={{fontSize:9,color:"#94a3b8",fontWeight:600,background:"none",border:"1px dashed #cbd5e1",borderRadius:8,padding:"2px 6px",cursor:"pointer"}}>
                                    {workers.length>0?"+ Edit":"+ Pilih Operator"}
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        {/* STEP checkmarks */}
                        {!isQtyBased&&(()=>{
                          const bisaEdit=canEditProgressKomponen(r.task,r.kode,r.panelId,proses);
                          return PCT_STEPS.map(s=>{
                          const reached=r.pct>=s;
                          const isNext=!done&&s===PCT_STEPS.find(x=>x>r.pct);
                          const prevStep=PCT_STEPS[PCT_STEPS.indexOf(s)-1]||0;
                          return(
                            <td key={s} style={{...td,textAlign:"center",padding:"4px",
                              background:reached?pBg(s)+"cc":rBg,opacity:bisaEdit?1:0.4}}>
                              <button disabled={!bisaEdit}
                                onClick={()=>{if(bisaEdit)updatePctManual(r.panelId,r.kode,proses,reached?prevStep:s);}}
                                title={!bisaEdit?(proses==="PACKING"?"QC checklist belum lolos semua":"Pilih operator dan klik Mulai dulu"):reached?`Batalkan ${s}%`:`Set ${s}%`}
                                style={{width:22,height:22,borderRadius:5,border:"none",cursor:bisaEdit?"pointer":"not-allowed",
                                  background:reached?pColor(s):isNext?"#eff6ff":"transparent",
                                  display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto",
                                  outline:isNext&&bisaEdit?`2px solid ${pc}`:"none",transition:"all .12s"}}>
                                {reached
                                  ?<span style={{color:"#fff",fontSize:12,fontWeight:700}}>✓</span>
                                  :isNext?<span style={{color:pc,fontSize:11,fontWeight:700}}>→</span>
                                  :<span style={{color:"#e2e8f0",fontSize:11}}>·</span>
                                }
                              </button>
                            </td>
                          );
                          });
                        })()}
                        <td style={{...td,textAlign:"center"}}>
                          {r.pct===100
                            ?<Badge label="TERCAPAI" color="#16a34a" bg="#dcfce7"/>
                            :r.pct===0
                            ?<Badge label="BELUM MULAI" color="#94a3b8" bg="#f1f5f9"/>
                            :<Badge label="ON PROGRESS" color="#2563eb" bg="#dbeafe"/>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            )}
            {/* catatan per proses */}
            <div style={{padding:"12px 16px",borderTop:"1px solid #f1f5f9",background:"#fafafa"}}>
              <div style={{fontSize:11,fontWeight:700,color:"#64748b",marginBottom:6}}>📝 CATATAN {proses}</div>
              <div style={{display:"flex",gap:8}}>
                <input value={catatan[proses]||""} onChange={e=>setCatatan(prev=>({...prev,[proses]:e.target.value}))}
                  placeholder={`Catatan kendala untuk ${proses}...`}
                  style={{flex:1,padding:"7px 12px",borderRadius:8,border:"1.5px solid #e2e8f0",
                    background:"#fff",fontSize:12,color:"#1e293b"}}/>
                <Btn color={cfg.color} style={{padding:"7px 16px",fontSize:12}}
                  onClick={()=>{
                    setSavedNote(prev=>({...prev,[proses]:true}));
                    setTimeout(()=>setSavedNote(prev=>({...prev,[proses]:false})),2000);
                  }}>
                  {savedNote[proses]?"✓ Terkirim":"Simpan"}
                </Btn>
              </div>
            </div>
          </Card>
        );
      })}

      {/* Band "Kontribusi Pasang Komponen" DIHAPUS (7 Agu 2026) - pindah ke tab "Komponen"
          terpisah (KomponenPasangView), lihat App.tsx. Data yang dibaca/ditulis SAMA PERSIS
          (checklist[kode].pasangKomponenTahap.WIRING, fotoPemasangan) - gak ada migrasi data. */}

      {/* TOMBOL KUNCI PROGRESS */}
      {todayTasks.length>0&&(
        <div style={{marginTop:16,marginBottom:8}}>
          <button onClick={lockProgress}
            style={{width:"100%",padding:"14px",borderRadius:12,border:"none",
              cursor:"pointer",fontWeight:800,fontSize:14,
              background:lockMsg||pernahDikunci?"#16a34a":"#1d4ed8",color:"#fff",
              boxShadow:"0 4px 14px #2563eb33",transition:"all .2s",
              display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            {lockMsg?"✅ Progress hari ini berhasil dikunci & tersimpan!":pernahDikunci?"✅ Sudah Dikunci — Kunci Ulang":"🔒 Kunci Progress Hari Ini"}
          </button>
          <div style={{fontSize:11,color:"#94a3b8",textAlign:"center",marginTop:8,lineHeight:1.5}}>
            Klik di akhir shift untuk menyimpan progress hari ini sebagai catatan permanen.<br/>
            Bisa diklik lagi jika ada update di shift berikutnya (tersimpan terpisah).
          </div>
        </div>
      )}

      {operatorModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:200,
          display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
          onClick={()=>setOperatorModal(null)}>
          <div style={{background:"#fff",borderRadius:14,border:"1.5px solid #e2e8f0",padding:20,width:"100%",maxWidth:380,maxHeight:"80vh",overflowY:"auto"}}
            onClick={(e:any)=>e.stopPropagation()}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10,marginBottom:4}}>
              <div style={{fontWeight:800,fontSize:16,color:"#1e293b"}}>Pilih Operator</div>
              <button onClick={()=>setOperatorModal(null)}
                style={{flexShrink:0,width:26,height:26,borderRadius:99,border:"none",background:"#f1f5f9",color:"#64748b",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700}}>×</button>
            </div>
            <div style={{fontSize:11,color:"#94a3b8",marginBottom:14}}>Bisa pilih lebih dari satu orang</div>
            <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:16}}>
              {pekerjaList.filter((p:any)=>p.divisi===user.divisi).map((p:any)=>{
                const checked=tempPekerjaIds.includes(p.id);
                return(
                  <label key={p.id} style={{display:"flex",alignItems:"center",gap:10,border:`1.5px solid ${checked?"#2563eb":"#e2e8f0"}`,
                    borderRadius:10,padding:"10px 12px",cursor:"pointer",background:checked?"#eff6ff":"#fff"}}>
                    <input type="checkbox" checked={checked}
                      onChange={()=>setTempPekerjaIds(prev=>checked?prev.filter(id=>id!==p.id):[...prev,p.id])}/>
                    <span style={{fontSize:13,fontWeight:600,color:"#1e293b"}}>{p.nama}</span>
                    {terakhirKerjaPekerjaId===p.id&&(
                      <span title="Terakhir kerja komponen ini" style={{width:8,height:8,borderRadius:99,background:"#eab308",marginLeft:"auto"}}/>
                    )}
                  </label>
                );
              })}
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setOperatorModal(null)}
                style={{flex:1,padding:"10px",borderRadius:10,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#64748b",fontWeight:700,fontSize:13,cursor:"pointer"}}>Batal</button>
              <button onClick={async()=>{
                  if(operatorModal.tahap)await updateOperatorBusbarTahap(operatorModal.taskId,operatorModal.kode,operatorModal.tahap,tempPekerjaIds);
                  else await updatePekerjaPerKomponen(operatorModal.taskId,operatorModal.kode,tempPekerjaIds);
                  setOperatorModal(null);
                }}
                style={{flex:1,padding:"10px",borderRadius:10,border:"none",background:"#2563eb",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
