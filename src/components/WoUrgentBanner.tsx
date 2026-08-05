import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { daysUntil } from "../lib/dateHelpers";
import { Badge } from "./ui/Primitives";

// ─────────────────────────────────────────────────────────────────────────────
// WO URGENT BANNER - dipisah dari App.tsx (Sprint 6)
// ─────────────────────────────────────────────────────────────────────────────
function categorizeWo(w:any):{level:"late"|"mendesak"|"normal",d:number|null}{
  if(!w.target)return{level:"normal",d:null};
  const d=daysUntil(w.target);
  if(d<0)return{level:"late",d};
  if(d<=7)return{level:"mendesak",d};
  return{level:"normal",d};
}
export function WoUrgentBanner(){
  const [wos,setWos]=useState<any[]>([]);
  const [expanded,setExpanded]=useState(false);
  const [showNormal,setShowNormal]=useState(false);

  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      let all:any[]=[];
      let from=0;
      const pageSize=1000;
      while(true){
        const{data,error}=await supabase.from("work_orders").select("id,wo,proyek,target")
          .or("is_archived.is.null,is_archived.eq.false").range(from,from+pageSize-1);
        if(error||!data)break;
        all=all.concat(data);
        if(data.length<pageSize)break;
        from+=pageSize;
      }
      if(!cancelled)setWos(all);
    })();
    return()=>{cancelled=true;};
  },[]);

  const sorted=wos
    .map(w=>({...w,cat:categorizeWo(w)}))
    .sort((a,b)=>(a.cat.d===null?Infinity:a.cat.d)-(b.cat.d===null?Infinity:b.cat.d));

  if(sorted.length===0)return null;

  const lateMendesak=sorted.filter(w=>w.cat.level==="late"||w.cat.level==="mendesak");
  const normalWos=sorted.filter(w=>w.cat.level==="normal");
  const worst=sorted[0];
  const anyDelayed=sorted.some(w=>w.cat.level==="late");
  const anyMendesak=sorted.some(w=>w.cat.level==="mendesak");
  const theme=anyDelayed
    ?{icon:"⛔",border:"#fecaca",bg:"#fef2f2",text:"#dc2626",sub:"#7f1d1d"}
    :anyMendesak
    ?{icon:"⚠️",border:"#fde68a",bg:"#fffbeb",text:"#d97706",sub:"#78350f"}
    :{icon:"📋",border:"#e2e8f0",bg:"#f8fafc",text:"#475569",sub:"#64748b"};

  const rowLabel=(w:any)=>w.cat.level==="late"?"Terlambat "+Math.abs(w.cat.d)+" hari"
    :w.cat.level==="mendesak"?"H-"+w.cat.d+" Mendesak"
    :w.cat.d===null?"Tidak ada target"
    :"H-"+w.cat.d;
  const rowColor=(w:any)=>w.cat.level==="late"?"#dc2626":w.cat.level==="mendesak"?"#d97706":"#64748b";
  const rowBadge=(w:any)=>w.cat.level==="late"?"Terlambat":w.cat.level==="mendesak"?"Mendesak":"Normal";

  const renderRow=(w:any)=>{
    const c=rowColor(w);
    return(
      <div key={w.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 12px",
        borderBottom:`1px solid ${theme.border}50`}}>
        <span style={{color:c,fontSize:12,flexShrink:0}}>●</span>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:11,fontWeight:700,color:c,whiteSpace:"nowrap" as const,overflow:"hidden" as const,textOverflow:"ellipsis" as const}}>
            WO {w.wo} — {w.proyek}
          </div>
          <div style={{fontSize:10,color:w.cat.level==="normal"?"#64748b":theme.sub}}>
            {rowLabel(w)}{w.target?" · Target: "+w.target:""}
          </div>
        </div>
        <Badge label={rowBadge(w)} color={c}/>
      </div>
    );
  };

  return(
    <div style={{marginBottom:16,borderRadius:10,border:`1.5px solid ${theme.border}`,
      background:theme.bg,overflow:"hidden"}}>
      <button onClick={()=>setExpanded(!expanded)}
        style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"9px 12px",
          background:"none",border:"none",cursor:"pointer",textAlign:"left" as const,fontFamily:"inherit"}}>
        <span style={{fontSize:14,flexShrink:0}}>{theme.icon}</span>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:11.5,fontWeight:700,color:theme.text}}>
            Status Deadline WO · {sorted.length} WO aktif
          </div>
          {!expanded&&(
            <div style={{fontSize:10.5,color:theme.sub,whiteSpace:"nowrap" as const,
              overflow:"hidden" as const,textOverflow:"ellipsis" as const}}>
              WO {worst.wo} — {worst.proyek} · {rowLabel(worst)}
            </div>
          )}
        </div>
        <span style={{fontSize:11,color:theme.text,flexShrink:0}}>{expanded?"▲ Tutup":"▼ Lihat semua"}</span>
      </button>
      {expanded&&(
        <div style={{maxHeight:320,overflowY:"auto" as const,borderTop:`1px solid ${theme.border}`}}>
          {lateMendesak.map(renderRow)}
          {normalWos.length>0&&(
            <>
              <button onClick={()=>setShowNormal(!showNormal)}
                style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:6,
                  padding:"8px 12px",background:"none",border:"none",borderBottom:showNormal?`1px solid ${theme.border}50`:"none",
                  cursor:"pointer",fontFamily:"inherit",fontSize:10.5,fontWeight:700,color:"#64748b"}}>
                {showNormal?"▲ Sembunyikan":"▼ Lihat semua WO normal"} ({normalWos.length})
              </button>
              {showNormal&&normalWos.map(renderRow)}
            </>
          )}
        </div>
      )}
    </div>
  );
}
