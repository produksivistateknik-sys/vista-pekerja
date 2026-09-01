import "../lib/iteratorPolyfill";
import { useEffect, useRef, useState, type TouchEvent as ReactTouchEvent } from "react";
import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore - Vite `?url` import, sama pola kayak src/lib/ocrHelpers.ts
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

const sanitizeNamaFile=(nama:string)=>(nama||"dokumen").replace(/[\\/:*?"<>|]/g,"_").trim()||"dokumen";
const downloadPdf=async(url:string,filename:string)=>{
  const res=await fetch(url);
  const blob=await res.blob();
  const blobUrl=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=blobUrl;a.download=filename;
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
};

// ─────────────────────────────────────────────────────────────────────────────
// PDF VIEWER (1 Sep 2026) - KHUSUS ANDROID sekarang (WoDigitalView.tsx udah cegat iOS duluan,
// window.open() ke Safari - lihat komentar di sana). Render custom per-halaman ke <canvas> via
// pdfjs-dist. Ini pendekatan yang TERBUKTI render di device Android sungguhan (tablet) - sempat
// ada bug zoom "gepeng" (maxWidth:100% yang salah) sudah diperbaiki, dan bug scroll "cuma bisa
// ke kiri" (kuirk flexbox justify-content:center) juga sudah diperbaiki (pakai margin:0 auto).
//
// iOS TIDAK LEWAT komponen ini lagi - WebView standalone PWA iOS gak reliable buat blob
// URL/iframe-ke-PDF (dikonfirmasi user: putih/harus-download/redirect gak konsisten pas app
// dibuka dari ikon home screen). Canvas custom pun sempat dilaporkan lambat/macet khusus di
// iPhone. Daripada terus force in-app di platform yang WebView-nya sendiri bermasalah, iOS
// dialihkan ke Safari penuh (lihat WoDigitalView.tsx) yang sudah pasti reliable.
//
// Tetap pakai path proxy /pdf-proxy/... (rewrite Vercel ke photo.vistaproduksi.com, lihat
// vercel.json) buat fetch() pdfjs-dist DAN tombol Download - same-origin, gak butuh CORS di R2.
// R2_BASE di-hardcode (BUKAN baca import.meta.env) - env var VITE_R2_PUBLIC_BASE_URL ternyata
// gak ke-set di Vercel production, bikin toProxyUrl() diam-diam gak pernah jalan.
//
// Render 2 tahap (resolusi rendah dulu biar langsung muncul, baru upgrade kualitas penuh di
// background) + pinch-zoom manual (2 jari, browser gak bisa native zoom karena user-scalable=no
// di index.html) + tombol zoom +/- fallback + safety-net timeout (kalau pdfjs-dist macet).
// ─────────────────────────────────────────────────────────────────────────────
const ZOOM_MIN=0.5,ZOOM_MAX=3,ZOOM_STEP=0.25;
const R2_BASE="https://photo.vistaproduksi.com";
const toProxyUrl=(u:string)=>u.startsWith(R2_BASE)?("/pdf-proxy"+u.slice(R2_BASE.length)):u;

export function PdfViewerPekerja({url,title,subtitle,onBack}:{url:string,title:string,subtitle?:string,onBack:()=>void}){
  const proxyUrl=toProxyUrl(url);
  const canvasRef=useRef<HTMLCanvasElement|null>(null);
  const containerRef=useRef<HTMLDivElement|null>(null);
  const pdfDocRef=useRef<any>(null);
  const renderTaskRef=useRef<any>(null);
  const firstPaintDoneRef=useRef(false);
  const[numPages,setNumPages]=useState(0);
  const[pageIndex,setPageIndex]=useState(0);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState<string|null>(null);
  const[resizeTick,setResizeTick]=useState(0);
  const[downloading,setDownloading]=useState(false);
  const[zoom,setZoom]=useState(1);
  const[shareMsg,setShareMsg]=useState("");
  const[loadPct,setLoadPct]=useState<number|null>(null);
  const[pinchScale,setPinchScale]=useState(1);
  const pinchStartDistRef=useRef<number|null>(null);
  const pinchStartZoomRef=useRef(1);

  useEffect(()=>{
    let cancelled=false;
    firstPaintDoneRef.current=false;
    setLoading(true);setError(null);setPageIndex(0);setNumPages(0);setZoom(1);setLoadPct(null);
    const task=pdfjsLib.getDocument({url:proxyUrl});
    task.onProgress=(p:any)=>{if(p?.total)setLoadPct(Math.min(99,Math.round((p.loaded/p.total)*100)));};
    // Safety-net: pdfjs-dist kadang MACET TOTAL (gak resolve, gak reject) alih-alih gagal dengan
    // error - mastiin tetap ada jalan keluar (pesan error + link buka tab baru).
    const hangTimeout=setTimeout(()=>{
      if(cancelled)return;
      setError("PDF terlalu lama dimuat. Coba lagi atau buka di tab baru.");
      setLoading(false);
    },20000);
    task.promise.then((pdf:any)=>{
      if(cancelled)return;
      clearTimeout(hangTimeout);
      pdfDocRef.current=pdf;
      setNumPages(pdf.numPages);
    }).catch(()=>{
      if(cancelled)return;
      clearTimeout(hangTimeout);
      setError("Gagal memuat PDF. Coba lagi atau buka di tab baru.");
      setLoading(false);
    });
    return()=>{cancelled=true;clearTimeout(hangTimeout);pdfDocRef.current?.destroy?.();pdfDocRef.current=null;};
  },[proxyUrl]);

  useEffect(()=>{
    const onResize=()=>setResizeTick(t=>t+1);
    window.addEventListener("resize",onResize);
    window.addEventListener("orientationchange",onResize);
    return()=>{window.removeEventListener("resize",onResize);window.removeEventListener("orientationchange",onResize);};
  },[]);

  useEffect(()=>{
    if(!pdfDocRef.current||!canvasRef.current||numPages===0)return;
    let cancelled=false;
    (async()=>{
      try{
        const page=await pdfDocRef.current.getPage(pageIndex+1);
        if(cancelled)return;
        const canvas=canvasRef.current;
        if(!canvas)return;
        const ctx=canvas.getContext("2d");
        if(!ctx)return;
        const containerWidth=containerRef.current?.clientWidth||360;
        const baseViewport=page.getViewport({scale:1});
        const fitScale=Math.min((containerWidth-24)/baseViewport.width,2);
        const cssScale=fitScale*zoom;
        canvas.style.width=(baseViewport.width*cssScale)+"px";
        canvas.style.height=(baseViewport.height*cssScale)+"px";

        const paint=async(backingScale:number)=>{
          const viewport=page.getViewport({scale:backingScale});
          canvas.width=viewport.width;
          canvas.height=viewport.height;
          if(renderTaskRef.current)renderTaskRef.current.cancel();
          const task=page.render({canvasContext:ctx,canvas,viewport});
          renderTaskRef.current=task;
          await task.promise;
        };

        await paint(Math.min(cssScale,1));
        if(cancelled)return;
        if(!firstPaintDoneRef.current){firstPaintDoneRef.current=true;setLoading(false);}

        const dpr=Math.min(window.devicePixelRatio||1,2);
        await paint(cssScale*dpr);
      }catch{/* render dibatalkan (ganti halaman/zoom/ukuran cepat) - abaikan */}
    })();
    return()=>{cancelled=true;};
  },[pageIndex,numPages,resizeTick,zoom]);

  const onTouchStart=(e:ReactTouchEvent)=>{
    if(e.touches.length===2){
      const a=e.touches[0],b=e.touches[1];
      pinchStartDistRef.current=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
      pinchStartZoomRef.current=zoom;
    }
  };
  const onTouchMove=(e:ReactTouchEvent)=>{
    if(e.touches.length===2&&pinchStartDistRef.current){
      const a=e.touches[0],b=e.touches[1];
      const dist=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
      const rawScale=dist/pinchStartDistRef.current;
      const clampedScale=Math.min(ZOOM_MAX/pinchStartZoomRef.current,Math.max(ZOOM_MIN/pinchStartZoomRef.current,rawScale));
      setPinchScale(clampedScale);
    }
  };
  const onTouchEnd=()=>{
    if(pinchStartDistRef.current){
      setZoom(+(pinchStartZoomRef.current*pinchScale).toFixed(2));
      setPinchScale(1);
      pinchStartDistRef.current=null;
    }
  };

  const doDownload=async()=>{
    setDownloading(true);
    try{await downloadPdf(proxyUrl,sanitizeNamaFile(title)+".pdf");}
    catch{alert("Gagal download file.");}
    setDownloading(false);
  };

  const doShare=async()=>{
    if((navigator as any).share){
      try{await (navigator as any).share({title,url});}catch{/* dibatalkan user - abaikan */}
      return;
    }
    try{
      await navigator.clipboard.writeText(url);
      setShareMsg("Link disalin!");
      setTimeout(()=>setShareMsg(""),1800);
    }catch{alert("Gagal membagikan link.");}
  };

  const iconBtnStyle={background:"#f1f5f9",border:"1px solid #e2e8f0",borderRadius:8,
    width:34,height:34,color:"#475569",fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0} as const;

  return(
    <div style={{padding:"12px 12px 20px"}}>
      <button onClick={onBack} style={{display:"flex",alignItems:"center",gap:5,background:"none",border:"none",
        color:"#1d4ed8",fontWeight:700,fontSize:13,cursor:"pointer",padding:0,marginBottom:10}}>
        <i className="ti ti-arrow-left" style={{fontSize:15}}/> Kembali
      </button>
      <div style={{fontWeight:800,fontSize:14,color:"#0f172a",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{title}</div>
      <div style={{fontSize:11,color:"#94a3b8",marginTop:1,marginBottom:10}}>
        {subtitle}{subtitle&&numPages>0?" · ":""}{numPages>0?`Halaman ${pageIndex+1} / ${numPages}`:""}
      </div>

      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:10}}>
        <div style={{display:"flex",alignItems:"center",gap:4}}>
          <button onClick={()=>setZoom(z=>Math.max(ZOOM_MIN,+(z-ZOOM_STEP).toFixed(2)))} disabled={zoom<=ZOOM_MIN} style={iconBtnStyle}>−</button>
          <span style={{fontSize:11,color:"#64748b",fontWeight:700,width:36,textAlign:"center"}}>{Math.round(zoom*100)}%</span>
          <button onClick={()=>setZoom(z=>Math.min(ZOOM_MAX,+(z+ZOOM_STEP).toFixed(2)))} disabled={zoom>=ZOOM_MAX} style={iconBtnStyle}>+</button>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{position:"relative"}}>
            <button onClick={doShare} style={iconBtnStyle}><i className="ti ti-share"/></button>
            {shareMsg&&<div style={{position:"absolute",top:"calc(100% + 6px)",right:0,background:"#0f172a",color:"#fff",fontSize:10.5,fontWeight:600,
              padding:"5px 9px",borderRadius:6,whiteSpace:"nowrap",zIndex:3}}>{shareMsg}</div>}
          </div>
          <button onClick={doDownload} disabled={downloading} style={{background:"#1d4ed8",border:"none",borderRadius:8,
            padding:"0 14px",height:34,color:"#fff",fontSize:12,fontWeight:700,cursor:downloading?"default":"pointer",display:"flex",alignItems:"center",gap:6}}>
            <i className="ti ti-download" style={{fontSize:14}}/>{downloading?"...":"Download"}
          </button>
        </div>
      </div>

      <div ref={containerRef} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}
        style={{background:"#f1f5f9",borderRadius:12,border:"1px solid #e2e8f0",minHeight:"55vh",touchAction:"pan-x pan-y",
        overflow:"auto",padding:12,position:"relative"}}>
        {loading&&(
          <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",color:"#94a3b8",textAlign:"center"}}>
            <i className="ti ti-loader-2" style={{fontSize:30,display:"block",marginBottom:8,animation:"pdfv-spin 1s linear infinite"}}/>
            Memuat PDF...{loadPct!=null&&` ${loadPct}%`}
          </div>
        )}
        {error&&(
          <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",color:"#64748b",textAlign:"center",maxWidth:260}}>
            <i className="ti ti-file-alert" style={{fontSize:30,display:"block",marginBottom:8,color:"#dc2626"}}/>
            {error}
            <div style={{marginTop:12}}>
              <a href={url} target="_blank" rel="noreferrer" style={{color:"#2563eb",fontSize:12,fontWeight:700}}>Buka di tab baru →</a>
            </div>
          </div>
        )}
        <canvas ref={canvasRef} style={{display:(!loading&&!error)?"block":"none",boxShadow:"0 4px 20px rgba(15,23,42,.15)",background:"#fff",margin:"0 auto",
          transform:pinchScale!==1?`scale(${pinchScale})`:undefined,transformOrigin:"center"}}/>
        {!loading&&!error&&numPages>1&&pageIndex>0&&(
          <button onClick={()=>setPageIndex(p=>p-1)} style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",
            width:38,height:38,borderRadius:"50%",background:"rgba(15,23,42,.75)",border:"none",color:"#fff",fontSize:17,cursor:"pointer",zIndex:2}}>
            <i className="ti ti-chevron-left"/>
          </button>
        )}
        {!loading&&!error&&numPages>1&&pageIndex<numPages-1&&(
          <button onClick={()=>setPageIndex(p=>p+1)} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",
            width:38,height:38,borderRadius:"50%",background:"rgba(15,23,42,.75)",border:"none",color:"#fff",fontSize:17,cursor:"pointer",zIndex:2}}>
            <i className="ti ti-chevron-right"/>
          </button>
        )}
      </div>
      <style>{`@keyframes pdfv-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
