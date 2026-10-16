import { useState, useEffect } from "react";
import { laporError } from "./laporError";

// ─────────────────────────────────────────────────────────────────────────────
// Status koneksi global + retry - dipisah dari App.tsx (Sprint 5, 5 Agu 2026)
// ─────────────────────────────────────────────────────────────────────────────
const TIMER_REQUEST_TIMEOUT_MS=15000;
function withTimeout<T>(promise:PromiseLike<T>, ms:number):Promise<T>{
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_,reject)=>setTimeout(()=>reject(new Error("Request timeout - koneksi lambat")),ms)),
  ]);
}

// ── Status koneksi global - dilaporkan withRetry() tiap kali ada request, dibaca badge kecil di
// header lewat useKoneksiStatus(). Module-level pub-sub sederhana (bukan Context - belum ada pola
// itu di file ini), biar OperatorView/NameplateView/dkk yang manggil withRetry gak perlu prop-
// drilling status ke komponen lain yang render badge-nya.
type KoneksiStatus="ok"|"lambat"|"putus";
let koneksiListeners:((s:KoneksiStatus)=>void)[]=[];
function laporKoneksi(s:KoneksiStatus){ koneksiListeners.forEach(fn=>fn(s)); }
export function useKoneksiStatus():KoneksiStatus{
  const[status,setStatus]=useState<KoneksiStatus>("ok");
  useEffect(()=>{
    koneksiListeners.push(setStatus);
    return()=>{koneksiListeners=koneksiListeners.filter(fn=>fn!==setStatus);};
  },[]);
  return status;
}

// ── Retry singkat dgn backoff pendek buat aksi PENTING (kunci progress, update qty, dll) - selain
// startTimer/stopTimer (yang punya penanganan sendiri, sengaja lebih hati-hati/non-optimistic).
// Ditimeout+retry SEBELUM ngaku gagal ke user, biar tahan sinyal lemot/putus-putus sekejap tanpa
// bikin user nunggu lama. Melaporkan status ke badge koneksi lewat laporKoneksi().
const RETRY_ATTEMPTS=3;
const RETRY_BACKOFF_MS=[500,1500,3000];
const SLOW_THRESHOLD_MS=5000;
export async function withRetry<T>(fn:()=>PromiseLike<T>, timeoutMs:number=TIMER_REQUEST_TIMEOUT_MS):Promise<T>{
  let lastErr:any;
  for(let i=0;i<RETRY_ATTEMPTS;i++){
    const mulai=Date.now();
    try{
      const hasil=await withTimeout(fn(),timeoutMs);
      laporKoneksi(Date.now()-mulai>SLOW_THRESHOLD_MS?"lambat":"ok");
      return hasil;
    }catch(err){
      lastErr=err;
      laporKoneksi("lambat");
      if(i<RETRY_ATTEMPTS-1)await new Promise(r=>setTimeout(r,RETRY_BACKOFF_MS[i]));
    }
  }
  laporKoneksi("putus");
  throw lastErr;
}

// ── Bedakan "server menolak data" vs "koneksi bermasalah" (29 Sep 2026) - SATU sumber logika
// buat semua alert gagal-simpan progress. Dulu banyak catch{} menelan SEMUA error lalu selalu
// bilang "koneksi lambat/putus" - kasus nyata: AGIS (Mekanik) 35x tekan Kunci Progress LVMDP
// F3B.34 BENDING 100%, padahal server menolak via trigger cap Mekanik ("BENDING (100%) tidak
// boleh melebihi POTONG (83%)"), internet-nya baik-baik aja. PostgrestError dari server (trigger
// raise = P0001, RLS = 42501, constraint = 23xxx, dst) SELALU bawa `code` tidak kosong; error
// koneksi = Error polos dari withTimeout() (tanpa code) atau fetch gagal dari supabase-js
// (code: "" kosong). Jadi patokannya code NON-KOSONG, bukan sekadar ada properti `code`.
export function klasifikasiErrorSimpan(err:any):{jenis:"server"|"koneksi";kode:string;pesan:string}{
  const kode=err&&typeof err==="object"&&typeof err.code==="string"?err.code.trim():"";
  const pesan=String((err&&typeof err==="object"?err.message:err)||"tidak ada pesan");
  return{jenis:kode?"server":"koneksi",kode,pesan};
}

