import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { SectionCard, EmptyState } from "./gudang/GudangUI";

// ─────────────────────────────────────────────────────────────────────────────
// TAB RIWAYAT (dalam GudangHome) - histori aksi harian: submit/reject BBMB
// (updated_at/updated_by, aksi GUDANG) dan konfirmasi pengambilan fisik BBMB
// (diambil_at/diambil_oleh, aksi OPERATOR - sejak 17 Agu 2026 pengambilan
// dikonfirmasi operator sendiri, bukan Gudang lagi). Dua kolom timestamp
// TERPISAH (bukan cuma updated_at) supaya event pengambilan gak ketiban/nyampur
// sama jejak submit/reject Gudang. Filter tanggal cek KEDUANYA - 1 item bisa
// muncul 2x di tanggal beda (disiapkan hari Senin, diambil hari Rabu = 2 baris
// riwayat terpisah, bukan cuma nampilin aksi terakhir).
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

const aksiInfo=(item:any):{label:string,color:string}=>{
  if(item.eventType==="pickup")return{label:"✓ Sudah Diambil",color:"#0369a1"};
  if(item.status==="submit")return{label:"✓ Disiapkan",color:"#16a34a"};
  if(item.status==="reject")return{label:"✕ Ditolak",color:"#dc2626"};
  return{label:item.status,color:"#94a3b8"};
};

export function RiwayatGudangTab(){
  const[tanggal,setTanggal]=useState(new Date().toISOString().slice(0,10));
  const[loading,setLoading]=useState(true);
  const[rows,setRows]=useState<any[]>([]);

  const fetchData=async()=>{
    setLoading(true);
    const startIso=tanggal+"T00:00:00";
    const endIso=tanggal+"T23:59:59.999";
    const inRange=(d:string)=>!!d&&d>=startIso&&d<=endIso;
    // 2 sumber event TERPISAH per item - updated_at/updated_by (aksi Gudang: submit/reject) dan
    // diambil_at/diambil_oleh (aksi operator: konfirmasi ambil) - 1 item bisa nyumbang 2 baris
    // riwayat kalau dua-duanya kena tanggal yang sama query ini (jarang, tapi mungkin).
    const [byUpdated,byDiambil]=await Promise.all([
      fetchAllPaged((from,to)=>
        supabase.from("permintaan_item").select("*").not("updated_at","is",null)
          .gte("updated_at",startIso).lte("updated_at",endIso).range(from,to)),
      fetchAllPaged((from,to)=>
        supabase.from("permintaan_item").select("*").not("diambil_at","is",null)
          .gte("diambil_at",startIso).lte("diambil_at",endIso).range(from,to)),
    ]);
    const events=[
      ...byUpdated.map((it:any)=>({...it,eventType:"status",eventAt:it.updated_at,eventBy:it.updated_by})),
      ...byDiambil.filter((it:any)=>!inRange(it.updated_at)).map((it:any)=>({...it,eventType:"pickup",eventAt:it.diambil_at,eventBy:it.diambil_oleh})),
      // byDiambil yang updated_at-nya JUGA kena tanggal ini udah kebawa lewat byUpdated (event
      // "status" duluan) - tambahin event "pickup"-nya juga biar 2 aksi beda hari tetap kelihatan
      // dua-duanya, bukan 1 baris doang.
      ...byDiambil.filter((it:any)=>inRange(it.updated_at)).map((it:any)=>({...it,eventType:"pickup",eventAt:it.diambil_at,eventBy:it.diambil_oleh})),
    ].sort((a,b)=>(b.eventAt||"").localeCompare(a.eventAt||""));
    const permIds=[...new Set(events.map((it:any)=>it.permintaan_id))];
    if(permIds.length===0){setRows([]);setLoading(false);return;}
    const perms=await fetchAllPaged((from,to)=>supabase.from("permintaan").select("*").in("id",permIds).range(from,to));
    const permMap:Record<number,any>={};
    perms.forEach((p:any)=>{permMap[p.id]=p;});
    setRows(events.map((it:any)=>({...it,perm:permMap[it.permintaan_id]})).filter((r:any)=>r.perm));
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

  return(
    <div style={{padding:16}} className="fi">
      <SectionCard icon="🕒" title="Riwayat Harian" subtitle="Aksi submit/reject/status/tarik yang sudah diproses">
      <input type="date" value={tanggal} onChange={(e:any)=>setTanggal(e.target.value)}
        style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid #cbd5e1",fontSize:14,fontWeight:600,color:"#0f172a",background:"#fff",fontFamily:"inherit",marginBottom:14}}/>

      {loading?(
        <div style={{textAlign:"center",padding:40,color:"#94a3b8",fontSize:13}}>Memuat...</div>
      ):rows.length===0?(
        <EmptyState title="Belum ada aksi" description="Belum ada aksi submit/reject/ambil yang tercatat di tanggal ini."/>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {rows.map((r:any)=>{
            const aksi=aksiInfo(r);
            return(
              <div key={`${r.id}-${r.eventType}`} style={{background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:12,padding:"11px 14px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:6}}>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:"#1e293b"}}>{r.nama_komponen} <span style={{color:"#64748b",fontWeight:500}}>×{r.qty}{r.satuan?` ${r.satuan}`:""}</span></div>
                    <div style={{fontSize:10.5,color:"#94a3b8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {r.perm.jenis} · {DIVISI_LABEL[r.perm.divisi]||r.perm.divisi} · {r.perm.operator_nama} · {r.perm.proyek||"-"}
                    </div>
                  </div>
                  <span style={{flexShrink:0,background:aksi.color+"18",color:aksi.color,borderRadius:20,padding:"3px 10px",fontSize:10.5,fontWeight:700,whiteSpace:"nowrap"}}>{aksi.label}</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:10.5,color:"#94a3b8"}}>
                  <span>oleh {r.eventBy||"-"}</span>
                  <span>{fmtDateTime(r.eventAt)}</span>
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
