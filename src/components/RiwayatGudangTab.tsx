import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { SectionCard, EmptyState, DatePickerField } from "./gudang/GudangUI";

// ─────────────────────────────────────────────────────────────────────────────
// TAB RIWAYAT (dalam GudangHome) - histori aksi harian: submit/reject BBMB
// (updated_at/updated_by, aksi GUDANG) dan konfirmasi pengambilan fisik BBMB
// (diambil_at/diambil_oleh, aksi OPERATOR - sejak 17 Agu 2026 pengambilan
// dikonfirmasi operator sendiri, bukan Gudang lagi) - keduanya di RECORD YANG
// SAMA (permintaan_item), cuma info pengambilan ditampilkan SEBAGAI BAGIAN
// dari kartu yang sama, bukan baris riwayat sendiri.
//
// REVISI (2 Sep 2026) - dulu 1 item bisa muncul 2 KALI sebagai baris riwayat
// terpisah (1 buat event submit/reject, 1 lagi buat event diambil) kalau
// kedua event itu jatuh di TANGGAL YANG SAMA - laporan nyata: "AMPLAS 120
// x10 Pcs" nongol 2x. Digabung jadi 1 CARD per item, isinya 3 baris riwayat
// (Diminta/Disiapkan-Ditolak/Diambil) + 1 badge status TERKINI aja.
//
// REVISI KE-2 (17 Sep 2026, ditemukan user) - fix di atas cuma nutup gejala
// DALAM 1 tanggal yang sama. Query fetchData() dulu MASIH nganggap item
// "masuk" tanggal X kalau updated_at ATAU diambil_at jatuh di situ - kalau
// approve & ambil beda HARI KALENDER, item yang SAMA tetap muncul di 2
// TAMPILAN TANGGAL BERBEDA (buka tanggal approve-nya nongol, buka tanggal
// ambil-nya nongol lagi). Dicek live: 110 dari 443 item (25%) punya
// updated_at & diambil_at beda hari kalender - bukan kasus langka. Sekarang
// SATU-SATUNYA penentu "item ini tanggal berapa" = updated_at (kapan Gudang
// submit/reject) - diambil_at TIDAK LAGI dipakai sebagai tanggal acuan
// alternatif, cuma ditampilkan sebagai info "📦 Diambil ..." di dalam kartu
// yang sama (kode itu sudah ada sejak awal, gak berubah). Badge "🔁 Lintas
// hari" (16 Sep 2026) DIHAPUS - itu tambalan sementara buat WARN soal
// duplikasi ini, sekarang duplikasinya sendiri sudah hilang di akarnya jadi
// warning itu jadi gak relevan lagi.
// ─────────────────────────────────────────────────────────────────────────────

const DIVISI_LABEL:Record<string,string>={
  mekanik:"Mekanik",painting:"Painting",assembling:"Assembling",
  wiring_ctrl:"Wiring Control",wiring_pwr:"Wiring Power",
  qc:"QC",nameplate:"Nameplate",komponen:"QS",gudang:"Gudang", // label "Komponen"->"QS" (23 Sep 2026), key TETAP "komponen"
};

const fetchAllPaged=async(build:(from:number,to:number)=>any):Promise<any[]>=>{
  let all:any[]=[];
  let from=0;
  const PAGE=1000;
  while(true){
    const{data,error}=await build(from,from+PAGE-1);
    if(error)throw error;
    all=all.concat(data??[]);
    if(!data||data.length<PAGE)break;
    from+=PAGE;
  }
  return all;
};

const fmtDateTime=(d:string)=>d?new Date(d).toLocaleString("id-ID",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):"-";

