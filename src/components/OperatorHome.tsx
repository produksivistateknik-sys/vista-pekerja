import { useState } from "react";
import { ReviewPotongView } from "./ReviewPotongView";
import { ReviewPaintingView } from "./ReviewPaintingView";
import { RiwayatKerjaView } from "./RiwayatKerjaView";
import { KomponenTambahanView } from "./KomponenTambahanView";
import { OperatorView } from "./OperatorView";
import { DIVISI_CONFIG } from "../lib/panelTypes";

// ─────────────────────────────────────────────────────────────────────────────
// Wrapper tab switcher "Tugas Saya" / "Review" / "Riwayat" / "Komponen Tambahan" -
// komponen TERPISAH dari OperatorView (bukan state internal di dalamnya) supaya
// gak ada resiko urutan hooks React berubah pas toggle tab (OperatorView isinya
// banyak hook, early return bersyarat di tengah function itu bisa bikin "rendered
// fewer hooks than expected" kalau tab-nya di-switch pas beberapa hook di
// bawah belum sempat jalan). Dengan swap komponen (bukan swap konten di dalam
// 1 komponen), tiap komponen punya hook-nya sendiri, aman.
// Dipisah dari App.tsx (Sprint 7).
// ─────────────────────────────────────────────────────────────────────────────
export function OperatorHome({user,viewMode}:any){
  const[mainTab,setMainTab]=useState<"tugas"|"review"|"riwayat"|"tambahan">("tugas");
  const bisaReviewPotong=user.divisi==="mekanik"&&user.sub_bagian==="Potong";
  // Sistem Section (RENDAM/PAINTING doang) - tab "Review" nunjukin ReviewPaintingView (Section-
  // grouped), BUKAN ReviewPotongView. Tab "Tambahan" TETAP cuma buat mekanik/Potong seperti
  // sebelumnya - proses lain (termasuk divisi painting ini) gak dapet tab itu.
  const bisaReviewPainting=user.divisi==="painting";
  const bisaReview=bisaReviewPotong||bisaReviewPainting;
  // Tab "Riwayat" (12 Agu 2026) - cari proyek+panel -> lihat semua komponen yang sudah
  // dikerjakan dengan tanggal & rasio qty (mis. 3/6), GENERIK buat SEMUA divisi operator (beda
  // dari Review yang cuma Potong/Painting dan dikelompokkan per shift/section). Proses yang
  // ditampilkan diturunkan dari DIVISI_CONFIG (subBagianProses kalau ada, else proses divisi
  // level) - otomatis ngikutin proses aktif user, gak perlu hardcode per-divisi. Painting gabung
  // RENDAM+PAINTING dalam 1 tampilan (bukan 2 sub-tab) sesuai proses login-nya yang juga gabung.
  const divisiCfg=DIVISI_CONFIG[user.divisi];
  const prosesRiwayat:string[]=divisiCfg?.subBagianProses?.[user.sub_bagian]||divisiCfg?.proses||[];
  const tabs=[
    {key:"tugas",label:"📋 Tugas Saya"},
    ...(bisaReview?[{key:"review",label:"🗂 Review"}]:[]),
    {key:"riwayat",label:"🕘 Riwayat"},
    ...(bisaReviewPotong?[{key:"tambahan",label:"➕ Tambahan"}]:[]),
  ];

  return(
    <div>
      <div style={{display:"flex",gap:2,padding:"8px 16px 0",background:"#fff",borderBottom:"1px solid #f1f5f9"}}>
        {tabs.map(t=>(
          <button key={t.key} onClick={()=>setMainTab(t.key as any)}
            style={{padding:"8px 16px",fontSize:12,fontWeight:mainTab===t.key?800:600,
              color:mainTab===t.key?"#d97706":"#94a3b8",cursor:"pointer",background:"none",
              border:"none",borderBottom:mainTab===t.key?"2.5px solid #d97706":"2.5px solid transparent",
              fontFamily:"inherit"}}>{t.label}</button>
        ))}
      </div>
      {bisaReview&&mainTab==="review"?(bisaReviewPainting?<ReviewPaintingView/>:<ReviewPotongView/>)
        :mainTab==="riwayat"?<RiwayatKerjaView proses={prosesRiwayat} label={divisiCfg?.label||user.divisi} icon={divisiCfg?.icon||"🕘"} color={divisiCfg?.color||"#d97706"}/>
        :bisaReviewPotong&&mainTab==="tambahan"?<KomponenTambahanView user={user}/>
        :<OperatorView user={user} viewMode={viewMode}/>}
    </div>
  );
}
