import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { PANEL_TYPES } from "../lib/panelTypes";
import { fmtShort } from "../lib/dateHelpers";
import { Lbl, Inp } from "./ui/Primitives";

// ─────────────────────────────────────────────────────────────────────────────
// RIWAYAT KERJA - tab generik "cari project+panel -> lihat semua komponen yang
// sudah dikerjakan" buat proses yang BELUM punya Review sendiri (semua proses
// operator KECUALI QC/QS/Nameplate/Warehouse - itu udah punya tampilan sendiri
// - dan KECUALI Potong/Painting yang udah punya Review shift/section sendiri,
// tab ini tetap muncul buat mereka juga sebagai tambahan cara cari per-panel).
// Beda dari ReviewPotongView/ReviewPaintingView (dikelompokkan per shift/section,
// proses khusus yang pakai sistem Section) - tab ini navigasinya cari proyek ->
// panel dulu, baru nampilin histori kode komponennya, cocok buat proses yang
// GAK pakai sistem Section (Bending/Stel/Finishing/Rakit/Busbar/Wiring dst).
// Sumber data: panels.checklist[kode] - qty-based (qtyProses/qtyProsesByDate)
// buat kebanyakan proses, ATAU persen-based (progress/progressByDate) khusus
// BUSBAR (gak punya qty, progress gabungan dari tahap FABRIKASI/PLATING/
// HEATSHRINK/PASANG - lihat hitungProgressBusbarGabungan di panelHelpers.tsx).
// ─────────────────────────────────────────────────────────────────────────────
export function RiwayatKerjaView({proses,label,icon,color}:{proses:string[],label:string,icon:string,color:string}){
  const isBusbar=proses.includes("BUSBAR");

  const[kodeNamaMap,setKodeNamaMap]=useState<Record<string,string>>({});
  useEffect(()=>{
    const map:Record<string,string>={};
    Object.values(PANEL_TYPES).forEach((cfg:any)=>{
      cfg.wps.forEach((w:any)=>w.items.forEach((it:any)=>{map[it.kode]=it.nama;}));
    });
    supabase.from("bom_master").select("kode_komponen,nama_komponen").then(({data}:any)=>{
      (data||[]).forEach((b:any)=>{map[b.kode_komponen]=b.nama_komponen;});
      setKodeNamaMap({...map});
    });
  },[]);

  const[loading,setLoading]=useState(true);
  const[woList,setWoList]=useState<any[]>([]);
  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      setLoading(true);
      const{data}=await supabase.from("work_orders").select("id,wo,proyek").eq("is_archived",false).order("created_at",{ascending:false});
      if(!cancelled){setWoList(data||[]);setLoading(false);}
    })();
    return()=>{cancelled=true;};
  },[]);

  const[searchProyek,setSearchProyek]=useState("");
  const[selectedWoId,setSelectedWoId]=useState<number|null>(null);
  const filteredWoList=useMemo(()=>{
    const q=searchProyek.trim().toLowerCase();
    if(!q)return woList;
    return woList.filter((w:any)=>(w.proyek||"").toLowerCase().includes(q)||(w.wo||"").toLowerCase().includes(q));
  },[woList,searchProyek]);

  const[panelList,setPanelList]=useState<any[]>([]);
  const[loadingPanel,setLoadingPanel]=useState(false);
  useEffect(()=>{
    setPanelList([]);setSelectedPanelId(null);setSearchPanel("");
    if(!selectedWoId)return;
    let cancelled=false;
    (async()=>{
      setLoadingPanel(true);
      const{data}=await supabase.from("panels").select("id,no_pnl,nama,tipe,checklist").eq("wo_id",selectedWoId).is("deleted_at",null).order("no_pnl",{ascending:true});
      if(!cancelled){setPanelList(data||[]);setLoadingPanel(false);}
    })();
    return()=>{cancelled=true;};
  },[selectedWoId]);

  const[searchPanel,setSearchPanel]=useState("");
  const[selectedPanelId,setSelectedPanelId]=useState<number|null>(null);
  const filteredPanelList=useMemo(()=>{
    const q=searchPanel.trim().toLowerCase();
    if(!q)return panelList;
    return panelList.filter((p:any)=>(p.nama||"").toLowerCase().includes(q));
  },[panelList,searchPanel]);

  const selectedWo=woList.find((w:any)=>w.id===selectedWoId);
  const selectedPanel=panelList.find((p:any)=>p.id===selectedPanelId);

  // Untuk tiap kode di checklist panel: kumpulin baris per proses yang diminta (biasanya 1,
  // Painting gabung RENDAM+PAINTING jadi 2) - cuma kode yang BENERAN udah ada progresnya yang
  // muncul ("sudah dikerjakan"), bukan semua kode BOM panel ini.
  const rows=useMemo(()=>{
    if(!selectedPanel)return[];
    const out:any[]=[];
    Object.entries(selectedPanel.checklist||{}).forEach(([kode,cl]:any)=>{
      const perProses:any[]=[];
      proses.forEach(p=>{
        if(p==="BUSBAR"){
          const pct=cl?.progress?.BUSBAR||0;
          if(pct<=0)return;
          const byDate=cl?.progressByDate?.BUSBAR||{};
          const dates=Object.keys(byDate).sort().map(tgl=>({tanggal:tgl,label:`${byDate[tgl]}%`}));
          perProses.push({proses:p,isPercent:true,pct,dates});
        } else {
          const qtyDone=cl?.qtyProses?.[p]||0;
          if(qtyDone<=0)return;
          const qtyTotal=Number(cl?.qty)||0;
          const byDate=cl?.qtyProsesByDate?.[p]||{};
          const dates=Object.keys(byDate).sort().map(tgl=>({tanggal:tgl,label:`+${byDate[tgl]}`}));
          perProses.push({proses:p,isPercent:false,qtyDone,qtyTotal,dates});
        }
      });
      if(perProses.length===0)return;
      out.push({kode,nama:kodeNamaMap[kode]||kode,perProses});
    });
    return out.sort((a,b)=>a.kode.localeCompare(b.kode,undefined,{numeric:true}));
  },[selectedPanel,proses,kodeNamaMap]);

  return(
    <div style={{padding:16,maxWidth:560,margin:"0 auto"}} className="fi">
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
        <div style={{width:40,height:40,borderRadius:10,background:`linear-gradient(135deg,${color},${color}cc)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,boxShadow:`0 3px 10px ${color}44`}}>{icon}</div>
        <div>
          <div style={{fontWeight:800,fontSize:15,color:"#1e293b"}}>Riwayat {label}</div>
          <div style={{fontSize:11,color:"#64748b"}}>Cari proyek & panel untuk lihat komponen yang sudah dikerjakan</div>
        </div>
      </div>

      <div style={{marginBottom:14}}>
        <Lbl>Proyek</Lbl>
        <Inp placeholder="Cari nama proyek / WO..." value={selectedWoId?selectedWo?.proyek+" — "+selectedWo?.wo:searchProyek}
          onFocus={()=>{if(selectedWoId){setSelectedWoId(null);setSearchProyek("");}}}
          onChange={(e:any)=>setSearchProyek(e.target.value)}/>
        {!selectedWoId&&searchProyek.trim()!==""&&(
          <div style={{marginTop:6,maxHeight:220,overflowY:"auto",background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:10}}>
            {loading?(
              <div style={{padding:12,fontSize:12,color:"#94a3b8"}}>Memuat...</div>
            ):filteredWoList.length===0?(
              <div style={{padding:12,fontSize:12,color:"#94a3b8"}}>Proyek tidak ditemukan</div>
            ):filteredWoList.slice(0,30).map((w:any)=>(
              <div key={w.id} onClick={()=>{setSelectedWoId(w.id);setSearchProyek("");}}
                style={{padding:"9px 12px",fontSize:12.5,color:"#1e293b",fontWeight:600,cursor:"pointer",borderBottom:"1px solid #f1f5f9"}}>
                {w.proyek} <span style={{color:"#94a3b8",fontWeight:500}}>· {w.wo}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedWoId&&(
        <div style={{marginBottom:14}}>
          <Lbl>Panel</Lbl>
          <Inp placeholder="Cari nama panel..." value={selectedPanelId?selectedPanel?.nama:searchPanel}
            onFocus={()=>{if(selectedPanelId){setSelectedPanelId(null);setSearchPanel("");}}}
            onChange={(e:any)=>setSearchPanel(e.target.value)}/>
          {!selectedPanelId&&(
            <div style={{marginTop:6,maxHeight:220,overflowY:"auto",background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:10}}>
              {loadingPanel?(
                <div style={{padding:12,fontSize:12,color:"#94a3b8"}}>Memuat...</div>
              ):filteredPanelList.length===0?(
                <div style={{padding:12,fontSize:12,color:"#94a3b8"}}>Panel tidak ditemukan</div>
              ):filteredPanelList.map((p:any)=>(
                <div key={p.id} onClick={()=>setSelectedPanelId(p.id)}
                  style={{padding:"9px 12px",fontSize:12.5,color:"#1e293b",fontWeight:600,cursor:"pointer",borderBottom:"1px solid #f1f5f9"}}>
                  #{p.no_pnl} {p.nama} <span style={{color:"#94a3b8",fontWeight:500}}>({p.tipe})</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedPanel&&(
        rows.length===0?(
          <div style={{textAlign:"center",padding:40,color:"#94a3b8"}}>
            <div style={{fontSize:32,marginBottom:8}}>📭</div>
            <div style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>Belum ada riwayat</div>
            <div style={{fontSize:12,marginTop:4}}>Belum ada komponen {label} yang dikerjakan di panel ini</div>
          </div>
        ):(
          <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
            {rows.map((r:any)=>(
              <div key={r.kode} style={{background:"#fff",borderRadius:12,border:"1.5px solid #e2e8f0",borderLeft:`3px solid ${color}`,padding:"11px 13px",boxShadow:"0 1px 3px #00000008"}}>
                <div style={{fontWeight:800,fontSize:12.5,color:"#1e293b",marginBottom:isBusbar?6:8}}>{r.nama}{r.nama!==r.kode&&<span style={{fontWeight:600,color:"#94a3b8"}}> ({r.kode})</span>}</div>
                <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
                  {r.perProses.map((pp:any)=>(
                    <div key={pp.proses}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                        {r.perProses.length>1&&<span style={{fontSize:9.5,fontWeight:800,color:"#64748b",letterSpacing:.3}}>{pp.proses}</span>}
                        <span style={{fontWeight:800,fontSize:13,color,background:color+"14",borderRadius:20,padding:"2px 9px"}}>
                          {pp.isPercent?`${pp.pct}%`:`${pp.qtyDone}/${pp.qtyTotal}`}
                        </span>
                        {!pp.isPercent&&pp.qtyDone>=pp.qtyTotal&&pp.qtyTotal>0&&<span style={{fontSize:10,fontWeight:700,color:"#16a34a"}}>✓ Selesai</span>}
                        {pp.isPercent&&pp.pct>=100&&<span style={{fontSize:10,fontWeight:700,color:"#16a34a"}}>✓ Selesai</span>}
                      </div>
                      <div style={{display:"flex",gap:5,flexWrap:"wrap" as const}}>
                        {pp.dates.map((d:any)=>(
                          <span key={d.tanggal} title={d.tanggal} style={{fontSize:10,fontWeight:600,color:"#475569",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:20,padding:"2px 8px"}}>
                            📅 {fmtShort(d.tanggal)} <span style={{color:"#94a3b8"}}>{d.label}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