// Alert gagal-simpan yang jujur + SELALU console.error detail asli (dulu gak pernah ke-log, jadi
// penyebab asli gak bisa dilacak). `ulangi` = nama tombol buat saran "coba tekan X lagi" (kasus
// koneksi); catatanServer/catatanKoneksi = kalimat tambahan opsional per konteks pemanggil.
// `aksi` (29 Sep 2026) = kata kerja di judul pesan ("mulai timer", "selesai-in timer", dst) -
// default "simpan progress" biar pemanggil lama gak berubah.
// `ref` (16 Okt 2026) = panel/komponen/proses yang gagal disimpan - ikut ke log_error_app supaya Kesehatan Data (K14)
// bisa mengelompokkan gagal berulang per komponen & mengecek apakah akhirnya tersimpan.
export type RefSimpan={panelId?:number|string;kode?:string;proses?:string;tahap?:string|null};
export function alertGagalSimpan(err:any,konteks:string,opts:{ulangi?:string;catatanServer?:string;catatanKoneksi?:string;aksi?:string;ref?:RefSimpan}={}){
  console.error(`[${konteks}] gagal:`,err);
  const k=klasifikasiErrorSimpan(err);
  // (16 Okt 2026) catat ke log_error_app (Kesehatan Data, filter Operator). Best-effort, tidak pernah melempar.
  const ref=opts.ref||{};
  laporError('gagal_simpan',{message:`${konteks}: ${k.pesan}`,code:k.kode||undefined,stack:err?.stack},{aksi:opts.aksi||'simpan progress',jenisGagal:k.jenis,
    panelId:ref.panelId!=null?Number(ref.panelId):undefined,kode:ref.kode,proses:ref.proses,tahap:ref.tahap||undefined,
    online:typeof navigator!=='undefined'?navigator.onLine:undefined,
    kunciKelompok:ref.kode?[ref.panelId,ref.kode,ref.proses,ref.tahap||''].join('|'):undefined});
  const aksi=opts.aksi||"simpan progress";
  if(k.jenis==="server"){
    alert(`Gagal ${aksi} - server menolak data (kode ${k.kode}): ${k.pesan}\n\nIni BUKAN masalah koneksi. ${opts.catatanServer||"Periksa angka yang diisi, atau laporkan ke admin beserta pesan ini."}`);
  } else {
    // (16 Okt 2026) pesan koneksi dibuat tegas: data BELUM tersimpan (kasus SISWOYO 16 Okt: "Kunci Progress" ditekan 3x).
    const offline=typeof navigator!=="undefined"&&navigator.onLine===false;
    alert(`${offline?"HP tidak tersambung internet":"Koneksi putus/lemah"} - gagal ${aksi}, data BELUM tersimpan.

${opts.catatanKoneksi||(opts.ulangi?`Angka tetap di layar. Tekan ${opts.ulangi} lagi setelah sinyal ada (tanda koneksi di atas kembali hijau).`:"Coba lagi setelah sinyal ada (tanda koneksi di atas kembali hijau).")}`);
  }
}

// Ringkasan alasan gagal PER PANEL buat alert rangkuman jalur bulk (Kunci Progress Hari Ini) -
// pakai klasifikasi yang sama persis alertGagalSimpan di atas.
export function ringkasAlasanGagal(err:any):string{
  const k=klasifikasiErrorSimpan(err);
  return k.jenis==="server"?`ditolak server (kode ${k.kode}): ${k.pesan}`:"koneksi lambat/putus";
}
