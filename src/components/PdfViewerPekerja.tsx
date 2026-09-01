import { useEffect, useRef, useState } from "react";

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
// PDF VIEWER (31 Agu 2026, redesign 1 Sep 2026, GANTI ke native embed 1 Sep 2026) - halaman
// FULL buat WO Digital, konten PDF-nya pakai <iframe> ke native PDF viewer browser (BUKAN lagi
// render custom per-halaman ke <canvas> via pdfjs-dist). Sama alasan/pola kayak
// vista-teknik/src/components/PdfViewer.tsx - kualitas zoom gak dibatasi resolusi render,
// pinch-zoom otomatis native (custom touch handler DIHAPUS), dan <iframe src> gak butuh CORS
// sama sekali (beda kasus sama fetch() custom viewer lama).
//
// pdfjs-dist TETAP di package.json - masih dipakai ocrHelpers.ts (MOM FAT OCR), cuma
// pemakaiannya DI FILE INI yang dihapus.
//
// UI wrapper (judul, "‹ Kembali", Bagikan, Download) TETAP dipertahankan. Toolbar zoom
// (-/100%/+) dan navigasi halaman custom (‹ 1/5 ›) DIHAPUS - browser sudah sediakan sendiri.
//
// FIX (1 Sep 2026) - PDF di R2 (photo.vistaproduksi.com) beda domain dari app
// (operator.vistaproduksi.com) - HP (Chrome Android) ternyata malah MEN-DOWNLOAD PDF
// cross-origin yang di-iframe-in, bukan nampilin inline (kebijakan browser mobile, dikonfirmasi
// user coba langsung). Fix: proxy lewat rewrite Vercel (/pdf-proxy/* -> photo.vistaproduksi.com/*,
// lihat vercel.json) biar dari sudut pandang browser PDF-nya "1 domain" sama app-nya - iframe src
// DAN fetch() download sama-sama dialihkan ke path proxy ini, sekalian nge-bypass kebutuhan CORS
// di R2 buat tombol Download (fetch jadi same-origin, gak perlu CORS sama sekali).
// ─────────────────────────────────────────────────────────────────────────────
const R2_BASE=import.meta.env.VITE_R2_PUBLIC_BASE_URL as string|undefined;
const toProxyUrl=(u:string)=>(R2_BASE&&u.startsWith(R2_BASE))?("/pdf-proxy"+u.slice(R2_BASE.length)):u;

export function PdfViewerPekerja({url,title,subtitle,onBack}:{url:string,title:string,subtitle?:string,onBack:()=>void}){
  const proxyUrl=toProxyUrl(url);
  const[loading,setLoading]=useState(true);
  const[downloading,setDownloading]=useState(false);
  const[shareMsg,setShareMsg]=useState("");
  const timeoutRef=useRef<ReturnType<typeof setTimeout>|null>(null);

  useEffect(()=>{
    setLoading(true);
    if(timeoutRef.current)clearTimeout(timeoutRef.current);
    timeoutRef.current=setTimeout(()=>{setLoading(false);},15000);
    return()=>{if(timeoutRef.current)clearTimeout(timeoutRef.current);};
  },[url]);

  const onIframeLoad=()=>{
    if(timeoutRef.current)clearTimeout(timeoutRef.current);
    setLoading(false);
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

  return(
    <div style={{padding:"12px 12px 20px"}}>
      <button onClick={onBack} style={{display:"flex",alignItems:"center",gap:5,background:"none",border:"none",
        color:"#1d4ed8",fontWeight:700,fontSize:13,cursor:"pointer",padding:0,marginBottom:10}}>
        <i className="ti ti-arrow-left" style={{fontSize:15}}/> Kembali
      </button>
      <div style={{fontWeight:800,fontSize:14,color:"#0f172a",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{title}</div>
      {subtitle&&<div style={{fontSize:11,color:"#94a3b8",marginTop:1,marginBottom:10}}>{subtitle}</div>}

      <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:8,margin:"10px 0"}}>
        <div style={{position:"relative"}}>
          <button onClick={doShare} style={{background:"#f1f5f9",border:"1px solid #e2e8f0",borderRadius:8,
            width:34,height:34,color:"#475569",fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <i className="ti ti-share"/>
          </button>
          {shareMsg&&<div style={{position:"absolute",top:"calc(100% + 6px)",right:0,background:"#0f172a",color:"#fff",fontSize:10.5,fontWeight:600,
            padding:"5px 9px",borderRadius:6,whiteSpace:"nowrap",zIndex:3}}>{shareMsg}</div>}
        </div>
        <button onClick={doDownload} disabled={downloading} style={{background:"#1d4ed8",border:"none",borderRadius:8,
          padding:"0 14px",height:34,color:"#fff",fontSize:12,fontWeight:700,cursor:downloading?"default":"pointer",display:"flex",alignItems:"center",gap:6}}>
          <i className="ti ti-download" style={{fontSize:14}}/>{downloading?"...":"Download"}
        </button>
      </div>

      <div style={{background:"#f1f5f9",borderRadius:12,border:"1px solid #e2e8f0",height:"70vh",overflow:"hidden",position:"relative"}}>
        {loading&&(
          <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",
            color:"#94a3b8",background:"#f1f5f9",zIndex:1}}>
            <i className="ti ti-loader-2" style={{fontSize:30,marginBottom:8,animation:"pdfv-spin 1s linear infinite"}}/>
            Memuat PDF...
          </div>
        )}
        <iframe src={proxyUrl} title={title} onLoad={onIframeLoad}
          style={{width:"100%",height:"100%",border:"none"}}/>
      </div>
      <style>{`@keyframes pdfv-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
