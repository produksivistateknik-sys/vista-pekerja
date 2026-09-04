import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { SectionCard, EmptyState, DatePickerField } from "./gudang/GudangUI";

// ─────────────────────────────────────────────────────────────────────────────
// TAB RIWAYAT (dalam GudangHome) - histori aksi harian: submit/reject BBMB
// (updated_at/updated_by, aksi GUDANG) dan konfirmasi pengambilan fisik BBMB
// (diambil_at/diambil_oleh, aksi OPERATOR - sejak 17 Agu 2026 pengambilan
// dikonfirmasi operator sendiri, bukan Gudang lagi). Dua kolom timestamp
// TERPISAH (bukan cuma updated_at) - dipakai buat nentuin apa 1 item MASUK
// tanggal yang lagi difilter (salah satu event jatuh di tanggal itu).
//
// REVISI (2 Sep 2026) - dulu 1 item bisa muncul 2 KALI sebagai baris riwayat
// terpisah (1 buat event submit/reject, 1 lagi buat event diambil) kalau
// kedua event itu jatuh di tanggal yang sama - laporan nyata: "AMPLAS 120
// x10 Pcs" nongol 2x. Sekarang digabung jadi 1 CARD per item, isinya 3 baris
// riwayat (Diminta/Disiapkan-Ditolak/Diambil) + 1 badge status TERKINI aja
// (bukan 2 badge terpisah per event).
// ─────────────────────────────────────────────────────────────────────────────

const DIVISI_LABEL:Record<string,string>={
  mekanik:"Mekanik",painting:"Painting",assembling:"Assembling",
  wiring_ctrl:"Wiring Control",wiring_pwr:"Wiring Power",
  qc:"QC",nameplate:"Nameplate",komponen:"Komponen",gudang:"Gudang",
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
  return{label:item.status,color:"#94a3b8"};
};

export function RiwayatGudangTab(){
  const[tanggal,setTanggal]=useState(new Date().toISOString().slice(0,10));
  const[loading,setLoading]=useState(true);
  const[rows,setRows]=useState<any[]>([]);
  // Search (3 Sep 2026) - 1 field, cocokkan ke SEMUA nama yang terlibat (peminta/penyiap/
  // pengambil) + panel + WO/proyek sekaligus, partial match case-insensitive. Filter murni JS
  // (data 1 hari sudah di-fetch semua), jadi update real-time tanpa query baru tiap ketikan -
  // dipakai BARENGAN sama filter tanggal (search cuma nyaring lebih lanjut dari situ).
  const[search,setSearch]=useState("");

  const fetchData=async()=>{
    setLoading(true);
    const startIso=tanggal+"T00:00:00";
    const endIso=tanggal+"T23:59:59.999";
    // 2 sumber event per item - updated_at (aksi Gudang: submit/reject) dan diambil_at (aksi
    // operator: konfirmasi ambil) - query terpisah, tapi hasilnya di-dedup jadi 1 baris/item.
    const [byUpdated,byDiambil]=await Promise.all([
      fetchAllPaged((from,to)=>
        supabase.from("permintaan_item").select("*").not("updated_at","is",null)
          .gte("updated_at",startIso).lte("updated_at",endIso).range(from,to)),
      fetchAllPaged((from,to)=>
        supabase.from("permintaan_item").select("*").not("diambil_at","is",null)
          .gte("diambil_at",startIso).lte("diambil_at",endIso).range(from,to)),
    ]);
    // Item MASUK tanggal ini kalau SALAH SATU event (submit/reject ATAU diambil) jatuh di tanggal
    // yang lagi difilter - tapi cuma 1 BARIS per item (dedup by id), bukan 2 event terpisah lagi.
    const itemMap=new Map<number,any>();
    [...byUpdated,...byDiambil].forEach((it:any)=>{if(!itemMap.has(it.id))itemMap.set(it.id,it);});
    const merged=[...itemMap.values()].sort((a,b)=>((b.diambil_at||b.updated_at||"")).localeCompare(a.diambil_at||a.updated_at||""));
    const permIds=[...new Set(merged.map((it:any)=>it.permintaan_id))];
    if(permIds.length===0){setRows([]);setLoading(false);return;}
    const perms=await fetchAllPaged((from,to)=>supabase.from("permintaan").select("*").in("id",permIds).range(from,to));
    const permMap:Record<number,any>={};
    perms.forEach((p:any)=>{permMap[p.id]=p;});
    setRows(merged.map((it:any)=>({...it,perm:permMap[it.permintaan_id]})).filter((r:any)=>r.perm));
    setLoading(false);
  };

  useEffect(()=>{
    fetchData();
    const ch=supabase.channel("realtime-gudang-riwayat")
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"permintaan_item"},fetchData)
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[tanggal]);

  const q=search.trim().toLowerCase();
  const filteredRows=q?rows.filter((r:any)=>[
    r.perm.operator_nama,r.updated_by,r.diambil_oleh,r.perm.panel_nama,r.perm.proyek,r.perm.wo_number,
  ].some(v=>(v||"").toLowerCase().includes(q))):rows;

  return(
    <div style={{padding:16}} className="fi">
      <SectionCard icon="🕒" title="Riwayat Harian" subtitle="Aksi submit/reject/status/tarik yang sudah diproses">
      <div style={{marginBottom:10}}><DatePickerField value={tanggal} onChange={setTanggal}/></div>
      <input type="text" value={search} onChange={(e:any)=>setSearch(e.target.value)}
        placeholder="Cari nama peminta/penyiap/pengambil, panel, atau WO..."
        style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid #cbd5e1",fontSize:13.5,fontWeight:600,color:"#0f172a",background:"#fff",fontFamily:"inherit",marginBottom:14}}/>

      {loading?(
        <div style={{textAlign:"center",padding:40,color:"#94a3b8",fontSize:13}}>Memuat...</div>
      ):filteredRows.length===0?(
        <EmptyState title="Belum ada aksi"
          description={q?"Tidak ada hasil yang cocok dengan pencarian.":"Belum ada aksi submit/reject/ambil yang tercatat di tanggal ini."}/>
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
              </div>
            );
          })}
        </div>
      )}
      </SectionCard>
    </div>
  );
}
