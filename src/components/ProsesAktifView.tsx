import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { SectionCard, EmptyState } from "./ui/Primitives";

// ─────────────────────────────────────────────────────────────────────────────
// PROSES AKTIF (29 Agu 2026) - tab bottom-nav, tampilkan timer fcs_timer_kerja
// yang sedang berjalan (selesai IS NULL) milik operator yang login. CUMA
// relevan untuk divisi yang pakai timer (mekanik/painting/assembling/
// wiring_ctrl/wiring_pwr - lihat OperatorView.tsx) - App.tsx yang tentukan
// kapan komponen ini dirender (disembunyikan total utk qc/nameplate/QS).
// READ-ONLY - aksi selesaikan timer tetap lewat UI existing di OperatorView,
// TIDAK diduplikasi di sini biar gak ada 2 jalur tulis ke tabel yang sama.
// ─────────────────────────────────────────────────────────────────────────────
export function ProsesAktifView({user}:{user:any}){
  const[loading,setLoading]=useState(true);
  const[timers,setTimers]=useState<any[]>([]);
  const[panelsMap,setPanelsMap]=useState<Record<number,any>>({});
  const[now,setNow]=useState(()=>Date.now());

  useEffect(()=>{
    const t=setInterval(()=>setNow(Date.now()),1000);
    return()=>clearInterval(t);
  },[]);

  useEffect(()=>{
    if(!user?.id)return;
    let cancelled=false;
    const fetchActive=async()=>{
      const{data}=await supabase.from("fcs_timer_kerja").select("*").eq("pekerja_id",user.id).is("selesai",null).order("mulai",{ascending:false});
      const rows=data||[];
      if(cancelled)return;
      setTimers(rows);
      const panelIds=[...new Set(rows.map((r:any)=>r.panel_id))];
      if(panelIds.length>0){
        const{data:panels}=await supabase.from("panels").select("id,nama,wo_id").in("id",panelIds);
        const woIds=[...new Set((panels||[]).map((p:any)=>p.wo_id).filter(Boolean))];
        let woMap:Record<number,any>={};
        if(woIds.length>0){
          const{data:wos}=await supabase.from("work_orders").select("id,proyek,wo").in("id",woIds);
          (wos||[]).forEach((w:any)=>{woMap[w.id]=w;});
        }
        const map:Record<number,any>={};
        (panels||[]).forEach((p:any)=>{map[p.id]={...p,wo:woMap[p.wo_id]};});
        if(!cancelled)setPanelsMap(map);
      } else if(!cancelled)setPanelsMap({});
      if(!cancelled)setLoading(false);
    };
    fetchActive();
    const ch=supabase.channel("realtime-proses-aktif-"+user.id)
      .on("postgres_changes",{event:"*",schema:"public",table:"fcs_timer_kerja",filter:"pekerja_id=eq."+user.id},fetchActive)
      .subscribe();
    return()=>{cancelled=true;supabase.removeChannel(ch);};
  },[user?.id]);

  const fmtDurasi=(mulai:string)=>{
    const detik=Math.max(0,Math.floor((now-new Date(mulai).getTime())/1000));
    const j=Math.floor(detik/3600),m=Math.floor((detik%3600)/60),s=detik%60;
    return j>0?`${j}j ${m}m`:`${m}m ${s}d`;
  };

  return(
    <div style={{padding:16}}>
      <SectionCard icon="⏱" title="Proses Aktif" subtitle={loading?"Memuat...":`${timers.length} proses sedang berjalan`}>
        {loading?(
          <div style={{textAlign:"center",padding:20,color:"#94a3b8",fontSize:12}}>Memuat...</div>
        ):timers.length===0?(
          <EmptyState title="Tidak ada proses aktif" description="Belum ada timer yang sedang berjalan saat ini."/>
        ):timers.map(t=>{
          const panel=panelsMap[t.panel_id];
          return(
            <div key={t.id} style={{border:"1px solid #bbf7d0",borderRadius:12,padding:"12px 14px",marginBottom:8,background:"#f0fdf4"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                <div style={{minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>{panel?.nama||"Panel #"+t.panel_id}</div>
                  <div style={{fontSize:11,color:"#64748b",marginTop:2}}>{panel?.wo?.proyek} · {t.proses} · {t.kode_komponen}</div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontWeight:800,fontSize:14,color:"#16a34a",fontFamily:"'DM Mono',monospace"}}>{fmtDurasi(t.mulai)}</div>
                  <div style={{fontSize:9,color:"#94a3b8"}}>berjalan</div>
                </div>
              </div>
            </div>
          );
        })}
      </SectionCard>
    </div>
  );
}
