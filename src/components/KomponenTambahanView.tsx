import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { TODAY } from "../lib/dateHelpers";

// ─────────────────────────────────────────────────────────────────────────────
// Komponen ad-hoc (di luar BOM/jadwal normal) - dipakai operator Potong buat
// kasus darurat/tambahan yang gak kebagian slot di raw_schedule. Disimpan di
// tabel TERPISAH (komponen_tambahan), sengaja gak nyentuh raw_schedule sama
// sekali biar auto-geser/cascading/jejak logic gak pernah "liat" data ini.
// Gak ada cek kapasitas (memang buat kondisi darurat/di luar rencana).
// Dipisah dari App.tsx (Sprint 7).
// ─────────────────────────────────────────────────────────────────────────────
export function KomponenTambahanView({user}:any){
  const namaOperator=user?.nama||user?.name||"Operator";
  const wsKey=`vista_pekerja_ws_${user.divisi}_${user.sub_bagian||""}_${user.id||user.username||user.nama||""}`;
  const sesiKerja=(()=>{
    try{
      const saved=JSON.parse(localStorage.getItem(wsKey)||"{}");
      if(saved.tanggal&&saved.shift)return{tanggal:saved.tanggal as string,shift:saved.shift as string};
    }catch{}
    return{tanggal:TODAY,shift:"1"};
  })();

  const[woList,setWoList]=useState<any[]>([]);
  const[selectedWoId,setSelectedWoId]=useState<number|null>(null);
  const[panelList,setPanelList]=useState<any[]>([]);
  const[selectedPanelId,setSelectedPanelId]=useState<number|null>(null);
  const[namaKomponen,setNamaKomponen]=useState("");
  const[qty,setQty]=useState("");
  const[submitting,setSubmitting]=useState(false);
  const[items,setItems]=useState<any[]>([]);
  const[loading,setLoading]=useState(true);
  const[,setTick]=useState(0);

  const fetchWoList=async()=>{
    const{data}=await supabase.from("work_orders").select("id,wo,proyek").eq("is_archived",false).order("created_at",{ascending:false});
    setWoList(data??[]);
  };
  const fetchPanelList=async(woId:number)=>{
    const{data}=await supabase.from("panels").select("id,no_pnl,nama").eq("wo_id",woId).is("deleted_at",null).order("no_pnl",{ascending:true});
    setPanelList(data??[]);
  };
  const fetchItems=async()=>{
    setLoading(true);
    const{data}=await supabase.from("komponen_tambahan").select("*").eq("tanggal",sesiKerja.tanggal).order("created_at",{ascending:false});
    setItems(data??[]);
    setLoading(false);
  };

  useEffect(()=>{
    fetchWoList();
    fetchItems();
    const ch=supabase.channel("realtime-komponen-tambahan-pekerja")
      .on("postgres_changes",{event:"*",schema:"public",table:"komponen_tambahan"},fetchItems)
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);
  useEffect(()=>{
    setSelectedPanelId(null);
    if(selectedWoId){fetchPanelList(selectedWoId);}else{setPanelList([]);}
  },[selectedWoId]);

  useEffect(()=>{
    const anyRunning=items.some((it:any)=>it.status==="berjalan");
    if(!anyRunning)return;
    const t=setInterval(()=>setTick(v=>v+1),1000);
    return()=>clearInterval(t);
  },[items]);

  const tambahKomponen=async()=>{
    if(!selectedWoId||!selectedPanelId||!namaKomponen.trim()||!qty||Number(qty)<=0){
      alert("Lengkapi proyek, panel, nama komponen, dan qty dulu");
      return;
    }
    setSubmitting(true);
    const wo=woList.find((w:any)=>w.id===selectedWoId);
    const panel=panelList.find((p:any)=>p.id===selectedPanelId);
    const{error}=await supabase.from("komponen_tambahan").insert({
      wo_id:selectedWoId,
      panel_id:selectedPanelId,
      proyek:wo?.proyek||null,
      wo:wo?.wo||null,
      panel_nama:panel?.nama||panel?.no_pnl||null,
      nama_komponen:namaKomponen.trim(),
      qty:Number(qty),
      proses:"POTONG",
      tanggal:sesiKerja.tanggal,
      shift:sesiKerja.shift,
      status:"belum_mulai",
    });
    setSubmitting(false);
    if(error){
      alert("Gagal menyimpan: "+error.message);
      return;
    }
    setNamaKomponen("");
    setQty("");
    fetchItems();
  };

  const mulaiKerja=async(id:number)=>{
    await supabase.from("komponen_tambahan").update({status:"berjalan",waktu_mulai:new Date().toISOString(),operator_nama:namaOperator}).eq("id",id);
    fetchItems();
  };
  const selesaiKerja=async(id:number)=>{
    await supabase.from("komponen_tambahan").update({status:"selesai",waktu_selesai:new Date().toISOString()}).eq("id",id);
    fetchItems();
  };

  const durasiLabel=(it:any)=>{
    if(!it.waktu_mulai)return "";
    const end=it.waktu_selesai?new Date(it.waktu_selesai).getTime():Date.now();
    const totalMenit=(end-new Date(it.waktu_mulai).getTime())/60000;
    const jam=Math.floor(totalMenit/60);
    const menit=Math.round(totalMenit%60);
    const detik=Math.max(0,Math.round(totalMenit*60));
    return jam>0?`${jam}j ${menit}m`:totalMenit>=1?`${menit}m`:`${detik}d`;
  };

  return(
    <div style={{padding:"14px 16px"}}>
      <div style={{fontSize:12,color:"#64748b",marginBottom:14}}>
        Input komponen tambahan (di luar BOM/jadwal normal) untuk kondisi darurat. Tidak ada pengecekan kapasitas.
      </div>
      <div style={{background:"#fff",borderRadius:12,padding:14,marginBottom:16,border:"1px solid #f1f5f9"}}>
        <div style={{fontWeight:800,fontSize:13,color:"#1e293b",marginBottom:10}}>+ Tambah Komponen</div>
        <select value={selectedWoId??""} onChange={e=>setSelectedWoId(e.target.value?Number(e.target.value):null)}
          style={{width:"100%",padding:"9px 10px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:12.5,marginBottom:8}}>
          <option value="">Pilih Proyek / WO...</option>
          {woList.map((w:any)=>(<option key={w.id} value={w.id}>{w.proyek} - {w.wo}</option>))}
        </select>
        <select value={selectedPanelId??""} onChange={e=>setSelectedPanelId(e.target.value?Number(e.target.value):null)} disabled={!selectedWoId}
          style={{width:"100%",padding:"9px 10px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:12.5,marginBottom:8}}>
          <option value="">Pilih Panel...</option>
          {panelList.map((p:any)=>(<option key={p.id} value={p.id}>{p.no_pnl} {p.nama?`- ${p.nama}`:""}</option>))}
        </select>
        <input value={namaKomponen} onChange={e=>setNamaKomponen(e.target.value)} placeholder="Nama komponen"
          style={{width:"100%",padding:"9px 10px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:12.5,marginBottom:8,boxSizing:"border-box"}}/>
        <input value={qty} onChange={e=>setQty(e.target.value.replace(/[^0-9]/g,""))} placeholder="Qty" inputMode="numeric"
          style={{width:"100%",padding:"9px 10px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:12.5,marginBottom:10,boxSizing:"border-box"}}/>
        <button disabled={submitting} onClick={tambahKomponen}
          style={{width:"100%",padding:"11px",borderRadius:8,border:"none",background:"#2563eb",color:"#fff",fontWeight:700,fontSize:13,cursor:submitting?"not-allowed":"pointer"}}>
          {submitting?"Menyimpan...":"+ Tambah"}
        </button>
      </div>
      <div style={{fontWeight:800,fontSize:13,color:"#1e293b",marginBottom:8}}>Komponen Tambahan Hari Ini</div>
      {loading?(
        <div style={{textAlign:"center",color:"#94a3b8",padding:20}}>Memuat...</div>
      ):items.length===0?(
        <div style={{textAlign:"center",color:"#94a3b8",padding:20,background:"#fff",borderRadius:12}}>Belum ada komponen tambahan hari ini.</div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {items.map((it:any)=>{
            const running=it.status==="berjalan";
            const selesai=it.status==="selesai";
            return(
              <div key={it.id} style={{background:"#fff",borderRadius:10,padding:"10px 12px",border:"1px solid #f1f5f9"}}>
                <div style={{fontSize:12.5,fontWeight:700,color:"#334155"}}>{it.nama_komponen} <span style={{fontWeight:600,color:"#d97706"}}>({it.qty} pcs)</span></div>
                <div style={{fontSize:10.5,color:"#94a3b8",marginTop:2,marginBottom:8}}>{it.proyek} • {it.panel_nama}</div>
                {selesai?(
                  <div style={{fontSize:11.5,fontWeight:700,color:"#16a34a"}}>✓ Selesai ({durasiLabel(it)})</div>
                ):(
                  <button disabled={false}
                    onClick={()=>running?selesaiKerja(it.id):mulaiKerja(it.id)}
                    style={{fontSize:13,fontWeight:700,border:"none",borderRadius:10,padding:"12px 14px",minHeight:44,width:"100%",cursor:"pointer",
                      background:running?"#fef2f2":"#f0fdf4",color:running?"#dc2626":"#16a34a"}}>
                    {running?`⏹ Selesai ${durasiLabel(it)}`:"▶ Mulai"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
