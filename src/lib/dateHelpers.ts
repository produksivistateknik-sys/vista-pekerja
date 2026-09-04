// Duplikat kecil dari src/lib/dateHelpers.ts di vista-teknik (repo terpisah, gak ada shared
// package) - persis pola yang sama.
export function getLocalDateStr(d:Date=new Date()){
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,"0");
  const day=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
export const TODAY = getLocalDateStr();
// getLocalDateStr() fresh (BUG FIX 5 Sep 2026), BUKAN TODAY const yang basi kalau tab dibiarkan
// terbuka lewat tengah malam - lihat useDateRollover di dateRollover.ts buat kelas bug TODAY
// lain (checkpoint tanggal, cache localStorage) yang gak bisa dibikin auto-fresh semudah ini.
export function daysUntil(t:string){ return Math.ceil((new Date(t).getTime()-new Date(getLocalDateStr()).getTime())/86400000); }
export function addDays(s:string,n:number){ const d=new Date(s); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); }
export function fmtDate(s:string){ return new Date(s).toLocaleDateString("id-ID",{weekday:"short",day:"numeric",month:"short",year:"numeric"}); }
export function fmtShort(s:string){ return new Date(s).toLocaleDateString("id-ID",{day:"numeric",month:"short"}); }
