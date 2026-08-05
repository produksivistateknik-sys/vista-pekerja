import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { PANEL_TYPES } from "../lib/panelTypes";
import { TODAY, addDays, fmtDate } from "../lib/dateHelpers";

// ─────────────────────────────────────────────────────────────────────────────
// REVIEW POTONG - histori read-only "hari ini/kemarin motong apa aja", navigasi
// per tanggal tunggal, dikelompokkan PROYEK -> PANEL -> semua komponen yang
// dipotong di tanggal itu (shift jadi badge per-baris, bukan level grouping -
// biar 1 panel yang kerja lintas shift tetap muncul SATU kali aja, gak duplikat).
// Sumber data: panels.checklist[kode].history.POTONG (bukan raw_schedule/jejak -
// itu murni penjadwalan, gak punya shift/qty per checkpoint). Tiap entry history
// sudah {ts,pct,shift,tanggal} - tanggal/shift di situ udah otomatis benar sesuai
// logic hariKerjaAwal (shift 2 lewat tengah malam) karena ditulis pakai logic
// yang sama pas operator submit progress - jadi di sini tinggal pakai apa
// adanya, gak perlu hitung ulang. Qty per checkpoint dihitung dari SELISIH
// persentase antar-checkpoint berurutan (checkpoint sebelumnya start dari 0%).
export function ReviewPotongView(){
  const[loading,setLoading]=useState(true);
  const[entries,setEntries]=useState<any[]>([]);
  const[viewDate,setViewDate]=useState(TODAY);
  const[expandedProyek,setExpandedProyek]=useState<Record<string,boolean>>({});
  const[expandedPanel,setExpandedPanel]=useState<Record<string,boolean>>({});

  // kode->nama komponen: bom_master (live, dikelola dari Master Data BOM Vista Teknik) jadi
  // sumber UTAMA - PANEL_TYPES statis cuma fallback kalau kebetulan ada kode yang belum
  // sempat ke-sync ke bom_master. Tanpa ini, komponen yang ditambah/diubah namanya setelah
  // config statis terakhir di-update bakal nongol sebagai kode mentah (FS.27) doang.
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
          const histHariIni=histSemua.filter((h:any)=>h.tanggal===viewDate);
          if(histHariIni.length===0)return;
          // Urutkan SEMUA checkpoint (bukan cuma hari ini) biar qty delta dihitung dari
          // checkpoint sebelumnya yang bener (bisa aja checkpoint sebelumnya itu H-1/H-2).
          const sortedSemua=[...histSampaiHariIni].sort((a:any,b:any)=>String(a.ts).localeCompare(String(b.ts)));
          const qtyTotal=Number(cl.qty)||0;
          sortedSemua.forEach((h:any,idx:number)=>{
            if(h.tanggal!==viewDate)return;
            const pctSebelum=idx>0?Number(sortedSemua[idx-1].pct)||0:0;
            const qtySkrg=Math.round((Number(h.pct)||0)/100*qtyTotal);
            const qtySblm=Math.round(pctSebelum/100*qtyTotal);
            const delta=qtySkrg-qtySblm;
            if(delta<=0)return;
            rows.push({
              tanggal:h.tanggal,shift:h.shift||"1",panelId:p.id,panelNama:p.nama,
              proyek:woMap[p.wo_id]?.proyek||"(Tanpa Proyek)",wo:woMap[p.wo_id]?.wo||"",
              kode,namaKomponen:kodeNamaMap[kode]||kode,qtyDelta:delta,ts:h.ts,
            });
          });
        });
      });

      const panelIdsRelevan=[...new Set(rows.map((r:any)=>r.panelId))];
      const{data:timers}=panelIdsRelevan.length>0
        ?await supabase.from("fcs_timer_kerja").select("panel_id,kode_komponen,tanggal,pekerja:pekerja_id(nama)").eq("proses","POTONG").in("panel_id",panelIdsRelevan).eq("tanggal",viewDate)
        :{data:[]};
      const operatorMap:Record<string,Set<string>>={};
      (timers||[]).forEach((t:any)=>{
        const key=`${t.panel_id}|${t.kode_komponen}|${t.tanggal}`;
        if(!operatorMap[key])operatorMap[key]=new Set();
        if(t.pekerja?.nama)operatorMap[key].add(t.pekerja.nama);
      });
      rows.forEach((r:any)=>{
        const key=`${r.panelId}|${r.kode}|${r.tanggal}`;
        r.operators=[...(operatorMap[key]||new Set())];
      });

      if(!cancelled){setEntries(rows);setLoading(false);}
    })();
    return()=>{cancelled=true;};
  },[viewDate,kodeNamaMap]);

  const naturalKodeSort=(a:string,b:string)=>{
    const parse=(k:string)=>{const m=k.match(/^(.*?)(\d+)$/);return m?{prefix:m[1],num:parseInt(m[2],10)}:{prefix:k,num:0};};
    const pa=parse(a),pb=parse(b);
    if(pa.prefix!==pb.prefix)return pa.prefix.localeCompare(pb.prefix);
    return pa.num-pb.num;
  };

  // PROYEK -> PANEL -> list komponen (flat, gak dipecah shift lagi - shift jadi
  // badge per-baris di bawah, biar 1 panel gak muncul dobel walau kerja lintas shift).
  const groupedProyek=useMemo(()=>{
    const byProyek:Record<string,{wo:string,panels:Record<string,{panelId:number,panelNama:string,items:any[]}>}>={};
    entries.forEach((r:any)=>{
      if(!byProyek[r.proyek])byProyek[r.proyek]={wo:r.wo,panels:{}};
      const panelKey=String(r.panelId);
      if(!byProyek[r.proyek].panels[panelKey])byProyek[r.proyek].panels[panelKey]={panelId:r.panelId,panelNama:r.panelNama,items:[]};
      byProyek[r.proyek].panels[panelKey].items.push(r);
    });
    return Object.entries(byProyek).sort((a,b)=>a[0].localeCompare(b[0])).map(([proyek,data])=>({
      proyek,wo:data.wo,
      panels:Object.values(data.panels).sort((a,b)=>a.panelNama.localeCompare(b.panelNama)).map(p=>({
        ...p,items:p.items.sort((a:any,b:any)=>naturalKodeSort(a.kode,b.kode)),
      })),
    }));
  },[entries]);

  const toggleProyek=(proyek:string)=>setExpandedProyek(prev=>({...prev,[proyek]:!(prev[proyek]??true)}));
  const togglePanel=(key:string)=>setExpandedPanel(prev=>({...prev,[key]:!(prev[key]??true)}));

  return(
    <div style={{padding:16,maxWidth:560,margin:"0 auto"}} className="fi">
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
        <div style={{width:40,height:40,borderRadius:10,background:"linear-gradient(135deg,#f59e0b,#d97706)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,boxShadow:"0 3px 10px #d9770644"}}>📋</div>
        <div>
          <div style={{fontWeight:800,fontSize:15,color:"#1e293b"}}>Review Potong</div>
          <div style={{fontSize:11,color:"#64748b"}}>Riwayat komponen yang sudah dipotong</div>
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
      ):groupedProyek.length===0?(
        <div style={{textAlign:"center",padding:40,color:"#94a3b8"}}>
          <div style={{fontSize:32,marginBottom:8}}>📭</div>
          <div style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>Belum ada riwayat</div>
          <div style={{fontSize:12,marginTop:4}}>Belum ada komponen yang dipotong di tanggal ini</div>
        </div>
      ):(
        groupedProyek.map(({proyek,wo,panels})=>{
          const isProyekOpen=expandedProyek[proyek]??true;
          return(
            <div key={proyek} style={{marginBottom:10,background:"#fff",borderRadius:10,border:"1px solid #e2e8f0",overflow:"hidden"}}>
              <div onClick={()=>toggleProyek(proyek)} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",cursor:"pointer",background:"#f8fafc"}}>
                <span style={{fontSize:11,color:"#94a3b8"}}>{isProyekOpen?"▾":"▸"}</span>
                <span style={{fontWeight:800,fontSize:13,color:"#1e293b",flex:1}}>{proyek}{wo?" - WO "+wo:""}</span>
                <span style={{background:"#fffbeb",color:"#d97706",borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:700}}>{panels.length} panel</span>
              </div>
              {isProyekOpen&&(
                <div style={{padding:"6px 10px 10px"}}>
                  {panels.map(p=>{
                    const panelKey=proyek+"|"+p.panelId;
                    const isPanelOpen=expandedPanel[panelKey]??true;
                    return(
                      <div key={p.panelId} style={{marginTop:6}}>
                        <div onClick={()=>togglePanel(panelKey)} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 6px",cursor:"pointer"}}>
                          <span style={{fontSize:10,color:"#94a3b8"}}>{isPanelOpen?"▾":"▸"}</span>
                          <span style={{fontWeight:700,fontSize:12,color:"#334155",flex:1}}>{p.panelNama}</span>
                          <span style={{fontSize:10,color:"#94a3b8"}}>{p.items.length} komponen</span>
                        </div>
                        {isPanelOpen&&(
                          <div style={{display:"flex",flexDirection:"column" as const,gap:5,paddingLeft:18,marginTop:2}}>
                            {p.items.map((r:any,i:number)=>(
                              <div key={i} style={{display:"flex",alignItems:"center",gap:8,background:"#f8fafc",borderRadius:8,padding:"7px 10px"}}>
                                <div style={{flex:1,minWidth:0}}>
                                  <div style={{fontSize:11.5,color:"#334155"}}>{r.namaKomponen}</div>
                                  <div style={{display:"flex",gap:5,flexWrap:"wrap" as const,marginTop:3,alignItems:"center"}}>
                                    <span style={{background:r.shift==="2"?"#ede9fe":"#eff6ff",color:r.shift==="2"?"#6d28d9":"#1d4ed8",borderRadius:20,padding:"1px 7px",fontSize:9,fontWeight:700}}>Shift {r.shift}</span>
                                    {r.operators.map((op:string)=>(
                                      <span key={op} style={{fontSize:10,color:"#64748b",fontWeight:600}}>👤 {op}</span>
                                    ))}
                                  </div>
                                </div>
                                <div style={{fontWeight:800,fontSize:13,color:"#d97706",flexShrink:0}}>{r.qtyDelta} <span style={{fontSize:9,fontWeight:700,color:"#92400e"}}>pcs</span></div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
