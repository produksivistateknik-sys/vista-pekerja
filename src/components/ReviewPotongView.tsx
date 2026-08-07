import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { PANEL_TYPES, PROSES_COLOR } from "../lib/panelTypes";
import { TODAY, addDays, fmtDate } from "../lib/dateHelpers";

// ─────────────────────────────────────────────────────────────────────────────
// REVIEW POTONG - histori read-only Section POTONG, REUSE pola & struktur PERSIS dari
// ReviewPaintingView (POTONG sekarang pakai sistem Section yang sama - lihat
// simpanSectionPaintingRendam di OperatorView.tsx, gak ada lagi bedanya sama RENDAM/PAINTING).
// SHIFT -> SECTION -> PANEL -> list komponen (section bisa lintas proyek/panel, operator collect
// dari mana aja). Sumber data: panels.checklist[kode].history.POTONG - entry dari section (ditulis
// simpanSectionPaintingRendam) punya field tambahan section/sectionMulai/shift; entry LAMA (dari
// sebelum migrasi ke sistem Section, ditulis lockBulkKomponen/lockSingleKomponen yang sudah
// dihapus) TIDAK punya field section - diabaikan di sini (riwayatnya tetap aman di database, cuma
// gak ditampilkan di tampilan Section - sama persis konsekuensi yang sudah berlaku di Review
// Painting buat data historisnya).
export function ReviewPotongView(){
  const[loading,setLoading]=useState(true);
  const[entries,setEntries]=useState<any[]>([]);
  const[viewDate,setViewDate]=useState(TODAY);
  const[expandedSection,setExpandedSection]=useState<Record<string,boolean>>({});

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

  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      setLoading(true);
      let allPanels:any[]=[];
      let from=0;
      while(true){
        const{data}=await supabase.from("panels").select("id,nama,tipe,wo_id,checklist").range(from,from+999);
        allPanels=allPanels.concat(data||[]);
        if(!data||data.length<1000)break;
        from+=1000;
      }
      const woIds=[...new Set(allPanels.map((p:any)=>p.wo_id).filter(Boolean))];
      const{data:wos}=woIds.length>0?await supabase.from("work_orders").select("id,wo,proyek").in("id",woIds):{data:[]};
      const woMap:Record<number,any>={};
      (wos||[]).forEach((w:any)=>{woMap[w.id]=w;});

      const rows:any[]=[];
      allPanels.forEach((p:any)=>{
        Object.entries(p.checklist||{}).forEach(([kode,cl]:any)=>{
          const histSemua=cl?.history?.POTONG||[];
          const histSampaiHariIni=histSemua.filter((h:any)=>h.tanggal<=viewDate);
          const histHariIni=histSemua.filter((h:any)=>h.tanggal===viewDate&&typeof h.section==="number");
          if(histHariIni.length===0)return;
          const sortedSemua=[...histSampaiHariIni].sort((a:any,b:any)=>String(a.ts).localeCompare(String(b.ts)));
          const qtyTotal=Number(cl.qty)||0;
          sortedSemua.forEach((h:any,idx:number)=>{
            if(h.tanggal!==viewDate||typeof h.section!=="number")return;
            const pctSebelum=idx>0?Number(sortedSemua[idx-1].pct)||0:0;
            const qtySkrg=Math.round((Number(h.pct)||0)/100*qtyTotal);
            const qtySblm=Math.round(pctSebelum/100*qtyTotal);
            const delta=qtySkrg-qtySblm;
            if(delta<=0)return;
            rows.push({
              section:h.section,sectionMulai:h.sectionMulai,tanggal:h.tanggal,shift:h.shift||"1",
              panelId:p.id,panelNama:p.nama,proyek:woMap[p.wo_id]?.proyek||"(Tanpa Proyek)",wo:woMap[p.wo_id]?.wo||"",
              kode,namaKomponen:kodeNamaMap[kode]||kode,qtyDelta:delta,qtyTotal,ts:h.ts,
            });
          });
        });
      });

      const panelIdsRelevan=[...new Set(rows.map((r:any)=>r.panelId))];
      const{data:timers}=panelIdsRelevan.length>0
        ?await supabase.from("fcs_timer_kerja").select("panel_id,kode_komponen,mulai,pekerja:pekerja_id(nama)").eq("proses","POTONG").in("panel_id",panelIdsRelevan).eq("tanggal",viewDate)
        :{data:[]};
      rows.forEach((r:any)=>{
        // Operator per SECTION (bukan per hari) - cocokkan timer yang mulainya jatuh di rentang
        // [sectionMulai, ts section ini], biar komponen yang dikerjain 2 section beda hari yang
        // sama gak ketuker operatornya.
        const rentangBawah=r.sectionMulai||r.tanggal;
        const ops=new Set<string>();
        (timers||[]).forEach((t:any)=>{
          if(t.panel_id!==r.panelId||t.kode_komponen!==r.kode)return;
          if(t.mulai>=rentangBawah&&t.mulai<=r.ts&&t.pekerja?.nama)ops.add(t.pekerja.nama);
        });
        r.operators=[...ops];
      });

      if(!cancelled){setEntries(rows);setLoading(false);}
    })();
    return()=>{cancelled=true;};
  },[viewDate,kodeNamaMap]);

  // SHIFT -> SECTION -> PANEL (key grouping dipecah shift+section biar Section 1 Shift 1 gak
  // numpuk sama Section 1 Shift 2 kalau kebetulan angkanya sama - nomor section di-scope per
  // shift, lihat simpanSectionPaintingRendam).
  const groupedShift=useMemo(()=>{
    const bySection:Record<string,{shift:string,section:number,mulai:string,selesai:string,items:any[]}>={};
    entries.forEach((r:any)=>{
      const key=r.shift+"|"+r.section;
      if(!bySection[key])bySection[key]={shift:r.shift,section:r.section,mulai:r.sectionMulai,selesai:r.ts,items:[]};
      const grp=bySection[key];
      if(r.ts>grp.selesai)grp.selesai=r.ts;
      grp.items.push(r);
    });
    const allSections=Object.values(bySection).map(sec=>{
      const byPanel:Record<number,{panelNama:string,proyek:string,items:any[]}>={};
      sec.items.forEach((r:any)=>{
        if(!byPanel[r.panelId])byPanel[r.panelId]={panelNama:r.panelNama,proyek:r.proyek,items:[]};
        byPanel[r.panelId].items.push(r);
      });
      return{...sec,panels:Object.values(byPanel).sort((a,b)=>a.panelNama.localeCompare(b.panelNama))};
    });
    const byShift:Record<string,typeof allSections>={};
    allSections.forEach(sec=>{
      if(!byShift[sec.shift])byShift[sec.shift]=[];
      byShift[sec.shift].push(sec);
    });
    return Object.keys(byShift).sort((a,b)=>a.localeCompare(b)).map(shift=>({
      shift,sections:byShift[shift].sort((a,b)=>b.section-a.section),
    }));
  },[entries]);

  const toggleSection=(key:string)=>setExpandedSection(prev=>({...prev,[key]:!(prev[key]??true)}));
  const fmtJam=(iso:string)=>iso?new Date(iso).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"}):"–";
  const pc=PROSES_COLOR.POTONG||"#f59e0b";

  return(
    <div style={{padding:16,maxWidth:560,margin:"0 auto"}} className="fi">
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
        <div style={{width:40,height:40,borderRadius:10,background:"linear-gradient(135deg,#f59e0b,#d97706)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,boxShadow:"0 3px 10px #d9770644"}}>📋</div>
        <div>
          <div style={{fontWeight:800,fontSize:15,color:"#1e293b"}}>Review Potong</div>
          <div style={{fontSize:11,color:"#64748b"}}>Riwayat Section Potong</div>
        </div>
      </div>

      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,background:"#fff",borderRadius:12,padding:"10px 14px",border:"1.5px solid #e2e8f0"}}>
        <button onClick={()=>setViewDate(addDays(viewDate,-1))} style={{width:34,height:34,borderRadius:8,border:"1px solid #e2e8f0",background:"#f8fafc",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",color:"#475569"}}>‹</button>
        <div style={{flex:1,textAlign:"center" as const}}>
          <div style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>📅 {fmtDate(viewDate)}</div>
          {viewDate===TODAY&&<div style={{fontSize:10,color:"#d97706",fontWeight:700,marginTop:2}}>Hari Ini</div>}
        </div>
        <button onClick={()=>setViewDate(addDays(viewDate,1))} disabled={viewDate>=TODAY} style={{width:34,height:34,borderRadius:8,border:"1px solid #e2e8f0",background:viewDate>=TODAY?"#f1f5f9":"#f8fafc",cursor:viewDate>=TODAY?"not-allowed":"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",color:viewDate>=TODAY?"#cbd5e1":"#475569"}}>›</button>
      </div>

      {loading?(
        <div style={{textAlign:"center",padding:40,color:"#94a3b8"}}>
          <div style={{fontSize:24,marginBottom:8}}>⏳</div>
          Memuat riwayat...
        </div>
      ):groupedShift.length===0?(
        <div style={{textAlign:"center",padding:40,color:"#94a3b8"}}>
          <div style={{fontSize:32,marginBottom:8}}>📭</div>
          <div style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>Belum ada riwayat</div>
          <div style={{fontSize:12,marginTop:4}}>Belum ada section yang disimpan di tanggal ini</div>
        </div>
      ):(
        groupedShift.map(({shift,sections})=>{
          const totalQtyShift=sections.reduce((s:number,sec:any)=>s+sec.items.reduce((s2:number,r:any)=>s2+r.qtyDelta,0),0);
          return(
          <div key={shift} style={{marginBottom:18}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:9}}>
              <span style={{fontSize:9.5,fontWeight:800,color:"#64748b",letterSpacing:.3}}>SHIFT {shift}</span>
              <span style={{flex:1,height:1,background:pc+"26"}}/>
              <span style={{fontSize:10,fontWeight:700,color:pc,background:pc+"14",borderRadius:20,padding:"3px 9px"}}>{sections.length} section · {totalQtyShift} pcs</span>
            </div>
            {sections.map((sec:any)=>{
              const secKey=shift+"|"+sec.section;
              const isOpen=expandedSection[secKey]??true;
              const totalQty=sec.items.reduce((s:number,r:any)=>s+r.qtyDelta,0);
              return(
                <div key={secKey} className="su" style={{marginBottom:9,background:"#fff",borderRadius:12,border:"1.5px solid #e2e8f0",borderLeft:`3px solid ${pc}`,overflow:"hidden",boxShadow:"0 1px 3px #00000008"}}>
                  <div onClick={()=>toggleSection(secKey)} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 13px",cursor:"pointer",background:isOpen?pc+"0a":"#fff"}}>
                    <span style={{width:30,height:30,borderRadius:9,background:pc,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,flexShrink:0}}>{sec.section}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:800,fontSize:12.5,color:"#1e293b"}}>Section {sec.section}</div>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap" as const,marginTop:3,alignItems:"center"}}>
                        <span style={{fontSize:9.5,color:"#64748b",fontWeight:600}}>⏱ {fmtJam(sec.mulai)} – {fmtJam(sec.selesai)}</span>
                        <span style={{fontSize:9.5,color:"#64748b"}}>· {sec.items.length} komponen</span>
                      </div>
                    </div>
                    <div style={{textAlign:"right" as const,flexShrink:0}}>
                      <div style={{fontWeight:800,fontSize:15,color:pc,lineHeight:1}}>{totalQty}</div>
                      <div style={{fontSize:8.5,fontWeight:700,color:"#94a3b8"}}>pcs</div>
                    </div>
                    <span style={{fontSize:11,color:"#cbd5e1"}}>{isOpen?"▾":"▸"}</span>
                  </div>
                  {isOpen&&(
                    <div style={{display:"flex",flexDirection:"column" as const,gap:8,padding:"2px 13px 12px"}}>
                      {sec.panels.map((pnl:any,pi:number)=>(
                        <div key={pi}>
                          <div style={{fontSize:10.5,fontWeight:800,color:"#334155",marginBottom:4,paddingTop:6}}>{pnl.panelNama} <span style={{fontWeight:600,color:"#94a3b8"}}>· {pnl.proyek}</span></div>
                          <div style={{display:"flex",flexDirection:"column" as const,gap:4}}>
                            {pnl.items.map((r:any,i:number)=>(
                              <div key={i} style={{display:"flex",alignItems:"center",gap:8,background:"#f8fafc",borderRadius:8,padding:"7px 10px"}}>
                                <div style={{flex:1,minWidth:0}}>
                                  <div style={{fontSize:11.5,color:"#334155",fontWeight:500}}>{r.namaKomponen}</div>
                                  {r.operators.length>0&&(
                                    <div style={{display:"flex",gap:5,flexWrap:"wrap" as const,marginTop:2}}>
                                      {r.operators.map((op:string)=>(
                                        <span key={op} style={{fontSize:9.5,color:"#64748b",fontWeight:600}}>👤 {op}</span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <span style={{fontWeight:800,fontSize:12,color:pc,background:pc+"14",borderRadius:20,padding:"3px 9px",flexShrink:0}}>{r.qtyDelta}/{r.qtyTotal} pcs</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          );
        })
      )}
    </div>
  );
}
