import { useState, useEffect, lazy, Suspense } from "react";
import { supabase } from "./lib/supabase";
import { isPushSupported, getPushPermissionState, subscribeToPush } from "./lib/pushNotif";
import { TODAY, addDays } from "./lib/dateHelpers";
import { useDateRollover } from "./lib/dateRollover";
import { DIVISI_CONFIG } from "./lib/panelTypes";
import { GCss } from "./lib/globalCss";
import { KoneksiBadge } from "./components/ui/Primitives";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import { LandingPage } from "./components/LandingPage";
import { Login } from "./components/Login";
import { ArsipSeksiView } from "./components/ArsipSeksiView";
import { ArsipQCView } from "./components/ArsipQCView";
import { NameplateView } from "./components/NameplateView";
import { QCChecklistTab } from "./components/QCChecklistTab";
import { KomponenProgressView } from "./components/KomponenProgressView";
import { KomponenPasangView, type KomponenPasangTugas } from "./components/KomponenPasangView";
import { PermintaanView } from "./components/PermintaanView";
import { GudangHome } from "./components/GudangHome";
import { OperatorView } from "./components/OperatorView";
import { ReviewPotongView } from "./components/ReviewPotongView";
import { ReviewPaintingView } from "./components/ReviewPaintingView";
import { RiwayatKerjaView } from "./components/RiwayatKerjaView";
import { KomponenTambahanView } from "./components/KomponenTambahanView";
import { JadwalPengirimanView } from "./components/JadwalPengirimanView";
import { ProsesAktifView } from "./components/ProsesAktifView";
// Lazy (30 Agu 2026) - MomFatView bawa tesseract.js+pdfjs-dist (~460KB), cuma dipakai QC.
// Kalau di-static-import kayak komponen lain, SEMUA divisi (mekanik/painting/dll yang gak
// pernah pakai fitur ini) ikut download library OCR ini di setiap page load - sia-sia.
const MomFatView = lazy(() => import("./components/MomFatView").then(m => ({ default: m.MomFatView })));
import { AkunView } from "./components/AkunView";
import { ProyekLuarView } from "./components/ProyekLuarView";
import { WoDigitalView } from "./components/WoDigitalView";
// Sprint 5-7 (5 Agu 2026): seluruh komponen/const yang tadinya nempel di App.tsx dipindah
// keluar ke src/lib/ dan src/components/ - struktur/nama fungsi/isi PERSIS SAMA, cuma
// lokasinya pindah. App.tsx sekarang murni shell (routing halaman + header/nav).

// QS - gaya sama persis Nameplate/Yellowmark (Fabrikasi % + Pemasangan Foto per panel), cuma 1
// tugas (bukan sepasang) dan bucket foto sendiri. TUGAS_WAREHOUSE (pasangannya) dihapus 14 Agu
// 2026 bareng login komponen>Warehouse - fungsinya sudah full pindah ke tab "Progress" login
// "Gudang" (lihat TUGAS_WAREHOUSE_GUDANG di GudangHome.tsx, value-nya identik).
const TUGAS_QS={field:"qs",label:"QS",icon:"📋",color:"#7c3aed",progressField:"qs_progress" as const,fotoField:"qs_photos",historyField:"qs_history",updatedByField:"qs_updated_by",updatedAtField:"qs_updated_at",bucket:"qs-photos"};

