import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { SectionCard, SegmentedControl, EmptyState, DatePickerField } from "./gudang/GudangUI";

// ─────────────────────────────────────────────────────────────────────────────
// TAB PERMINTAAN (dalam GudangHome) - sisi Gudang buat proses masuk BBMB & BBMU.
// Query/grouping logic sama persis prinsipnya dengan PermintaanBarangTab.tsx
// (vista-teknik admin, SUDAH DIHAPUS 14 Agu 2026 - fitur ini sepenuhnya pindah
// ke sini), UI mobile-first beda dari versi desktop lama.
//
// PENYATUAN PENUH (3 Sep 2026) - KEPUTUSAN FINAL: BBMB & BBMU sekarang HARUS
// PERSIS SAMA di semua sisi, satu-satunya beda adalah KATEGORI DATA (komponen
// dari master kategori BBMB vs BBMU), BUKAN behavior/status/layout. Sebelumnya
// BBMU pakai vocab beda (tersedia/belum_lengkap/belum_datang, gak ada reject) &
// komponen terpisah (BBMUList) dari BBMB (BBMBList) - digabung jadi 1 komponen
// PermintaanList(jenis) di bawah. Status BBMU sekarang SAMA PERSIS BBMB:
// pending -> submit (✓)/reject (✗, catatan wajib). TIDAK ADA migration DB yang
// diperlukan - permintaan_item.status cuma `text`, gak ada CHECK constraint
// sama sekali (dicek langsung ke migration aslinya).
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
// is_hutang=false (5 Sep 2026) - row hutang (sisa yang belum terpenuhi) SENGAJA dikecualikan
// dari sini, dia punya permintaan_id yang SAMA dengan item asli tapi harus MUNCUL DI SUBTAB
// HUTANG TERPISAH (lihat HutangList di bawah), bukan ikut tercampur di BBMB/BBMU biasa.
const fetchItemsByPermintaanIds=async(ids:number[]):Promise<any[]>=>{
  if(ids.length===0)return[];
  return fetchAllPaged((from,to)=>supabase.from("permintaan_item").select("*").in("permintaan_id",ids).eq("is_hutang",false).range(from,to));
};
const groupItemsByPermintaan=(items:any[]):Record<number,any[]>=>{
  const map:Record<number,any[]>={};
  items.forEach((it:any)=>{(map[it.permintaan_id]=map[it.permintaan_id]||[]).push(it);});
  return map;
};
const fmtDateTime=(d:string)=>d?new Date(d).toLocaleString("id-ID",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):"-";

// ── FITUR HUTANG (5 Sep 2026) - pemenuhan sebagian permintaan ──────────────────────────────
// Proses submit dengan opsi qty partial - dipakai BARENGAN oleh PermintaanList (BBMB/BBMU
// biasa) DAN HutangList (cicilan hutang), satu sumber logic gak ada duplikat. qtyDipenuhi <
// qty item saat ini -> row asli di-update jadi qty yang beneran dikeluarkan, SISA jadi row
// hutang BARU (is_hutang=true, induk_item_id nunjuk ke row ini, bisa dicicil lagi berkali-kali
// - row hutang yang gak lunas juga lewat fungsi ini lagi, rantainya nyambung otomatis).
const prosesSubmitDenganQty=async(item:any,qtyDipenuhi:number,adminName:string,targetDivisi?:string)=>{
  const qtyLama=Number(item.qty);
  const lunasPenuh=qtyDipenuhi>=qtyLama;
  await supabase.from("permintaan_item").update({
    status:"submit",qty:qtyDipenuhi,
    updated_by:adminName,updated_at:new Date().toISOString(),dilihat_operator:false,
  }).eq("id",item.id);
  let sisaQty=0;
  if(!lunasPenuh){
    sisaQty=qtyLama-qtyDipenuhi;
    await supabase.from("permintaan_item").insert({
      permintaan_id:item.permintaan_id,
      komponen_bbmb_master_id:item.komponen_bbmb_master_id,
      komponen_master_id:item.komponen_master_id,
      kode_komponen:item.kode_komponen,
      nama_komponen:item.nama_komponen,
      satuan:item.satuan,
      satuan_dipilih:item.satuan_dipilih,
      qty:sisaQty,
      qty_diminta_awal:qtyLama,
      status:"pending",
      is_hutang:true,
      induk_item_id:item.id,
    });
  }
  // Fitur tambahan, GAGAL DI SINI TIDAK BOLEH gagalin update status yang udah beres di atas.
  if(targetDivisi){
    try{
      await supabase.functions.invoke("notify-permintaan",{body:{
        trigger:"status",targetDivisi,
        namaKomponen:item.nama_komponen,qty:qtyDipenuhi,satuan:item.satuan,
        statusLabel:lunasPenuh?"Sudah Siap":`Dipenuhi Sebagian (Sisa ${sisaQty} jadi Hutang)`,
      }});
    }catch{/* notifikasi gagal - diabaikan, status tetap tersimpan */}
  }
};

