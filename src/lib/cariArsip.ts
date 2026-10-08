// PENCARIAN ARSIP PER-KATA (8 Okt 2026) - satu sumber logika buat Arsip QC, Arsip Seksi
// (QS/Assembling Luar/Wiring Control/Nameplate) & WO Digital tab Arsip (CLAUDE.md B.1).
// Dulu tiap view mencocokkan SELURUH ketikan ke SATU kolom saja (panel ATAU proyek ATAU WO), jadi
// ketikan gabungan "071 pp" / "suvarna pp" selalu 0 hasil (dicek live: 0 vs 10 panel) - operator
// terpaksa hapus ketikannya dan mulai lagi. Sekarang ketikan dipecah per kata (spasi) dan SETIAP
// kata harus ada di gabungan kolom-kolomnya (urutan kata bebas, huruf besar/kecil diabaikan).
export function kataCari(q:string):string[]{
  return q.toLowerCase().split(/\s+/).filter(Boolean);
}

export function cocokSemuaKata(kata:string[],...kolom:(string|number|null|undefined)[]):boolean{
  if(kata.length===0)return true;
  const teks=kolom.map(k=>k==null?"":String(k)).join(" ").toLowerCase();
  return kata.every(k=>teks.includes(k));
}

// Simpan state pencarian per-tab browser (sessionStorage) - biar ketikan & pilihan WO gak hilang
// saat operator keluar ke menu lalu masuk Arsip lagi. Akses dibungkus try/catch (mode privat /
// storage diblokir -> tetap jalan, cuma gak diingat).
export function bacaSesi<T>(kunci:string,awal:T):T{
  try{const v=sessionStorage.getItem(kunci);return v==null?awal:JSON.parse(v) as T;}catch{return awal;}
}
export function tulisSesi(kunci:string,nilai:unknown){
  try{sessionStorage.setItem(kunci,JSON.stringify(nilai));}catch{/* abaikan - cuma kenyamanan */}
}
