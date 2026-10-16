// Penanda "simpanan menunggu koneksi" di header (16 Okt 2026, antrean simpan lokal - lib/antreanSimpan.ts).
// Tidak tampil kalau antrean kosong. Ketuk = coba kirim sekarang.
import { useEffect, useState } from "react";
import { dengarJumlahAntrean, kirimAntreanDanUmumkan } from "../../lib/antreanSimpan";

export function AntreanBadge(){
  const[n,setN]=useState(0);
  const[mengirim,setMengirim]=useState(false);
  useEffect(()=>dengarJumlahAntrean(setN),[]);
  if(!n)return null;
  return <button type="button" disabled={mengirim} title="Simpanan yang gagal terkirim karena sinyal, disimpan di HP ini. Ketuk untuk kirim sekarang."
    onClick={async()=>{setMengirim(true);try{await kirimAntreanDanUmumkan();}finally{setMengirim(false);}}}
    style={{display:"inline-flex",alignItems:"center",gap:4,padding:"2px 8px",borderRadius:20,cursor:"pointer",
      fontSize:10,fontWeight:700,color:"#b45309",background:"#fef3c7",border:"1px solid #fcd34d",whiteSpace:"nowrap",fontFamily:"inherit"}}>
    {mengirim?"⏳ mengirim...":`⏳ ${n} simpanan menunggu`}
  </button>;
}