// Badge status TERKINI - prioritas: udah diambil > disiapkan (nunggu diambil) > ditolak > lainnya.
const statusTerkini=(item:any):{label:string,color:string}=>{
  if(item.sudah_diambil)return{label:"✓ Sudah Diambil",color:"#0369a1"};
  if(item.status==="submit")return{label:"✓ Sudah Siap",color:"#16a34a"};
  if(item.status==="reject")return{label:"✕ Ditolak",color:"#dc2626"};
  // Jaring pengaman (8 Sep 2026) - ditolak_admin seharusnya udah gak pernah nyampe sini lagi
  // (lihat exclude di fetchData), tapi tetap dikasih label rapi kalau suatu saat ke-trigger -
  // jangan sampai nama status mentah ke-print ke user.
  if(item.status==="ditolak_admin")return{label:"✕ Ditolak Admin",color:"#b91c1c"};
  return{label:item.status,color:"#94a3b8"};
};
// Key status buat filter (6 Sep 2026) - HARUS ikut urutan prioritas SAMA PERSIS kayak
// statusTerkini() di atas, biar filter selalu konsisten sama badge yang beneran tampil.
type StatusFilterKey="ALL"|"SIAP"|"DIAMBIL"|"DITOLAK";
const statusKeyOf=(item:any):StatusFilterKey|"LAIN"=>{
  if(item.sudah_diambil)return"DIAMBIL";
  if(item.status==="submit")return"SIAP";
  if(item.status==="reject")return"DITOLAK";
  return"LAIN";
};
const STATUS_FILTER_OPTIONS:{key:StatusFilterKey,label:string,color:string}[]=[
  {key:"ALL",label:"Semua",color:"#475569"},
  {key:"SIAP",label:"✓ Sudah Siap",color:"#16a34a"},
  {key:"DIAMBIL",label:"✓ Sudah Diambil",color:"#0369a1"},
  {key:"DITOLAK",label:"✕ Ditolak",color:"#dc2626"},
];

