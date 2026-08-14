import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Lbl, Card, SectionCard, EmptyState, CardToggle, SearchableSelect } from "./ui/Primitives";
import { DIVISI_CONFIG } from "../lib/panelTypes";

// ─────────────────────────────────────────────────────────────────────────────
// TAB PERMINTAAN BARANG (BBMB & BBMU) - sistem request/approve pengeluaran
// komponen. Independen total dari modul lama (komponen_stok/Warehouse progress
// panel) - tabel sendiri (permintaan/permintaan_item/komponen_bbmb_master).
// BBMB (Bantu): komponen dari master komponen_bbmb_master (diisi admin lewat
// upload Excel), tiap item punya qty+satuan bebas. BBMU (Utama): SEJAK 14 Agu
// 2026 disederhanakan jadi 1 row permintaan header per submit (proyek/panel/
// catatan bebas + status), TIDAK LAGI pakai permintaan_item sama sekali -
// permintaan_item sekarang eksklusif buat BBMB.
// Tab ini SENGAJA muncul buat SEMUA divisi (gak dikondisikan kayak tab
// Komponen/Arsip), jadi App.tsx render ini tanpa cek user.divisi. Redesign 14
// Agu 2026: pakai SectionCard/EmptyState/CardToggle (reuse dari redesign
// Gudang, sekarang di ui/Primitives.tsx) + aksen warna ikut DIVISI_CONFIG per
// divisi (bukan hardcode teal lagi).
// ─────────────────────────────────────────────────────────────────────────────

type Jenis="BBMB"|"BBMU";
type ItemRow={value:string;namaKomponen:string;qty:number;satuan:string};

const STATUS_LABEL:Record<Jenis,Record<string,string>>={
  BBMB:{pending:"Menunggu",submit:"✓ Disiapkan",reject:"✕ Ditolak"},
  BBMU:{pending:"Menunggu",tersedia:"Tersedia",belum_lengkap:"Belum Lengkap",belum_datang:"Belum Datang"},
};
const STATUS_COLOR:Record<Jenis,Record<string,string>>={
  BBMB:{pending:"#94a3b8",submit:"#16a34a",reject:"#dc2626"},
  BBMU:{pending:"#94a3b8",tersedia:"#16a34a",belum_lengkap:"#f59e0b",belum_datang:"#dc2626"},
};

const emptyItem=():ItemRow=>({value:"",namaKomponen:"",qty:1,satuan:""});

