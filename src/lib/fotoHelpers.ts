import { supabase } from "./supabase";
import { deleteFromR2, extractR2Key } from "./r2Client";

// Helper foto (kompres sebelum upload, download) - dipisah dari App.tsx (Sprint 6)
// ─────────────────────────────────────────────────────────────────────────────

// Hapus file dari storage berdasarkan public URL-nya - dipakai bareng di semua tempat yang
// punya tombol hapus foto (QC/Nameplate/Warehouse/QS/Pasang Komponen/Tracking Komponen).
// MIGRASI R2 (Agu 2026): selama migrasi belum tuntas, foto LAMA masih nunjuk ke URL Supabase
// Storage dan foto BARU nunjuk ke URL R2 - berdampingan di kolom yang sama. Fungsi ini deteksi
// otomatis dari pola URL-nya (bukan dari flag terpisah) jadi caller (6 lokasi di atas) TIDAK
// perlu tahu/berubah sama sekali. Kalau URL gak cocok pola manapun, diam-diam skip (caller
// tetap lanjut hapus referensi di DB) - jangan sampai proses hapus foto gagal total gara-gara ini.
export const hapusFotoDariStorage=async(bucket:string,url:string):Promise<void>=>{
  const marker=`/storage/v1/object/public/${bucket}/`;
  const idx=url.indexOf(marker);
  if(idx>=0){
    const path=decodeURIComponent(url.slice(idx+marker.length));
    if(path)await supabase.storage.from(bucket).remove([path]);
    return;
  }
  const r2Key=extractR2Key(url);
  if(r2Key)await deleteFromR2(r2Key);
};

// Kompres foto sebelum upload (canvas resize max-width 1600px + JPEG q0.8) - foto asli dari
// kamera HP bisa 3-8MB, operator sering upload lewat data seluler.
// KOMPRES FOTO (19 Okt 2026, foto banyak per simpan - ukur lab dgn 12 foto asli Proyek Luar 14): dulu yang dibatasi
// cuma LEBAR 1600 px q0.8 (foto potret tetap 1600x2133, rata2 209 KB). Sekarang SISI TERPANJANG 1600 px q0.75 (rata2
// 126 KB, -40%; teks nameplate/label tetap terbaca) + THUMBNAIL sisi terpanjang 320 px q0.7 (~10 KB) dari decode yang
// sama - thumbnail dipakai grid/galeri, foto penuh dipakai saat diperbesar & dicetak.
export const FOTO_SISI_MAKS=1600, FOTO_KUALITAS=0.75, THUMB_SISI_MAKS=320, THUMB_KUALITAS=0.7;
const keKanvas=(img:HTMLImageElement,sisiMaks:number,kualitas:number):Promise<Blob>=>new Promise((resolve,reject)=>{
  const scale=Math.min(1,sisiMaks/Math.max(img.width,img.height));
  const canvas=document.createElement("canvas");
  canvas.width=Math.max(1,Math.round(img.width*scale));
  canvas.height=Math.max(1,Math.round(img.height*scale));
  const ctx=canvas.getContext("2d");
  if(!ctx){reject(new Error("Canvas tidak didukung"));return;}
  ctx.drawImage(img,0,0,canvas.width,canvas.height);
  canvas.toBlob(blob=>{if(blob)resolve(blob);else reject(new Error("Gagal kompres foto"));},"image/jpeg",kualitas);
});
const bacaGambar=(file:Blob):Promise<{img:HTMLImageElement,lepas:()=>void}>=>new Promise((resolve,reject)=>{
  const img=new Image();
  const url=URL.createObjectURL(file);
  img.onload=()=>resolve({img,lepas:()=>URL.revokeObjectURL(url)});
  img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("Gagal membaca foto"));};
  img.src=url;
});
// Foto + thumbnail sekali decode. Thumbnail gagal -> null (bukan fatal, tampilan pakai foto penuh).
export const kompresFotoDanThumb=async(file:File):Promise<{foto:Blob,thumb:Blob|null}>=>{
  const{img,lepas}=await bacaGambar(file);
  try{
    const foto=await keKanvas(img,FOTO_SISI_MAKS,FOTO_KUALITAS);
    let thumb:Blob|null=null;
    try{thumb=await keKanvas(img,THUMB_SISI_MAKS,THUMB_KUALITAS);}catch{thumb=null;}
    return{foto,thumb};
  }finally{lepas();}
};
export const compressImageNp=async(file:File):Promise<Blob>=>(await kompresFotoDanThumb(file)).foto;
// FIX (27 Sep 2026): cache:'no-store' - foto yang sama biasanya udah dimuat <img> (tanpa Origin,
// respons R2 tanpa header CORS & tanpa Vary: Origin) dan kesimpan cache browser; fetch() ini dulu
// bisa kebagian respons cache itu -> diblok CORS. Sekalian cek res.ok - dulu 404/403 tetap
// ke-download sebagai file .jpg rusak (isi pesan error server), bukan dilaporkan gagal.
export const downloadFotoNp=async(url:string,label:string)=>{
  try{
    const res=await fetch(url,{cache:"no-store"});
    if(!res.ok)throw new Error(`server membalas HTTP ${res.status}${res.status===404?" (file tidak ditemukan)":""}`);
    const blob=await res.blob();
    const blobUrl=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=blobUrl;
    // Ekstensi dari tipe file asli (6 Okt 2026, dukungan video) - dulu selalu ".jpg", video ikut jadi .jpg.
    const ext=blob.type.startsWith("video/")?(blob.type.includes("quicktime")?"mov":"mp4"):blob.type==="image/png"?"png":"jpg";
    a.download=`${label.replace(/\.[a-z0-9]{2,5}$/i,"")}_${Date.now()}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  }catch(err:any){
    console.error("downloadFotoNp gagal:",url,err);
    alert("Gagal download: "+(err instanceof TypeError?"koneksi terputus atau akses file diblokir browser":err.message));
  }
};