export function RiwayatGudangTab({adminName}:{adminName:string}){
  const[tanggal,setTanggal]=useState(new Date().toISOString().slice(0,10));
  const[loading,setLoading]=useState(true);
  const[rows,setRows]=useState<any[]>([]);
  // Search (3 Sep 2026) - 1 field, cocokkan ke SEMUA nama yang terlibat (peminta/penyiap/
  // pengambil) + panel + WO/proyek sekaligus, partial match case-insensitive. Filter murni JS
  // (data 1 hari sudah di-fetch semua), jadi update real-time tanpa query baru tiap ketikan -
  // dipakai BARENGAN sama filter tanggal (search cuma nyaring lebih lanjut dari situ).
  const[search,setSearch]=useState("");
  const[statusFilter,setStatusFilter]=useState<StatusFilterKey>("ALL");

  // FIX (5 Sep 2026, ketemu pas nambah checkbox "Sudah Diinput") - fetchData dipicu ulang oleh
  // realtime SETIAP kali ada row permintaan_item ke-update (termasuk toggle checkbox itu
  // sendiri). Dulu selalu setLoading(true) di awal - checkbox yang dicentang berkali-kali
  // berurutan (pola pemakaian wajar buat fitur ini) bikin SELURUH list "berkedip" ilang jadi
  // placeholder "Memuat..." tiap 1 klik. silent=true (dipanggil dari realtime listener) skip
  // loading state - data di-refresh diam-diam di background, list gak "kedip".
  const fetchData=async(silent=false)=>{
    if(!silent)setLoading(true);
    const startIso=tanggal+"T00:00:00";
    const endIso=tanggal+"T23:59:59.999";
    // SATU sumber tanggal (17 Sep 2026, REVISI KE-2 - lihat komentar header file) - updated_at
    // (kapan Gudang submit/reject) SATU-SATUNYA penentu "item ini masuk tanggal apa". diambil_at
    // TIDAK LAGI dipakai sebagai tanggal acuan alternatif - cuma tampil sebagai info "📦 Diambil"
    // di dalam kartu yang sama (render di bawah, kode itu gak berubah). Karena cuma 1 query/1
    // sumber, gak perlu dedup Map lagi - Postgres SELECT gak mungkin balikin 1 id 2x.
    // BUG FIX (8 Sep 2026) - neq status='ditolak_admin' WAJIB di sini: fitur approval admin
    // (PermintaanAdminTab.tsx) reuse kolom updated_at/updated_by buat aksi tolak admin (biar
    // konsisten pola submit/reject Gudang) - tanpa exclude ini, item yang DITOLAK ADMIN (belum
    // pernah sampai ke Gudang sama sekali) ikut "ketangkep" query ini seolah aksi Gudang.
    const items=await fetchAllPaged((from,to)=>
      supabase.from("permintaan_item").select("*").not("updated_at","is",null).neq("status","ditolak_admin")
        .gte("updated_at",startIso).lte("updated_at",endIso).range(from,to));
    const merged=items.slice().sort((a,b)=>(b.updated_at||"").localeCompare(a.updated_at||""));
    const permIds=[...new Set(merged.map((it:any)=>it.permintaan_id))];
    if(permIds.length===0){setRows([]);if(!silent)setLoading(false);return;}
    const perms=await fetchAllPaged((from,to)=>supabase.from("permintaan").select("*").in("id",permIds).range(from,to));
    const permMap:Record<number,any>={};
    perms.forEach((p:any)=>{permMap[p.id]=p;});
    setRows(merged.map((it:any)=>({...it,perm:permMap[it.permintaan_id]})).filter((r:any)=>r.perm));
    if(!silent)setLoading(false);
  };

  useEffect(()=>{
    fetchData();
    const ch=supabase.channel("realtime-gudang-riwayat")
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"permintaan_item"},()=>fetchData(true))
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[tanggal]);

  // Dot merah di date picker (6 Sep 2026) - tanggal yang punya item riwayat BELUM DIINPUT
  // (sudah_diinput=false), TERPISAH TOTAL dari dot di tab Permintaan (kondisi/sumber data beda,
  // cuma komponen visualnya yang dipakai bareng). Query SEKALI per bulan yang lagi keliatan -
  // discope ke rentang bulan (bukan 1 hari) dan di-filter sudah_diinput=false. status='submit'
  // SENGAJA disaring (6 Sep 2026, permintaan user) - item DITOLAK gak pernah ada barang keluar,
  // gak ada yang perlu dicatat ke pembukuan, jadi gak boleh ikut nyalain dot "belum diinput".
  // SATU sumber tanggal (17 Sep 2026, sinkron sama fetchData() di atas) - dot cuma nyala di
  // tanggal updated_at, BUKAN diambil_at lagi - kalau dot masih ikut diambil_at, tanggal itu bisa
  // nyala titiknya padahal list Riwayat di tanggal itu kosong (item-nya sekarang "tinggal" di
  // tanggal updated_at-nya).
  const[dotDates,setDotDates]=useState<Set<string>>(new Set());
  const dotMonthRef=useRef<{year:number,month:number}|null>(null);
  const fetchDotDates=async(year:number,month:number)=>{
    const lastDay=new Date(year,month+1,0).getDate();
    const start=`${year}-${String(month+1).padStart(2,"0")}-01T00:00:00`;
    const end=`${year}-${String(month+1).padStart(2,"0")}-${String(lastDay).padStart(2,"0")}T23:59:59.999`;
    const items=await fetchAllPaged((from,to)=>
      supabase.from("permintaan_item").select("id,updated_at,sudah_diinput").eq("status","submit")
        .not("updated_at","is",null).gte("updated_at",start).lte("updated_at",end).eq("sudah_diinput",false).range(from,to));
    const dates=new Set<string>();
    items.forEach((it:any)=>{if(it.updated_at)dates.add(it.updated_at.slice(0,10));});
    setDotDates(dates);
  };
  const handleVisibleMonthChange=(year:number,month:number)=>{
    dotMonthRef.current={year,month};
    fetchDotDates(year,month);
  };
  useEffect(()=>{
    const ch=supabase.channel("realtime-gudang-riwayat-dots")
      .on("postgres_changes",{event:"*",schema:"public",table:"permintaan_item"},()=>{if(dotMonthRef.current)fetchDotDates(dotMonthRef.current.year,dotMonthRef.current.month);})
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);

  const q=search.trim().toLowerCase();
  const filteredRows=rows
    .filter((r:any)=>!q||[
      r.perm.operator_nama,r.updated_by,r.diambil_oleh,r.perm.panel_nama,r.perm.proyek,r.perm.wo_number,r.nama_komponen,
    ].some(v=>(v||"").toLowerCase().includes(q)))
    .filter((r:any)=>statusFilter==="ALL"||statusKeyOf(r)===statusFilter);

  // Checklist manual "Sudah Diinput" (5 Sep 2026) - penanda internal MURNI (gak terhubung
  // sistem/proses lain apa pun), gudang tandai transaksi yang udah dicatat ke pembukuan/laporan
  // di luar sistem. Toggle langsung update DB (gak ada tombol simpan terpisah) - update state
  // lokal optimis dulu biar responsif, realtime channel yang udah ada bakal sinkronkan ulang.
  const toggleSudahDiinput=async(item:any)=>{
    const next=!item.sudah_diinput;
    setRows(prev=>prev.map((r:any)=>r.id===item.id?{...r,sudah_diinput:next}:r));
    await supabase.from("permintaan_item").update({sudah_diinput:next}).eq("id",item.id);
  };

  // Fitur Pengajuan Koreksi Qty (7 Sep 2026) - Gudang TIDAK bisa langsung ubah qty sendiri,
  // harus diajukan & disetujui divisi peminta dulu (lihat migration permintaan_item_koreksi.sql
  // buat konteks lengkap). pendingKoreksiMap dipakai buat tau item mana yang lagi "Menunggu
  // Persetujuan" (sembunyiin tombol ajukan, cegah dobel pengajuan buat item yang sama).
  const[pendingKoreksiMap,setPendingKoreksiMap]=useState<Record<number,any>>({});
  useEffect(()=>{
    if(rows.length===0){setPendingKoreksiMap({});return;}
    let cancelled=false;
    const fetchPending=async()=>{
      const ids=rows.map((r:any)=>r.id);
      const{data}=await supabase.from("permintaan_item_koreksi").select("*").in("permintaan_item_id",ids).eq("status","menunggu");
      if(!cancelled){
        const map:Record<number,any>={};
        (data||[]).forEach((k:any)=>{map[k.permintaan_item_id]=k;});
        setPendingKoreksiMap(map);
      }
    };
    fetchPending();
    const ch=supabase.channel("realtime-gudang-riwayat-koreksi")
      .on("postgres_changes",{event:"*",schema:"public",table:"permintaan_item_koreksi"},fetchPending)
      .subscribe();
    return()=>{cancelled=true;supabase.removeChannel(ch);};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[rows]);

  // Riwayat Koreksi Qty DIPUTUSKAN (16 Sep 2026) - sebelumnya pengajuan koreksi yang sudah
  // disetujui/ditolak HILANG TOTAL dari tampilan begitu diputuskan (cuma badge "Menunggu
  // Persetujuan" pending di atas, gak pernah ada gantinya) - dilaporkan user lewat kasus nyata
  // (STREP TEMBAGA, koreksi id 15, disetujui LUTVAN 15 Sep, tapi permintaan_item.updated_at-nya
  // masih 12 Sep krn approve_permintaan_koreksi() RPC emang gak pernah nyentuh kolom itu -
  // dicek langsung: BUKAN dibiarkan sengaja, approve_permintaan_koreksi() sengaja TIDAK diubah
  // buat nulis ulang updated_at/updated_by - kolom itu jadi basis timeline "✓ Sudah Siap oleh
  // X" di atas, kalau ditimpa tanggal keputusan koreksi malah bikin bug baru (seolah GUDANG yang
  // proses barangnya hari itu, padahal itu ADMIN yang approve koreksi qty, orang & event beda).
  // Solusi lebih aman: section riwayat TERPISAH, berbasis diputuskan_at sendiri (bukan nebeng ke
  // updated_at item) - gak nyentuh sama sekali logic/tampilan/query section di atas.
  const[koreksiDecided,setKoreksiDecided]=useState<any[]>([]);
  const fetchKoreksiDecided=async()=>{
    const startIso=tanggal+"T00:00:00";
    const endIso=tanggal+"T23:59:59.999";
    const decided=await fetchAllPaged((from,to)=>
      supabase.from("permintaan_item_koreksi").select("*").in("status",["disetujui","ditolak"])
        .gte("diputuskan_at",startIso).lte("diputuskan_at",endIso).range(from,to));
    if(decided.length===0){setKoreksiDecided([]);return;}
    const itemIds=[...new Set(decided.map((k:any)=>k.permintaan_item_id))];
    const items=await fetchAllPaged((from,to)=>supabase.from("permintaan_item").select("*").in("id",itemIds).range(from,to));
    const itemMap:Record<number,any>={};
    items.forEach((it:any)=>{itemMap[it.id]=it;});
    const permIds=[...new Set(items.map((it:any)=>it.permintaan_id))];
    const perms=await fetchAllPaged((from,to)=>supabase.from("permintaan").select("*").in("id",permIds).range(from,to));
    const permMap:Record<number,any>={};
    perms.forEach((p:any)=>{permMap[p.id]=p;});
    const merged=decided
      .map((k:any)=>({...k,item:itemMap[k.permintaan_item_id],perm:itemMap[k.permintaan_item_id]?permMap[itemMap[k.permintaan_item_id].permintaan_id]:null}))
      .filter((k:any)=>k.item)
      .sort((a:any,b:any)=>(b.diputuskan_at||"").localeCompare(a.diputuskan_at||""));
    setKoreksiDecided(merged);
  };
  useEffect(()=>{
    fetchKoreksiDecided();
    const ch=supabase.channel("realtime-gudang-riwayat-koreksi-decided")
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"permintaan_item_koreksi"},fetchKoreksiDecided)
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[tanggal]);
  const koreksiDecidedFiltered=koreksiDecided.filter((k:any)=>!q||[
    k.item?.nama_komponen,k.diajukan_oleh,k.disetujui_oleh,k.perm?.proyek,k.perm?.panel_nama,k.perm?.wo_number,
  ].some(v=>(v||"").toLowerCase().includes(q)));

  const[koreksiTarget,setKoreksiTarget]=useState<any|null>(null);
  const[koreksiQty,setKoreksiQty]=useState("");
  const[koreksiAlasan,setKoreksiAlasan]=useState("");
  const[koreksiSubmitting,setKoreksiSubmitting]=useState(false);
  const[koreksiError,setKoreksiError]=useState("");
  // Peringatan hutang (informatif, TIDAK blokir) - item yang dikoreksi punya kaitan hutang kalau
  // dia SENDIRI hasil cicilan (induk_item_id keisi) ATAU pernah jadi asal cicilan buat row lain
  // (ada row lain yang induk_item_id-nya nunjuk ke sini). Dicek pas modal dibuka.
  const[koreksiHutangWarning,setKoreksiHutangWarning]=useState(false);

  const bukaKoreksi=async(item:any)=>{
    setKoreksiTarget(item);
    setKoreksiQty(String(item.qty));
    setKoreksiAlasan("");
    setKoreksiError("");
    setKoreksiHutangWarning(false);
    const{data}=await supabase.from("permintaan_item").select("id").or(`id.eq.${item.induk_item_id||0},induk_item_id.eq.${item.id}`).limit(1);
    if(item.induk_item_id||(data&&data.length>0))setKoreksiHutangWarning(true);
  };
  const tutupKoreksi=()=>{setKoreksiTarget(null);setKoreksiError("");};
  const submitKoreksi=async()=>{
    if(!koreksiTarget)return;
    const qtyBaru=Number(koreksiQty);
    if(!koreksiQty||isNaN(qtyBaru)||qtyBaru<0){setKoreksiError("Qty baru wajib diisi, angka >= 0");return;}
    if(!koreksiAlasan.trim()){setKoreksiError("Alasan koreksi wajib diisi");return;}
    setKoreksiSubmitting(true);
    setKoreksiError("");
    // REVISI (13 Sep 2026, "approval koreksi qty diarahkan ke Admin") - dulu target_divisi diisi
    // divisi peminta asal (koreksiTarget.perm.divisi), disetujui siapa pun yang login di divisi
    // itu (vista-pekerja PermintaanView.tsx tab "Koreksi", SEKARANG DIHAPUS). Sekarang SELALU
    // 'admin' - pseudo-divisi (konsisten sama admins.divisi='admin' di Login.tsx vista-teknik),
    // diputuskan lewat PermintaanAdminTab.tsx tab "Koreksi Qty", pola sama kayak approval BBMB/
    // BBMU. Kolom target_divisi TETAP dipakai apa adanya (gak ganti skema) - cuma nilainya yang
    // berubah, biar targeted edit bukan migrasi kolom.
    const{error:insErr}=await supabase.from("permintaan_item_koreksi").insert({
      permintaan_item_id:koreksiTarget.id,
      qty_lama:koreksiTarget.qty,
      qty_diusulkan:qtyBaru,
      alasan:koreksiAlasan.trim(),
      diajukan_oleh:adminName,
      target_divisi:"admin",
    });
    if(insErr){setKoreksiError("Gagal ajukan: "+insErr.message);setKoreksiSubmitting(false);return;}
    try{
      // targetAdmin (bukan targetDivisi lagi) - broadcast ke semua admin Vista Teknik yang
      // subscribe, sama persis pola trigger 'baru' (permintaan BBMB/BBMU baru).
      await supabase.functions.invoke("notify-permintaan",{body:{
        trigger:"koreksi_baru",targetAdmin:true,
        namaKomponen:koreksiTarget.nama_komponen,qtyLama:koreksiTarget.qty,qtyDiusulkan:qtyBaru,satuan:koreksiTarget.satuan,
      }});
    }catch{/* notifikasi gagal - diabaikan, pengajuan tetap tersimpan */}
    setKoreksiSubmitting(false);
    tutupKoreksi();
  };

  return(
    <div style={{padding:16}} className="fi">
      <SectionCard icon="🕒" title="Riwayat Harian" subtitle="Aksi submit/reject/status/tarik yang sudah diproses">
      <div style={{marginBottom:10}}><DatePickerField value={tanggal} onChange={setTanggal} markedDates={dotDates} onVisibleMonthChange={handleVisibleMonthChange}/></div>
      <input type="text" value={search} onChange={(e:any)=>setSearch(e.target.value)}
        placeholder="Cari nama komponen, peminta/penyiap/pengambil, panel, atau WO..."
        style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid #cbd5e1",fontSize:13.5,fontWeight:600,color:"#0f172a",background:"#fff",fontFamily:"inherit",marginBottom:10}}/>

      <div style={{display:"flex",gap:6,flexWrap:"wrap" as const,marginBottom:14}}>
        {STATUS_FILTER_OPTIONS.map(o=>{
          const active=statusFilter===o.key;
          return(
            <button key={o.key} onClick={()=>setStatusFilter(o.key)}
              style={{padding:"5px 12px",borderRadius:20,border:`1.5px solid ${active?o.color:"#e2e8f0"}`,
                background:active?o.color+"18":"#fff",color:active?o.color:"#64748b",
                cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"inherit"}}>
              {o.label}
            </button>
          );
        })}
      </div>

      {loading?(
        <div style={{textAlign:"center",padding:40,color:"#94a3b8",fontSize:13}}>Memuat...</div>
      ):filteredRows.length===0?(
        <EmptyState title="Belum ada aksi"
          description={q||statusFilter!=="ALL"?"Tidak ada hasil yang cocok dengan pencarian/filter.":"Belum ada aksi submit/reject/ambil yang tercatat di tanggal ini."}/>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {filteredRows.map((r:any)=>{
            const status=statusTerkini(r);
            return(
              <div key={r.id} style={{background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:12,padding:"11px 14px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:8}}>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:"#1e293b"}}>{r.nama_komponen} <span style={{color:"#64748b",fontWeight:500}}>×{r.qty}{r.satuan?` ${r.satuan}`:""}</span></div>
                    <div style={{fontSize:10.5,color:"#94a3b8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {r.perm.jenis} · {DIVISI_LABEL[r.perm.divisi]||r.perm.divisi} · {r.perm.operator_nama} · {r.perm.proyek||"-"}{r.perm.panel_nama?` · ${r.perm.panel_nama}`:""}
                    </div>
                  </div>
                  <span style={{flexShrink:0,background:status.color+"18",color:status.color,borderRadius:20,padding:"3px 10px",fontSize:10.5,fontWeight:700,whiteSpace:"nowrap"}}>{status.label}</span>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:2,fontSize:10.5,color:"#64748b"}}>
                  <span>📝 Diminta oleh {r.perm.operator_nama||"-"} — {fmtDateTime(r.perm.created_at)}</span>
                  {/* Disetujui Admin (7 Sep 2026, fitur approval admin) - urutan kronologis
                      ditaruh SEBELUM "Sudah Siap/Ditolak oleh" Gudang, karena tahap ini memang
                      terjadi lebih dulu (admin setuju -> baru status jadi 'pending' -> baru
                      Gudang bisa proses). Item lama (sebelum fitur ini ada) gak punya kolom ini
                      terisi - baris ini otomatis gak muncul buat mereka. */}
                  {r.disetujui_admin_oleh&&(
                    <span>✅ Disetujui Admin oleh {r.disetujui_admin_oleh} — {fmtDateTime(r.disetujui_admin_at)}</span>
                  )}
                  {r.updated_at&&(
                    <span>{r.status==="reject"?"✕ Ditolak":"✓ Sudah Siap"} oleh {r.updated_by||"-"} — {fmtDateTime(r.updated_at)}</span>
                  )}
                  {r.status==="submit"&&(
                    r.sudah_diambil
                      ?<span>📦 Diambil oleh {r.diambil_oleh||"-"} — {fmtDateTime(r.diambil_at)}</span>
                      :<span style={{color:"#94a3b8"}}>⏳ Menunggu diambil</span>
                  )}
                </div>
                {r.status==="reject"&&r.catatan_reject&&<div style={{fontSize:11,color:"#dc2626",marginTop:6}}>⚠ {r.catatan_reject}</div>}
                {/* Item DITOLAK gak pernah ada barang keluar - gak ada yang perlu dicatat ke
                    pembukuan (6 Sep 2026, permintaan user) - checklist "Sudah Diinput" cuma
                    relevan buat item yang beneran diproses (status submit). */}
                {r.status!=="reject"&&(
                  <label style={{display:"flex",alignItems:"center",gap:6,marginTop:8,paddingTop:8,borderTop:"1px solid #f1f5f9",cursor:"pointer"}}>
                    <input type="checkbox" checked={!!r.sudah_diinput} onChange={()=>toggleSudahDiinput(r)}
                      style={{width:14,height:14,cursor:"pointer",accentColor:"#16a34a"}}/>
                    <span style={{fontSize:10.5,fontWeight:600,color:r.sudah_diinput?"#16a34a":"#94a3b8"}}>
                      {r.sudah_diinput?"✓ Sudah Diinput":"Sudah Diinput?"}
                    </span>
                  </label>
                )}
                {/* Pengajuan Koreksi Qty (7 Sep 2026) - berlaku SEMUA status (Sudah Siap/Diambil/
                    Ditolak), qty ASLI baru berubah kalau divisi peminta setuju (PermintaanView.tsx). */}
                {pendingKoreksiMap[r.id]?(
                  <div style={{marginTop:8,paddingTop:8,borderTop:"1px solid #f1f5f9",fontSize:10.5,color:"#d97706",fontWeight:700,display:"flex",alignItems:"center",gap:5}}>
                    ⏳ Koreksi qty ke {pendingKoreksiMap[r.id].qty_diusulkan} - Menunggu Persetujuan
                  </div>
                ):(
                  <div style={{marginTop:8,paddingTop:8,borderTop:"1px solid #f1f5f9"}}>
                    <button onClick={()=>bukaKoreksi(r)}
                      style={{fontSize:10.5,fontWeight:700,color:"#0369a1",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0}}>
                      ✏️ Ajukan Koreksi Qty
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      </SectionCard>

      {/* Riwayat Koreksi Qty Diputuskan (16 Sep 2026) - section TERPISAH, gak nyampur sama list
          item di atas sama sekali (murni tambahan, render kondisional cuma kalau ada datanya utk
          tanggal/pencarian ini - gak ada empty-state baru yang perlu ditambah). */}
      {koreksiDecidedFiltered.length>0&&(
        <div style={{marginTop:14}}>
          <SectionCard icon="✏️" title="Koreksi Qty Diputuskan" subtitle="Pengajuan koreksi yang sudah disetujui/ditolak di tanggal ini">
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {koreksiDecidedFiltered.map((k:any)=>{
                const disetujui=k.status==="disetujui";
                const warna=disetujui?"#16a34a":"#dc2626";
                return(
                  <div key={k.id} style={{background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:12,padding:"11px 14px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:6}}>
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:700,color:"#1e293b"}}>{k.item.nama_komponen}</div>
                        <div style={{fontSize:10.5,color:"#94a3b8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                          {k.perm?.proyek||"-"}{k.perm?.panel_nama?` · ${k.perm.panel_nama}`:""}
                        </div>
                      </div>
                      <span style={{flexShrink:0,background:warna+"18",color:warna,borderRadius:20,padding:"3px 10px",fontSize:10.5,fontWeight:700,whiteSpace:"nowrap"}}>
                        {disetujui?"✓ Disetujui":"✕ Ditolak"}
                      </span>
                    </div>
                    <div style={{fontSize:11.5,color:"#334155",marginBottom:4}}>
                      Qty {k.qty_lama}{k.item.satuan?` ${k.item.satuan}`:""} → <strong>{k.qty_diusulkan}{k.item.satuan?` ${k.item.satuan}`:""}</strong>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:2,fontSize:10.5,color:"#64748b"}}>
                      <span>📝 Diajukan oleh {k.diajukan_oleh} — {fmtDateTime(k.diajukan_at)}</span>
                      <span>{disetujui?"✅":"✕"} {disetujui?"Disetujui":"Ditolak"} oleh {k.disetujui_oleh||"-"} — {fmtDateTime(k.diputuskan_at)}</span>
                      {/* Status pengambilan fisik (16 Sep 2026) - k.item udah ke-fetch penuh dari
                          fetchKoreksiDecided (bukan cuma id), diambil_oleh/diambil_at/sudah_diambil
                          udah ada di situ, tinggal ditampilkan - user nanya "diambil siapa" gak
                          kelihatan di section ini. Cuma relevan kalau item-nya status='submit'
                          (approve_permintaan_koreksi gak pernah ngubah status jadi 'submit' - kalau
                          koreksi disetujui buat item yang statusnya masih 'pending'/belum diproses
                          Gudang, pengambilan emang belum relevan sama sekali, sama pola main list
                          di atas r.status==="submit"). */}
                      {k.item.status==="submit"&&(
                        k.item.sudah_diambil
                          ?<span>📦 Diambil oleh {k.item.diambil_oleh||"-"} — {fmtDateTime(k.item.diambil_at)}</span>
                          :<span style={{color:"#94a3b8"}}>⏳ Menunggu diambil</span>
                      )}
                    </div>
                    <div style={{fontSize:10.5,color:"#64748b",fontStyle:"italic" as const,marginTop:4}}>Alasan: {k.alasan}</div>
                    {!disetujui&&k.catatan_reject&&<div style={{fontSize:11,color:"#dc2626",marginTop:4}}>⚠ {k.catatan_reject}</div>}
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </div>
      )}

      {koreksiTarget&&(
        <div onClick={tutupKoreksi} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div onClick={(e:any)=>e.stopPropagation()} style={{background:"#fff",borderRadius:16,padding:20,width:"100%",maxWidth:360}}>
            <div style={{fontWeight:800,fontSize:15,color:"#1e293b",marginBottom:4}}>Ajukan Koreksi Qty</div>
            <div style={{fontSize:12,color:"#64748b",marginBottom:12}}>{koreksiTarget.nama_komponen} - qty saat ini {koreksiTarget.qty}{koreksiTarget.satuan?` ${koreksiTarget.satuan}`:""}</div>
            {koreksiHutangWarning&&(
              <div style={{background:"#fffbeb",border:"1px solid #fde68a",color:"#92400e",borderRadius:9,padding:"9px 11px",fontSize:11,marginBottom:12,lineHeight:1.5}}>
                ⚠ Item ini punya kaitan dengan sistem Hutang (cicilan/dicicil). Koreksi qty di sini TIDAK otomatis menyesuaikan baris Hutang terkait - cek manual kalau perlu.
              </div>
            )}
            <div style={{marginBottom:6,fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4}}>Qty yang seharusnya</div>
            <input type="number" min="0" autoFocus value={koreksiQty} onChange={(e:any)=>setKoreksiQty(e.target.value)}
              style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid #cbd5e1",fontSize:16,fontWeight:700,color:"#0f172a",fontFamily:"inherit",marginBottom:10,boxSizing:"border-box" as const}}/>
            <div style={{marginBottom:6,fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4}}>Alasan koreksi (wajib)</div>
            <textarea value={koreksiAlasan} onChange={(e:any)=>setKoreksiAlasan(e.target.value)} rows={3}
              placeholder="Contoh: salah input qty, seharusnya 5400 CM bukan 540 CM"
              style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid #cbd5e1",fontSize:13,color:"#0f172a",fontFamily:"inherit",marginBottom:10,boxSizing:"border-box" as const,resize:"vertical" as const}}/>
            {koreksiError&&<div style={{fontSize:11.5,color:"#dc2626",marginBottom:10,fontWeight:600}}>{koreksiError}</div>}
            <div style={{display:"flex",gap:8}}>
              <button onClick={tutupKoreksi} disabled={koreksiSubmitting}
                style={{flex:1,padding:"10px",borderRadius:9,border:"1px solid #e2e8f0",background:"#fff",color:"#64748b",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                Batal
              </button>
              <button onClick={submitKoreksi} disabled={koreksiSubmitting}
                style={{flex:1,padding:"10px",borderRadius:9,border:"none",
                  background:koreksiSubmitting?"#94a3b8":"#0369a1",color:"#fff",fontWeight:700,fontSize:13,
                  cursor:koreksiSubmitting?"default":"pointer",fontFamily:"inherit"}}>
                {koreksiSubmitting?"Mengajukan...":"Ajukan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
