import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { SectionCard, SegmentedControl, EmptyState } from "./gudang/GudangUI";

// ─────────────────────────────────────────────────────────────────────────────
// TAB PERMINTAAN (dalam GudangHome) - sisi Gudang buat proses masuk BBMB (submit/
// reject) dan BBMU (status tersedia/belum lengkap/belum datang). Query/grouping
// logic sama persis prinsipnya dengan PermintaanBarangTab.tsx (vista-teknik admin),
// direplikasi di sini (beda project, gak bisa cross-import) - UI mobile-first
// beda dari versi desktop (tombol icon-only kecil, bukan pill full-width).
// ─────────────────────────────────────────────────────────────────────────────

const DIVISI_LABEL:Record<string,string>={
  mekanik:"Mekanik",painting:"Painting",assembling:"Assembling",
  wiring_ctrl:"Wiring Control",wiring_pwr:"Wiring Power",
  qc:"QC",nameplate:"Nameplate",komponen:"Komponen",gudang:"Gudang",
};
const STATUS_LABEL_BBMU:Record<string,string>={pending:"Menunggu",tersedia:"Tersedia",belum_lengkap:"Belum Lengkap",belum_datang:"Belum Datang"};
const STATUS_COLOR_BBMU:Record<string,string>={pending:"#94a3b8",tersedia:"#16a34a",belum_lengkap:"#f59e0b",belum_datang:"#dc2626"};

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
const fetchItemsByPermintaanIds=async(ids:number[]):Promise<any[]>=>{
  if(ids.length===0)return[];
  return fetchAllPaged((from,to)=>supabase.from("permintaan_item").select("*").in("permintaan_id",ids).range(from,to));
};
const groupItemsByPermintaan=(items:any[]):Record<number,any[]>=>{
  const map:Record<number,any[]>={};
  items.forEach((it:any)=>{(map[it.permintaan_id]=map[it.permintaan_id]||[]).push(it);});
  return map;
};
const fmtDateTime=(d:string)=>d?new Date(d).toLocaleString("id-ID",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):"-";

export function PermintaanGudangTab({user}:{user:any}){
  const adminName=user?.nama||user?.name||"Gudang";
  const[jenisTab,setJenisTab]=useState<"BBMB"|"BBMU">("BBMB");
  // Filter tanggal per hari (REVISI 2 Sep 2026) - dulu Permintaan Masuk gak punya filter waktu
  // sama sekali (BBMB nampilin SEMUA yang masih pending, BBMU nampilin SEMUA riwayat) - sekarang
  // di-scope ke tanggal permintaan dibuat (permintaan.created_at), pola sama kayak RiwayatGudangTab.
  const[tanggal,setTanggal]=useState(new Date().toISOString().slice(0,10));

  // Titik merah "belum dibaca" per sub-tab (REVISI 2 Sep 2026) - Gudang cuma 1 login SHARED
  // (operator_users gak punya baris per-individu buat divisi gudang), jadi status "sudah dibaca"
  // gak bisa disimpan di localStorage (beda device/sesi = beda status) - harus di tabel DB
  // (gudang_read_state) biar konsisten buat siapapun yang pakai login itu. Titik nyala kalau ada
  // permintaan.created_at LEBIH BARU dari last_read_at tab itu.
  const[unread,setUnread]=useState<Record<"BBMB"|"BBMU",boolean>>({BBMB:false,BBMU:false});

  const checkUnread=async()=>{
    const{data:readState}=await supabase.from("gudang_read_state").select("*");
    const readMap:Record<string,string>={};
    (readState||[]).forEach((r:any)=>{readMap[r.tab]=r.last_read_at;});
    const results:Record<"BBMB"|"BBMU",boolean>={BBMB:false,BBMU:false};
    for(const t of["BBMB","BBMU"] as const){
      const lastRead=readMap[t]||"1970-01-01T00:00:00Z";
      const{count}=await supabase.from("permintaan").select("id",{count:"exact",head:true}).eq("jenis",t).gt("created_at",lastRead);
      results[t]=(count||0)>0;
    }
    setUnread(results);
  };
  const markRead=async(t:"BBMB"|"BBMU")=>{
    setUnread(prev=>({...prev,[t]:false}));
    await supabase.from("gudang_read_state").upsert({tab:t,last_read_at:new Date().toISOString()});
  };

  useEffect(()=>{
    checkUnread();
    markRead(jenisTab); // tab default (BBMB) ke-mark dibaca begitu layar ini dibuka
    const ch=supabase.channel("realtime-gudang-unread")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"permintaan"},checkUnread)
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  const handleTabChange=(k:"BBMB"|"BBMU")=>{
    setJenisTab(k);
    markRead(k);
  };

  return(
    <div style={{padding:16}} className="fi">
      <SectionCard icon="📋" title="Permintaan Masuk" subtitle="Proses permintaan BBMB & BBMU dari operator">
        <SegmentedControl options={[
          {key:"BBMB",label:"BBMB (Bantu)",icon:"🧰",dot:unread.BBMB},
          {key:"BBMU",label:"BBMU (Utama)",icon:"⚙️",dot:unread.BBMU},
        ]} value={jenisTab} onChange={handleTabChange}/>
        <input type="date" value={tanggal} onChange={(e:any)=>setTanggal(e.target.value)}
          style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid #cbd5e1",fontSize:14,fontWeight:600,color:"#0f172a",background:"#fff",fontFamily:"inherit",marginBottom:14}}/>
        {jenisTab==="BBMB"?<BBMBList adminName={adminName} tanggal={tanggal}/>:<BBMUList adminName={adminName} tanggal={tanggal}/>}
      </SectionCard>
    </div>
  );
}

