// TUTUP TIMER SAAT KOMPONEN SELESAI (15 Okt 2026, temuan Kesehatan Data K8) - 27 timer basi yang di-Force Stop
// admin 15 Okt ternyata SEMUA komponennya sudah 100%. Auto-stop lama (autoStopTimerJikaSelesai, 7 Agu) cuma
// menghentikan timer yang (a) ada di state timerAktif PERANGKAT yang menyimpan dan (b) milik operator yang
// tercatat di tim penyimpan. Lolos kalau: timer dimulai operator lain/dari HP lain (13 dari 30 kasus: AFIF BENDING
// FS.30 disimpan AGIS+RIFAUL, PUTRA PAINTING FS.2 disimpan NICKY+DWI, FIRMAN WIRING disimpan AINUL, ...), state
// lokal basi, atau jalurnya tidak memanggil auto-stop sama sekali (arsip Pasang Komponen - kartu langsung hilang,
// timer tidak bisa distop lagi dari UI: 5 timer ILHAM WM.2).
// Helper ini membaca LANGSUNG dari database semua timer yang masih jalan utk panel+komponen+proses(+tahap) itu,
// milik SIAPA PUN, lalu menutupnya. Timer dari hari sebelumnya ditutup dgn selesai = mulai (durasi 0, sama dgn
// Force Stop admin) supaya tidak tercatat puluhan jam; timer hari ini ditutup sekarang.
// Best-effort: TIDAK PERNAH melempar - dipanggil SETELAH progress berhasil tersimpan.
import { supabase } from "./supabase";
import { withRetry } from "./koneksi";
import { getLocalDateStr } from "./dateHelpers";

export async function tutupTimerKomponenSelesai(panelId:number,kode:string,proses:string,tahap?:string|null):Promise<number>{
  const label=`[tutupTimerKomponenSelesai ${proses}${tahap?"/"+tahap:""} ${kode} panel ${panelId}]`;
  try{
    const{data,error}=await withRetry(()=>{
      let q=supabase.from("fcs_timer_kerja").select("id,mulai,tanggal")
        .eq("panel_id",panelId).eq("kode_komponen",kode).eq("proses",proses).is("selesai",null);
      q=tahap?q.eq("tahap",tahap):q.is("tahap",null);
      return q.limit(200);
    });
    if(error){console.error(label,"gagal membaca timer aktif:",error);return 0;}
    const hariIni=getLocalDateStr();
    let n=0;
    for(const t of (data||[]) as any[]){
      const selesai=t.tanggal<hariIni?t.mulai:new Date().toISOString();
      const{error:e}=await withRetry(()=>supabase.from("fcs_timer_kerja").update({selesai}).eq("id",t.id).is("selesai",null));
      if(e)console.error(label,`gagal menutup timer ${t.id}:`,e);else n++;
    }
    return n;
  }catch(err){
    console.error(label,"gagal (diabaikan, progress sudah tersimpan):",err);
    return 0;
  }
}

// HENTIKAN SEMUA TIMER KOMPONEN PADA TANGGAL ITU (22 Okt 2026, aturan operator harian) - tombol "Selesai" dulu hanya
// menghentikan timer orang yang ada di daftar renhar; kalau daftar diganti saat timer berjalan (insiden IFAL 534 FS.4,
// FAHRI 544 FS.4) timer orang yang dikeluarkan terus menghitung. Ini membaca LANGSUNG dari DB semua timer yang masih
// berjalan utk panel+komponen+proses(+tahap) bertanggal `tanggal`, milik SIAPA PUN, lalu menutupnya sekarang.
// BUKAN best-effort: error dikembalikan supaya pemanggil memberi tahu operator (aturan A.2).
// tanggal null (23 Okt 2026) = SEMUA timer yang masih berjalan utk panel+komponen+proses(+tahap) itu SAJA, apa pun kolom
// tanggal-nya (proses/tahap lain tidak disentuh) (timer baru
// bertanggal hari mulai - bisa beda dgn tanggal kartu tempat tombol Selesai ditekan).
export async function hentikanTimerKomponenHari(panelId:number,kode:string,proses:string,tanggal:string|null,tahap?:string|null):Promise<{n:number;error:any}>{
  const{data,error}=await withRetry(()=>{
    let q=supabase.from("fcs_timer_kerja").select("id")
      .eq("panel_id",panelId).eq("kode_komponen",kode).eq("proses",proses).is("selesai",null);
    if(tanggal)q=q.eq("tanggal",tanggal);
    q=tahap?q.eq("tahap",tahap):q.is("tahap",null);
    return q.order("id").limit(200);
  });
  if(error)return{n:0,error};
  let n=0;
  for(const t of (data||[]) as any[]){
    const{error:e}=await withRetry(()=>supabase.from("fcs_timer_kerja").update({selesai:new Date().toISOString()}).eq("id",t.id).is("selesai",null));
    if(e)return{n,error:e};
    n++;
  }
  return{n,error:null};
}