// Modal konfirmasi qty saat submit - default qty = qty diminta (paling umum: dipenuhi penuh,
// gudang tinggal klik Konfirmasi tanpa ubah apa-apa), gudang cek stok fisik MANUAL sendiri lalu
// turunkan angkanya kalau stok gak cukup. Validasi: 0 < qty <= qty saat ini di row.
function QtyEditModal({item,onConfirm,onCancel,submitting}:{item:any;onConfirm:(qty:number)=>void;onCancel:()=>void;submitting:boolean}){
  const[qtyInput,setQtyInput]=useState(String(item.qty));
  const qtyNum=Number(qtyInput)||0;
  const valid=qtyNum>0&&qtyNum<=item.qty;
  return(
    <div onClick={onCancel} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div onClick={(e:any)=>e.stopPropagation()} style={{background:"#fff",borderRadius:16,padding:20,width:"100%",maxWidth:340}}>
        <div style={{fontWeight:800,fontSize:15,color:"#1e293b",marginBottom:4}}>Konfirmasi Qty Dikeluarkan</div>
        <div style={{fontSize:12,color:"#64748b",marginBottom:12}}>{item.nama_komponen} · diminta {item.qty}{item.satuan?` ${item.satuan}`:""}</div>
        <div style={{marginBottom:6,fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4}}>Qty yang benar-benar dikeluarkan</div>
        <input type="number" min="0" max={item.qty} autoFocus value={qtyInput} onChange={(e:any)=>setQtyInput(e.target.value)}
          style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid #cbd5e1",fontSize:16,fontWeight:700,color:"#0f172a",fontFamily:"inherit",marginBottom:6,boxSizing:"border-box" as const}}/>
        {qtyNum>0&&qtyNum<item.qty&&(
          <div style={{fontSize:11.5,color:"#d97706",marginBottom:8,fontWeight:600}}>
            ⚠ Sisa {item.qty-qtyNum}{item.satuan?` ${item.satuan}`:""} akan jadi Hutang.
          </div>
        )}
        {!valid&&qtyInput!==""&&(
          <div style={{fontSize:11.5,color:"#dc2626",marginBottom:8,fontWeight:600}}>Qty harus lebih dari 0 dan tidak boleh melebihi {item.qty}.</div>
        )}
        <div style={{display:"flex",gap:8,marginTop:10}}>
          <button onClick={onCancel} disabled={submitting} style={{flex:1,padding:"10px",borderRadius:10,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#64748b",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Batal</button>
          <button onClick={()=>onConfirm(qtyNum)} disabled={!valid||submitting}
            style={{flex:1,padding:"10px",borderRadius:10,border:"none",background:!valid||submitting?"#94a3b8":"#16a34a",color:"#fff",fontWeight:700,fontSize:13,cursor:!valid||submitting?"default":"pointer",fontFamily:"inherit"}}>
            {submitting?"Menyimpan...":"Konfirmasi"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PermintaanGudangTab({user}:{user:any}){
  const adminName=user?.nama||user?.name||"Gudang";
  const[jenisTab,setJenisTab]=useState<"BBMB"|"BBMU"|"HUTANG">("BBMB");
  // Filter tanggal per hari (REVISI 2 Sep 2026) - discope ke tanggal permintaan dibuat
  // (permintaan.created_at), pola sama kayak RiwayatGudangTab.
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

  // Badge angka Hutang (5 Sep 2026) - beda mekanisme dari unread-dot BBMB/BBMU di atas (yang
  // titik biner "ada yang belum dibaca"). Ini ANGKA JUMLAH BARIS outstanding (is_hutang=true
  // AND status='pending') - TIDAK boleh "hilang cuma karena dilihat", cuma berkurang kalau
  // hutangnya beneran diproses (lunas atau sisa berkurang jadi row hutang baru yang lebih kecil
  // - count row pending tetap jalan otomatis ngikutin apa pun perubahannya).
  const[hutangCount,setHutangCount]=useState(0);
  const fetchHutangCount=async()=>{
    const{count}=await supabase.from("permintaan_item").select("id",{count:"exact",head:true}).eq("is_hutang",true).eq("status","pending");
    setHutangCount(count||0);
  };

  useEffect(()=>{
    checkUnread();
    markRead("BBMB"); // tab default (BBMB) ke-mark dibaca begitu layar ini dibuka
    fetchHutangCount();
    const ch=supabase.channel("realtime-gudang-unread")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"permintaan"},checkUnread)
      .subscribe();
    const chHutang=supabase.channel("realtime-gudang-hutang-count")
      .on("postgres_changes",{event:"*",schema:"public",table:"permintaan_item"},fetchHutangCount)
      .subscribe();
    return()=>{supabase.removeChannel(ch);supabase.removeChannel(chHutang);};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  const handleTabChange=(k:"BBMB"|"BBMU"|"HUTANG")=>{
    setJenisTab(k);
    if(k!=="HUTANG")markRead(k);
  };

  return(
    <div style={{padding:16}} className="fi">
      <SectionCard icon="📋" title="Permintaan Masuk" subtitle="Proses permintaan BBMB & BBMU dari operator">
        <SegmentedControl options={[
          {key:"BBMB",label:"BBMB (Bantu)",icon:"🧰",dot:unread.BBMB},
          {key:"BBMU",label:"BBMU (Utama)",icon:"⚙️",dot:unread.BBMU},
          {key:"HUTANG",label:"Hutang",icon:"🧾",badge:hutangCount},
        ]} value={jenisTab} onChange={handleTabChange}/>
        {jenisTab==="HUTANG"?(
          <HutangList adminName={adminName}/>
        ):(
          <>
            <div style={{marginBottom:14}}><DatePickerField value={tanggal} onChange={setTanggal}/></div>
            <PermintaanList jenis={jenisTab} adminName={adminName} tanggal={tanggal}/>
          </>
        )}
      </SectionCard>
    </div>
  );
}

// ================= BBMB & BBMU (1 komponen, persis sama) =================
function PermintaanList({jenis,adminName,tanggal}:{jenis:"BBMB"|"BBMU";adminName:string;tanggal:string}){
  const[loading,setLoading]=useState(true);
  const[permMap,setPermMap]=useState<Record<number,any>>({});
  const[itemsByPerm,setItemsByPerm]=useState<Record<number,any[]>>({});
  const[rejectTarget,setRejectTarget]=useState<any|null>(null);
  const[rejectCatatan,setRejectCatatan]=useState("");
  const[submittingId,setSubmittingId]=useState<number|null>(null);
  const[qtyTarget,setQtyTarget]=useState<any|null>(null); // fitur Hutang, 5 Sep 2026

  // silent (5 Sep 2026, fix pola sama RiwayatGudangTab.tsx) - fetchData dipicu ulang oleh
  // realtime SETIAP kali ada perubahan permintaan_item, TERMASUK aksi submit/reject admin
  // gudang sendiri (yang udah manggil fetchData() langsung juga - lihat handleQtyConfirm/
  // setItemStatus di bawah). Tanpa ini, tiap 1 klik submit/reject bikin list "berkedip" DUA
  // KALI (sekali dari panggilan langsung, sekali lagi dari realtime echo) - admin gudang yang
  // proses banyak item berturut-turut bakal ngerasa keganggu banget.
  const fetchData=async(silent=false)=>{
    if(!silent)setLoading(true);
    // Discope ke tanggal permintaan DIBUAT (bukan tanggal item-nya diproses) - fetch perms dulu
    // (di-filter tanggal+jenis), baru ambil item punya perm-perm itu.
    const startIso=tanggal+"T00:00:00";
    const endIso=tanggal+"T23:59:59.999";
    const perms=await fetchAllPaged((from,to)=>supabase.from("permintaan").select("*").eq("jenis",jenis)
      .gte("created_at",startIso).lte("created_at",endIso).order("created_at",{ascending:false}).range(from,to));
    if(perms.length===0){setPermMap({});setItemsByPerm({});if(!silent)setLoading(false);return;}
    const permIds=perms.map((p:any)=>p.id);
    const allItems=await fetchItemsByPermintaanIds(permIds);
    const pMap:Record<number,any>={};
    perms.forEach((p:any)=>{pMap[p.id]=p;});
    setPermMap(pMap);
    setItemsByPerm(groupItemsByPermintaan(allItems));
    if(!silent)setLoading(false);
  };

  useEffect(()=>{
    fetchData();
    const ch=supabase.channel(`realtime-gudang-masuk-${jenis}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"permintaan_item"},()=>fetchData(true))
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"permintaan"},()=>fetchData(true))
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[jenis,tanggal]);

  // Push notif ke divisi pengaju - cari item+perm dari state yang UDAH ADA (itemsByPerm/permMap)
  // SEBELUM update, biar tau divisi tujuan + nama komponen buat isi notif.
  const findItemContext=(itemId:number)=>{
    for(const permId of Object.keys(itemsByPerm)){
      const found=(itemsByPerm[Number(permId)]||[]).find((it:any)=>it.id===itemId);
      if(found)return{item:found,perm:permMap[Number(permId)]};
    }
    return null;
  };

  // Submit sekarang WAJIB lewat QtyEditModal (5 Sep 2026, fitur Hutang) - reject TETAP langsung
  // (gak ada opsi qty parsial buat reject, tolak ya tolak semua sisa qty item itu).
  const handleQtyConfirm=async(qty:number)=>{
    if(!qtyTarget)return;
    setSubmittingId(qtyTarget.id);
    const ctx=findItemContext(qtyTarget.id);
    await prosesSubmitDenganQty(qtyTarget,qty,adminName,ctx?.perm?.divisi);
    setQtyTarget(null);setSubmittingId(null);
    fetchData();
  };

  const setItemStatus=async(itemId:number,status:"reject",catatan?:string)=>{
    setSubmittingId(itemId);
    const ctx=findItemContext(itemId);
    await supabase.from("permintaan_item").update({status,catatan_reject:catatan||null,updated_by:adminName,updated_at:new Date().toISOString(),dilihat_operator:false}).eq("id",itemId);
    // Fitur tambahan, GAGAL DI SINI TIDAK BOLEH gagalin update status yang udah beres di atas.
    if(ctx?.perm?.divisi){
      try{
        await supabase.functions.invoke("notify-permintaan",{body:{
          trigger:"reject",targetDivisi:ctx.perm.divisi,
          namaKomponen:ctx.item.nama_komponen,qty:ctx.item.qty,satuan:ctx.item.satuan,catatanReject:catatan||null,
        }});
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
  if(divisiKeys.length===0)return<EmptyState title={`Tidak ada permintaan ${jenis}`}
    description={`Semua permintaan ${jenis==="BBMB"?"bantu":"utama"} sudah diproses. Permintaan baru dari operator akan muncul di sini.`}
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
              // Fix (3 Sep 2026, bug nyata dilaporkan) - dulu SEMUA item ditampilkan (termasuk yang
              // udah "Sudah Siap"/"Ditolak", nongkrong jadi baris badge) selama card-nya sendiri
              // masih ada item lain yang pending. Sekarang cuma item PENDING yang tampil di sini -
              // begitu 1 item diproses, item itu langsung hilang dari card ini (gak nunggu card-nya
              // sendiri kosong total). Card-nya sendiri baru hilang kalau UDAH gak ada item pending
              // sama sekali (logic grouped di atas, gak berubah).
              const items=(itemsByPerm[permId]||[]).filter((it:any)=>it.status==="pending");
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
                        <div style={{display:"flex",gap:6,flexShrink:0}}>
                          <button onClick={()=>setQtyTarget(it)} disabled={submittingId===it.id}
                            title="Submit - barang disiapkan"
                            style={{width:30,height:30,borderRadius:8,border:"1px solid #bbf7d0",background:"#f0fdf4",
                              color:"#16a34a",cursor:"pointer",fontSize:15,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center"}}>✓</button>
                          <button onClick={()=>{setRejectTarget(it);setRejectCatatan("");}} disabled={submittingId===it.id}
                            title="Reject"
                            style={{width:30,height:30,borderRadius:8,border:"1px solid #fecaca",background:"#fef2f2",
                              color:"#dc2626",cursor:"pointer",fontSize:15,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
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

      {qtyTarget&&(
        <QtyEditModal item={qtyTarget} submitting={submittingId===qtyTarget.id} onCancel={()=>setQtyTarget(null)} onConfirm={handleQtyConfirm}/>
      )}

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

// ================= HUTANG (5 Sep 2026) - sisa pemenuhan sebagian, bisa dicicil ==============
// TANPA filter tanggal (beda dari PermintaanList di atas) - hutang bisa lintas hari, harus
// TETAP muncul sampai beneran lunas, gak scoped ke tanggal permintaan dibuat. Query langsung
// is_hutang=true AND status='pending' (row yang masih outstanding), grup per divisi sama
// persis pola PermintaanList - submit/reject-nya REUSE prosesSubmitDenganQty/QtyEditModal yang
// sama, jadi cicilan lanjutan (masih ada sisa lagi) otomatis jalan lewat jalur yang sama.
function HutangList({adminName}:{adminName:string}){
  const[loading,setLoading]=useState(true);
  const[permMap,setPermMap]=useState<Record<number,any>>({});
  const[itemsByPerm,setItemsByPerm]=useState<Record<number,any[]>>({});
  const[rejectTarget,setRejectTarget]=useState<any|null>(null);
  const[rejectCatatan,setRejectCatatan]=useState("");
  const[qtyTarget,setQtyTarget]=useState<any|null>(null);
  const[submittingId,setSubmittingId]=useState<number|null>(null);

  // silent - sama fix RiwayatGudangTab.tsx/PermintaanList di atas, biar list gak "berkedip"
  // dobel tiap submit/reject/cicil hutang.
  const fetchData=async(silent=false)=>{
    if(!silent)setLoading(true);
    const hutangItems=await fetchAllPaged((from,to)=>supabase.from("permintaan_item").select("*").eq("is_hutang",true).eq("status","pending").range(from,to));
    if(hutangItems.length===0){setPermMap({});setItemsByPerm({});if(!silent)setLoading(false);return;}
    const permIds=[...new Set(hutangItems.map((it:any)=>it.permintaan_id))];
    const perms=await fetchAllPaged((from,to)=>supabase.from("permintaan").select("*").in("id",permIds).range(from,to));
    const pMap:Record<number,any>={};
    perms.forEach((p:any)=>{pMap[p.id]=p;});
    setPermMap(pMap);
    setItemsByPerm(groupItemsByPermintaan(hutangItems));
    if(!silent)setLoading(false);
  };

  useEffect(()=>{
    fetchData();
    const ch=supabase.channel("realtime-gudang-hutang-list")
      .on("postgres_changes",{event:"*",schema:"public",table:"permintaan_item"},()=>fetchData(true))
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  const findItemContext=(itemId:number)=>{
    for(const permId of Object.keys(itemsByPerm)){
      const found=(itemsByPerm[Number(permId)]||[]).find((it:any)=>it.id===itemId);
      if(found)return{item:found,perm:permMap[Number(permId)]};
    }
    return null;
  };

  const handleQtyConfirm=async(qty:number)=>{
    if(!qtyTarget)return;
    setSubmittingId(qtyTarget.id);
    const ctx=findItemContext(qtyTarget.id);
    await prosesSubmitDenganQty(qtyTarget,qty,adminName,ctx?.perm?.divisi);
    setQtyTarget(null);setSubmittingId(null);
    fetchData();
  };

  const doReject=async(itemId:number,catatan:string)=>{
    setSubmittingId(itemId);
    const ctx=findItemContext(itemId);
    await supabase.from("permintaan_item").update({status:"reject",catatan_reject:catatan,updated_by:adminName,updated_at:new Date().toISOString(),dilihat_operator:false}).eq("id",itemId);
    if(ctx?.perm?.divisi){
      try{
        await supabase.functions.invoke("notify-permintaan",{body:{
          trigger:"reject",targetDivisi:ctx.perm.divisi,
          namaKomponen:ctx.item.nama_komponen,qty:ctx.item.qty,satuan:ctx.item.satuan,catatanReject:catatan,
        }});
      }catch{/* notifikasi gagal - diabaikan */}
    }
    setRejectTarget(null);setRejectCatatan("");setSubmittingId(null);
    fetchData();
  };

  const grouped:Record<string,number[]>={};
  Object.values(permMap).forEach((p:any)=>{
    const key=p.divisi||"-";
    if(!grouped[key])grouped[key]=[];
    grouped[key].push(p.id);
  });
  const divisiKeys=Object.keys(grouped).sort();

  if(loading)return<div style={{textAlign:"center",padding:40,color:"#94a3b8",fontSize:13}}>Memuat...</div>;
  if(divisiKeys.length===0)return<EmptyState title="Tidak ada Hutang"
    description="Semua permintaan sudah dipenuhi penuh. Hutang muncul otomatis kalau qty yang dikeluarkan kurang dari yang diminta."
    tip="Hutang bisa dicicil bertahap sampai benar-benar lunas."/>;

  return(
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      {divisiKeys.map(divisi=>(
        <div key={divisi}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
            <span style={{background:"#fef2f2",color:"#dc2626",border:"1px solid #fecaca",borderRadius:6,padding:"3px 10px",fontSize:12,fontWeight:700}}>{DIVISI_LABEL[divisi]||divisi}</span>
            <span style={{color:"#94a3b8",fontWeight:600,fontSize:11}}>{grouped[divisi].length} hutang</span>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {grouped[divisi].map(permId=>{
              const p=permMap[permId];
              const items=itemsByPerm[permId]||[];
              return(
                <div key={permId} style={{background:"#fff",border:"1.5px solid #fecaca",borderRadius:14,padding:"12px 14px",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10,gap:8}}>
                    <div style={{minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>{p.operator_nama}</div>
                      <div style={{fontSize:11,color:"#64748b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.proyek||"-"} · {p.panel_nama||"-"}</div>
                    </div>
                    <div style={{fontSize:10,color:"#94a3b8",whiteSpace:"nowrap",flexShrink:0}}>{fmtDateTime(p.created_at)}</div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {items.map((it:any)=>(
                      <div key={it.id} style={{display:"flex",alignItems:"center",gap:8,background:"#fef2f2",borderRadius:9,padding:"8px 10px"}}>
                        <span style={{flex:1,minWidth:0,fontSize:12.5,fontWeight:600,color:"#334155",overflow:"hidden",textOverflow:"ellipsis"}}>
                          {it.nama_komponen} <span style={{color:"#dc2626",fontWeight:700}}>Hutang ×{it.qty}{it.satuan?` ${it.satuan}`:""}</span>
                          {it.qty_diminta_awal&&<span style={{color:"#94a3b8",fontWeight:500}}> (dari {it.qty_diminta_awal})</span>}
                        </span>
                        <div style={{display:"flex",gap:6,flexShrink:0}}>
                          <button onClick={()=>setQtyTarget(it)} disabled={submittingId===it.id}
                            title="Submit - barang disiapkan"
                            style={{width:30,height:30,borderRadius:8,border:"1px solid #bbf7d0",background:"#f0fdf4",
                              color:"#16a34a",cursor:"pointer",fontSize:15,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center"}}>✓</button>
                          <button onClick={()=>{setRejectTarget(it);setRejectCatatan("");}} disabled={submittingId===it.id}
                            title="Reject"
                            style={{width:30,height:30,borderRadius:8,border:"1px solid #fecaca",background:"#fef2f2",
                              color:"#dc2626",cursor:"pointer",fontSize:15,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
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

      {qtyTarget&&(
        <QtyEditModal item={qtyTarget} submitting={submittingId===qtyTarget.id} onCancel={()=>setQtyTarget(null)} onConfirm={handleQtyConfirm}/>
      )}

      {rejectTarget&&(
        <div onClick={()=>setRejectTarget(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div onClick={(e:any)=>e.stopPropagation()} style={{background:"#fff",borderRadius:16,padding:20,width:"100%",maxWidth:340}}>
            <div style={{fontWeight:800,fontSize:15,color:"#1e293b",marginBottom:4}}>Alasan Reject</div>
            <div style={{fontSize:12,color:"#64748b",marginBottom:12}}>{rejectTarget.nama_komponen} ×{rejectTarget.qty}{rejectTarget.satuan?` ${rejectTarget.satuan}`:""}</div>
            <textarea autoFocus value={rejectCatatan} onChange={(e:any)=>setRejectCatatan(e.target.value)}
              placeholder="Contoh: masih belum ada stok..."
              style={{width:"100%",minHeight:70,padding:"10px 12px",borderRadius:10,border:"1.5px solid #fecaca",fontSize:14,fontFamily:"inherit",resize:"vertical" as const,marginBottom:14}}/>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setRejectTarget(null)} style={{flex:1,padding:"10px",borderRadius:10,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#64748b",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Batal</button>
              <button onClick={()=>{if(!rejectCatatan.trim()){alert("Catatan reject wajib diisi");return;}doReject(rejectTarget.id,rejectCatatan.trim());}}
                style={{flex:1,padding:"10px",borderRadius:10,border:"none",background:"#dc2626",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Konfirmasi</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
