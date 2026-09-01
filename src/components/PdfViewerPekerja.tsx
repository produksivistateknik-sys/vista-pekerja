import { useEffect, useRef, useState } from "react";

const sanitizeNamaFile=(nama:string)=>(nama||"dokumen").replace(/[\\/:*?"<>|]/g,"_").trim()||"dokumen";

// ─────────────────────────────────────────────────────────────────────────────
// PDF VIEWER (1 Sep 2026, blob-URL 1 Sep 2026) - dua pendekatan sebelumnya SAMA-SAMA gagal di
// HP (dikonfirmasi user coba langsung): <iframe> ke URL remote (baik langsung ke R2 maupun
// lewat proxy Vercel "1 domain") selalu diperlakukan browser mobile sebagai file buat
// di-download, BUKAN ditampilkan inline - kejadian di Android Chrome MAUPUN iOS Safari. Render
// custom ke <canvas> (pdfjs-dist) berhasil hindari itu tapi lambat/macet khusus di iPhone.
//
// Sekarang: fetch() PDF-nya dulu jadi Blob, baru <iframe src> diarahkan ke blob: URL LOKAL
// (bukan URL remote lagi). Blob URL BUKAN request jaringan - gak ada "respons HTTP" yang bisa
// diperlakukan browser sebagai attachment/download, jadi native PDF viewer browser (Chrome
// PDF Viewer / Safari PDFKit) render inline seperti biasa. Efek samping yang pas juga: fetch()
// otomatis kena HTTP cache normal (Cache-Control yang sudah di-set di upload) - buka dokumen
// yang SAMA kedua kalinya langsung dari cache, gak fetch ulang dari jaringan sama sekali.
//
// Tetap pakai path proxy /pdf-proxy/... (rewrite Vercel ke photo.vistaproduksi.com, lihat
// vercel.json) buat fetch()-nya - same-origin, gak butuh CORS di R2. Progress loading dibaca
// manual dari ReadableStream (content-length vs bytes yang sudah kebaca).
// ─────────────────────────────────────────────────────────────────────────────
// BUG FIX (1 Sep 2026) - awalnya baca dari import.meta.env.VITE_R2_PUBLIC_BASE_URL, tapi env var
// itu TERNYATA gak ke-set di Vercel production (cuma ada di .env.local buat dev lokal) - jadi
// toProxyUrl() diam-diam gak pernah jalan (R2_BASE selalu undefined), fetch() tetap ke domain
// R2 asli dan kena CORS. Domain ini BUKAN rahasia (sudah publik di tiap URL file WO Digital),
// jadi hardcode langsung - gak lagi bergantung env var yang rawan kelewat di-set.
const R2_BASE="https://photo.vistaproduksi.com";
const toProxyUrl=(u:string)=>u.startsWith(R2_BASE)?("/pdf-proxy"+u.slice(R2_BASE.length)):u;

export function PdfViewerPekerja({url,title,subtitle,onBack}:{url:string,title:string,subtitle?:string,onBack:()=>void}){
  const proxyUrl=toProxyUrl(url);
  const[blobUrl,setBlobUrl]=useState<string|null>(null);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState<string|null>(null);
  const[loadPct,setLoadPct]=useState<number|null>(null);
  const[downloading,setDownloading]=useState(false);
  const[shareMsg,setShareMsg]=useState("");
  const blobRef=useRef<Blob|null>(null);

  useEffect(()=>{
    let cancelled=false;
    let objectUrl:string|null=null;
    setLoading(true);setError(null);setBlobUrl(null);setLoadPct(null);
    blobRef.current=null;
    const controller=new AbortController();

    // Safety-net: kalau fetch macet/gantung kelamaan, tetap kasih jalan keluar (pesan error +
    // link buka tab baru) alih-alih loading selamanya.
    const hangTimeout=setTimeout(()=>{
      if(cancelled)return;
      controller.abort();
      setError("PDF terlalu lama dimuat. Coba lagi atau buka di tab baru.");
      setLoading(false);
    },25000);

    (async()=>{
      try{
        const res=await fetch(proxyUrl,{signal:controller.signal});
        if(!res.ok)throw new Error("HTTP "+res.status);
        const total=Number(res.headers.get("content-length"))||0;
        const reader=res.body?.getReader();
        let blob:Blob;
        if(reader){
          const chunks:Uint8Array[]=[];
          let loaded=0;
          while(true){
            const{done,value}=await reader.read();
            if(done)break;
            chunks.push(value);
            loaded+=value.length;
            if(total)setLoadPct(Math.min(99,Math.round((loaded/total)*100)));
          }
          blob=new Blob(chunks as BlobPart[],{type:"application/pdf"});
        }else{
          blob=await res.blob();
        }
        if(cancelled)return;
        clearTimeout(hangTimeout);
        blobRef.current=blob;
        objectUrl=URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
        setLoading(false);
      }catch{
        if(cancelled)return;
        clearTimeout(hangTimeout);
        setError("Gagal memuat PDF. Coba lagi atau buka di tab baru.");
        setLoading(false);
      }
    })();

    return()=>{
      cancelled=true;
      clearTimeout(hangTimeout);
      controller.abort();
      if(objectUrl)URL.revokeObjectURL(objectUrl);
    };
  },[proxyUrl]);

  const doDownload=async()=>{
    setDownloading(true);
    try{
      // Blob-nya sudah ke-fetch buat viewer - reuse langsung, gak fetch ulang.
      const blob=blobRef.current||await (await fetch(proxyUrl)).blob();
      const dlUrl=URL.createObjectURL(blob);
      const a=document.createElement("a");
      a.href=dlUrl;a.download=sanitizeNamaFile(title)+".pdf";
      document.body.appendChild(a);a.click();document.body.removeChild(a);
      URL.revokeObjectURL(dlUrl);
    }catch{alert("Gagal download file.");}
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
      {subtitle&&<div style={{fontSize:11,color:"#94a3b8",marginTop:1,marginBottom:10}}>{subtitle}</div>}

      <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:8,margin:"10px 0"}}>
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

      <div style={{background:"#f1f5f9",borderRadius:12,border:"1px solid #e2e8f0",height:"70vh",overflow:"hidden",position:"relative"}}>
        {loading&&(
          <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",
            color:"#94a3b8",background:"#f1f5f9",zIndex:1}}>
            <i className="ti ti-loader-2" style={{fontSize:30,marginBottom:8,animation:"pdfv-spin 1s linear infinite"}}/>
            Memuat PDF...{loadPct!=null&&` ${loadPct}%`}
          </div>
        )}
        {error&&(
          <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",
            color:"#64748b",textAlign:"center",padding:20,background:"#f1f5f9",zIndex:1}}>
            <i className="ti ti-file-alert" style={{fontSize:30,display:"block",marginBottom:8,color:"#dc2626"}}/>
            {error}
            <div style={{marginTop:12}}>
              <a href={url} target="_blank" rel="noreferrer" style={{color:"#2563eb",fontSize:12,fontWeight:700}}>Buka di tab baru →</a>
            </div>
          </div>
        )}
        {blobUrl&&<iframe src={blobUrl} title={title} style={{width:"100%",height:"100%",border:"none"}}/>}
      </div>
      <style>{`@keyframes pdfv-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