// ================= BBMB =================
function BBMBList({adminName,tanggal}:{adminName:string;tanggal:string}){
  const[loading,setLoading]=useState(true);
  const[permMap,setPermMap]=useState<Record<number,any>>({});
  const[itemsByPerm,setItemsByPerm]=useState<Record<number,any[]>>({});
  const[rejectTarget,setRejectTarget]=useState<any|null>(null);
  const[rejectCatatan,setRejectCatatan]=useState("");
  const[submittingId,setSubmittingId]=useState<number|null>(null);

  const fetchData=async()=>{
    setLoading(true);
    // Discope ke tanggal permintaan DIBUAT (bukan tanggal item-nya diproses) - fetch perms dulu
    // (di-filter tanggal), baru ambil item punya perm-perm itu. Grouping "cuma yang masih pending"
    // di bawah (grouped) tetap jalan seperti biasa dari itemsByPerm ini.
    const startIso=tanggal+"T00:00:00";
    const endIso=tanggal+"T23:59:59.999";
    const perms=await fetchAllPaged((from,to)=>supabase.from("permintaan").select("*").eq("jenis","BBMB")
      .gte("created_at",startIso).lte("created_at",endIso).order("created_at",{ascending:false}).range(from,to));
    if(perms.length===0){setPermMap({});setItemsByPerm({});setLoading(false);return;}
    const permIds=perms.map((p:any)=>p.id);
    const allItems=await fetchItemsByPermintaanIds(permIds);
    const pMap:Record<number,any>={};
    perms.forEach((p:any)=>{pMap[p.id]=p;});
    setPermMap(pMap);
    setItemsByPerm(groupItemsByPermintaan(allItems));
    setLoading(false);
  };

  useEffect(()=>{
    fetchData();
    const ch=supabase.channel("realtime-gudang-bbmb-masuk")
      .on("postgres_changes",{event:"*",schema:"public",table:"permintaan_item"},fetchData)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"permintaan"},fetchData)
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[tanggal]);

  const setItemStatus=async(itemId:number,status:"submit"|"reject",catatan?:string)=>{
    setSubmittingId(itemId);
    await supabase.from("permintaan_item").update({status,catatan_reject:catatan||null,updated_by:adminName,updated_at:new Date().toISOString(),dilihat_operator:false}).eq("id",itemId);
    setRejectTarget(null);setRejectCatatan("");setSubmittingId(null);
    fetchData();
  };

  const grouped:Record<string,number[]>={};
  Object.values(permMap).forEach((p:any)=>{
    const items=itemsByPerm[p.id]||[];
    if(!items.some((it:any)=>it.status==="pending"))return;
    const key=p.divisi||"-";
    if(!grouped[key])grouped[key]=[];
    grouped[key].push(p.id);
  });
  const divisiKeys=Object.keys(grouped).sort();

  if(loading)return<div style={{textAlign:"center",padding:40,color:"#94a3b8",fontSize:13}}>Memuat...</div>;
  if(divisiKeys.length===0)return<EmptyState title="Tidak ada permintaan BBMB"
    description="Semua permintaan bantu sudah diproses. Permintaan baru dari operator akan muncul di sini."
    tip="Pastikan stok tersedia sebelum memproses permintaan baru."/>;

  return(
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      {divisiKeys.map(divisi=>(
        <div key={divisi}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
            <span style={{background:"#eff6ff",color:"#1d4ed8",border:"1px solid #bfdbfe",borderRadius:6,padding:"3px 10px",fontSize:12,fontWeight:700}}>{DIVISI_LABEL[divisi]||divisi}</span>
            <span style={{color:"#94a3b8",fontWeight:600,fontSize:11}}>{grouped[divisi].length} permintaan</span>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {grouped[divisi].map(permId=>{
              const p=permMap[permId];
              const items=itemsByPerm[permId]||[];
              return(
                <div key={permId} style={{background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:14,padding:"12px 14px",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10,gap:8}}>
                    <div style={{minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>{p.operator_nama}</div>
                      <div style={{fontSize:11,color:"#64748b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.proyek||"-"} · {p.panel_nama||"-"}</div>
                    </div>
                    <div style={{fontSize:10,color:"#94a3b8",whiteSpace:"nowrap",flexShrink:0}}>{fmtDateTime(p.created_at)}</div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {items.map((it:any)=>(
                      <div key={it.id} style={{display:"flex",alignItems:"center",gap:8,background:"#f8fafc",borderRadius:9,padding:"8px 10px"}}>
                        <span style={{flex:1,minWidth:0,fontSize:12.5,fontWeight:600,color:"#334155",overflow:"hidden",textOverflow:"ellipsis"}}>
                          {it.nama_komponen} <span style={{color:"#64748b",fontWeight:500}}>×{it.qty}{it.satuan?` ${it.satuan}`:""}</span>
                        </span>
                        {it.status==="pending"?(
                          <div style={{display:"flex",gap:6,flexShrink:0}}>
                            <button onClick={()=>setItemStatus(it.id,"submit")} disabled={submittingId===it.id}
                              title="Submit - barang disiapkan"
                              style={{width:30,height:30,borderRadius:8,border:"1px solid #bbf7d0",background:"#f0fdf4",
                                color:"#16a34a",cursor:"pointer",fontSize:15,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center"}}>✓</button>
                            <button onClick={()=>{setRejectTarget(it);setRejectCatatan("");}} disabled={submittingId===it.id}
                              title="Reject"
                              style={{width:30,height:30,borderRadius:8,border:"1px solid #fecaca",background:"#fef2f2",
                                color:"#dc2626",cursor:"pointer",fontSize:15,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
                          </div>
                        ):(
                          <span style={{flexShrink:0,background:it.status==="submit"?"#f0fdf4":"#fef2f2",color:it.status==="submit"?"#16a34a":"#dc2626",
                            borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700,whiteSpace:"nowrap"}}>
                            {it.status==="submit"?"Disiapkan":"Ditolak"}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {rejectTarget&&(
        <div onClick={()=>setRejectTarget(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div onClick={(e:any)=>e.stopPropagation()} style={{background:"#fff",borderRadius:16,padding:20,width:"100%",maxWidth:340}}>
            <div style={{fontWeight:800,fontSize:15,color:"#1e293b",marginBottom:4}}>Alasan Reject</div>
            <div style={{fontSize:12,color:"#64748b",marginBottom:12}}>{rejectTarget.nama_komponen} ×{rejectTarget.qty}{rejectTarget.satuan?` ${rejectTarget.satuan}`:""}</div>
            <textarea autoFocus value={rejectCatatan} onChange={(e:any)=>setRejectCatatan(e.target.value)}
              placeholder="Contoh: stok kosong..."
              style={{width:"100%",minHeight:70,padding:"10px 12px",borderRadius:10,border:"1.5px solid #fecaca",fontSize:14,fontFamily:"inherit",resize:"vertical" as const,marginBottom:14}}/>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setRejectTarget(null)} style={{flex:1,padding:"10px",borderRadius:10,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#64748b",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Batal</button>
              <button onClick={()=>{if(!rejectCatatan.trim()){alert("Catatan reject wajib diisi");return;}setItemStatus(rejectTarget.id,"reject",rejectCatatan.trim());}}
                style={{flex:1,padding:"10px",borderRadius:10,border:"none",background:"#dc2626",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Konfirmasi</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ================= BBMU =================
const BBMU_SUBTABS=[
  {key:"wiring_ctrl",label:"Wiring Control",filter:(p:any)=>p.divisi==="wiring_ctrl"},
  {key:"assembling",label:"Assembling",filter:(p:any)=>p.divisi==="assembling"&&p.sub_bagian==="Assembling Luar"},
] as const;

function BBMUList({adminName,tanggal}:{adminName:string;tanggal:string}){
  void adminName; // permintaan (header BBMU) gak punya kolom updated_by/updated_at
  const[subTab,setSubTab]=useState<typeof BBMU_SUBTABS[number]["key"]>("wiring_ctrl");
  const[loading,setLoading]=useState(true);
  const[perms,setPerms]=useState<any[]>([]);

  const fetchData=async()=>{
    setLoading(true);
    const startIso=tanggal+"T00:00:00";
    const endIso=tanggal+"T23:59:59.999";
    const rows=await fetchAllPaged((from,to)=>supabase.from("permintaan").select("*").eq("jenis","BBMU")
      .gte("created_at",startIso).lte("created_at",endIso).order("created_at",{ascending:false}).range(from,to));
    setPerms(rows);
    setLoading(false);
  };

  useEffect(()=>{
    fetchData();
    const ch=supabase.channel("realtime-gudang-bbmu")
      .on("postgres_changes",{event:"*",schema:"public",table:"permintaan"},fetchData)
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[tanggal]);

  const setStatus=async(permId:number,status:string)=>{
    await supabase.from("permintaan").update({status,dilihat_operator:false}).eq("id",permId);
    fetchData();
  };

  const activeFilter=BBMU_SUBTABS.find(t=>t.key===subTab)!.filter;
  const filtered=perms.filter(activeFilter);

  return(
    <div>
      <div style={{display:"flex",gap:6,marginBottom:14}}>
        {BBMU_SUBTABS.map(t=>(
          <button key={t.key} onClick={()=>setSubTab(t.key)}
            style={{flex:1,height:32,borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:12,fontFamily:"inherit",
              border:subTab===t.key?"1.5px solid #1d4ed8":"1px solid #e2e8f0",
              background:subTab===t.key?"#eff6ff":"#fff",color:subTab===t.key?"#1d4ed8":"#64748b"}}>
            {t.label}
          </button>
        ))}
      </div>
      {loading?(
        <div style={{textAlign:"center",padding:40,color:"#94a3b8",fontSize:13}}>Memuat...</div>
      ):filtered.length===0?(
        <EmptyState title="Belum ada permintaan BBMU"
          description={`Belum ada permintaan dari ${BBMU_SUBTABS.find(t=>t.key===subTab)!.label}. Permintaan baru akan muncul di sini.`}/>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {filtered.map(p=>(
            <div key={p.id} style={{background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:14,padding:"12px 14px",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10,gap:8}}>
                <div style={{minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>{p.operator_nama}</div>
                  <div style={{fontSize:11,color:"#64748b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.proyek||"-"} · {p.panel_nama||"-"}</div>
                </div>
                <div style={{fontSize:10,color:"#94a3b8",whiteSpace:"nowrap",flexShrink:0}}>{fmtDateTime(p.created_at)}</div>
              </div>
              {p.catatan&&<div style={{fontSize:12.5,fontWeight:600,color:"#334155",background:"#f8fafc",borderRadius:9,padding:"8px 10px",marginBottom:10}}>{p.catatan}</div>}
              <div style={{display:"flex",gap:5,flexWrap:"wrap" as const}}>
                {(["tersedia","belum_lengkap","belum_datang"] as const).map(s=>{
                  const active=(p.status||"pending")===s;
                  return(
                    <button key={s} onClick={()=>setStatus(p.id,s)}
                      style={{padding:"6px 10px",borderRadius:20,cursor:"pointer",fontSize:10.5,fontWeight:700,fontFamily:"inherit",
                        border:active?"none":`1px solid ${STATUS_COLOR_BBMU[s]}44`,
                        background:active?STATUS_COLOR_BBMU[s]:STATUS_COLOR_BBMU[s]+"10",
                        color:active?"#fff":STATUS_COLOR_BBMU[s]}}>
                      {STATUS_LABEL_BBMU[s]}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
