import { useState, useEffect, useRef } from "react";
import { downloadFotoNp } from "../lib/fotoHelpers";
import { isVideoFoto, isGenericFoto } from "../lib/mediaThumb";

// ─────────────────────────────────────────────────────────────────────────────
// FOTO ZOOM VIEWER - dipisah dari App.tsx (Sprint 6)
// ─────────────────────────────────────────────────────────────────────────────
export type FotoViewerPekerja={url:string,uploaded_at?:string,uploaded_by?:string,name?:string,mime?:string};

// Viewer gaya ClickUp: prev/next antar foto dalam galeri yang sama, toolbar atas rapi
// (nama+posisi, Download, Close), scroll-wheel zoom + drag buat geser waktu di-zoom (mouse),
// pinch dua-jari + drag satu-jari (touch), thumbnail strip di bawah buat lompat foto.
// Dipakai sama semua tempat foto hasil kerja (Nameplate/Warehouse/QS/QC).
export function FotoZoomViewerPekerja({fotos,startIndex,label,onClose}:{fotos:FotoViewerPekerja[],startIndex:number,label?:string,onClose:()=>void}){
  const[index,setIndex]=useState(startIndex);
  const[zoom,setZoom]=useState(1);
  const[pan,setPan]=useState({x:0,y:0});
  const draggingRef=useRef(false);
  const dragStartRef=useRef({x:0,y:0,panX:0,panY:0});
  const pinchStartDist=useRef<number|null>(null);
  const pinchStartZoom=useRef(1);
  const panStartTouchRef=useRef<{x:number,y:number,panX:number,panY:number}|null>(null);

  // Swipe-down buat dismiss (mobile) - cuma aktif pas zoom===1 (gak konflik sama pan satu-jari
  // yang dipakai buat geser foto pas lagi di-zoom). BUG FIX (17 Agu 2026): tombol close di
  // header SEHARUSNYA selalu keliatan (header first-flex-child di container position:fixed),
  // tapi dilaporkan gak kejangkau di beberapa device - ditambah jalur keluar redundan
  // (swipe-down, tap area kosong di sekitar foto) + body scroll dikunci selama viewer kebuka,
  // biar gak ada skenario device manapun yang bikin user kejebak gak bisa keluar.
  const[dismissDragY,setDismissDragY]=useState(0);
  const dismissStartRef=useRef<{y:number,active:boolean}|null>(null);

  useEffect(()=>{
    const prevOverflow=document.body.style.overflow;
    document.body.style.overflow="hidden";
    return()=>{document.body.style.overflow=prevOverflow;};
  },[]);

  const foto=fotos[index];
  const isVideo=isVideoFoto(foto);
  const isGeneric=isGenericFoto(foto);
  const resetView=()=>{setZoom(1);setPan({x:0,y:0});setDismissDragY(0);};
  const goPrev=()=>{if(index>0){setIndex(index-1);resetView();}};
  const goNext=()=>{if(index<fotos.length-1){setIndex(index+1);resetView();}};

  // BUG FIX (7 Agu 2026): <img> gak punya loading/error state sama sekali - sementara foto lagi
  // kedownload (bisa beberapa detik di sinyal lemot pabrik) atau kalau beneran gagal load, yang
  // kelihatan cuma backdrop hitam modal ini - persis kayak "layar hitam, loading gak kelar-kelar"
  // yang dilaporkan, gak ada beda visual antara "masih loading" sama "macet total". Reset ke
  // "loading" tiap ganti foto (prev/next/thumbnail) - status lama gak kebawa ke foto berikutnya.
  const[imgStatus,setImgStatus]=useState<"loading"|"loaded"|"error">("loading");
  useEffect(()=>{setImgStatus("loading");},[index]);

  useEffect(()=>{
    const handler=(e:KeyboardEvent)=>{
      if(e.key==="ArrowLeft")goPrev();
      else if(e.key==="ArrowRight")goNext();
      else if(e.key==="Escape")onClose();
    };
    window.addEventListener("keydown",handler);
    return()=>window.removeEventListener("keydown",handler);
  },[index,fotos.length]);

  const handleWheel=(e:any)=>{
    e.preventDefault();
    setZoom(z=>{
      const next=Math.min(4,Math.max(1,z+(e.deltaY<0?0.25:-0.25)));
      if(next===1)setPan({x:0,y:0});
      return next;
    });
  };

  const handleMouseDown=(e:any)=>{
    if(zoom<=1)return;
    draggingRef.current=true;
    dragStartRef.current={x:e.clientX,y:e.clientY,panX:pan.x,panY:pan.y};
  };
  const handleMouseMove=(e:any)=>{
    if(!draggingRef.current)return;
    setPan({x:dragStartRef.current.panX+(e.clientX-dragStartRef.current.x),y:dragStartRef.current.panY+(e.clientY-dragStartRef.current.y)});
  };
  const handleMouseUp=()=>{draggingRef.current=false;};

  const handleTouchStart=(e:any)=>{
    if(e.touches.length===2){
      const[a,b]=e.touches;
      pinchStartDist.current=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
      pinchStartZoom.current=zoom;
      panStartTouchRef.current=null;
    } else if(e.touches.length===1&&zoom>1){
      const t=e.touches[0];
      panStartTouchRef.current={x:t.clientX,y:t.clientY,panX:pan.x,panY:pan.y};
    } else if(e.touches.length===1&&zoom===1){
      dismissStartRef.current={y:e.touches[0].clientY,active:true};
    }
  };
  const handleTouchMove=(e:any)=>{
    if(e.touches.length===2&&pinchStartDist.current){
      const[a,b]=e.touches;
      const dist=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
      const scale=dist/pinchStartDist.current;
      const next=Math.min(4,Math.max(1,pinchStartZoom.current*scale));
      setZoom(next);
      if(next===1)setPan({x:0,y:0});
    } else if(e.touches.length===1&&panStartTouchRef.current){
      const t=e.touches[0];
      const st=panStartTouchRef.current;
      setPan({x:st.panX+(t.clientX-st.x),y:st.panY+(t.clientY-st.y)});
    } else if(e.touches.length===1&&dismissStartRef.current?.active){
      const delta=e.touches[0].clientY-dismissStartRef.current.y;
      if(delta>0)setDismissDragY(delta); // cuma respon geser ke BAWAH - ke atas dibiarkan diam (bukan gesture dismiss)
    }
  };
  const DISMISS_THRESHOLD=100;
  const handleTouchEnd=()=>{
    pinchStartDist.current=null;
    panStartTouchRef.current=null;
    if(dismissStartRef.current?.active){
      if(dismissDragY>DISMISS_THRESHOLD)onClose();
      else setDismissDragY(0);
    }
    dismissStartRef.current=null;
  };

  const fmtTgl=(iso?:string)=>{
    if(!iso)return"";
    const d=new Date(iso);
    return d.toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"})+" "+d.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"});
  };

  return(
    <div onClick={onClose}
      style={{position:"fixed" as const,inset:0,background:"rgba(0,0,0,0.92)",zIndex:9999,display:"flex",flexDirection:"column" as const,
        opacity:dismissDragY>0?Math.max(0.4,1-dismissDragY/400):1,transition:dismissStartRef.current?"none":"opacity .15s"}}>
      <style>{`@keyframes fotoZoomSpin{to{transform:rotate(360deg)}}`}</style>
      {/* Tombol close SENGAJA position:fixed independen dari header (bukan cuma anggota flex di
          dalamnya) + tap target 44x44 (standar minimum Apple/Google) + z-index di atas segalanya
          di komponen ini - biar posisinya gak pernah bisa "ketutup"/ke-nonaktifkan oleh apapun di
          konten foto (zoom/pan/overflow), dan gampang di-tap di layar kecil. Ditemani jalur keluar
          lain yang lebih natural buat mobile: tap area kosong di sekitar foto, atau swipe-down. */}
      <button onClick={(e:any)=>{e.stopPropagation();onClose();}}
        style={{position:"fixed" as const,top:"max(14px, env(safe-area-inset-top))",right:"max(14px, env(safe-area-inset-right))",
          width:44,height:44,borderRadius:99,background:"rgba(15,23,42,0.75)",color:"#fff",border:"1px solid rgba(255,255,255,0.35)",
          cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:10000}}>
        <i className="ti ti-x" style={{fontSize:20}}/>
      </button>

      <div onClick={(e:any)=>e.stopPropagation()}
        style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 70px 12px 18px",background:"linear-gradient(rgba(0,0,0,0.55),transparent)",flexShrink:0}}>
        <div style={{minWidth:0}}>
          <div style={{color:"#fff",fontSize:13,fontWeight:700,whiteSpace:"nowrap" as const,overflow:"hidden",textOverflow:"ellipsis"}}>
            {foto.name||label||"Foto"}{fotos.length>1?` · ${index+1}/${fotos.length}`:""}
          </div>
          {(foto.uploaded_by||foto.uploaded_at)&&(
            <div style={{color:"#cbd5e1",fontSize:11,marginTop:2}}>
              {foto.uploaded_by?`Diupload oleh ${foto.uploaded_by}`:""}{foto.uploaded_at?" · "+fmtTgl(foto.uploaded_at):""}
            </div>
          )}
        </div>
        <button onClick={()=>downloadFotoNp(foto.url,foto.name||label||"foto")}
          style={{display:"flex",alignItems:"center",gap:6,background:"rgba(15,23,42,0.65)",color:"#fff",border:"1px solid rgba(255,255,255,0.3)",borderRadius:8,padding:"8px 14px",fontSize:12,fontWeight:700,cursor:"pointer",flexShrink:0}}>
          <i className="ti ti-download" style={{fontSize:15}}/> Download
        </button>
      </div>

      {/* Tap di area kosong sekitar foto (bukan foto-nya sendiri) buat close - target===currentTarget
          artinya klik kena wrapper ini langsung, bukan bubble dari <img>/tombol prev-next di dalamnya. */}
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",position:"relative" as const,overflow:"hidden",minHeight:0,
          transform:dismissDragY>0?`translateY(${dismissDragY}px)`:undefined}}
        onClick={(e:any)=>{if(e.target===e.currentTarget)onClose();else e.stopPropagation();}}>
        {fotos.length>1&&index>0&&(
          <button onClick={goPrev}
            style={{position:"absolute" as const,left:14,top:"50%",transform:"translateY(-50%)",width:44,height:44,borderRadius:99,background:"rgba(15,23,42,0.55)",color:"#fff",border:"1px solid rgba(255,255,255,0.3)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2}}>
            <i className="ti ti-chevron-left" style={{fontSize:24}}/>
          </button>
        )}
        {isVideo?(
          <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <video src={foto.url} controls autoPlay style={{maxWidth:"90%",maxHeight:"90%"}}/>
          </div>
        ):isGeneric?(
          <div style={{display:"flex",flexDirection:"column" as const,alignItems:"center",gap:14,color:"#fff"}}>
            <i className="ti ti-file-text" style={{fontSize:64,color:"#94a3b8"}}/>
            <div style={{fontSize:14,fontWeight:600,maxWidth:320,textAlign:"center" as const,wordBreak:"break-all" as const}}>{foto.name||"File"}</div>
            <button onClick={()=>window.open(foto.url,"_blank")}
              style={{display:"flex",alignItems:"center",gap:6,background:"rgba(255,255,255,0.15)",color:"#fff",border:"none",borderRadius:8,padding:"10px 18px",fontSize:13,fontWeight:700,cursor:"pointer"}}>
              <i className="ti ti-external-link" style={{fontSize:15}}/> Buka File
            </button>
          </div>
        ):(
          <div
            onWheel={handleWheel}
            onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
            onClick={(e:any)=>{if(e.target===e.currentTarget)onClose();}}
            style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",touchAction:"none" as const,cursor:zoom>1?(draggingRef.current?"grabbing":"grab"):"default"}}>
            {imgStatus==="loading"&&(
              <div style={{position:"absolute" as const,display:"flex",flexDirection:"column" as const,alignItems:"center",gap:10,color:"#fff",pointerEvents:"none" as const}}>
                <i className="ti ti-loader-2" style={{fontSize:36,animation:"fotoZoomSpin 0.8s linear infinite"}}/>
                <div style={{fontSize:12,color:"#cbd5e1"}}>Memuat foto...</div>
              </div>
            )}
            {imgStatus==="error"?(
              <div style={{display:"flex",flexDirection:"column" as const,alignItems:"center",gap:14,color:"#fff"}}>
                <i className="ti ti-photo-off" style={{fontSize:56,color:"#94a3b8"}}/>
                <div style={{fontSize:13,fontWeight:600,textAlign:"center" as const}}>Foto gagal dimuat - cek koneksi internet.</div>
                <button onClick={()=>window.open(foto.url,"_blank")}
                  style={{display:"flex",alignItems:"center",gap:6,background:"rgba(255,255,255,0.15)",color:"#fff",border:"none",borderRadius:8,padding:"10px 18px",fontSize:13,fontWeight:700,cursor:"pointer"}}>
                  <i className="ti ti-external-link" style={{fontSize:15}}/> Buka di Tab Baru
                </button>
              </div>
            ):(
              <img key={foto.url} src={foto.url} draggable={false}
                onLoad={()=>setImgStatus("loaded")} onError={()=>setImgStatus("error")}
                style={{maxWidth:"90%",maxHeight:"90%",objectFit:"contain" as const,opacity:imgStatus==="loaded"?1:0,transform:`translate(${pan.x}px,${pan.y}px) scale(${zoom})`,transformOrigin:"center",transition:draggingRef.current?"none":"opacity .15s,transform .08s"}}/>
            )}
          </div>
        )}
        {fotos.length>1&&index<fotos.length-1&&(
          <button onClick={goNext}
            style={{position:"absolute" as const,right:14,top:"50%",transform:"translateY(-50%)",width:44,height:44,borderRadius:99,background:"rgba(15,23,42,0.55)",color:"#fff",border:"1px solid rgba(255,255,255,0.3)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2}}>
            <i className="ti ti-chevron-right" style={{fontSize:24}}/>
          </button>
        )}
      </div>

      <div onClick={(e:any)=>e.stopPropagation()} style={{flexShrink:0,padding:"10px 18px 16px"}}>
        {!isVideo&&!isGeneric&&(
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:14,marginBottom:fotos.length>1?12:0}}>
            <button onClick={()=>setZoom(z=>{const n=Math.max(1,z-0.5);if(n===1)setPan({x:0,y:0});return n;})}
              style={{width:32,height:32,borderRadius:99,background:"rgba(255,255,255,0.15)",color:"#fff",border:"none",fontSize:17,fontWeight:700,cursor:"pointer"}}>−</button>
            <span style={{color:"#fff",fontSize:12,fontWeight:700,minWidth:40,textAlign:"center" as const}}>{Math.round(zoom*100)}%</span>
            <button onClick={()=>setZoom(z=>Math.min(4,z+0.5))}
              style={{width:32,height:32,borderRadius:99,background:"rgba(255,255,255,0.15)",color:"#fff",border:"none",fontSize:17,fontWeight:700,cursor:"pointer"}}>+</button>
          </div>
        )}
        {fotos.length>1&&(
          <div style={{display:"flex",gap:6,overflowX:"auto" as const,justifyContent:fotos.length<=8?"center":"flex-start",padding:"2px 0"}}>
            {fotos.map((f,fi)=>{
              const fVideo=isVideoFoto(f);
              const fGeneric=isGenericFoto(f);
              return(
                <div key={fi} onClick={()=>{setIndex(fi);resetView();}}
                  style={{position:"relative" as const,width:48,height:48,borderRadius:6,cursor:"pointer",flexShrink:0,overflow:"hidden",
                    background:"#1e293b",display:"flex",alignItems:"center",justifyContent:"center",
                    border:fi===index?"2px solid #fff":"2px solid transparent",opacity:fi===index?1:0.55}}>
                  {fVideo?(
                    <><video src={f.url} muted style={{width:"100%",height:"100%",objectFit:"cover" as const}}/>
                    <i className="ti ti-player-play-filled" style={{position:"absolute" as const,fontSize:14,color:"#fff"}}/></>
                  ):fGeneric?(
                    <i className="ti ti-file-text" style={{fontSize:18,color:"#cbd5e1"}}/>
                  ):(
                    <img src={f.url} style={{width:"100%",height:"100%",objectFit:"cover" as const}}/>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
