import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { SectionCard, EmptyState, DatePickerField } from "./gudang/GudangUI";

// ─────────────────────────────────────────────────────────────────────────────
// TAB TARIK (dalam GudangHome) - READ-ONLY sejak 17 Agu 2026. Konfirmasi
// pengambilan fisik SEKARANG dilakukan OPERATOR sendiri (lewat Riwayat Permintaan
// di PermintaanView.tsx, tombol "Konfirmasi Sudah Diambil"), Gudang cuma bisa
// LIHAT status "Belum Diambil"/"Sudah Diambil" - gak ada lagi tombol tandai
// manual dari sisi ini. BBMB SAJA - BBMU gak punya tahap pengambilan fisik
// terpisah (statusnya cukup di header permintaan: tersedia/belum_lengkap/
// belum_datang, gak ada kolom sudah_diambil di tabel permintaan).
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

type FilterMode="belum"|"sudah";

export function TarikGudangTab(){
  const[filterMode,setFilterMode]=useState<FilterMode>("belum");
  // Filter tanggal (REVISI 2 Sep 2026, pola sama kayak RiwayatGudangTab.tsx) - discope ke tanggal
  // PERMINTAAN DIBUAT (permintaan.created_at), bukan tanggal disiapkan/diambil - konsisten sama
  // tab lain (Permintaan Masuk, Riwayat, Permintaan operator) yang semua discope ke created_at.
  const[tanggal,setTanggal]=useState(new Date().toISOString().slice(0,10));
  const[loading,setLoading]=useState(true);
  const[rows,setRows]=useState<any[]>([]); // item + permintaan header digabung flat

  const fetchData=async()=>{
    setLoading(true);
    const startIso=tanggal+"T00:00:00";
    const endIso=tanggal+"T23:59:59.999";
    const perms=await fetchAllPaged((from,to)=>supabase.from("permintaan").select("*").eq("jenis","BBMB")
      .gte("created_at",startIso).lte("created_at",endIso).range(from,to));
    if(perms.length===0){setRows([]);setLoading(false);return;}
    const permMap:Record<number,any>={};
    perms.forEach((p:any)=>{permMap[p.id]=p;});
    const permIds=perms.map((p:any)=>p.id);
    // BBMB yang sudah disiapkan Gudang ("submit") - baik yang belum maupun yang sudah diambil,
    // biar Gudang bisa lihat dua-duanya (toggle filter di bawah), bukan cuma antrian aktif.
    const items=await fetchAllPaged((from,to)=>supabase.from("permintaan_item").select("*").eq("status","submit").in("permintaan_id",permIds).range(from,to));
    const merged=items
      .map((it:any)=>({...it,perm:permMap[it.permintaan_id]}))
      .filter((r:any)=>r.perm) // jaga-jaga kalau header udah gak ada
      .sort((a:any,b:any)=>(a.perm.created_at||"").localeCompare(b.perm.created_at||"")); // FIFO - antre paling lama duluan
    setRows(merged);
    setLoading(false);
  };

  useEffect(()=>{
    fetchData();
    const ch=supabase.channel("realtime-gudang-tarik")
      .on("postgres_changes",{event:"*",schema:"public",table:"permintaan_item"},fetchData)
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[tanggal]);

  const filteredRows=rows.filter(r=>filterMode==="belum"?!r.sudah_diambil:r.sudah_diambil);

  // Dikelompokkan per divisi (REVISI 2 Sep 2026, pola sama kayak BBMBList di PermintaanGudangTab.tsx)
  // - dulu 1 list panjang gabungan semua divisi, scroll makin jauh makin banyak antrian. Urutan FIFO
  // (created_at) tetap dipertahankan DI DALAM tiap grup divisi, cuma grupnya sendiri urut abjad.
  const grouped:Record<string,any[]>={};
  filteredRows.forEach(r=>{
    const key=r.perm.divisi||"-";
    if(!grouped[key])grouped[key]=[];
    grouped[key].push(r);
  });
  const divisiKeys=Object.keys(grouped).sort();

  return(
    <div style={{padding:16}} className="fi">
      <SectionCard icon="📦" title="Pengambilan Komponen" subtitle="Status pengambilan fisik BBMB - dikonfirmasi operator, bukan di sini">
      <div style={{marginBottom:14}}><DatePickerField value={tanggal} onChange={setTanggal}/></div>
      <div style={{display:"flex",gap:6,marginBottom:14,background:"#f1f5f9",borderRadius:12,padding:4}}>
        {([{k:"belum",l:"Belum Diambil"},{k:"sudah",l:"Sudah Diambil"}] as const).map(t=>(
          <button key={t.k} onClick={()=>setFilterMode(t.k)}
            style={{flex:1,padding:"9px 8px",border:"none",borderRadius:9,cursor:"pointer",
              fontWeight:700,fontSize:12.5,fontFamily:"inherit",
              background:filterMode===t.k?"#fff":"transparent",color:filterMode===t.k?"#0369a1":"#64748b",
              boxShadow:filterMode===t.k?"0 1px 3px rgba(0,0,0,0.08)":"none"}}>
            {t.l}
          </button>
        ))}
      </div>
      {loading?(
        <div style={{textAlign:"center",padding:40,color:"#94a3b8",fontSize:13}}>Memuat...</div>
      ):filteredRows.length===0?(
        <EmptyState title={filterMode==="belum"?"Tidak ada yang menunggu":"Belum ada yang diambil"}
          description={filterMode==="belum"?"Semua barang yang sudah disiapkan sudah dikonfirmasi diambil operator.":"Belum ada konfirmasi pengambilan dari operator."}
          tip="Konfirmasi pengambilan dilakukan operator sendiri lewat app mereka, bukan dari sini."/>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:18}}>
          {divisiKeys.map(divisi=>(
            <div key={divisi}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <span style={{background:"#eff6ff",color:"#1d4ed8",border:"1px solid #bfdbfe",borderRadius:6,padding:"3px 10px",fontSize:12,fontWeight:700}}>{DIVISI_LABEL[divisi]||divisi}</span>
                <span style={{color:"#94a3b8",fontWeight:600,fontSize:11}}>{grouped[divisi].length} item</span>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {grouped[divisi].map((r:any)=>(
                  <div key={r.id} style={{background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:14,padding:"12px 14px",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8,gap:8}}>
                      <div style={{minWidth:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                          <span style={{background:"#eff6ff",color:"#1d4ed8",borderRadius:5,padding:"1px 7px",fontSize:9.5,fontWeight:800}}>BBMB</span>
                          <span style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>{r.perm.operator_nama}</span>
                        </div>
                        <div style={{fontSize:11,color:"#64748b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                          {r.perm.proyek||"-"} · {r.perm.panel_nama||"-"}
                        </div>
                      </div>
                      <div style={{fontSize:10,color:"#94a3b8",whiteSpace:"nowrap",flexShrink:0}}>Diminta: {fmtDateTime(r.perm.created_at)}</div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:8,background:"#f8fafc",borderRadius:9,padding:"9px 10px"}}>
                      <span style={{flex:1,minWidth:0,fontSize:13,fontWeight:700,color:"#334155"}}>{r.nama_komponen} <span style={{color:"#64748b",fontWeight:500}}>×{r.qty}{r.satuan?` ${r.satuan}`:""}</span></span>
                      {r.sudah_diambil?(
                        <span style={{flexShrink:0,background:"#f0fdf4",color:"#16a34a",borderRadius:20,padding:"4px 10px",fontSize:10.5,fontWeight:700,whiteSpace:"nowrap" as const,textAlign:"right" as const}}>
                          ✓ Sudah Diambil
                        </span>
                      ):(
                        <span style={{flexShrink:0,background:"#fffbeb",color:"#b45309",borderRadius:20,padding:"4px 10px",fontSize:10.5,fontWeight:700,whiteSpace:"nowrap" as const}}>
                          Belum Diambil
                        </span>
                      )}
                    </div>
                    {r.sudah_diambil&&(
                      <div style={{marginTop:8,fontSize:10.5,color:"#16a34a",fontWeight:600}}>
                        ✓ Diambil oleh {r.diambil_oleh||"-"} — {fmtDateTime(r.diambil_at)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      </SectionCard>
    </div>
  );
}
