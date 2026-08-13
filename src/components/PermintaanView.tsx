import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Lbl, Card } from "./ui/Primitives";

// ─────────────────────────────────────────────────────────────────────────────
// TAB PERMINTAAN BARANG (BBMB & BBMU) - sistem request/approve pengeluaran
// komponen. Independen total dari modul lama (komponen_stok/Warehouse progress
// panel) - tabel sendiri (permintaan/permintaan_item/komponen_bbmb_master).
// BBMB (Bantu): komponen dari master komponen_bbmb_master (diisi admin lewat
// upload Excel). BBMU (Utama): komponen auto dari BOM riil panel yang dipilih
// (bom_master + panel.checklist), gak ada master terpisah - sama pola dengan
// KomponenPasangView. Tab ini SENGAJA muncul buat SEMUA divisi (gak dikondisikan
// kayak tab Komponen/Arsip), jadi App.tsx render ini tanpa cek user.divisi.
// ─────────────────────────────────────────────────────────────────────────────

type Jenis="BBMB"|"BBMU";
type ItemRow={value:string;namaKomponen:string;qty:number};

const STATUS_LABEL:Record<Jenis,Record<string,string>>={
  BBMB:{pending:"Menunggu",submit:"Disiapkan",reject:"Ditolak"},
  BBMU:{pending:"Menunggu",tersedia:"Tersedia",belum_lengkap:"Belum Lengkap",belum_datang:"Belum Datang"},
};
const STATUS_COLOR:Record<Jenis,Record<string,string>>={
  BBMB:{pending:"#94a3b8",submit:"#16a34a",reject:"#dc2626"},
  BBMU:{pending:"#94a3b8",tersedia:"#16a34a",belum_lengkap:"#f59e0b",belum_datang:"#dc2626"},
};

const emptyItem=():ItemRow=>({value:"",namaKomponen:"",qty:1});

