import "../lib/iteratorPolyfill";
import { useEffect, useRef, useState } from "react";
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
// PDF VIEWER (31 Agu 2026) - viewer in-app buat WO Digital, ganti download langsung. Sama
// pola kayak vista-teknik/src/components/PdfViewer.tsx (render <canvas> via pdfjs-dist,
// bukan <iframe>/<embed> - gak reliable semua device), watermark logo Vista otomatis
// kelihatan (sudah nempel di file-nya). Bahasa visual niru FotoZoomViewerPekerja.tsx
// (dark fullscreen modal) + tambahan mobile: lock scroll body, tombol close pakai
// safe-area-inset (notch/status bar), sama kayak versi foto.
// ─────────────────────────────────────────────────────────────────────────────
export function PdfViewerPekerja({url,title,subtitle,onClose}:{url:string,title:string,subtitle?:string,onClose:()=>void}){
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

  useEffect(()=>{
    const prevOverflow=document.body.style.overflow;
    document.body.style.overflow="hidden";
    return()=>{document.body.style.overflow=prevOverflow;};
  },[]);

  useEffect(()=>{
    let cancelled=false;
    firstPaintDoneRef.current=false;
    setLoading(true);setError(null);setPageIndex(0);setNumPages(0);
    pdfjsLib.getDocument({url}).promise.then((pdf:any)=>{
      if(cancelled)return;
      pdfDocRef.current=pdf;
      setNumPages(pdf.numPages);
    }).catch(()=>{
      if(cancelled)return;
      setError("Gagal memuat PDF. Coba lagi atau buka di tab baru.");
      setLoading(false);
    });
    return()=>{cancelled=true;pdfDocRef.current?.destroy?.();pdfDocRef.current=null;};
  },[url]);

  useEffect(()=>{
    const onResize=()=>setResizeTick(t=>t+1);
    window.addEventListener("resize",onResize);
    window.addEventListener("orientationchange",onResize);
    return()=>{window.removeEventListener("resize",onResize);window.removeEventListener("orientationchange",onResize);};
  },[]);

  // Render 2 tahap (31 Agu 2026, fix "loading lama") - sama pola kayak
  // vista-teknik/src/components/PdfViewer.tsx: render CEPAT resolusi rendah dulu (langsung
  // tampil, nutup spinner), baru upgrade ke kualitas penuh di background. Ukuran CSS canvas
  // TETAP sama di kedua tahap biar gak "lompat" pas upgrade.
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
        const cssScale=Math.min((containerWidth-24)/baseViewport.width,2);
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
      }catch{/* render dibatalkan (ganti halaman/ukuran cepat) - abaikan */}
    })();
    return()=>{cancelled=true;};
  },[pageIndex,numPages,resizeTick]);

  const doDownload=async()=>{
    setDownloading(true);
    try{await downloadPdf(url,sanitizeNamaFile(title)+".pdf");}
    catch{alert("Gagal download file.");}
    setDownloading(false);
  };

  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:9999,display:"flex",flexDirection:"column"}}>
      <div onClick={e=>e.stopPropagation()} style={{padding:"14px 66px 14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,
        background:"linear-gradient(rgba(0,0,0,0.55),transparent)",flexShrink:0}}>
        <div style={{minWidth:0}}>
          <div style={{color:"#fff",fontWeight:700,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{title}</div>
          <div style={{color:"rgba(255,255,255,.6)",fontSize:10.5,marginTop:2}}>
            {subtitle}{subtitle&&numPages>0?" · ":""}{numPages>0?`Halaman ${pageIndex+1} / ${numPages}`:""}
          </div>
        </div>
        <button onClick={doDownload} disabled={downloading} style={{background:"rgba(255,255,255,.12)",border:"none",borderRadius:8,
          padding:"7px 12px",color:"#fff",fontSize:11.5,fontWeight:700,cursor:downloading?"default":"pointer",display:"flex",alignItems:"center",gap:5,flexShrink:0}}>
          <i className="ti ti-download" style={{fontSize:14}}/>{downloading?"...":"Download"}
        </button>
      </div>

      <button onClick={onClose} style={{position:"fixed",top:"calc(10px + env(safe-area-inset-top,0px))",right:"calc(10px + env(safe-area-inset-right,0px))",
        width:44,height:44,borderRadius:"50%",background:"rgba(0,0,0,.55)",border:"none",color:"#fff",fontSize:18,cursor:"pointer",
        display:"flex",alignItems:"center",justifyContent:"center",zIndex:3}}>
        <i className="ti ti-x"/>
      </button>

      <div ref={containerRef} onClick={e=>e.stopPropagation()} style={{flex:1,overflow:"auto",display:"flex",alignItems:"flex-start",justifyContent:"center",padding:12,position:"relative"}}>
        {loading&&(
          <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",color:"rgba(255,255,255,.7)",textAlign:"center"}}>
            <i className="ti ti-loader-2" style={{fontSize:30,display:"block",marginBottom:8,animation:"pdfv-spin 1s linear infinite"}}/>
            Memuat PDF...
          </div>
        )}
        {error&&(
          <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",color:"rgba(255,255,255,.8)",textAlign:"center",maxWidth:280}}>
            <i className="ti ti-file-alert" style={{fontSize:30,display:"block",marginBottom:8,color:"#f87171"}}/>
            {error}
            <div style={{marginTop:12}}>
              <a href={url} target="_blank" rel="noreferrer" style={{color:"#60a5fa",fontSize:12,fontWeight:700}}>Buka di tab baru →</a>
            </div>
          </div>
        )}
        {!loading&&!error&&numPages>1&&pageIndex>0&&(
          <button onClick={()=>setPageIndex(p=>p-1)} style={{position:"fixed",left:8,top:"50%",transform:"translateY(-50%)",
            width:40,height:40,borderRadius:"50%",background:"rgba(0,0,0,.5)",border:"none",color:"#fff",fontSize:18,cursor:"pointer",zIndex:2}}>
            <i className="ti ti-chevron-left"/>
          </button>
        )}
        {!loading&&!error&&numPages>1&&pageIndex<numPages-1&&(
          <button onClick={()=>setPageIndex(p=>p+1)} style={{position:"fixed",right:8,top:"50%",transform:"translateY(-50%)",
            width:40,height:40,borderRadius:"50%",background:"rgba(0,0,0,.5)",border:"none",color:"#fff",fontSize:18,cursor:"pointer",zIndex:2}}>
            <i className="ti ti-chevron-right"/>
          </button>
        )}
        <canvas ref={canvasRef} style={{display:(!loading&&!error)?"block":"none",boxShadow:"0 8px 32px rgba(0,0,0,.5)",background:"#fff",maxWidth:"100%"}}/>
      </div>
      <style>{`@keyframes pdfv-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
