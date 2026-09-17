import { useState, useEffect } from 'react'
import { useWoEngineeringBroadcast, type WoEngineeringEvent } from '../lib/useWoEngineeringBroadcast'

// Banner broadcast "WO diubah Engineering" (17 Sep 2026, REDESAIN VISUAL) - lihat komentar
// lengkap di vista-teknik/src/components/WoEngineeringBanner.tsx (komponen ini duplikasi kecil,
// sama persis). Dulu bar tipis full-width solid, sekarang kartu mengambang semi-transparan+blur,
// center-top, animasi slide+fade masuk-keluar, ditumpuk (stack) kalau lebih dari 1 belum dibaca.
export function WoEngineeringBanner({akun,topOffset=0}:{akun:string|null,topOffset?:number}){
  const{unread,markAsRead}=useWoEngineeringBroadcast(akun)
  if(unread.length===0)return null
  return(
    <div style={{position:"fixed",top:16+topOffset,left:"50%",transform:"translateX(-50%)",zIndex:10001,
      display:"flex",flexDirection:"column" as const,gap:10,
      width:"calc(100% - 32px)",maxWidth:440,pointerEvents:"none" as const}}>
      {unread.map(ev=><WoEngineeringCard key={ev.id} event={ev} onRead={markAsRead}/>)}
    </div>
  )
}

function WoEngineeringCard({event,onRead}:{event:WoEngineeringEvent,onRead:(id:number)=>void}){
  const[visible,setVisible]=useState(false)
  const[closing,setClosing]=useState(false)
  useEffect(()=>{
    const raf=requestAnimationFrame(()=>setVisible(true))
    return()=>cancelAnimationFrame(raf)
  },[])
  const handleRead=()=>{
    setClosing(true)
    setTimeout(()=>onRead(event.id),260)
  }
  const jenisLabel=event.jenis_perubahan==="tambah"?"Ditambahkan":"Diedit"
  const waktuRelatif=(()=>{
    const diffMin=Math.round((Date.now()-new Date(event.created_at).getTime())/60000)
    if(diffMin<1)return"baru saja"
    if(diffMin<60)return diffMin+" menit lalu"
    const diffJam=Math.round(diffMin/60)
    if(diffJam<24)return diffJam+" jam lalu"
    return Math.round(diffJam/24)+" hari lalu"
  })()
  return(
    <div style={{
      pointerEvents:closing?"none" as const:"auto" as const,
      transform:closing?"translateY(-16px)":visible?"translateY(0)":"translateY(-24px)",
      opacity:closing?0:visible?1:0,
      transition:closing
        ?"transform 250ms cubic-bezier(0.4,0,1,1), opacity 250ms cubic-bezier(0.4,0,1,1)"
        :"transform 320ms cubic-bezier(0.16,1,0.3,1), opacity 320ms ease-out",
      background:"rgba(67,56,202,0.85)",backdropFilter:"blur(14px) saturate(160%)",
      WebkitBackdropFilter:"blur(14px) saturate(160%)",
      border:"1px solid rgba(255,255,255,0.2)",borderRadius:16,
      boxShadow:"0 16px 40px rgba(67,56,202,0.35), 0 4px 14px rgba(15,23,42,0.14)",
      color:"#fff",padding:"14px 16px",fontFamily:"inherit"}}>
      <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
        <div style={{flexShrink:0,width:38,height:38,borderRadius:11,background:"rgba(255,255,255,0.16)",
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:19}}>🛠️</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:14.5,fontWeight:800,lineHeight:1.35}}>WO {event.wo_number} - {event.proyek}</div>
          <div style={{marginTop:4,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap" as const}}>
            <span style={{background:"rgba(255,255,255,0.18)",borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700}}>{jenisLabel}</span>
            <span style={{fontSize:12.5,color:"#e0e7ff"}}>oleh <strong style={{color:"#fff"}}>{event.dilakukan_oleh}</strong></span>
          </div>
        </div>
      </div>
      <div style={{marginTop:12,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
        <span style={{fontSize:11.5,color:"#c7d2fe"}}>{waktuRelatif}</span>
        <button onClick={handleRead}
          style={{padding:"7px 16px",borderRadius:9,border:"none",background:"#fff",color:"#4338ca",
            fontWeight:800,fontSize:12.5,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>
          ✓ Sudah Dibaca
        </button>
      </div>
    </div>
  )
}