const selStyle:any={width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid #cbd5e1",fontSize:14,fontWeight:600,color:"#0f172a",background:"#fff",fontFamily:"inherit"};
const inpStyle:any={width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid #cbd5e1",fontSize:14,fontWeight:600,color:"#0f172a",fontFamily:"inherit"};

export function PermintaanView({user}:{user:any}){
  const namaOperator=user?.nama||user?.name||"Operator";
  const divisi:string=user?.divisi||"";
  const subBagian:string|null=user?.sub_bagian||null;

  const[jenisTab,setJenisTab]=useState<Jenis>("BBMB");

  const[woList,setWoList]=useState<any[]>([]);
  const[selectedWoId,setSelectedWoId]=useState<number|null>(null);
  const[panelList,setPanelList]=useState<any[]>([]);
  const[selectedPanelId,setSelectedPanelId]=useState<number|null>(null);

  const[masterList,setMasterList]=useState<any[]>([]); // BBMB: komponen_bbmb_master
  const[bomMap,setBomMap]=useState<Record<string,string>>({}); // BBMU: kode->nama dari bom_master

  const[items,setItems]=useState<ItemRow[]>([emptyItem()]);
  const[submitting,setSubmitting]=useState(false);

  const[riwayat,setRiwayat]=useState<any[]>([]);
  const[loadingRiwayat,setLoadingRiwayat]=useState(true);

  useEffect(()=>{
    supabase.from("work_orders").select("id,wo,proyek").eq("is_archived",false).order("created_at",{ascending:false})
      .then(({data})=>setWoList(data??[]));
    supabase.from("komponen_bbmb_master").select("id,nama,satuan").order("nama",{ascending:true})
      .then(({data})=>setMasterList(data??[]));
    supabase.from("bom_master").select("kode_komponen,nama_komponen")
      .then(({data})=>{
        const m:Record<string,string>={};
        (data||[]).forEach((b:any)=>{m[b.kode_komponen]=b.nama_komponen;});
        setBomMap(m);
      });
  },[]);

  useEffect(()=>{
    setSelectedPanelId(null);
    setItems([emptyItem()]);
    if(selectedWoId){
      supabase.from("panels").select("id,no_pnl,nama,tipe,wo_id,checklist").eq("wo_id",selectedWoId).is("deleted_at",null)
        .order("no_pnl",{ascending:true}).then(({data})=>setPanelList(data??[]));
    } else {
      setPanelList([]);
    }
  },[selectedWoId]);

  useEffect(()=>{
    setItems([emptyItem()]);
  },[selectedPanelId,jenisTab]);

  const fetchRiwayat=async()=>{
    setLoadingRiwayat(true);
    const{data:perms}=await supabase.from("permintaan").select("*")
      .eq("jenis",jenisTab).eq("operator_nama",namaOperator).eq("divisi",divisi)
      .order("created_at",{ascending:false}).limit(30);
    if(perms&&perms.length>0){
      const ids=perms.map((p:any)=>p.id);
      const{data:itemRows}=await supabase.from("permintaan_item").select("*").in("permintaan_id",ids);
      const map:Record<number,any[]>={};
      (itemRows||[]).forEach((it:any)=>{(map[it.permintaan_id]=map[it.permintaan_id]||[]).push(it);});
      setRiwayat(perms.map((p:any)=>({...p,items:map[p.id]||[]})));
    } else {
      setRiwayat([]);
    }
    setLoadingRiwayat(false);
  };

  useEffect(()=>{
    fetchRiwayat();
    const ch=supabase.channel(`realtime-permintaan-${jenisTab}-${namaOperator}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"permintaan_item"},()=>fetchRiwayat())
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[jenisTab]);

  // Komponen panel BBMU: kode BOM yang qty>0 di checklist panel terpilih, nama dari bom_master.
  const panelKomponenList=(()=>{
    const panel=panelList.find((p:any)=>p.id===selectedPanelId);
    if(!panel)return[];
    return Object.entries(panel.checklist||{})
      .filter(([,cl]:any)=>(cl?.qty||0)>0)
      .map(([kode]:any)=>({kode,nama:bomMap[kode]||kode}));
  })();

  const updateItem=(idx:number,patch:Partial<ItemRow>)=>{
    setItems(prev=>prev.map((it,i)=>i===idx?{...it,...patch}:it));
  };
  const tambahBaris=()=>setItems(prev=>[...prev,emptyItem()]);
  const hapusBaris=(idx:number)=>setItems(prev=>prev.length<=1?prev:prev.filter((_,i)=>i!==idx));

  const onPilihKomponen=(idx:number,value:string)=>{
    if(jenisTab==="BBMB"){
      const m=masterList.find((x:any)=>String(x.id)===value);
      updateItem(idx,{value,namaKomponen:m?.nama||""});
    } else {
      const k=panelKomponenList.find((x:any)=>x.kode===value);
      updateItem(idx,{value,namaKomponen:k?.nama||value});
    }
  };

  const submitPermintaan=async()=>{
    if(!selectedWoId){alert("Pilih Work Order dulu");return;}
    if(!selectedPanelId){alert("Pilih Panel dulu");return;}
    const itemsValid=items.filter(it=>it.namaKomponen&&Number(it.qty)>0);
    if(itemsValid.length===0){alert("Isi minimal 1 komponen dengan qty lebih dari 0");return;}
    setSubmitting(true);
    const woObj=woList.find((w:any)=>w.id===selectedWoId);
    const panelObj=panelList.find((p:any)=>p.id===selectedPanelId);
    const{data:perm,error:permErr}=await supabase.from("permintaan").insert({
      jenis:jenisTab,operator_nama:namaOperator,divisi,sub_bagian:subBagian,
      wo_id:selectedWoId,panel_id:selectedPanelId,
      wo_number:woObj?.wo||null,proyek:woObj?.proyek||null,panel_nama:panelObj?.nama||null,
    }).select().single();
    if(permErr||!perm){
      alert("Gagal mengirim permintaan: "+(permErr?.message||"unknown error"));
      setSubmitting(false);
      return;
    }
    const rows=itemsValid.map(it=>({
      permintaan_id:perm.id,
      komponen_bbmb_master_id:jenisTab==="BBMB"&&it.value?Number(it.value):null,
      kode_komponen:jenisTab==="BBMU"?it.value:null,
      nama_komponen:it.namaKomponen,
      qty:Number(it.qty),
      status:"pending",
    }));
    const{error:itemErr}=await supabase.from("permintaan_item").insert(rows);
    if(itemErr){
      alert("Permintaan tersimpan tapi gagal simpan komponen: "+itemErr.message);
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    setSelectedWoId(null);
    setItems([emptyItem()]);
    alert("Permintaan berhasil dikirim!");
    fetchRiwayat();
  };

  const fmtDateTime=(d:string)=>d?new Date(d).toLocaleString("id-ID",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):"-";
  const komponenOptions=jenisTab==="BBMB"?masterList.map((m:any)=>({value:String(m.id),label:m.nama})):panelKomponenList.map((k:any)=>({value:k.kode,label:k.nama}));
  const komponenDisabled=jenisTab==="BBMU"&&!selectedPanelId;

  return(
    <div style={{padding:16}} className="fi">
      <div style={{fontWeight:800,fontSize:17,color:"#1e293b",marginBottom:4}}>📝 Permintaan Barang</div>
      <div style={{fontSize:12,color:"#64748b",marginBottom:16}}>Halo {namaOperator}, ajukan permintaan komponen bantu atau utama</div>

      <div style={{display:"flex",gap:6,marginBottom:16,background:"#f1f5f9",borderRadius:12,padding:4}}>
        {(["BBMB","BBMU"] as Jenis[]).map(j=>(
          <button key={j} onClick={()=>setJenisTab(j)}
            style={{flex:1,padding:"10px 8px",border:"none",borderRadius:9,cursor:"pointer",
              fontWeight:700,fontSize:13,fontFamily:"inherit",
              background:jenisTab===j?"#fff":"transparent",color:jenisTab===j?"#0d9488":"#64748b",
              boxShadow:jenisTab===j?"0 1px 3px rgba(0,0,0,0.08)":"none"}}>
            {j==="BBMB"?"BBMB (Bantu)":"BBMU (Utama)"}
          </button>
        ))}
      </div>

      <div style={{marginBottom:14,display:"flex",alignItems:"center",gap:12,background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:14,padding:"12px 16px",boxShadow:"0 2px 8px rgba(0,0,0,0.04)"}}>
        <div style={{width:42,height:42,borderRadius:11,background:"linear-gradient(135deg,#2dd4bf,#0d9488)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:19,boxShadow:"0 3px 10px #0d948844"}}>👤</div>
        <div>
          <div style={{fontSize:11,fontWeight:600,color:"#94a3b8"}}>Operator · Divisi</div>
          <div style={{fontSize:14,fontWeight:800,color:"#0f172a"}}>{namaOperator} · {subBagian||divisi}</div>
        </div>
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

      {selectedWoId&&selectedPanelId&&(
        <>
          <Lbl>Daftar Komponen</Lbl>
          {jenisTab==="BBMU"&&panelKomponenList.length===0&&(
            <div style={{fontSize:12,color:"#94a3b8",marginBottom:10,background:"#f8fafc",borderRadius:8,padding:"8px 10px"}}>Panel ini belum punya komponen BOM (qty&gt;0).</div>
          )}
          <div style={{display:"flex",flexDirection:"column" as const,gap:8,marginBottom:10}}>
            {items.map((it,idx)=>(
              <div key={idx} style={{display:"flex",gap:8,alignItems:"center",background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:12,padding:10}}>
                <div style={{flex:1,minWidth:0}}>
                  <select value={it.value} disabled={komponenDisabled} onChange={(e:any)=>onPilihKomponen(idx,e.target.value)} style={{...selStyle,padding:"8px 10px",fontSize:13}}>
                    <option value="">{komponenDisabled?"Pilih panel dulu...":"Pilih komponen..."}</option>
                    {komponenOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <input type="number" min="1" value={it.qty} onChange={(e:any)=>updateItem(idx,{qty:Number(e.target.value)})}
                  style={{...inpStyle,width:64,padding:"8px 8px",fontSize:13,textAlign:"center" as const}}/>
                <button onClick={()=>hapusBaris(idx)} disabled={items.length<=1}
                  style={{width:34,height:34,flexShrink:0,borderRadius:8,border:"1px solid #fecaca",background:items.length<=1?"#f8fafc":"#fef2f2",
                    color:items.length<=1?"#cbd5e1":"#dc2626",cursor:items.length<=1?"default":"pointer",fontSize:15,fontWeight:700}}>×</button>
              </div>
            ))}
          </div>
          <button onClick={tambahBaris} style={{width:"100%",padding:"10px",borderRadius:10,border:"1.5px dashed #cbd5e1",background:"#f8fafc",color:"#64748b",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit",marginBottom:16}}>
            + Tambah Komponen Lagi
          </button>

          <button onClick={submitPermintaan} disabled={submitting}
            style={{width:"100%",padding:"15px",borderRadius:12,border:"none",
              background:submitting?"#94a3b8":"linear-gradient(135deg,#2dd4bf,#0d9488)",
              color:"#fff",fontSize:16,fontWeight:800,cursor:submitting?"default":"pointer",fontFamily:"inherit",marginBottom:24,
              boxShadow:submitting?"none":"0 4px 14px #0d948844"}}>
            {submitting?"Mengirim...":"Kirim Permintaan"}
          </button>
        </>
      )}

      <div style={{fontSize:12,fontWeight:800,color:"#0f172a",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:8}}>Riwayat Saya ({jenisTab})</div>
      {loadingRiwayat?(
        <div style={{textAlign:"center" as const,padding:30,color:"#94a3b8",fontSize:13}}>Memuat...</div>
      ):riwayat.length===0?(
        <div style={{textAlign:"center" as const,padding:30,color:"#94a3b8",fontSize:13}}>Belum ada permintaan {jenisTab} yang dikirim</div>
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
              <div style={{display:"flex",flexDirection:"column" as const,gap:6}}>
                {(r.items||[]).map((it:any)=>(
                  <div key={it.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,background:"#f8fafc",borderRadius:8,padding:"6px 10px"}}>
                    <span style={{fontSize:12.5,fontWeight:600,color:"#334155",flex:1,minWidth:0}}>{it.nama_komponen} <span style={{color:"#64748b",fontWeight:500}}>×{it.qty}</span></span>
                    <span style={{background:STATUS_COLOR[jenisTab][it.status]+"18",color:STATUS_COLOR[jenisTab][it.status],
                      borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700,whiteSpace:"nowrap" as const}}>
                      {STATUS_LABEL[jenisTab][it.status]||it.status}
                    </span>
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
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
