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

  // Push notif ke divisi pengaju (3 REVISI, 2 Sep 2026) - cari item+perm dari state yang UDAH ADA
  // (itemsByPerm/permMap) SEBELUM update, biar tau divisi tujuan + nama komponen buat isi notif.
  const findItemContext=(itemId:number)=>{
    for(const permId of Object.keys(itemsByPerm)){
      const found=(itemsByPerm[Number(permId)]||[]).find((it:any)=>it.id===itemId);
      if(found)return{item:found,perm:permMap[Number(permId)]};
    }
    return null;
  };

  const setItemStatus=async(itemId:number,status:"submit"|"reject",catatan?:string)=>{
    setSubmittingId(itemId);
    const ctx=findItemContext(itemId);
    await supabase.from("permintaan_item").update({status,catatan_reject:catatan||null,updated_by:adminName,updated_at:new Date().toISOString(),dilihat_operator:false}).eq("id",itemId);
    // Fitur tambahan, GAGAL DI SINI TIDAK BOLEH gagalin update status yang udah beres di atas.
    if(ctx?.perm?.divisi){
      try{
        if(status==="submit"){
          await supabase.functions.invoke("notify-permintaan",{body:{
            trigger:"status",targetDivisi:ctx.perm.divisi,
            namaKomponen:ctx.item.nama_komponen,qty:ctx.item.qty,satuan:ctx.item.satuan,statusLabel:"Sudah Siap",
          }});
        }else{
          await supabase.functions.invoke("notify-permintaan",{body:{
            trigger:"reject",targetDivisi:ctx.perm.divisi,
            namaKomponen:ctx.item.nama_komponen,qty:ctx.item.qty,satuan:ctx.item.satuan,catatanReject:catatan||null,
          }});
        }
      }catch{/* notifikasi gagal - diabaikan, status tetap tersimpan */}
    }
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
                            {it.status==="submit"?"Sudah Siap":"Ditolak"}
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
// REVISI (2 Sep 2026) - BBMU balik ke struktur penuh per-item (dulu SEMPAT disederhanakan jadi
// 1 status buat SELURUH permintaan/catatan bebas, TAPI gak ada data yang kepakai format itu - 0
// baris waktu revisi ini dibuat, jadi gak perlu migrasi). Sekarang polanya SAMA persis kayak
// BBMBList di atas (permintaan_item per komponen, masing-masing status sendiri) - bedanya cuma
// vocab status (tersedia/belum_lengkap/belum_datang, BUKAN submit/reject) dan gak ada reject-modal
// (BBMU gak punya penolakan, cuma status ketersediaan).
//
// FIX BUG NYATA (3 Sep 2026, ketemu pas audit): dulu sub-tab di-HARDCODE cuma "wiring_ctrl" &
// "assembling"+"Assembling Luar" (sisa desain lama waktu BBMU cuma buat 2 divisi itu) - tapi tab
// BBMU di PermintaanView.tsx operator SENGAJA dibuka buat SEMUA divisi (gak dikondisikan). Akibatnya
// permintaan BBMU dari divisi LAIN (kejadian nyata: mekanik/Bending, painting/Painting) TERSIMPAN
// di DB tapi GAK PERNAH KELIHATAN di sub-tab manapun di sisi Gudang - stuck permanen, gak bisa
// diproses. Sekarang dikelompokkan per-divisi OTOMATIS (persis pola BBMBList di atas), bukan
// whitelist tetap - divisi apapun yang kirim BBMU otomatis dapat grup sendiri.
function BBMUList({adminName,tanggal}:{adminName:string;tanggal:string}){
  const[loading,setLoading]=useState(true);
  const[permMap,setPermMap]=useState<Record<number,any>>({});
  const[itemsByPerm,setItemsByPerm]=useState<Record<number,any[]>>({});
  const[submittingId,setSubmittingId]=useState<number|null>(null);

  const fetchData=async()=>{
    setLoading(true);
    const startIso=tanggal+"T00:00:00";
    const endIso=tanggal+"T23:59:59.999";
    const perms=await fetchAllPaged((from,to)=>supabase.from("permintaan").select("*").eq("jenis","BBMU")
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
    const ch=supabase.channel("realtime-gudang-bbmu")
      .on("postgres_changes",{event:"*",schema:"public",table:"permintaan_item"},fetchData)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"permintaan"},fetchData)
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[tanggal]);

  // Push notif ke divisi pengaju - pola sama persis BBMBList.findItemContext di atas.
  const findItemContext=(itemId:number)=>{
    for(const permId of Object.keys(itemsByPerm)){
      const found=(itemsByPerm[Number(permId)]||[]).find((it:any)=>it.id===itemId);
      if(found)return{item:found,perm:permMap[Number(permId)]};
    }
    return null;
  };

  const setItemStatus=async(itemId:number,status:string)=>{
    setSubmittingId(itemId);
    const ctx=findItemContext(itemId);
    await supabase.from("permintaan_item").update({status,updated_by:adminName,updated_at:new Date().toISOString(),dilihat_operator:false}).eq("id",itemId);
    if(ctx?.perm?.divisi){
      try{
        await supabase.functions.invoke("notify-permintaan",{body:{
          trigger:"status",targetDivisi:ctx.perm.divisi,
          namaKomponen:ctx.item.nama_komponen,qty:ctx.item.qty,satuan:ctx.item.satuan,
          statusLabel:STATUS_LABEL_BBMU[status]||status,
        }});
      }catch{/* notifikasi gagal - diabaikan, status tetap tersimpan */}
    }
    setSubmittingId(null);
    fetchData();
  };

  const grouped:Record<string,number[]>={};
  Object.values(permMap).forEach((p:any)=>{
    const key=p.divisi||"-";
    if(!grouped[key])grouped[key]=[];
    grouped[key].push(p.id);
  });
  const divisiKeys=Object.keys(grouped).sort();

  return(
    <div>
      {loading?(
        <div style={{textAlign:"center",padding:40,color:"#94a3b8",fontSize:13}}>Memuat...</div>
      ):divisiKeys.length===0?(
        <EmptyState title="Belum ada permintaan BBMU"
          description="Permintaan dari operator akan muncul di sini, dikelompokkan per divisi."/>
      ):(
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
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {items.map((it:any)=>(
                    <div key={it.id} style={{background:"#f8fafc",borderRadius:9,padding:"8px 10px"}}>
                      <div style={{fontSize:12.5,fontWeight:600,color:"#334155",marginBottom:6}}>
                        {it.nama_komponen} <span style={{color:"#64748b",fontWeight:500}}>×{it.qty}{it.satuan?` ${it.satuan}`:""}</span>
                      </div>
                      <div style={{display:"flex",gap:5,flexWrap:"wrap" as const}}>
                        {(["tersedia","belum_lengkap","belum_datang"] as const).map(s=>{
                          const active=(it.status||"pending")===s;
                          return(
                            <button key={s} onClick={()=>setItemStatus(it.id,s)} disabled={submittingId===it.id}
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
              </div>
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
