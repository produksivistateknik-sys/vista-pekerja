import { useState } from "react";
import { ReviewPotongView } from "./ReviewPotongView";
import { ReviewPaintingView } from "./ReviewPaintingView";
import { KomponenTambahanView } from "./KomponenTambahanView";
import { OperatorView } from "./OperatorView";

// ─────────────────────────────────────────────────────────────────────────────
// Wrapper tab switcher "Tugas Saya" / "Review" / "Komponen Tambahan" - komponen
// TERPISAH dari OperatorView (bukan state internal di dalamnya) supaya gak ada
// resiko urutan hooks React berubah pas toggle tab (OperatorView isinya banyak
// hook, early return bersyarat di tengah function itu bisa bikin "rendered
// fewer hooks than expected" kalau tab-nya di-switch pas beberapa hook di
// bawah belum sempat jalan). Dengan swap komponen (bukan swap konten di dalam
// 1 komponen), tiap komponen punya hook-nya sendiri, aman.
// Dipisah dari App.tsx (Sprint 7).
// ─────────────────────────────────────────────────────────────────────────────
export function OperatorHome({user,viewMode}:any){
  const[mainTab,setMainTab]=useState<"tugas"|"review"|"tambahan">("tugas");
  const bisaReviewPotong=user.divisi==="mekanik"&&user.sub_bagian==="Potong";
  // Sistem Section (RENDAM/PAINTING doang) - tab "Review" nunjukin ReviewPaintingView (Section-
  // grouped), BUKAN ReviewPotongView. Tab "Tambahan" TETAP cuma buat mekanik/Potong seperti
  // sebelumnya - proses lain (termasuk divisi painting ini) gak dapet tab itu.
  const bisaReviewPainting=user.divisi==="painting";
  const bisaReview=bisaReviewPotong||bisaReviewPainting;
  const tabs=bisaReviewPotong
    ?[{key:"tugas",label:"📋 Tugas Saya"},{key:"review",label:"🗂 Review"},{key:"tambahan",label:"➕ Tambahan"}]
    :[{key:"tugas",label:"📋 Tugas Saya"},{key:"review",label:"🗂 Review"}];

  return(
    <div>
      {bisaReview&&(
        <div style={{display:"flex",gap:2,padding:"8px 16px 0",background:"#fff",borderBottom:"1px solid #f1f5f9"}}>
          {tabs.map(t=>(
            <button key={t.key} onClick={()=>setMainTab(t.key as any)}
              style={{padding:"8px 16px",fontSize:12,fontWeight:mainTab===t.key?800:600,
                color:mainTab===t.key?"#d97706":"#94a3b8",cursor:"pointer",background:"none",
                border:"none",borderBottom:mainTab===t.key?"2.5px solid #d97706":"2.5px solid transparent",
                fontFamily:"inherit"}}>{t.label}</button>
          ))}
        </div>
      )}
      {bisaReview&&mainTab==="review"?(bisaReviewPainting?<ReviewPaintingView/>:<ReviewPotongView/>)
        :bisaReviewPotong&&mainTab==="tambahan"?<KomponenTambahanView user={user}/>
        :<OperatorView user={user} viewMode={viewMode}/>}
    </div>
  );
}
