import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { DIVISI_CONFIG, PANEL_TYPES } from "../lib/panelTypes";
import { SectionCard, EmptyState } from "./ui/Primitives";
import { fmtShort } from "../lib/dateHelpers";

// ─────────────────────────────────────────────────────────────────────────────
// AKUN (29 Agu 2026) - tab bottom-nav: data diri, password (READ-ONLY, bukan
// ubah), cari riwayat komponen (khusus divisi timer), tombol Keluar.
//
// SOAL PASSWORD: semua divisi non-gudang SEKARANG pakai password BERSAMA per
// divisi/sub-bagian (nameplate baru disamakan 29 Agu 2026, lihat panelTypes.ts)
// - TIDAK ADA LAGI akun individual ter-hash yang perlu ditampilkan. Sumber
// password: tabel fcs_sub_bagian_password (utk divisi dgn subBagianPassword),
// fallback ke DIVISI_CONFIG kalau baris tabelnya belum ada - PERSIS logic yang
// dipakai Login.tsx sendiri buat verifikasi, biar gak pernah nunjukin password
// yang beda dari yang beneran dipakai buat login.
//
// REVISI "Riwayat Pengerjaan" (29 Agu 2026): awalnya list riwayat MILIK operator
// yang login (pekerja_id=user.id) - user tolak, goals-nya beda: jawab "siapa yang
// memproses komponen X" pas pengawas tanya (bisa OPERATOR MANAPUN, bukan cuma
// yang login), dan gak boleh list panjang. Sekarang jadi CARI (proyek->panel,
// pola sama persis RiwayatKerjaView.tsx) baru nampilin hasil - kosong sampai
// operator benar-benar pilih panel, bukan dump semua data dari awal.
//
// REVISI (30 Agu 2026): section "Notifikasi" ditambah - PINDAHAN dari ikon lonceng di header
// App.tsx (dihapus dari sana bareng tombol Keluar, biar header gak sesak - lihat App.tsx).
// Ikon lonceng lama itu SEBENARNYA cuma tombol pintasan+badge count (bukan daftar notifikasi
// beneran, gak pernah ada daftarnya) - fungsi yang dipindah ya persis itu: tampilkan count +
// tombol ke halaman Permintaan, notifCount/onBukaPermintaan dikirim dari App.tsx.
// ─────────────────────────────────────────────────────────────────────────────
export function AkunView({user,isTimerDivisi,proses,notifCount,onBukaPermintaan,onLogout}:{user:any,isTimerDivisi:boolean,proses:string[],notifCount:number,onBukaPermintaan:()=>void,onLogout:()=>void}){
  const cfg=(DIVISI_CONFIG as any)[user.divisi];
  const namaOperator=user.nama||user.name||"Operator";

  const[sharedPassword,setSharedPassword]=useState<string|null>(null);
  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      if(!cfg)return;
      if(cfg.subBagianPassword&&user.sub_bagian){
        const{data}=await supabase.from("fcs_sub_bagian_password").select("password").eq("sub_bagian",user.sub_bagian).single();
        if(!cancelled)setSharedPassword(data?.password||cfg.subBagianPassword[user.sub_bagian]||null);
      } else if(cfg.password){
        if(!cancelled)setSharedPassword(cfg.password);
      }
    })();
    return()=>{cancelled=true;};
  },[user.divisi,user.sub_bagian]);

  const[showPwd,setShowPwd]=useState(false);

  // Kode->nama komponen (buat tampilan hasil cari) - pola PERSIS RiwayatKerjaView.tsx: PANEL_TYPES
  // statis dulu, ditimpa bom_master (lebih lengkap/update) kalau kode-nya ada di situ juga.
  const[kodeNamaMap,setKodeNamaMap]=useState<Record<string,string>>({});
  useEffect(()=>{
    if(!isTimerDivisi)return;
    const map:Record<string,string>={};
    Object.values(PANEL_TYPES).forEach((c:any)=>{
      c.wps.forEach((w:any)=>w.items.forEach((it:any)=>{map[it.kode]=it.nama;}));
    });
    supabase.from("bom_master").select("kode_komponen,nama_komponen").then(({data}:any)=>{
      (data||[]).forEach((b:any)=>{map[b.kode_komponen]=b.nama_komponen;});
      setKodeNamaMap({...map});
    });
  },[isTimerDivisi]);

  // Cari riwayat komponen: proyek -> panel -> siapa+kapan mengerjakan (lihat komentar file).
  const[woList,setWoList]=useState<any[]>([]);
  useEffect(()=>{
    if(!isTimerDivisi)return;
    let cancelled=false;
    (async()=>{
      const{data}=await supabase.from("work_orders").select("id,wo,proyek").eq("is_archived",false).order("created_at",{ascending:false});
      if(!cancelled)setWoList(data||[]);
    })();
    return()=>{cancelled=true;};
  },[isTimerDivisi]);
  const[searchProyek,setSearchProyek]=useState("");
  const[selectedWoId,setSelectedWoId]=useState<number|null>(null);
  const filteredWoList=useMemo(()=>{
    const q=searchProyek.trim().toLowerCase();
    if(!q)return[];
    return woList.filter((w:any)=>(w.proyek||"").toLowerCase().includes(q)||(w.wo||"").toLowerCase().includes(q)).slice(0,8);
  },[woList,searchProyek]);

  const[panelList,setPanelList]=useState<any[]>([]);
  const[selectedPanelId,setSelectedPanelId]=useState<number|null>(null);
  useEffect(()=>{
    setPanelList([]);setSelectedPanelId(null);
    if(!selectedWoId)return;
    let cancelled=false;
    (async()=>{
      const{data}=await supabase.from("panels").select("id,no_pnl,nama").eq("wo_id",selectedWoId).is("deleted_at",null).order("no_pnl",{ascending:true});
      if(!cancelled)setPanelList(data||[]);
    })();
    return()=>{cancelled=true;};
  },[selectedWoId]);

  const[hasilCari,setHasilCari]=useState<any[]>([]);
  const[loadingCari,setLoadingCari]=useState(false);
  useEffect(()=>{
    setHasilCari([]);
    if(!selectedPanelId||proses.length===0)return;
    let cancelled=false;
    (async()=>{
      setLoadingCari(true);
      // .limit() defensif (audit egress Agu 2026) - fcs_timer_kerja bisa punya banyak sesi per
      // panel/proses seiring waktu, hasil pencarian ini cuma butuh yang terbaru buat ditampilkan.
      const{data:timers}=await supabase.from("fcs_timer_kerja").select("*").eq("panel_id",selectedPanelId).in("proses",proses).order("mulai",{ascending:false}).limit(200);
      const rows=timers||[];
      const pekerjaIds=[...new Set(rows.map((r:any)=>r.pekerja_id))];
      let namaMap:Record<number,string>={};
      if(pekerjaIds.length>0){
        const{data:pekerjaRows}=await supabase.from("pekerja").select("id,nama").in("id",pekerjaIds);
        (pekerjaRows||[]).forEach((p:any)=>{namaMap[p.id]=p.nama;});
      }
      if(!cancelled){setHasilCari(rows.map((r:any)=>({...r,pekerjaNama:namaMap[r.pekerja_id]||"?"})));setLoadingCari(false);}
    })();
    return()=>{cancelled=true;};
  },[selectedPanelId,proses]);

  const selectedWo=woList.find((w:any)=>w.id===selectedWoId);

  const fieldLabel:any={fontSize:10.5,color:"#94a3b8",fontWeight:700,textTransform:"uppercase",letterSpacing:.3};
  const fieldValue:any={fontSize:14,fontWeight:700,color:"#1e293b",marginTop:2};

  return(
    <div style={{padding:16}}>
      <SectionCard icon="👤" title="Data Diri" iconBg={cfg?.bg}>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div><div style={fieldLabel}>Nama</div><div style={fieldValue}>{namaOperator}</div></div>
          <div><div style={fieldLabel}>Divisi</div><div style={fieldValue}>{cfg?.icon} {cfg?.label||user.divisi}</div></div>
          {user.sub_bagian&&<div><div style={fieldLabel}>Sub-bagian</div><div style={fieldValue}>{user.sub_bagian}</div></div>}
        </div>
      </SectionCard>

      <SectionCard icon="🔑" title="Kata Sandi" subtitle="Password bersama divisi/sub-bagian Anda" iconBg={cfg?.bg}>
        {sharedPassword?(
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{flex:1,fontFamily:"'DM Mono',monospace",fontSize:16,fontWeight:800,letterSpacing:2,color:"#1e293b",
              background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10,padding:"10px 14px",overflow:"hidden",textOverflow:"ellipsis"}}>
              {showPwd?sharedPassword:"•".repeat(Math.max(6,sharedPassword.length))}
            </div>
            <button onClick={()=>setShowPwd(v=>!v)} title={showPwd?"Sembunyikan":"Tampilkan"}
              style={{width:40,height:40,flexShrink:0,borderRadius:10,border:"1px solid #e2e8f0",background:"#fff",cursor:"pointer"}}>
              <i className={`ti ti-${showPwd?"eye-off":"eye"}`} style={{fontSize:16,color:"#64748b"}}/>
            </button>
          </div>
        ):(
          <div style={{fontSize:12,color:"#94a3b8"}}>Memuat...</div>
        )}
      </SectionCard>

      <SectionCard icon="🔔" title="Notifikasi" iconBg={cfg?.bg}>
        <div onClick={onBukaPermintaan} style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",
          padding:"10px 12px",borderRadius:12,background:notifCount>0?"#fff7ed":"#f8fafc",
          border:`1px solid ${notifCount>0?"#fed7aa":"#e2e8f0"}`}}>
          <div style={{width:34,height:34,borderRadius:10,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",
            background:notifCount>0?"#f97316":"#e2e8f0",color:notifCount>0?"#fff":"#94a3b8",fontWeight:800,fontSize:13}}>
            {notifCount}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12.5,fontWeight:700,color:"#1e293b"}}>
              {notifCount>0?`${notifCount} permintaan butuh perhatian`:"Tidak ada notifikasi baru"}
            </div>
            <div style={{fontSize:10.5,color:"#94a3b8"}}>Ketuk untuk buka Permintaan</div>
          </div>
          <i className="ti ti-chevron-right" style={{fontSize:16,color:"#94a3b8"}}/>
        </div>
      </SectionCard>

      {isTimerDivisi&&(
        <SectionCard icon="🔎" title="Cari Riwayat Komponen" subtitle="Cek siapa & kapan komponen dikerjakan" iconBg={cfg?.bg}>
          <input placeholder="Cari proyek/WO..." value={selectedWoId?`${selectedWo?.proyek} — WO ${selectedWo?.wo}`:searchProyek}
            onChange={e=>{setSearchProyek(e.target.value);setSelectedWoId(null);}}
            style={{width:"100%",padding:"9px 12px",borderRadius:10,border:"1.5px solid #e2e8f0",
              fontSize:13,fontFamily:"inherit",boxSizing:"border-box"}}/>
          {!selectedWoId&&filteredWoList.length>0&&(
            <div style={{border:"1px solid #e2e8f0",borderRadius:10,marginTop:6,overflow:"hidden"}}>
              {filteredWoList.map(w=>(
                <div key={w.id} onClick={()=>{setSelectedWoId(w.id);setSearchProyek("");}}
                  style={{padding:"8px 12px",fontSize:12.5,cursor:"pointer",borderBottom:"1px solid #f1f5f9"}}>
                  <b>{w.proyek}</b> — WO {w.wo}
                </div>
              ))}
            </div>
          )}
          {selectedWoId&&(
            <select value={selectedPanelId||""} onChange={e=>setSelectedPanelId(e.target.value?Number(e.target.value):null)}
              style={{width:"100%",padding:"9px 12px",borderRadius:10,border:"1.5px solid #e2e8f0",
                fontSize:13,fontFamily:"inherit",marginTop:8,boxSizing:"border-box"}}>
              <option value="">Pilih panel...</option>
              {panelList.map(p=>(<option key={p.id} value={p.id}>#{p.no_pnl} {p.nama}</option>))}
            </select>
          )}
          {selectedPanelId&&(
            <div style={{marginTop:10}}>
              {loadingCari?(
                <div style={{textAlign:"center",padding:14,color:"#94a3b8",fontSize:12}}>Mencari...</div>
              ):hasilCari.length===0?(
                <EmptyState title="Belum ada riwayat" description="Belum ada komponen di panel ini yang tercatat dikerjakan."/>
              ):hasilCari.map(r=>(
                <div key={r.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,
                  padding:"8px 0",borderBottom:"1px solid #f1f5f9"}}>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:12.5,fontWeight:700,color:"#1e293b"}}>{r.kode_komponen} — {kodeNamaMap[r.kode_komponen]||"?"}</div>
                    <div style={{fontSize:10.5,color:"#94a3b8"}}>{r.proses} · {r.pekerjaNama} · {fmtShort(r.tanggal)}</div>
                  </div>
                  <div style={{fontSize:11,fontWeight:700,color:"#64748b",flexShrink:0}}>{r.selesai?`${r.durasi_menit||0} mnt`:"berjalan"}</div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      <button onClick={onLogout} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:8,
        background:"#fef2f2",border:"1.5px solid #fecaca",color:"#dc2626",borderRadius:14,padding:14,
        cursor:"pointer",fontSize:14,fontWeight:700,fontFamily:"inherit",marginTop:4}}>
        <i className="ti ti-logout" style={{fontSize:17}}/> Keluar
      </button>
    </div>
  );
}