// Tab "Komponen" (GANTI section "Kontribusi Pasang Komponen" yang dulu nempel di card
// OperatorView, 7 Agu 2026) - pola navigasi SAMA PERSIS Tab QS di atas, tapi per-komponen bukan
// per-panel (lihat KomponenPasangView.tsx).
const TUGAS_KOMPONEN_WIRING:KomponenPasangTugas={seksi:"wiring_control",label:"Komponen",icon:"🔌",color:"#6366f1",tahap:"WIRING",fotoBucket:"wiring-komponen-photos"};
const TUGAS_KOMPONEN_ASSEMBLING:KomponenPasangTugas={seksi:"assembling_luar",label:"Komponen",icon:"🔧",color:"#059669",tahap:"ASSEMBLING",fotoBucket:"pasang-komponen-photos"};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
export default function App(){
  const hasDateRolled=useDateRollover();
  const [user,setUser]=useState<any>(()=>{
    try{
      const saved=localStorage.getItem("vista_pekerja_session");
      return saved?JSON.parse(saved):null;
    }catch{return null;}
  });
  const [page,setPage]=useState<string>(()=>{
    try{
      return localStorage.getItem("vista_pekerja_session")?"app":"landing";
    }catch{return "landing";}
  });

  const cfg=user?DIVISI_CONFIG[user.divisi]:null;
  // Jam real-time di header profil (restyle 29 Agu 2026) - update tiap detik, dipasang di top
  // level (bukan di dalam blok "if(!user)" dkk di bawah) karena hooks React gak boleh kondisional.
  const [jamSekarang,setJamSekarang]=useState(()=>new Date());
  useEffect(()=>{
    const t=setInterval(()=>setJamSekarang(new Date()),1000);
    return()=>clearInterval(t);
  },[]);
  const [viewMode,setViewMode]=useState<"desktop"|"mobile">(()=>{
    try{return (localStorage.getItem("vista_pekerja_viewmode") as any)||"desktop";}catch{return "desktop";}
  });
  const toggleViewMode=()=>{
    const next=viewMode==="desktop"?"mobile":"desktop";
    setViewMode(next);
    try{localStorage.setItem("vista_pekerja_viewmode",next);}catch{}
  };
  // "gudang" (13 Agu 2026) - login baru full-mobile 5-tab, sengaja dikecualikan sama seperti
  // nameplate/qc/komponen (gak butuh/gak boleh toggle desktop-mobile, UI-nya sendiri sudah
  // punya bottom-nav 5-tab terpisah - lihat GudangHome.tsx).
  const isOperatorDivisi=user&&!["nameplate","qc","komponen","gudang"].includes(user.divisi);

  // Gate pilih shift SETELAH login SEBELUM grid (restyle 29 Agu 2026) - cuma buat divisi operator
  // biasa (isOperatorDivisi), nameplate/qc/komponen/gudang gak butuh konsep shift sama sekali.
  // SENGAJA baca/tulis localStorage pakai KEY & FORMAT YANG PERSIS SAMA dengan state internal
  // OperatorView.tsx (wsKey/hariKerjaAwal/shift/shiftSet, lihat OperatorView.tsx:34-138) - BUKAN
  // reimplementasi, cuma baca kontrak localStorage yang sama dari luar. Begitu gate ini nulis
  // shiftSet:true ke key itu, useState initializer OperatorView.tsx otomatis baca shiftSet:true
  // duluan pas dia mount, jadi gate INTERNAL-nya sendiri (baris 1498-1532 di sana) otomatis
  // ke-skip tanpa OperatorView.tsx perlu diubah SAMA SEKALI - zero risk ke logic shift-lewat-
  // tengah-malam yang sudah teruji di file itu. "Ganti Shift" pas lagi di dalam Tugas Saya TETAP
  // pakai tombol internal OperatorView.tsx yang sudah ada (gak disentuh) - badge Shift di header
  // di bawah cuma affordance tambahan buat reset ulang gate ini dari luar.
  const wsKey=user?`vista_pekerja_ws_${user.divisi}_${user.sub_bagian||""}_${user.id||user.username||user.nama||""}`:"";
  const hariKerjaAwal=(()=>{
    if(!wsKey)return TODAY;
    try{
      const saved=JSON.parse(localStorage.getItem(wsKey)||"{}");
      const jamNow=new Date().getHours();
      const kemarin=addDays(TODAY,-1);
      if(jamNow<7&&saved.shift==="2"&&saved.tanggal===kemarin)return kemarin;
    }catch{}
    return TODAY;
  })();
  const [gateShift,setGateShift]=useState(()=>{
    if(!wsKey)return "1";
    try{
      const saved=JSON.parse(localStorage.getItem(wsKey)||"{}");
      return saved.tanggal===hariKerjaAwal&&saved.shift?saved.shift:"1";
    }catch{return "1";}
  });
  const [gateShiftSet,setGateShiftSet]=useState(()=>{
    if(!wsKey)return false;
    try{
      const saved=JSON.parse(localStorage.getItem(wsKey)||"{}");
      return saved.tanggal===hariKerjaAwal?!!saved.shiftSet:false;
    }catch{return false;}
  });
  const mulaiKerja=()=>{
    setGateShiftSet(true);
    try{localStorage.setItem(wsKey,JSON.stringify({tanggal:hariKerjaAwal,shift:gateShift,shiftSet:true}));}catch{}
  };

  // Tab bawah "Arsip" - cuma muncul buat divisi/sub_bagian yang punya seksi arsip otomatis
  // (QS/QC/Assembling Luar/Wiring Control/Nameplate - "Warehouse" DIHAPUS 14 Agu 2026 bareng
  // login komponen>Warehouse). Assembling Luar dan Wiring Control DIPISAH jadi 2 seksi arsip
  // independen (6 Agu 2026) - dua-duanya divisi terpisah, handle komponen sendiri (Assembling
  // Luar: pasang_komponen_photos per-panel; Wiring Control: fotoPemasangan per-kode), hasil
  // sendiri, gak saling nunggu buat diarsipkan. Sebelumnya dua-duanya baca seksi gabungan
  // 'pasang_komponen' - itu bikin kode yang salah satu sisinya gak pernah dapet task jadi stuck
  // selamanya nunggu sisi yang gak akan pernah diisi.
  // "nameplate" (17 Agu 2026) - trigger arsip-nya SENGAJA fungsi/trigger TERPISAH
  // (panels_auto_archive_nameplate(), bukan nempel di panels_auto_archive_seksi() yang lama)
  // biar nol risiko ke logic seksi lain yang sudah ada - lihat migration
  // 20260817020000_panel_seksi_archived_nameplate.sql. ArsipSeksiView.tsx gak perlu diubah sama
  // sekali - payload data-nya pakai key "photos" yang sama kayak QS, otomatis kebaca lewat
  // fallback generik yang sudah ada.
  const arsipSeksi:string|null=!user?null
    :user.divisi==="qc"?"qc"
    :user.divisi==="komponen"&&user.sub_bagian==="QS"?"qs"
    :user.divisi==="assembling"&&user.sub_bagian==="Assembling Luar"?"assembling_luar"
    :user.divisi==="wiring_ctrl"?"wiring_control"
    :user.divisi==="nameplate"?"nameplate"
    :null;
  // Tab "Komponen" (7 Agu 2026) - cuma Wiring Control dan Assembling Luar, GANTI section
  // "Kontribusi Pasang Komponen" yang dulu nempel di card OperatorView.
  const komponenPasangTugas:KomponenPasangTugas|null=!user?null
    :user.divisi==="wiring_ctrl"?TUGAS_KOMPONEN_WIRING
    :user.divisi==="assembling"&&user.sub_bagian==="Assembling Luar"?TUGAS_KOMPONEN_ASSEMBLING
    :null;

  // GRID MENU (restyle 29 Agu 2026, GANTI bottom-nav tab lama) - null = tampilkan grid, string =
  // halaman yang lagi dibuka (tombol "Kembali" reset ke null). Dipisah dari OperatorHome.tsx
  // (yang sebelumnya jadi tab-switcher SENDIRI di dalam tab "Tugas Saya") - sekarang App.tsx jadi
  // SATU-SATUNYA router, tiap sub-tab lama (Review/Riwayat/Tambahan) jadi tile grid tersendiri,
  // konsisten sama pola nameplate/qc/komponen yang sudah lebih dulu di-routing langsung dari sini.
  // OperatorHome.tsx TIDAK dihapus (masih ada filenya), cuma berhenti dipakai.
  // FIX (1 Sep 2026) - iOS standalone PWA (di-install ke home screen) sering RELOAD TOTAL
  // halaman ini begitu user balik dari Safari (window.open buat lihat PDF WO Digital, misalnya)
  // - manajemen memori background OS, bukan sesuatu yang bisa dicegah dari kode. Tanpa
  // persist, selectedMenu reset ke null (Beranda) tiap kali itu kejadian, padahal user cuma
  // mau balik ke menu yang lagi dibuka. Simpan ke localStorage, restore pas mount - divalidasi
  // ulang begitu menuTiles ke-hitung (efek di bawah) biar gak nyangkut di tile yang gak valid
  // buat divisi user ini. Dibersihkan pas logout (lihat doLogout) biar user lain di device yang
  // sama gak mulai di tile milik user sebelumnya.
  const [selectedMenu,setSelectedMenu]=useState<string|null>(()=>{
    try{return localStorage.getItem("vista_pekerja_selected_menu")||null;}catch{return null;}
  });
  const bisaReviewPotong=user?.divisi==="mekanik"&&user?.sub_bagian==="Potong";
  const bisaReviewPainting=user?.divisi==="painting";
  const prosesRiwayat:string[]=cfg?.subBagianProses?.[user?.sub_bagian]||cfg?.proses||[];

  // Ikon tile grid pakai Tabler Icons (polish 29 Agu 2026, GANTI emoji) - konsisten sama font
  // ikon yang SUDAH dipakai luas di komponen lain (QCChecklistTab/NameplateView/dll, className
  // "ti ti-*"). CATATAN: field ini terpisah dari `cfg.icon`/`komponenPasangTugas.icon` (tetap
  // emoji, JANGAN diubah - dipakai literal sbg teks di badge header & KomponenPasangView.tsx:431).
  type MenuTile={key:string,label:string,icon:string};
  const menuTiles:MenuTile[]=!user?[]:(()=>{
    if(user.divisi==="nameplate")return[
      {key:"tugas",label:"Nameplate",icon:"tag"},
      ...(arsipSeksi?[{key:"arsip",label:"Arsip",icon:"archive"}]:[]),
      {key:"permintaan",label:"Permintaan",icon:"clipboard-text"},
      {key:"wodigital",label:"WO Digital",icon:"file-type-pdf"},
    ];
    if(user.divisi==="qc")return[
      {key:"tugas",label:"QC",icon:"search"},
      ...(arsipSeksi?[{key:"arsip",label:"Arsip",icon:"archive"}]:[]),
      {key:"permintaan",label:"Permintaan",icon:"clipboard-text"},
      {key:"proyekluar",label:"Proyek Luar",icon:"building"},
      // MOM FAT (30 Agu 2026) - OCR checklist dokumen FAT, cuma QC (lihat MomFatView.tsx).
      {key:"momfat",label:"MOM FAT",icon:"file-text"},
      {key:"wodigital",label:"WO Digital",icon:"file-type-pdf"},
    ];
    if(user.divisi==="komponen"&&user.sub_bagian==="QS")return[
      {key:"tugas",label:"QS",icon:"clipboard-list"},
      ...(arsipSeksi?[{key:"arsip",label:"Arsip",icon:"archive"}]:[]),
      {key:"permintaan",label:"Permintaan",icon:"clipboard-text"},
      {key:"wodigital",label:"WO Digital",icon:"file-type-pdf"},
    ];
    // "komponen" non-QS (dulu TrackingKomponenView) - fitur dikonfirmasi tidak terpakai, tile
    // dihapus dari grid (29 Agu 2026). Cuma sisa Permintaan buat tipe login ini.
    if(user.divisi==="komponen")return[{key:"permintaan",label:"Permintaan",icon:"clipboard-text"}];
    // Operator biasa: mekanik/painting/assembling/wiring_ctrl/wiring_pwr - arsipSeksi &
    // komponenPasangTugas otomatis cuma keisi buat wiring_ctrl/assembling-Luar (lihat definisi di
    // atas), jadi 2 sub-grup itu otomatis dapet tile Komponen+Arsip tanpa perlu cabang terpisah.
    return[
      {key:"tugas",label:"Tugas Saya",icon:"clipboard-list"},
      ...(bisaReviewPotong||bisaReviewPainting?[{key:"review",label:"Review",icon:"folder-check"}]:[]),
      {key:"riwayat",label:"Riwayat",icon:"history"},
      ...(bisaReviewPotong?[{key:"tambahan",label:"Tambahan",icon:"plus"}]:[]),
      ...(komponenPasangTugas?[{key:"komponen",label:"Komponen",icon:komponenPasangTugas.seksi==="wiring_control"?"plug":"tool"}]:[]),
      ...(arsipSeksi?[{key:"arsip",label:"Arsip",icon:"archive"}]:[]),
      {key:"permintaan",label:"Permintaan",icon:"clipboard-text"},
      // Proyek Luar (30 Agu 2026) - fitur laporan proyek eksternal, BERDIRI SENDIRI dari WO/
      // panel manapun. Cuma qc/wiring_ctrl/wiring_pwr/assembling (mekanik/painting TIDAK).
      ...(["wiring_ctrl","wiring_pwr","assembling"].includes(user.divisi)?[{key:"proyekluar",label:"Proyek Luar",icon:"building"}]:[]),
      {key:"wodigital",label:"WO Digital",icon:"file-type-pdf"},
    ];
  })();
  const selectedTile=menuTiles.find(t=>t.key===selectedMenu);

  // Validasi selectedMenu yang di-restore dari localStorage (lihat komentar deklarasi state di
  // atas) - baru bisa dicek setelah menuTiles ke-hitung (butuh `user`). Kalau ternyata gak valid
  // buat divisi user ini (mis. tile lama dari sesi user lain), balik ke Beranda alih-alih
  // nyangkut di halaman kosong.
  useEffect(()=>{
    if(user&&selectedMenu&&!menuTiles.some(t=>t.key===selectedMenu))setSelectedMenu(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[user?.id]);

  useEffect(()=>{
    try{
      if(selectedMenu)localStorage.setItem("vista_pekerja_selected_menu",selectedMenu);
      else localStorage.removeItem("vista_pekerja_selected_menu");
    }catch{/* localStorage gak tersedia (private mode dll) - abaikan, gak fatal */}
  },[selectedMenu]);

  // BOTTOM NAV (29 Agu 2026) - Beranda/Proses Aktif/Jadwal Pengiriman/Akun, TERPISAH dari grid
  // menu di atas (selectedMenu). Pola in-page state switch (konsisten sama grid menu, bukan
  // routing baru) - "beranda" nampilin apa yang SUDAH ada (gate shift/grid/halaman ke-buka),
  // 3 tab lain nampilin halaman baru penuh yang GANTI area itu sepenuhnya. Ganti tab manapun
  // SELAIN tetap di beranda otomatis nutup tile grid yang lagi kebuka (setSelectedMenu(null)) -
  // biar pas balik ke Beranda selalu mulai dari grid root, bukan nyangkut di halaman lama.
  // "Proses Aktif" cuma relevan buat divisi timer (isOperatorDivisi - reuse, set-nya PERSIS
  // sama) - disembunyikan total buat qc/nameplate/komponen sesuai keputusan investigasi.
  const [activeBottomTab,setActiveBottomTab]=useState<"beranda"|"proses"|"jadwal"|"akun">("beranda");
  const gantiBottomTab=(tab:typeof activeBottomTab)=>{
    setActiveBottomTab(tab);
    setSelectedMenu(null);
  };

  // Badge notif di header (17 Agu 2026) = jumlah permintaan (BBMB+BBMU) SE-DIVISI (bukan cuma
  // milik operator yang sedang login - Riwayat sekarang juga se-divisi, lihat PermintaanView.tsx)
  // yang butuh perhatian: STATUSNYA BARU DIUBAH Gudang dan belum dilihat (dilihat_operator), ATAU
  // sudah disiapkan tapi belum dikonfirmasi diambil fisik (sudah_diambil). Gudang gak ikut sini -
  // dia punya badge sendiri (jumlah pending) di GudangHeader.
  //
  // PENYATUAN PENUH (3 Sep 2026) - dulu 2 cabang beda logic: BBMU baca `permintaan.status` (kolom
  // header dari desain "BBMU 1-row" Agustus yang SUDAH DIREVISI BALIK 2 Sep - kolom itu gak pernah
  // ditulis lagi sejak itu, jadi bbmuUnread SELALU 0, bug laten yang gak sengaja ketemu pas
  // penyatuan ini), BBMB baca permintaan_item per-item. Sekarang BBMB & BBMU PERSIS SAMA
  // strukturnya, jadi 1 logic item-based generik buat keduanya (gak ada split bbmuIds/bbmbIds lagi).
  const [notifCount,setNotifCount]=useState(0);
  useEffect(()=>{
    if(!user||user.divisi==="gudang")return;
    let cancelled=false;
    const fetchNotifCount=async()=>{
      const{data:perms}=await supabase.from("permintaan").select("id,dilihat_operator")
        .eq("divisi",user.divisi)
        .order("created_at",{ascending:false}).limit(100);
      if(!perms||perms.length===0){if(!cancelled)setNotifCount(0);return;}
      const permIds=perms.map((p:any)=>p.id);
      // Paginasi (2 Sep 2026, ketemu pas audit) - permIds bisa sampai 100 permintaan (limit di
      // atas), kalau tiap permintaan punya banyak item total bisa >1000 baris & kepotong diam-diam
      // tanpa .range() (persis bug renhar/komponen_master yang sudah kejadian sebelumnya di app
      // ini) - badge notif jadi under-count.
      let items:any[]=[];
      let from=0;
      const PAGE=1000;
      while(true){
        const{data}=await supabase.from("permintaan_item").select("permintaan_id,status,dilihat_operator,sudah_diambil")
          .neq("status","pending").in("permintaan_id",permIds).range(from,from+PAGE-1);
        items=items.concat(data??[]);
        if(!data||data.length<PAGE)break;
        from+=PAGE;
      }
      const needsAttention=items.filter((it:any)=>!it.dilihat_operator||(it.status==="submit"&&!it.sudah_diambil));
      if(!cancelled)setNotifCount(new Set(needsAttention.map((it:any)=>it.permintaan_id)).size);
    };
    fetchNotifCount();
    const ch=supabase.channel("realtime-operator-notif-"+user.id)
      .on("postgres_changes",{event:"*",schema:"public",table:"permintaan_item"},fetchNotifCount)
      .on("postgres_changes",{event:"*",schema:"public",table:"permintaan"},fetchNotifCount)
      .subscribe();
    return()=>{cancelled=true;supabase.removeChannel(ch);};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[user?.id,user?.divisi]);

  const headerSubtitle=selectedTile?`${selectedTile.icon} ${selectedTile.label}`:"Pilih menu di bawah untuk mulai";

  // Banner ajakan aktifkan push notification pengingat Maintenance Rutin - subscribe di-key ke
  // `divisi` (bukan per-orang, device login pakai password bersama per sub-bagian). Cuma muncul
  // sekali per device (localStorage) kalau browser dukung & izin belum diputuskan.
  const PUSH_BANNER_KEY="vista_pekerja_push_banner_dismissed";
  const [showPushBanner,setShowPushBanner]=useState(false);
  const [pushLoading,setPushLoading]=useState(false);
  useEffect(()=>{
    if(!user)return;
    if(!isPushSupported())return;
    if(localStorage.getItem(PUSH_BANNER_KEY))return;
    if(getPushPermissionState()==="default")setShowPushBanner(true);
  },[user]);
  const aktifkanPush=async()=>{
    if(!user?.divisi)return;
    setPushLoading(true);
    const res=await subscribeToPush(user.divisi);
    setPushLoading(false);
    setShowPushBanner(false);
    localStorage.setItem(PUSH_BANNER_KEY,"1");
    if(!res.success)alert("Gagal aktifkan notifikasi: "+(res.error||"unknown error"));
  };
  const tutupPushBanner=()=>{
    setShowPushBanner(false);
    localStorage.setItem(PUSH_BANNER_KEY,"1");
  };

  // Session di-cache penuh di localStorage pas login, gak ada expiry - kalau admin ubah
  // divisi/sub_bagian/nama operator ini dari Vista Teknik pas app-nya masih kebuka, sesi lama
  // bakal nyangkut sampai logout-login manual. Dengerin perubahan row operator_users-nya sendiri
  // biar role ke-refresh live tanpa perlu logout.
  useEffect(()=>{
    if(!user?.id)return;
    const ch=supabase.channel("realtime-operator-session-"+user.id)
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"operator_users",filter:"id=eq."+user.id},(payload:any)=>{
        const fresh={...payload.new,name:payload.new.nama};
        setUser(fresh);
        try{localStorage.setItem("vista_pekerja_session",JSON.stringify(fresh));}catch{}
      })
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[user?.id]);

  if(page==="landing") return <LandingPage onEnter={()=>setPage("login")}/>;
  if(!user) return <Login onLogin={(u:any)=>{
    setUser(u);
    try{localStorage.setItem("vista_pekerja_session",JSON.stringify(u));}catch{}
    setPage("app");
  }}/>;

  const doLogout=()=>{if(window.confirm("Keluar dari aplikasi?")){setUser(null);try{localStorage.removeItem("vista_pekerja_session");localStorage.removeItem("vista_pekerja_selected_menu");}catch{}setPage("landing");}};

  // Restyle header profil (29 Agu 2026) - operator_users TIDAK punya kolom foto (dicek skema),
  // jadi avatar pakai inisial nama, bukan placeholder foto. Warna avatar ikut cfg.color/bg per
  // divisi (bukan hijau/warna baru) - konsisten sama sistem badge warna-per-divisi yang sudah
  // dipakai di seluruh app (DIVISI_CONFIG), biar header gak jadi "pulau" visual sendiri.
  const namaOperator=user.nama||user.name||"Operator";
  const inisialOperator=namaOperator.trim().split(/\s+/).slice(0,2).map((w:string)=>w[0]).join("").toUpperCase()||"OP";
  const jamText=jamSekarang.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
  const tanggalText=jamSekarang.toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long"});

  return(
    <div style={{minHeight:"100vh",background:"#f1f5f9"}}>
      <style>{GCss}</style>
      {hasDateRolled&&(
        <div style={{position:"fixed",top:0,left:0,right:0,zIndex:10000,background:"#1e293b",color:"#fff",
          display:"flex",alignItems:"center",justifyContent:"center",gap:12,padding:"8px 16px",fontSize:12.5,flexWrap:"wrap" as const,textAlign:"center" as const}}>
          <span>📅 Tanggal sudah berganti ke hari baru - halaman ini dibuka dari kemarin, muat ulang biar progress yang disimpan pakai tanggal yang benar.</span>
          <button onClick={()=>window.location.reload()}
            style={{padding:"5px 14px",borderRadius:7,border:"none",background:"#fff",color:"#1e293b",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>
            Muat Ulang
          </button>
        </div>
      )}
      <style>{`
        .menu-tile-np:active{transform:translateY(-2px);box-shadow:0 8px 20px #00000022!important;}
        @media(hover:hover){.menu-tile-np:hover{transform:translateY(-2px);box-shadow:0 8px 20px #00000022!important;}}
      `}</style>
      <div style={{display:"flex",flexDirection:"column",minHeight:"100vh"}}>
        {/* Divisi "gudang" punya header sendiri (lihat GudangHeader di GudangHome.tsx) - header
            global di bawah ini SENGAJA dilewati buat gudang, sama persis pola bottom-nav yang
            udah lebih dulu dikecualikan (lihat "user.divisi!=='gudang'" di bawah). Header global
            ini TETAP dipakai apa adanya buat semua divisi lain - gak diubah sama sekali. */}
        {user.divisi!=="gudang"&&(
        <div style={{background:"#f1f5f9",padding:"10px 16px 8px",
          paddingTop:"max(10px, env(safe-area-inset-top))",position:"sticky",top:0,zIndex:100}}>
          {/* Header digabung jadi 1 card (30 Agu 2026, sebelumnya 2 card terpisah: profil warna +
              ringkasan putih). Notifikasi & Keluar DIPINDAH ke AkunView (lihat prop notifCount/
              onLogout di situ) - dihapus dari sini biar gak dobel & header gak sesak. View-toggle
              & refresh TETAP di sini. Badge/tombol ganti dari abu/tint-divisi ke putih-transparan
              (background:#ffffff2x, color putih) - kontras aman di atas cfg.color manapun
              (semua warna DIVISI_CONFIG cukup gelap, dicek manual pas restyle sebelumnya). */}
          <div style={{background:cfg?.color||"#1d4ed8",backgroundImage:"linear-gradient(135deg, rgba(255,255,255,.10), rgba(0,0,0,.08))",
            borderRadius:18,padding:"16px 18px",boxShadow:`0 4px 14px ${cfg?.color||"#1d4ed8"}40`,marginBottom:10}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
              <div style={{display:"flex",alignItems:"center",gap:12,minWidth:0}}>
                <div style={{width:48,height:48,borderRadius:14,flexShrink:0,background:"#fff",color:cfg?.color||"#1d4ed8",
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,fontWeight:800}}>{inisialOperator}</div>
                <div style={{minWidth:0}}>
                  <div style={{fontWeight:800,fontSize:17,color:"#fff",letterSpacing:-.2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{namaOperator}</div>
                  <div style={{fontSize:11.5,color:"#ffffffcc",marginTop:2}}>{cfg?.icon} {user.sub_bagian||cfg?.label}</div>
                </div>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{fontWeight:800,fontSize:16,color:"#fff",fontFamily:"'DM Mono',monospace",letterSpacing:-.3}}>{jamText}</div>
                <div style={{fontSize:10,color:"#ffffffb3",marginTop:1,textTransform:"capitalize"}}>{tanggalText}</div>
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",rowGap:6,
              marginTop:14,paddingTop:12,borderTop:"1px solid #ffffff25"}}>
              <div style={{fontSize:11.5,color:"#ffffffb3",marginRight:2}}>{headerSubtitle}</div>
              <KoneksiBadge/>
              <span style={{background:"#ffffff25",color:"#fff",border:"1px solid #ffffff40",
                borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>{cfg?.icon} {user.sub_bagian||cfg?.label}</span>
              {isOperatorDivisi&&gateShiftSet&&(
                <span style={{background:"#ffffff25",color:"#fff",border:"1px solid #ffffff40",
                  borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>
                  🕐 Shift {gateShift}
                </span>
              )}
              <div style={{flex:1}}/>
              {isOperatorDivisi&&(
                <button onClick={toggleViewMode} title={viewMode==="desktop"?"Ganti ke tampilan Mobile":"Ganti ke tampilan Desktop"}
                  style={{width:36,height:36,flexShrink:0,border:"1px solid #ffffff40",borderRadius:10,
                    background:"#ffffff20",display:"flex",alignItems:"center",justifyContent:"center",
                    cursor:"pointer",fontSize:15,color:"#fff"}}>
                  {viewMode==="desktop"?"📱":"🖥️"}
                </button>
              )}
              <button onClick={()=>window.location.reload()} title="Refresh"
                style={{width:36,height:36,flexShrink:0,border:"1px solid #ffffff40",borderRadius:10,
                  background:"#ffffff20",display:"flex",alignItems:"center",justifyContent:"center",
                  cursor:"pointer",fontSize:15,color:"#fff"}}>
                🔄
              </button>
            </div>
          </div>
        </div>
        )}
        {showPushBanner&&(
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:"#eff6ff",borderBottom:"1px solid #bfdbfe"}}>
            <div style={{fontSize:18}}>🔔</div>
            <div style={{flex:1,fontSize:11,color:"#1e3a5f"}}>
              <div style={{fontWeight:700,marginBottom:1}}>Aktifkan notifikasi maintenance?</div>
              <div style={{color:"#475569"}}>Dapat pengingat langsung ke device ini kalau ada mesin di divisi {cfg?.label||"ini"} yang jadwal maintenance-nya jatuh tempo.</div>
            </div>
            <button onClick={aktifkanPush} disabled={pushLoading} style={{padding:"7px 14px",borderRadius:8,border:"none",background:"#1d4ed8",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>{pushLoading?"...":"Aktifkan"}</button>
            <button onClick={tutupPushBanner} style={{padding:"7px 12px",borderRadius:8,border:"1px solid #cbd5e1",background:"#fff",color:"#64748b",fontSize:11,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>Nanti</button>
          </div>
        )}
        <div style={{flex:1,overflowY:"auto"}}>
          {user.divisi==="gudang"?<GudangHome user={user} onLogout={doLogout}/>
            :activeBottomTab==="proses"?<ProsesAktifView user={user}/>
            :activeBottomTab==="jadwal"?<JadwalPengirimanView/>
            :activeBottomTab==="akun"?<AkunView user={user} isTimerDivisi={!!isOperatorDivisi} proses={prosesRiwayat} onLogout={doLogout}
              notifCount={notifCount} onBukaPermintaan={()=>{setActiveBottomTab("beranda");setSelectedMenu("permintaan");}}/>
            :isOperatorDivisi&&!gateShiftSet?(
              <div style={{padding:20,maxWidth:420,margin:"0 auto"}} className="fi">
                <div style={{background:"#fff",borderRadius:18,padding:20,boxShadow:"0 4px 14px #00000014"}}>
                  <div style={{fontWeight:800,fontSize:15,color:"#1e293b",marginBottom:2}}>Setup sesi kerja</div>
                  <div style={{fontSize:12,color:"#64748b",marginBottom:16}}>Pilih shift kerja Anda hari ini</div>
                  <div style={{display:"flex",gap:10,marginBottom:16}}>
                    {["1","2"].map(s=>(
                      <button key={s} onClick={()=>setGateShift(s)}
                        style={{flex:1,padding:"14px",borderRadius:12,border:`2px solid ${gateShift===s?(cfg?.color||"#1d4ed8"):"#e2e8f0"}`,
                          background:gateShift===s?(cfg?.color||"#1d4ed8")+"18":"#f8fafc",color:gateShift===s?(cfg?.color||"#1d4ed8"):"#64748b",
                          cursor:"pointer",fontWeight:800,fontSize:16,transition:"all .15s",fontFamily:"inherit"}}>
                        Shift {s}
                      </button>
                    ))}
                  </div>
                  <button onClick={mulaiKerja} style={{width:"100%",padding:13,fontSize:15,fontWeight:700,color:"#fff",
                    background:cfg?.color||"#1d4ed8",border:"none",borderRadius:10,cursor:"pointer",fontFamily:"inherit"}}>
                    Mulai Kerja →
                  </button>
                </div>
              </div>
            )
            :!selectedMenu?(
              <div style={{padding:"14px 16px",display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:14}}>
                {menuTiles.map(t=>(
                  <button key={t.key} onClick={()=>setSelectedMenu(t.key)} className="menu-tile-np" style={{
                    background:"#fff",borderRadius:18,padding:"24px 14px",border:"none",
                    boxShadow:"0 4px 14px #00000014",display:"flex",flexDirection:"column",
                    alignItems:"center",gap:12,cursor:"pointer",fontFamily:"inherit",transition:"transform .12s, box-shadow .12s"}}>
                    <div style={{width:52,height:52,borderRadius:14,background:cfg?.color||"#1d4ed8",
                      display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <i className={`ti ti-${t.icon}`} style={{fontSize:24,color:"#fff"}}/>
                    </div>
                    <span style={{fontSize:12.5,fontWeight:700,color:"#1e293b"}}>{t.label}</span>
                  </button>
                ))}
              </div>
            ):(
              <>
                <div style={{padding:"12px 16px 0"}}>
                  <button onClick={()=>setSelectedMenu(null)} style={{display:"flex",alignItems:"center",gap:6,
                    background:"#fff",border:`1px solid ${cfg?.color||"#1d4ed8"}30`,borderRadius:10,padding:"8px 14px",
                    fontSize:12,fontWeight:700,color:cfg?.color||"#1d4ed8",cursor:"pointer",boxShadow:"0 2px 8px #0000000f",fontFamily:"inherit"}}>
                    <i className="ti ti-arrow-left" style={{fontSize:14}}/> Kembali
                  </button>
                </div>
                {selectedMenu==="permintaan"?<PermintaanView user={user}/>
                  :selectedMenu==="arsip"&&arsipSeksi==="qc"?<ArsipQCView/>
                  :selectedMenu==="arsip"&&arsipSeksi?<ArsipSeksiView seksi={arsipSeksi}/>
                  :selectedMenu==="komponen"&&komponenPasangTugas?<KomponenPasangView user={user} tugas={komponenPasangTugas}/>
                  :selectedMenu==="riwayat"?<RiwayatKerjaView proses={prosesRiwayat} label={cfg?.label||user.divisi} icon={cfg?.icon||"🕘"} color={cfg?.color||"#d97706"}/>
                  :selectedMenu==="review"?(bisaReviewPainting?<ReviewPaintingView/>:<ReviewPotongView/>)
                  :selectedMenu==="tambahan"?<KomponenTambahanView user={user}/>
                  :selectedMenu==="proyekluar"?<ProyekLuarView user={user}/>
                  :selectedMenu==="momfat"?<ErrorBoundary label="MOM FAT"><Suspense fallback={<div style={{textAlign:"center",padding:40,color:"#94a3b8"}}>Memuat...</div>}><MomFatView user={user}/></Suspense></ErrorBoundary>
                  :selectedMenu==="wodigital"?<WoDigitalView/>
                  :user.divisi==="nameplate"?<NameplateView user={user}/>
                  :user.divisi==="qc"?<QCChecklistTab user={user}/>
                  :user.divisi==="komponen"&&user.sub_bagian==="QS"?<KomponenProgressView user={user} tugas={TUGAS_QS}/>
                  :<OperatorView user={user} viewMode={viewMode}/>}
              </>
            )}
        </div>
        {/* Bottom nav (29 Agu 2026) - TERPISAH dari grid menu (selectedMenu), gudang dikecualikan
            (punya bottom-nav 5-tab sendiri di GudangHome.tsx, sama pola pengecualian di seluruh
            file ini). "Proses Aktif" cuma muncul buat divisi timer (isOperatorDivisi). */}
        {user.divisi!=="gudang"&&(
          <div style={{position:"sticky",bottom:0,background:"#fff",borderTop:"1px solid #f1f5f9",
            display:"flex",paddingBottom:"env(safe-area-inset-bottom)",zIndex:100,boxShadow:"0 -4px 14px #00000010"}}>
            {[
              {key:"beranda",label:"Beranda",icon:"home"},
              ...(isOperatorDivisi?[{key:"proses",label:"Proses Aktif",icon:"activity"}]:[]),
              {key:"jadwal",label:"Jadwal Pengiriman",icon:"truck"},
              {key:"akun",label:"Akun",icon:"user"},
            ].map(tab=>{
              const isActive=activeBottomTab===tab.key;
              return(
                <button key={tab.key} onClick={()=>gantiBottomTab(tab.key as any)}
                  style={{flex:1,border:"none",background:"none",cursor:"pointer",
                  display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                  gap:3,padding:"10px 4px",color:isActive?(cfg?.color||"#1d4ed8"):"#94a3b8",fontFamily:"inherit"}}>
                  <i className={`ti ti-${tab.icon}`} style={{fontSize:19}}/>
                  <span style={{fontSize:9,fontWeight:700,letterSpacing:.2,textAlign:"center"}}>{tab.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
