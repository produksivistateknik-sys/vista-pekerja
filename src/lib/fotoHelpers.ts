import { supabase } from "./supabase";

// Helper foto (kompres sebelum upload, download) - dipisah dari App.tsx (Sprint 6)
// ─────────────────────────────────────────────────────────────────────────────

// Hapus file dari Supabase Storage berdasarkan public URL-nya - dipakai bareng di semua tempat
// yang punya tombol hapus foto (QC/Nameplate/Warehouse/QS/Pasang Komponen/Tracking Komponen).
// Kalau URL gak sesuai pola public URL Supabase yang diharapkan, diam-diam skip (caller tetap
// lanjut hapus referensi di DB) - jangan sampai proses hapus foto gagal total gara-gara ini.
export const hapusFotoDariStorage=async(bucket:string,url:string):Promise<void>=>{
  const marker=`/storage/v1/object/public/${bucket}/`;
  const idx=url.indexOf(marker);
  if(idx<0)return;
  const path=decodeURIComponent(url.slice(idx+marker.length));
  if(!path)return;
  await supabase.storage.from(bucket).remove([path]);
};

// Kompres foto sebelum upload (canvas resize max-width 1600px + JPEG q0.8) - foto asli dari
// kamera HP bisa 3-8MB, operator sering upload lewat data seluler.
export const compressImageNp=(file:File):Promise<Blob>=>new Promise((resolve,reject)=>{
  const img=new Image();
  const url=URL.createObjectURL(file);
  img.onload=()=>{
    const maxW=1600;
    const scale=Math.min(1,maxW/img.width);
    const canvas=document.createElement("canvas");
    canvas.width=Math.round(img.width*scale);
    canvas.height=Math.round(img.height*scale);
    const ctx=canvas.getContext("2d");
    if(!ctx){URL.revokeObjectURL(url);reject(new Error("Canvas tidak didukung"));return;}
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    canvas.toBlob(blob=>{
      URL.revokeObjectURL(url);
      if(blob)resolve(blob);else reject(new Error("Gagal kompres foto"));
    },"image/jpeg",0.8);
  };
  img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("Gagal membaca foto"));};
  img.src=url;
});
export const downloadFotoNp=async(url:string,label:string)=>{
  try{
    const res=await fetch(url);
    const blob=await res.blob();
    const blobUrl=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=blobUrl;
    a.download=`${label}_${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  }catch(err:any){
    alert("Gagal download: "+err.message);
  }
};
