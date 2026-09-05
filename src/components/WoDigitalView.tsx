import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { fetchAllPanels } from "../lib/panelHelpers";
import { SectionCard, EmptyState, Badge } from "./ui/Primitives";

// Paginasi eksplisit (BUG FIX 5 Sep 2026) - Supabase/PostgREST default mentok 1000 baris per
// request tanpa .range() (sama kelas bug fetchAllPanels di panelHelpers.tsx). work_orders/
// work_instructions/wi_revisions belum sebesar itu sekarang, tapi fetchAll() di bawah query
// semuanya polos - begitu salah satu tembus 1000 baris, sisanya ke-cut diam-diam dari daftar
// WO Digital operator (gak nemu gambar teknik panel yang sebenarnya sudah ada dokumennya).
const fetchAllPaged=async(build:(from:number,to:number)=>any):Promise<any[]>=>{
  let all:any[]=[];
  let from=0;
  const PAGE=1000;
  while(true){
    const{data,error}=await build(from,from+PAGE-1);
    if(error)throw error;
    all=all.concat(data??[]);
    if(!data||data.length<PAGE)break;
    from+=PAGE;
  }
  return all;
};

const fmtTgl=(iso?:string)=>iso?new Date(iso).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"}):"—";

// ─────────────────────────────────────────────────────────────────────────────
// WO DIGITAL (31 Agu 2026) - versi digital gambar teknik (construction drawing, sudah
// ber-watermark) menggantikan distribusi kertas cetak. READ-ONLY (upload cuma dari Vista
// Teknik, lihat WoDigitalTab.tsx).
//
// REVISI (4 Sep 2026) - dokumen sekarang PER-PANEL (dulu 1 WO = 1 dokumen buat semua panel).
// 1 WO bisa punya BEBERAPA dokumen independen: 1 dokumen "level-WO" (panel_id null, gambar
// umum) + N dokumen per-panel - masing-masing punya riwayat revisi SENDIRI.
//
// REDESIGN (6 Sep 2026) - 3 level navigasi (list->detail, state lokal, pola sama ArsipQCView.tsx,
// BUKAN router):
//   Level 1: list WO compact (baris tipis + nama panel sebagai preview, bukan card besar)
//   Level 2 (BARU): pilih revisi - klik WO gak langsung buka PDF lagi, tampilkan dulu riwayat
//     semua revisi (bukan cuma yang current) per dokumen, biar operator bisa buka revisi lama
//     kalau perlu. 1 WO bisa punya >1 dokumen (level-WO + per-panel) - dikelompokkan per
//     dokumen dengan sub-header, BUKAN digabung rata (biar jelas revisi mana milik dokumen mana).
//   Level 3: viewer - TETAP window.open() (lihat catatan di bawah), bukan native embed.
//
// 2 tampilan: Aktif (work_orders.is_archived=false, langsung tampil semua tanpa perlu
// ketik) dan Arsip (is_archived=true, search-first - historis, sama pola ArsipQCView.tsx).
// Arsip personal per-operator DIBATALKAN (31 Agu 2026) - cukup 1 arsip resmi/bersama.
//
// VIEWER (1 Sep 2026, final - TIDAK diubah oleh redesign 6 Sep 2026 di atas) - sempat dicoba
// banyak pendekatan in-app (iframe remote, canvas custom via pdfjs-dist, blob-URL) - SEMUA
// gagal gak konsisten khusus di iOS mode "standalone" (app di-install ke home screen) karena
// limitasi lama WebKit yang gak reliable buat blob URL/download di WebView standalone. Android
// (canvas custom) SEBENARNYA berhasil render di device sungguhan, tapi user minta disamakan aja
// - lebih simpel & konsisten di semua platform. Sekarang: "Lihat" = window.open() langsung ke
// browser (Safari/Chrome) buat SEMUA platform - gak ada viewer in-app/native embed. window.open
// ke top-level navigation gak butuh CORS sama sekali (beda dari fetch()), dan ini cara paling
// teruji buat nampilin PDF di web. PdfViewerPekerja.tsx (canvas/pdfjs-dist) DIHAPUS - gak
// dipakai lagi. (Redesign 6 Sep 2026 sempat menyinggung "native PDF embed" - dicek ulang, itu
// TIDAK PERNAH ada/berhasil di Vista Pekerja, cuma ada di Vista Teknik/Admin (repo terpisah) -
// window.open() dipertahankan di sini, dikonfirmasi ke user.)
// ─────────────────────────────────────────────────────────────────────────────
export function WoDigitalView(){
  const[loading,setLoading]=useState(true);
  const[woList,setWoList]=useState<any[]>([]);
  const[panelsAll,setPanelsAll]=useState<any[]>([]);
  const[wiList,setWiList]=useState<any[]>([]);
  const[revList,setRevList]=useState<any[]>([]);
  const[search,setSearch]=useState("");
  const[viewMode,setViewMode]=useState<"aktif"|"arsip">("aktif");
  const[selectedWo,setSelectedWo]=useState<any|null>(null);

  const fetchAll=async()=>{
    setLoading(true);
    const[wo,panels,wi,rev]=await Promise.all([
      fetchAllPaged((from,to)=>supabase.from("work_orders").select("id,wo,proyek,is_archived").range(from,to)),
      fetchAllPanels("id,wo_id,no_pnl,nama"),
      fetchAllPaged((from,to)=>supabase.from("work_instructions" as any).select("*").range(from,to)),
      // SEMUA revisi (bukan cuma is_current) - Level 2 butuh riwayat lengkap, badge Berlaku/
      // Tidak Berlaku dihitung per-baris dari field is_current-nya sendiri, bukan dari filter query.
      fetchAllPaged((from,to)=>supabase.from("wi_revisions" as any).select("*").range(from,to)),
    ]);
    setWoList(wo);
    setPanelsAll(panels);
    setWiList(wi);
    setRevList(rev);
    setLoading(false);
  };
  useEffect(()=>{
    fetchAll();
    const ch=supabase.channel("realtime-wo-digital-pekerja")
      .on("postgres_changes",{event:"*",schema:"public",table:"work_instructions"},fetchAll)
      .on("postgres_changes",{event:"*",schema:"public",table:"wi_revisions"},fetchAll)
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);

  const q=search.trim().toLowerCase();
  const filteredWo=useMemo(()=>{
    if(viewMode==="arsip"&&!q)return[];
    return woList.filter(w=>{
      if(viewMode==="arsip"?!w.is_archived:!!w.is_archived)return false;
      if(q&&!(w.wo||"").toLowerCase().includes(q)&&!(w.proyek||"").toLowerCase().includes(q))return false;
      return true;
    });
  },[woList,q,viewMode]);

  const panelsOfWo=(woId:number)=>panelsAll.filter(p=>p.wo_id===woId);
  const currentRevOfPanel=(panelId:number)=>{
    const wi=wiList.find((w:any)=>w.panel_id===panelId);
    if(!wi)return null;
    return revList.find((r:any)=>r.work_instruction_id===wi.id&&r.is_current)||null;
  };
  const statsOfWo=(woId:number)=>{
    const woPanels=panelsOfWo(woId);
    const docCount=woPanels.filter(p=>currentRevOfPanel(p.id)).length;
    return{docCount,totalPanels:woPanels.length};
  };
  // Nama panel buat baris preview Level 1 - dipotong kalau kepanjangan (>3 panel).
  const panelPreviewOfWo=(woId:number):string=>{
    const names=panelsOfWo(woId).map(p=>p.nama).filter(Boolean);
    if(names.length===0)return"Belum ada panel";
    if(names.length<=3)return names.join(", ");
    return`${names.slice(0,2).join(", ")}, +${names.length-2} lainnya`;
  };

  // Dokumen (work_instructions) milik 1 WO, dikelompokkan buat Level 2. Label sub-header:
  // kalau panel_id masih nunjuk panel yang MASIH ADA, pakai nama panel LIVE (paling akurat,
  // ikut kalau panel di-rename). Kalau panel_id null, JANGAN asumsikan itu "dokumen umum"
  // yang sengaja diupload gitu - work_instructions.panel_id punya FK "ON DELETE SET NULL" ke
  // panels (migrasi 20260904060000): begitu panel yang py dokumen di-arsip/dihapus, panel_id
  // otomatis jadi null, TAPI dokumen+revisinya tetap ada (gak ikut kehapus). Kalau digeneralisir
  // "Dokumen Umum" di sini, konteks panel aslinya (mis. "Panel MCC TR 4") HILANG dari operator
  // padahal cuma panelnya yang udah gak ada, bukan berarti dokumennya level-WO. Makanya fallback
  // ke wi.judul (teks bebas yang diisi admin pas upload, mis. "Gambar Teknik - Panel 1 - MCC TR
  // 4" - independen dari panel_id, gak ikut hilang) - jauh lebih informatif drpd label generik.
  const dokumenOfWo=(woId:number)=>{
    const wis=wiList.filter((w:any)=>w.wo_id===woId);
    const withMeta=wis.map((wi:any)=>{
      const panel=wi.panel_id?panelsAll.find(p=>p.id===wi.panel_id):null;
      const revisions=revList.filter((r:any)=>r.work_instruction_id===wi.id).sort((a:any,b:any)=>b.revision_number-a.revision_number);
      return{wi,label:panel?`Panel: ${panel.nama}`:(wi.judul||"Dokumen"),sortKey:panel?(Number(panel.no_pnl)||0)+1:0,revisions};
    }).filter(d=>d.revisions.length>0);
    return withMeta.sort((a,b)=>a.sortKey-b.sortKey);
  };

  return(
    <div style={{padding:16}} className="fi">
      <SectionCard icon="📐" title="WO Digital" subtitle="Gambar teknik (construction drawing) versi digital">
        {!selectedWo?(
          <>
            <div style={{display:"flex",gap:6,marginBottom:10}}>
              <button onClick={()=>setViewMode("aktif")} style={{flex:1,padding:"9px 6px",borderRadius:9,border:"none",cursor:"pointer",
                fontSize:12,fontWeight:700,background:viewMode==="aktif"?"#1d4ed8":"#e2e8f0",color:viewMode==="aktif"?"#fff":"#64748b"}}>
                Aktif
              </button>
              <button onClick={()=>setViewMode("arsip")} style={{flex:1,padding:"9px 6px",borderRadius:9,border:"none",cursor:"pointer",
                fontSize:12,fontWeight:700,background:viewMode==="arsip"?"#1d4ed8":"#e2e8f0",color:viewMode==="arsip"?"#fff":"#64748b"}}>
                🗄️ Arsip
              </button>
            </div>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari nomor WO / proyek..."
              style={{width:"100%",padding:"9px 12px",borderRadius:10,border:"1.5px solid #e2e8f0",fontSize:13,fontFamily:"inherit",boxSizing:"border-box",marginBottom:12}}/>

            {viewMode==="arsip"&&!q?(
              <EmptyState title="Cari WO dulu" description="Ketik nomor WO atau nama proyek untuk menampilkan arsip." variant="box-paper"/>
            ):loading?(
              <div style={{textAlign:"center",padding:20,color:"#94a3b8",fontSize:12}}>Memuat...</div>
            ):filteredWo.length===0?(
              <EmptyState title="Tidak ada" description="Tidak ada WO yang cocok." variant="box-paper"/>
            ):(
              <div style={{border:"1px solid #e2e8f0",borderRadius:12,overflow:"hidden"}}>
                {filteredWo.map((w,wi)=>{
                  const stats=statsOfWo(w.id);
                  return(
                    <div key={w.id} onClick={()=>setSelectedWo(w)}
                      style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",cursor:"pointer",
                        borderTop:wi===0?"none":"1px solid #f1f5f9",background:"#fff"}}>
                      <div style={{width:34,height:34,borderRadius:9,background:"#eff6ff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        <i className="ti ti-folder" style={{fontSize:16,color:"#1d4ed8"}}/>
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap" as const}}>
                          <span style={{fontSize:13,fontWeight:700,color:"#0f172a",overflow:"hidden",textOverflow:"ellipsis" as const,whiteSpace:"nowrap" as const}}>WO {w.wo} · {w.proyek}</span>
                          {stats.totalPanels>0&&(stats.docCount===stats.totalPanels?<Badge label="Semua Ada Dokumen" color="#16a34a" bg="#f0fdf4"/>:stats.docCount>0?<Badge label={`${stats.docCount}/${stats.totalPanels} Dokumen`} color="#d97706" bg="#fffbeb"/>:<Badge label="Belum Ada Dokumen" color="#94a3b8" bg="#f1f5f9"/>)}
                        </div>
                        <div style={{fontSize:11,color:"#94a3b8",marginTop:2,overflow:"hidden",textOverflow:"ellipsis" as const,whiteSpace:"nowrap" as const}}>{panelPreviewOfWo(w.id)}</div>
                      </div>
                      <i className="ti ti-chevron-right" style={{fontSize:16,color:"#cbd5e1",flexShrink:0}}/>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ):(()=>{
          // LEVEL 2 - pilihan revisi, dikelompokkan per dokumen (level-WO + per-panel).
          const dokumen=dokumenOfWo(selectedWo.id);
          return(
            <>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                <button onClick={()=>setSelectedWo(null)}
                  style={{width:34,height:34,borderRadius:9,background:"#f1f5f9",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <i className="ti ti-arrow-left" style={{fontSize:17,color:"#475569"}}/>
                </button>
                <div style={{fontSize:14,fontWeight:800,color:"#0f172a",overflow:"hidden",textOverflow:"ellipsis" as const,whiteSpace:"nowrap" as const}}>WO {selectedWo.wo} · {selectedWo.proyek}</div>
              </div>

              {dokumen.length===0?(
                <EmptyState title="Belum ada dokumen" description="Belum ada gambar teknik yang diupload untuk WO ini." variant="box-paper"/>
              ):(
                <div style={{display:"flex",flexDirection:"column" as const,gap:16}}>
                  {dokumen.map(({wi,label,revisions})=>(
                    <div key={wi.id}>
                      <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.3,marginBottom:6}}>{label}</div>
                      <div style={{border:"1px solid #e2e8f0",borderRadius:12,overflow:"hidden"}}>
                        {revisions.map((rev:any,ri:number)=>(
                          <div key={rev.id} onClick={()=>window.open(rev.file_url,"_blank")}
                            style={{display:"flex",alignItems:"center",gap:10,padding:"11px 14px",cursor:"pointer",
                              borderTop:ri===0?"none":"1px solid #f1f5f9",background:rev.is_current?"#fafbff":"#fff"}}>
                            <div style={{width:32,height:32,borderRadius:8,background:rev.is_current?"#eff6ff":"#f1f5f9",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                              <i className="ti ti-file-type-pdf" style={{fontSize:15,color:rev.is_current?"#1d4ed8":"#94a3b8"}}/>
                            </div>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap" as const}}>
                                <span style={{fontSize:12.5,fontWeight:700,color:rev.is_current?"#0f172a":"#94a3b8"}}>
                                  Revisi {rev.revision_number}{rev.rev_mark?` - ${rev.rev_mark}`:""}
                                </span>
                                {rev.is_current?<Badge label="Berlaku" color="#16a34a" bg="#f0fdf4"/>:<Badge label="Tidak berlaku" color="#94a3b8" bg="#f1f5f9"/>}
                              </div>
                              <div style={{fontSize:10.5,color:rev.is_current?"#64748b":"#cbd5e1",marginTop:2}}>
                                {fmtTgl(rev.uploaded_at)}{rev.page_count?` · ${rev.page_count} halaman`:""}
                              </div>
                            </div>
                            <i className="ti ti-external-link" style={{fontSize:15,color:rev.is_current?"#1d4ed8":"#cbd5e1",flexShrink:0}}/>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          );
        })()}
      </SectionCard>
    </div>
  );
}
