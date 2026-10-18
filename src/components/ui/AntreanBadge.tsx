// Penanda "simpanan menunggu koneksi" di header (16 Okt 2026, antrean simpan lokal - lib/antreanSimpan.ts).
// (18 Okt 2026) + foto/video yang menunggu dikirim (antrean foto lokal - lib/antreanFoto.ts).
// Tidak tampil kalau kedua antrean kosong. Ketuk = coba kirim sekarang.
import { useEffect, useState } from "react";
import { dengarJumlahAntrean, kirimAntreanDanUmumkan } from "../../lib/antreanSimpan";
import { dengarJumlahAntreanFoto, kirimAntreanFotoDanUmumkan } from "../../lib/antreanFoto";

export function AntreanBadge(){
  const[n,setN]=useState(0);
  const[nFoto,setNFoto]=useState(0);
  const[mengirim,setMengirim]=useState(false);
  useEffect(()=>dengarJumlahAntrean(setN),[]);
  useEffect(()=>dengarJumlahAntreanFoto(setNFoto),[]);
  if(!n&&!nFoto)return null;
  const teks=[n?`${n} simpanan`:"",nFoto?`${nFoto} foto`:""].filter(Boolean).join(" + ");
  return <button type="button" disabled={mengirim} title="Simpanan/foto yang gagal terkirim karena sinyal, disimpan di HP ini & dikirim otomatis. Ketuk untuk kirim sekarang."
    onClick={async()=>{setMengirim(true);try{if(n)await kirimAntreanDanUmumkan();if(nFoto)await kirimAntreanFotoDanUmumkan();}finally{setMengirim(false);}}}
    style={{display:"inline-flex",alignItems:"center",gap:4,padding:"2px 8px",borderRadius:20,cursor:"pointer",
      fontSize:10,fontWeight:700,color:"#b45309",background:"#fef3c7",border:"1px solid #fcd34d",whiteSpace:"nowrap",fontFamily:"inherit"}}>
    {mengirim?"⏳ mengirim...":`⏳ ${teks} menunggu`}
  </button>;
}
