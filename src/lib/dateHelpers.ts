import { hariIniWib } from "./tanggalWib";
// Duplikat kecil dari src/lib/dateHelpers.ts di vista-teknik (repo terpisah, gak ada shared
// package) - persis pola yang sama.
export function getLocalDateStr(d:Date=new Date()){
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,"0");
  const day=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
// TODAY (23 Okt 2026): dulu konstanta yg dihitung SEKALI saat modul dimuat -> basi bila aplikasi/tab dibiarkan terbuka
// melewati tengah malam (mis. tanggal timer Komponen Pasang, label "hari ini"). Sekarang BINDING HIDUP (export let):
// diperbarui tiap menit dari lib/tanggalWib hariIniWib() (tanggal kalender WIB) - semua pembaca TODAY saat render ikut
// segar tanpa mengubah pemakainya. Yang menyalin TODAY ke state/konstanta saat mount tetap nilai awal (by design).
export let TODAY=hariIniWib();
if(typeof window!=="undefined")setInterval(()=>{const t=hariIniWib();if(t!==TODAY)TODAY=t;},60000);
// (18 Okt 2026) RENTANG TANGGAL MENURUT JAM HP (WIB) untuk filter timestamptz - SATU sumber di aplikasi operator.
// Dulu banyak layar memakai tanggal+"T00:00:00" TANPA zona waktu -> server membacanya sbg UTC, jadi permintaan
// pukul 00.00-06.59 WIB masuk ke tanggal SEBELUMNYA (bukti: #1169 17 Okt 06.16 WIB tampil di 16 Okt; 37 dari 633
// permintaan terdampak). Pola sama dgn vista-teknik (new Date(tanggal+'T00:00:00').toISOString()).
export function rentangHariLokal(tanggal:string):{startIso:string,endIso:string}{
  return{startIso:new Date(tanggal+"T00:00:00").toISOString(),endIso:new Date(tanggal+"T23:59:59.999").toISOString()};
}
// bulan 0-11 (Date.getMonth)
export function rentangBulanLokal(tahun:number,bulan:number):{startIso:string,endIso:string}{
  return{startIso:new Date(tahun,bulan,1,0,0,0,0).toISOString(),endIso:new Date(tahun,bulan+1,0,23,59,59,999).toISOString()};
}
// Tanggal (YYYY-MM-DD, jam HP) dari timestamp server - BUKAN ts.slice(0,10) (itu tanggal UTC).
export function tanggalLokalDari(ts:string|null|undefined):string{
  if(!ts)return"";
  const d=new Date(ts);
  return isNaN(d.getTime())?String(ts).slice(0,10):getLocalDateStr(d);
}
// getLocalDateStr() fresh (BUG FIX 5 Sep 2026), BUKAN TODAY const yang basi kalau tab dibiarkan
// terbuka lewat tengah malam - lihat useDateRollover di dateRollover.ts buat kelas bug TODAY
// lain (checkpoint tanggal, cache localStorage) yang gak bisa dibikin auto-fresh semudah ini.
export function daysUntil(t:string){ return Math.ceil((new Date(t).getTime()-new Date(getLocalDateStr()).getTime())/86400000); }
export function addDays(s:string,n:number){ const d=new Date(s); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); }
export function fmtDate(s:string){ return new Date(s).toLocaleDateString("id-ID",{weekday:"short",day:"numeric",month:"short",year:"numeric"}); }
export function fmtShort(s:string){ return new Date(s).toLocaleDateString("id-ID",{day:"numeric",month:"short"}); }