const selStyle:any={width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid #cbd5e1",fontSize:14,fontWeight:600,color:"#0f172a",background:"#fff",fontFamily:"inherit"};
const inpStyle:any={width:"100%",padding:"8px 10px",borderRadius:8,border:"1.5px solid #cbd5e1",fontSize:13,fontWeight:600,color:"#0f172a",background:"#fff",fontFamily:"inherit"};

export function PermintaanView({user}:{user:any}){
  const namaOperator=user?.nama||user?.name||"Operator";
  const divisi:string=user?.divisi||"";
  const subBagian:string|null=user?.sub_bagian||null;
  const cfg=(DIVISI_CONFIG as any)[divisi];
  const accent:string=cfg?.color||"#0d9488";

  const[jenisTab,setJenisTab]=useState<Jenis>("BBMB");

  const[woList,setWoList]=useState<any[]>([]);
  const[selectedWoId,setSelectedWoId]=useState<number|null>(null);
  const[panelList,setPanelList]=useState<any[]>([]);
  const[selectedPanelId,setSelectedPanelId]=useState<number|null>(null);

  const[masterList,setMasterList]=useState<any[]>([]); // BBMB: komponen_bbmb_master

  const[items,setItems]=useState<ItemRow[]>([emptyItem()]); // BBMB saja
  const[catatan,setCatatan]=useState(""); // BBMU saja
  const[submitting,setSubmitting]=useState(false);

  const[riwayat,setRiwayat]=useState<any[]>([]);
  const[loadingRiwayat,setLoadingRiwayat]=useState(true);
  const[confirmingId,setConfirmingId]=useState<number|null>(null);

  useEffect(()=>{
    supabase.from("work_orders").select("id,wo,proyek").eq("is_archived",false).order("created_at",{ascending:false})
      .then(({data})=>setWoList(data??[]));
    supabase.from("komponen_bbmb_master").select("id,nama,satuan").order("nama",{ascending:true})
      .then(({data})=>setMasterList(data??[]));
  },[]);

  useEffect(()=>{
    setSelectedPanelId(null);
    setItems([emptyItem()]);
    setCatatan("");
    if(selectedWoId){
      supabase.from("panels").select("id,no_pnl,nama,tipe,wo_id,checklist").eq("wo_id",selectedWoId).is("deleted_at",null)
        .order("no_pnl",{ascending:true}).then(({data})=>setPanelList(data??[]));
    } else {
      setPanelList([]);
    }
  },[selectedWoId]);

  useEffect(()=>{
    setItems([emptyItem()]);
    setCatatan("");
  },[selectedPanelId,jenisTab]);

  // Riwayat SE-DIVISI (bukan cuma milik operator yang sedang login) - siapapun yang login di
  // divisi yang sama bisa lihat & konfirmasi pengambilan permintaan siapa saja di divisi itu,
  // gak dibatasi harus operator yang sama dengan yang minta.
  // "Aktif" = masih pending (belum diproses Gudang), baru berubah status dan belum dilihat, ATAU
  // (BBMB) sudah disiapkan tapi belum dikonfirmasi diambil - dipakai buat ngurutin (yang butuh
  // perhatian naik ke atas) DAN nentuin mana yang ditandai "sudah dibaca" begitu list ini tampil.
  const fetchRiwayat=async()=>{
    setLoadingRiwayat(true);
    const{data:perms}=await supabase.from("permintaan").select("*")
      .eq("jenis",jenisTab).eq("divisi",divisi)
      .order("created_at",{ascending:false}).limit(30);
    if(jenisTab==="BBMB"&&perms&&perms.length>0){
      const ids=perms.map((p:any)=>p.id);
      const{data:itemRows}=await supabase.from("permintaan_item").select("*").in("permintaan_id",ids);
      const map:Record<number,any[]>={};
      (itemRows||[]).forEach((it:any)=>{(map[it.permintaan_id]=map[it.permintaan_id]||[]).push(it);});
      const merged=perms.map((p:any)=>({...p,items:map[p.id]||[]}));
      const isAktif=(p:any)=>(p.items||[]).some((it:any)=>it.status==="pending"||!it.dilihat_operator||(it.status==="submit"&&!it.sudah_diambil));
      merged.sort((a:any,b:any)=>{
        const diff=Number(isAktif(b))-Number(isAktif(a));
        return diff!==0?diff:(b.created_at||"").localeCompare(a.created_at||"");
      });
      setRiwayat(merged);
      const unreadIds=(itemRows||[]).filter((it:any)=>it.status!=="pending"&&!it.dilihat_operator).map((it:any)=>it.id);
      if(unreadIds.length>0)supabase.from("permintaan_item").update({dilihat_operator:true}).in("id",unreadIds).then(()=>{});
    } else {
      const merged=perms??[];
      const isAktif=(p:any)=>p.status==="pending"||!p.dilihat_operator;
      merged.sort((a:any,b:any)=>{
        const diff=Number(isAktif(b))-Number(isAktif(a));
        return diff!==0?diff:(b.created_at||"").localeCompare(a.created_at||"");
      });
      setRiwayat(merged);
      const unreadIds=merged.filter((p:any)=>p.status&&p.status!=="pending"&&!p.dilihat_operator).map((p:any)=>p.id);
      if(unreadIds.length>0)supabase.from("permintaan").update({dilihat_operator:true}).in("id",unreadIds).then(()=>{});
    }
    setLoadingRiwayat(false);
  };

  useEffect(()=>{
    fetchRiwayat();
    const ch=supabase.channel(`realtime-permintaan-${jenisTab}-${divisi}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"permintaan_item"},()=>fetchRiwayat())
      .on("postgres_changes",{event:"*",schema:"public",table:"permintaan"},()=>fetchRiwayat())
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[jenisTab,divisi]);

  // Konfirmasi pengambilan fisik - SEKARANG dari sisi operator (bukan Gudang lagi, lihat
  // TarikGudangTab.tsx yang sudah jadi read-only). Siapapun yang login saat ini yang
  // mengonfirmasi (dicatat di diambil_oleh), gak harus operator yang sama dengan operator_nama
  // permintaan aslinya. BBMB saja - BBMU gak punya tahap pengambilan fisik terpisah.
  const konfirmasiDiambil=async(itemId:number)=>{
    setConfirmingId(itemId);
    await supabase.from("permintaan_item").update({
      sudah_diambil:true,diambil_oleh:namaOperator,diambil_at:new Date().toISOString(),
    }).eq("id",itemId);
    setConfirmingId(null);
    fetchRiwayat();
  };

  const updateItem=(idx:number,patch:Partial<ItemRow>)=>{
    setItems(prev=>prev.map((it,i)=>i===idx?{...it,...patch}:it));
  };
  const tambahBaris=()=>setItems(prev=>[...prev,emptyItem()]);
  const hapusBaris=(idx:number)=>setItems(prev=>prev.length<=1?prev:prev.filter((_,i)=>i!==idx));

  const onPilihKomponen=(idx:number,id:string,label:string)=>{
    updateItem(idx,{value:id,namaKomponen:label});
  };

  const submitPermintaan=async()=>{
    if(!selectedWoId){alert("Pilih Work Order dulu");return;}
    if(!selectedPanelId){alert("Pilih Panel dulu");return;}
    const itemsValid=jenisTab==="BBMB"?items.filter(it=>it.namaKomponen&&Number(it.qty)>0):[];
    if(jenisTab==="BBMB"&&itemsValid.length===0){alert("Isi minimal 1 komponen dengan qty lebih dari 0");return;}
    setSubmitting(true);
    const woObj=woList.find((w:any)=>w.id===selectedWoId);
    const panelObj=panelList.find((p:any)=>p.id===selectedPanelId);
    const{data:perm,error:permErr}=await supabase.from("permintaan").insert({
      jenis:jenisTab,operator_nama:namaOperator,divisi,sub_bagian:subBagian,
      wo_id:selectedWoId,panel_id:selectedPanelId,
      wo_number:woObj?.wo||null,proyek:woObj?.proyek||null,panel_nama:panelObj?.nama||null,
      ...(jenisTab==="BBMU"?{catatan:catatan||null,status:"pending"}:{}),
    }).select().single();
    if(permErr||!perm){
      alert("Gagal mengirim permintaan: "+(permErr?.message||"unknown error"));
      setSubmitting(false);
      return;
    }
    if(jenisTab==="BBMB"){
      const rows=itemsValid.map(it=>({
        permintaan_id:perm.id,
        komponen_bbmb_master_id:it.value?Number(it.value):null,
        nama_komponen:it.namaKomponen,
        qty:Number(it.qty),
        satuan:it.satuan||null,
        status:"pending",
      }));
      const{error:itemErr}=await supabase.from("permintaan_item").insert(rows);
      if(itemErr){
        alert("Permintaan tersimpan tapi gagal simpan komponen: "+itemErr.message);
        setSubmitting(false);
        return;
      }
    }
    setSubmitting(false);
    setSelectedWoId(null);
    setItems([emptyItem()]);
    setCatatan("");
    alert("Permintaan berhasil dikirim!");
    fetchRiwayat();
  };

  const fmtDateTime=(d:string)=>d?new Date(d).toLocaleString("id-ID",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):"-";

  return(
    <div style={{padding:16}} className="fi">
      <SectionCard icon="📥" iconBg={cfg?.bg} title="Permintaan Barang" subtitle="Ajukan permintaan komponen bantu atau utama.">
        <CardToggle options={[{key:"BBMB",label:"BBMB (Bantu)",icon:"🧰"},{key:"BBMU",label:"BBMU (Utama)",icon:"⚙️"}]}
          value={jenisTab} onChange={setJenisTab} color={accent}/>
      </SectionCard>

      <div style={{marginBottom:14,display:"flex",alignItems:"center",gap:12,background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:12,padding:"12px 16px"}}>
        <div style={{width:40,height:40,borderRadius:10,background:accent,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:17,color:"#fff",fontWeight:800}}>
          {namaOperator.charAt(0).toUpperCase()}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <Lbl>Operator · Divisi</Lbl>
          <div style={{fontSize:14,fontWeight:800,color:"#0f172a"}}>{namaOperator} · {divisi}</div>
        </div>
        <span style={{background:cfg?.bg,color:accent,border:`1px solid ${accent}30`,borderRadius:20,
          padding:"3px 10px",fontSize:11,fontWeight:700,whiteSpace:"nowrap" as const,flexShrink:0}}>
          {cfg?.icon} {subBagian||cfg?.label||divisi}
        </span>
      </div>

      <div style={{marginBottom:14}}>
        <Lbl>Work Order</Lbl>
        <select value={selectedWoId??""} onChange={(e:any)=>setSelectedWoId(e.target.value?Number(e.target.value):null)} style={selStyle}>
          <option value="">Pilih Work Order...</option>
          {woList.map((w:any)=><option key={w.id} value={w.id}>{w.wo} — {w.proyek}</option>)}
        </select>
      </div>

      {selectedWoId&&(
        <div style={{marginBottom:14}}>
          <Lbl>Panel</Lbl>
          <select value={selectedPanelId??""} onChange={(e:any)=>setSelectedPanelId(e.target.value?Number(e.target.value):null)} style={selStyle}>
            <option value="">Pilih Panel...</option>
            {panelList.map((p:any)=><option key={p.id} value={p.id}>#{p.no_pnl} {p.nama} ({p.tipe})</option>)}
          </select>
          {panelList.length===0&&<div style={{fontSize:12,color:"#94a3b8",marginTop:6}}>Belum ada panel untuk WO ini</div>}
        </div>
      )}

      {selectedWoId&&selectedPanelId&&jenisTab==="BBMB"&&(
        <>
          <Lbl>Daftar Komponen</Lbl>
          <div style={{display:"flex",flexDirection:"column" as const,gap:12,marginBottom:10}}>
            {items.map((it,idx)=>(
              <div key={idx} style={{background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:12,padding:14}}>
                <SearchableSelect options={masterList.map((m:any)=>({id:String(m.id),label:m.nama}))} value={it.value}
                  onChange={(id,label)=>onPilihKomponen(idx,id,label)} placeholder="Ketik nama komponen..."/>
                <div style={{display:"flex",alignItems:"flex-end",gap:8,marginTop:10}}>
                  <div style={{flex:1}}>
                    <Lbl>Satuan</Lbl>
                    <input type="text" placeholder="pcs, meter, roll..." value={it.satuan}
                      onChange={(e:any)=>updateItem(idx,{satuan:e.target.value})} style={inpStyle}/>
                  </div>
                  <div style={{display:"flex",alignItems:"center",border:"1.5px solid #cbd5e1",borderRadius:8,overflow:"hidden",flexShrink:0}}>
                    <button onClick={()=>updateItem(idx,{qty:Math.max(1,it.qty-1)})}
                      style={{width:32,height:34,border:"none",background:"#f8fafc",color:"#475569",fontSize:16,fontWeight:700,cursor:"pointer"}}>−</button>
                    <input type="number" min="1" value={it.qty} onChange={(e:any)=>updateItem(idx,{qty:Math.max(1,Number(e.target.value))})}
                      style={{width:40,height:34,border:"none",borderLeft:"1px solid #e2e8f0",borderRight:"1px solid #e2e8f0",textAlign:"center" as const,fontSize:14,fontWeight:700,color:"#0f172a",background:"#fff",fontFamily:"inherit"}}/>
                    <button onClick={()=>updateItem(idx,{qty:it.qty+1})}
                      style={{width:32,height:34,border:"none",background:"#f8fafc",color:"#475569",fontSize:16,fontWeight:700,cursor:"pointer"}}>+</button>
                  </div>
                  <button onClick={()=>hapusBaris(idx)} disabled={items.length<=1}
                    style={{width:34,height:34,borderRadius:8,border:"1px solid #fecaca",background:items.length<=1?"#f8fafc":"#fef2f2",
                      color:items.length<=1?"#cbd5e1":"#dc2626",cursor:items.length<=1?"default":"pointer",fontSize:15,fontWeight:700,flexShrink:0}}>×</button>
                </div>
              </div>
            ))}
          </div>
          <button onClick={tambahBaris} style={{width:"100%",padding:"10px",borderRadius:10,border:"1.5px dashed #cbd5e1",background:"#f8fafc",color:"#64748b",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit",marginBottom:16}}>
            + Tambah Komponen Lagi
          </button>

          <button onClick={submitPermintaan} disabled={submitting}
            style={{width:"100%",padding:"14px",borderRadius:10,border:"none",
              background:submitting?"#94a3b8":accent,
              color:"#fff",fontSize:15,fontWeight:700,cursor:submitting?"default":"pointer",fontFamily:"inherit",marginBottom:20}}>
            {submitting?"Mengirim...":"Kirim Permintaan"}
          </button>
        </>
      )}

      {selectedWoId&&selectedPanelId&&jenisTab==="BBMU"&&(
        <>
          <Lbl>Catatan</Lbl>
          <textarea value={catatan} onChange={(e:any)=>setCatatan(e.target.value)} rows={5}
            placeholder="Tuliskan detail komponen utama yang dibutuhkan..."
            style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid #cbd5e1",fontSize:14,fontWeight:500,color:"#0f172a",background:"#fff",fontFamily:"inherit",resize:"vertical" as const,marginBottom:16}}/>

          <button onClick={submitPermintaan} disabled={submitting}
            style={{width:"100%",padding:"14px",borderRadius:10,border:"none",
              background:submitting?"#94a3b8":accent,
              color:"#fff",fontSize:15,fontWeight:700,cursor:submitting?"default":"pointer",fontFamily:"inherit",marginBottom:20}}>
            {submitting?"Mengirim...":"Kirim Permintaan"}
          </button>
        </>
      )}

      <div style={{height:1,background:"#f1f5f9",margin:"4px 0 16px"}}/>

      <Lbl>Riwayat Permintaan Divisi ({jenisTab})</Lbl>
      {loadingRiwayat?(
        <div style={{textAlign:"center" as const,padding:30,color:"#94a3b8",fontSize:13}}>Memuat...</div>
      ):riwayat.length===0?(
        <EmptyState variant="box-paper" title={`Belum ada permintaan ${jenisTab}`}
          description="Permintaan dari divisi ini akan muncul di sini."/>
      ):(
        <div style={{display:"flex",flexDirection:"column" as const,gap:10}}>
          {riwayat.map((r:any)=>(
            <Card key={r.id} style={{padding:"14px 16px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                <div>
                  <div style={{fontWeight:800,fontSize:13,color:"#0f172a"}}>{r.proyek||"-"} · {r.panel_nama||"-"}</div>
                  <div style={{fontSize:10.5,color:"#94a3b8"}}>{r.wo_number||"-"}</div>
                </div>
                <span style={{fontSize:10.5,fontWeight:600,color:"#94a3b8",whiteSpace:"nowrap" as const}}>{fmtDateTime(r.created_at)}</span>
              </div>
              {jenisTab==="BBMB"?(
                <div style={{display:"flex",flexDirection:"column" as const,gap:6}}>
                  {(r.items||[]).map((it:any)=>(
                    <div key={it.id} style={{background:"#f8fafc",borderRadius:8,padding:"6px 10px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                        <span style={{fontSize:12.5,fontWeight:600,color:"#334155",flex:1,minWidth:0}}>{it.nama_komponen} <span style={{color:"#64748b",fontWeight:500}}>×{it.qty}{it.satuan?` ${it.satuan}`:""}</span></span>
                        <span style={{background:STATUS_COLOR.BBMB[it.status]+"18",color:STATUS_COLOR.BBMB[it.status],
                          borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700,whiteSpace:"nowrap" as const}}>
                          {STATUS_LABEL.BBMB[it.status]||it.status}
                        </span>
                      </div>
                      {it.status==="submit"&&!it.sudah_diambil&&(
                        <button onClick={()=>konfirmasiDiambil(it.id)} disabled={confirmingId===it.id}
                          style={{width:"100%",marginTop:6,padding:"7px",borderRadius:7,border:"none",
                            background:confirmingId===it.id?"#94a3b8":accent,color:"#fff",fontWeight:700,fontSize:11,
                            cursor:confirmingId===it.id?"default":"pointer",fontFamily:"inherit"}}>
                          {confirmingId===it.id?"Menyimpan...":"Konfirmasi Sudah Diambil"}
                        </button>
                      )}
                      {it.sudah_diambil&&(
                        <div style={{marginTop:6,fontSize:10.5,color:"#16a34a",fontWeight:700}}>
                          ✓ Sudah diambil oleh {it.diambil_oleh||"-"} — {fmtDateTime(it.diambil_at)}
                        </div>
                      )}
                    </div>
                  ))}
                  {(r.items||[]).some((it:any)=>it.status==="reject"&&it.catatan_reject)&&(
                    <div style={{fontSize:11,color:"#dc2626",marginTop:2}}>
                      {(r.items||[]).filter((it:any)=>it.status==="reject"&&it.catatan_reject).map((it:any)=>(
                        <div key={it.id}>⚠ {it.nama_komponen}: {it.catatan_reject}</div>
                      ))}
                    </div>
                  )}
                </div>
              ):(
                <>
                  {r.catatan&&<div style={{fontSize:12.5,color:"#334155",marginBottom:8,background:"#f8fafc",borderRadius:8,padding:"8px 10px"}}>{r.catatan}</div>}
                  <span style={{background:STATUS_COLOR.BBMU[r.status||"pending"]+"18",color:STATUS_COLOR.BBMU[r.status||"pending"],
                    borderRadius:20,padding:"3px 10px",fontSize:10.5,fontWeight:700}}>
                    {STATUS_LABEL.BBMU[r.status||"pending"]||r.status}
                  </span>
                </>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
