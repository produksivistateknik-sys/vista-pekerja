import { useState, useEffect } from "react";

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
