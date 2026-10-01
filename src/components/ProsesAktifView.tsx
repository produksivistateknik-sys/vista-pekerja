import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { withRetry, alertGagalSimpan } from "../lib/koneksi";
import { getLocalDateStr } from "../lib/dateHelpers";
import { DIVISI_CONFIG } from "../lib/panelTypes";
import { SectionCard, EmptyState } from "./ui/Primitives";

// ─────────────────────────────────────────────────────────────────────────────
// PROSES AKTIF (29 Agu 2026) - tab bottom-nav, tampilkan timer fcs_timer_kerja
// yang sedang berjalan (selesai IS NULL) milik operator yang login. CUMA
// relevan untuk divisi yang pakai timer (mekanik/painting/assembling/
// wiring_ctrl/wiring_pwr - lihat OperatorView.tsx) - App.tsx yang tentukan
// kapan komponen ini dirender (disembunyikan total utk qc/nameplate/QS).
// FORCE CLOSE (7 Sep 2026) - satu-satunya jalur tulis di komponen ini, dipakai
// untuk timer yang nyangkut/kelupaan (contoh nyata: 74j+ jalan terus). Operasi-
// nya SAMA PERSIS dengan selesaikanDariReminder()/stopTimer() di OperatorView.tsx
// (update `selesai` by id timer, progress/qty yang sudah tersimpan di tempat lain
// - checklist/pekerja_per_komponen - TIDAK disentuh sama sekali) - sengaja gak
// reuse fungsi itu langsung karena beda instance komponen (gak share state
// timerAktif), tapi query-nya identik.
//
// REKAN SATU SUB-BAGIAN (1 Okt 2026, diminta user) - section kedua, READ-ONLY (gak ada Force
// Close buat timer orang lain), timer aktif operator LAIN di sub-bagian yang sama.
// - Sub-bagian (mis. Assembling Luar/Dalam) cuma ada di sesi login (user.sub_bagian), GAK
//   disimpan di tabel pekerja (cuma kolom divisi) - jadi cakupan = pekerja.divisi sama, lalu
//   KHUSUS divisi yang punya >1 sub-bagian (sekarang cuma assembling) dipersempit lewat proses
//   timer: DIVISI_CONFIG.subBagianProses[sub_bagian] + PASANG KOMPONEN dgn tahap sub-bagian ini
//   (TUGAS_KOMPONEN_* di App.tsx, diteruskan lewat prop tahapPasangKomponen). Gak cukup filter
//   proses doang: PASANG KOMPONEN juga dijalankan operator Wiring Control (tahap WIRING).
// - Cuma timer yang dimulai HARI INI (kolom tanggal) - per 30 Sep 2026 40 dari 61 timer aktif
//   adalah timer basi lupa di-stop (sampai 184 jam), kalau ditampilin daftar rekan penuh noise.
//   Yang basi cuma dihitung ("N timer lama belum di-stop").
// - Realtime: 1 channel difilter pekerja_id=in.(pekerja satu divisi), refetch di-debounce 1 dtk
//   (5 operator klik Mulai barengan = 1 fetch) + refetch saat tab balik kelihatan (jaga-jaga
//   koneksi realtime sempat putus waktu layar HP mati).
// ─────────────────────────────────────────────────────────────────────────────

type InfoPanel={id:number;nama:string;wo_id:number|null;wo?:{id:number;proyek:string;wo:string}};

// Nama panel + proyek buat sekumpulan panel_id - dipakai section "Proses Saya" & "Rekan" (1 jalur).
async function ambilInfoPanel(panelIds:number[]):Promise<Record<number,InfoPanel>>{
  if(panelIds.length===0)return {};
  const{data:panels,error}=await supabase.from("panels").select("id,nama,wo_id").in("id",panelIds);
  if(error)throw error;
  const woIds=[...new Set((panels||[]).map((p:any)=>p.wo_id).filter(Boolean))];
  const woMap:Record<number,any>={};
  if(woIds.length>0){
    const{data:wos,error:woErr}=await supabase.from("work_orders").select("id,proyek,wo").in("id",woIds);
    if(woErr)throw woErr;
    (wos||[]).forEach((w:any)=>{woMap[w.id]=w;});
  }
  const map:Record<number,InfoPanel>={};
  (panels||[]).forEach((p:any)=>{map[p.id]={...p,wo:woMap[p.wo_id]};});
  return map;
}

// Semua baris timer aktif (paginasi penuh - aturan batas 1000 row, walau normalnya puluhan).
async function ambilTimerAktif(pekerjaIds:number[]):Promise<any[]>{
  let semua:any[]=[];
  for(let from=0;;from+=1000){
    const{data,error}=await supabase.from("fcs_timer_kerja").select("*")
      .in("pekerja_id",pekerjaIds).is("selesai",null).order("mulai",{ascending:false}).range(from,from+999);
    if(error)throw error;
    semua=semua.concat(data||[]);
    if(!data||data.length<1000)break;
  }
  return semua;
}

// Apakah timer ini milik sub-bagian yang sama dgn operator yang login (lihat komentar atas).
function timerSatuSubBagian(t:any,user:any,tahapPasangKomponen?:string|null):boolean{
  const subMap=(DIVISI_CONFIG as any)[user?.divisi]?.subBagianProses;
  if(!subMap||Object.keys(subMap).length<=1)return true; // divisi cuma 1 sub-bagian -> divisi = cakupan
  const prosesSub:string[]=subMap[user?.sub_bagian]||[];
  if(prosesSub.includes(t.proses))return true;
  return t.proses==="PASANG KOMPONEN"&&!!tahapPasangKomponen&&t.tahap===tahapPasangKomponen;
}

export function ProsesAktifView({user,tahapPasangKomponen}:{user:any;tahapPasangKomponen?:string|null}){
  const[loading,setLoading]=useState(true);
  const[timers,setTimers]=useState<any[]>([]);
  const[panelsMap,setPanelsMap]=useState<Record<number,InfoPanel>>({});
  const[now,setNow]=useState(()=>Date.now());
  const[closingId,setClosingId]=useState<number|null>(null);
  const[errSaya,setErrSaya]=useState<string|null>(null);

  const[rekanLoading,setRekanLoading]=useState(true);
  const[rekanTimers,setRekanTimers]=useState<any[]>([]);
  const[rekanBasi,setRekanBasi]=useState(0);
  const[rekanNama,setRekanNama]=useState<Record<number,string>>({});
  const[rekanPanels,setRekanPanels]=useState<Record<number,InfoPanel>>({});
  const[errRekan,setErrRekan]=useState<string|null>(null);

  useEffect(()=>{
    const t=setInterval(()=>setNow(Date.now()),1000);
    return()=>clearInterval(t);
  },[]);

  useEffect(()=>{
    if(!user?.id)return;
    let cancelled=false;
    const fetchActive=async()=>{
      try{
        const{data,error}=await supabase.from("fcs_timer_kerja").select("*").eq("pekerja_id",user.id).is("selesai",null).order("mulai",{ascending:false});
        if(error)throw error;
        const rows=data||[];
        if(cancelled)return;
        setTimers(rows);
        const map=await ambilInfoPanel([...new Set(rows.map((r:any)=>Number(r.panel_id)))]);
        if(!cancelled){setPanelsMap(map);setErrSaya(null);}
      }catch(err:any){
        // FIX (1 Okt 2026) - dulu error diabaikan, gagal fetch tampil "0 proses" tanpa pesan.
        console.error("[ProsesAktif] gagal ambil timer sendiri:",err);
        if(!cancelled)setErrSaya(err?.message||String(err));
      }finally{
        if(!cancelled)setLoading(false);
      }
    };
    fetchActive();
    const ch=supabase.channel("realtime-proses-aktif-"+user.id)
      .on("postgres_changes",{event:"*",schema:"public",table:"fcs_timer_kerja",filter:"pekerja_id=eq."+user.id},fetchActive)
      .subscribe();
    return()=>{cancelled=true;supabase.removeChannel(ch);};
  },[user?.id]);

  // ── Rekan satu sub-bagian ──
  useEffect(()=>{
    if(!user?.id||!user?.divisi)return;
    let cancelled=false;
    let ch:any=null;
    let debounce:any=null;
    let pekerjaIds:number[]=[];

    const fetchRekan=async()=>{
      try{
        const timerSemua=pekerjaIds.length?await ambilTimerAktif(pekerjaIds):[];
        const hariIni=getLocalDateStr();
        const relevan=timerSemua.filter((t:any)=>Number(t.pekerja_id)!==Number(user.id)&&timerSatuSubBagian(t,user,tahapPasangKomponen));
        const hariIniSaja=relevan.filter((t:any)=>t.tanggal===hariIni);
        const map=await ambilInfoPanel([...new Set(hariIniSaja.map((t:any)=>Number(t.panel_id)))]);
        if(cancelled)return;
        setRekanTimers(hariIniSaja);
        setRekanBasi(relevan.length-hariIniSaja.length);
        setRekanPanels(map);
        setErrRekan(null);
      }catch(err:any){
        console.error("[ProsesAktif] gagal ambil timer rekan:",err);
        if(!cancelled)setErrRekan(err?.message||String(err));
      }finally{
        if(!cancelled)setRekanLoading(false);
      }
    };
    const fetchRekanDebounced=()=>{clearTimeout(debounce);debounce=setTimeout(fetchRekan,1000);};
    const onVisible=()=>{if(document.visibilityState==="visible")fetchRekan();};

    (async()=>{
      try{
        // Pekerja satu divisi (cuma id/nama - tabel pekerja juga punya kolom password, jangan select *).
        const{data,error}=await supabase.from("pekerja").select("id,nama").eq("divisi",user.divisi);
        if(error)throw error;
        if(cancelled)return;
        pekerjaIds=(data||[]).map((p:any)=>Number(p.id));
        setRekanNama(Object.fromEntries((data||[]).map((p:any)=>[Number(p.id),p.nama])));
      }catch(err:any){
        console.error("[ProsesAktif] gagal ambil daftar rekan:",err);
        if(!cancelled){setErrRekan(err?.message||String(err));setRekanLoading(false);}
        return;
      }
      await fetchRekan();
      if(cancelled||pekerjaIds.length===0)return;
      ch=supabase.channel("realtime-proses-aktif-rekan-"+user.id)
        .on("postgres_changes",{event:"*",schema:"public",table:"fcs_timer_kerja",filter:`pekerja_id=in.(${pekerjaIds.join(",")})`},fetchRekanDebounced)
        .subscribe();
      document.addEventListener("visibilitychange",onVisible);
    })();

    return()=>{
      cancelled=true;
      clearTimeout(debounce);
      document.removeEventListener("visibilitychange",onVisible);
      if(ch)supabase.removeChannel(ch);
    };
  },[user?.id,user?.divisi,user?.sub_bagian,tahapPasangKomponen]);

  const fmtDurasi=(mulai:string)=>{
    const detik=Math.max(0,Math.floor((now-new Date(mulai).getTime())/1000));
    const j=Math.floor(detik/3600),m=Math.floor((detik%3600)/60),s=detik%60;
    return j>0?`${j}j ${m}m`:`${m}m ${s}d`;
  };

  const forceClose=async(timerId:number)=>{
    if(!window.confirm("Yakin mau tutup paksa proses ini? Progress saat ini akan disimpan dan proses dianggap selesai."))return;
    setClosingId(timerId);
    try{
      const{error}=await withRetry(()=>supabase.from("fcs_timer_kerja").update({selesai:new Date().toISOString()}).eq("id",timerId).is("selesai",null));
      if(error){
        alertGagalSimpan(error,`Tutup paksa timer ${timerId}`,{aksi:"tutup paksa",catatanServer:"Laporkan ke admin beserta pesan ini."});
        return;
      }
      setTimers(prev=>prev.filter(t=>t.id!==timerId));
    }catch(err:any){
      // (29 Sep 2026) dulu selalu "koneksi bermasalah" - sekarang lewat helper bersama lib/koneksi.ts.
      alertGagalSimpan(err,`Tutup paksa timer ${timerId}`,{aksi:"tutup paksa",ulangi:"Tutup Paksa",catatanServer:"Laporkan ke admin beserta pesan ini."});
    }finally{
      setClosingId(null);
    }
  };

  // Kelompokkan timer rekan per operator; operator yang mulai paling baru di atas (rekanTimers
  // sudah urut mulai desc dari query, jadi urutan kemunculan pertama = urutan grup).
  const grupRekan:{pekerjaId:number;timers:any[]}[]=[];
  rekanTimers.forEach((t:any)=>{
    const pid=Number(t.pekerja_id);
    let g=grupRekan.find(x=>x.pekerjaId===pid);
    if(!g){g={pekerjaId:pid,timers:[]};grupRekan.push(g);}
    g.timers.push(t);
  });
  const labelCakupan=user?.sub_bagian||(DIVISI_CONFIG as any)[user?.divisi]?.label||"divisi ini";
  const pesanError=(msg:string)=>(
    <div style={{fontSize:11,color:"#b91c1c",background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"8px 10px",marginBottom:8}}>
      Gagal memuat data: {msg}. Coba buka ulang tab ini; kalau tetap gagal, laporkan ke admin.
    </div>
  );

  return(
    <div style={{padding:16}}>
      <SectionCard icon="⏱" title="Proses Saya" subtitle={loading?"Memuat...":`${timers.length} proses sedang berjalan`}>
        {errSaya&&pesanError(errSaya)}
        {loading?(
          <div style={{textAlign:"center",padding:20,color:"#94a3b8",fontSize:12}}>Memuat...</div>
        ):timers.length===0?(
          <EmptyState title="Tidak ada proses aktif" description="Belum ada timer yang sedang berjalan saat ini."/>
        ):timers.map(t=>{
          const panel=panelsMap[t.panel_id];
          return(
            <div key={t.id} style={{border:"1px solid #bbf7d0",borderRadius:12,padding:"12px 14px",marginBottom:8,background:"#f0fdf4"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                <div style={{minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>{panel?.nama||"Panel #"+t.panel_id}</div>
                  <div style={{fontSize:11,color:"#64748b",marginTop:2}}>{panel?.wo?.proyek} · {t.proses} · {t.kode_komponen}</div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontWeight:800,fontSize:14,color:"#16a34a",fontFamily:"'DM Mono',monospace"}}>{fmtDurasi(t.mulai)}</div>
                  <div style={{fontSize:9,color:"#94a3b8"}}>berjalan</div>
                </div>
              </div>
              <button disabled={closingId===t.id} onClick={()=>forceClose(t.id)}
                style={{marginTop:8,width:"100%",fontSize:11,fontWeight:700,border:"1px solid #fbcfe8",borderRadius:8,
                  padding:"7px 10px",background:"#fff",color:"#db2777",cursor:closingId===t.id?"not-allowed":"pointer"}}>
                {closingId===t.id?"Menutup...":"⏹ Force Close"}
              </button>
            </div>
          );
        })}
      </SectionCard>

      <div style={{height:12}}/>

      <SectionCard icon="👥" title={`Rekan ${labelCakupan}`}
        subtitle={rekanLoading?"Memuat...":`${grupRekan.length} operator · ${rekanTimers.length} proses berjalan hari ini`}>
        {errRekan&&pesanError(errRekan)}
        {rekanLoading?(
          <div style={{textAlign:"center",padding:20,color:"#94a3b8",fontSize:12}}>Memuat...</div>
        ):grupRekan.length===0?(
          <EmptyState title="Tidak ada rekan yang sedang jalan" description="Belum ada rekan satu sub-bagian yang menjalankan timer hari ini."/>
        ):grupRekan.map(g=>(
          <div key={g.pekerjaId} style={{border:"1px solid #e2e8f0",borderRadius:12,padding:"10px 12px",marginBottom:8,background:"#fff"}}>
            <div style={{fontWeight:800,fontSize:13,color:"#1e293b",marginBottom:6}}>
              {rekanNama[g.pekerjaId]||"Operator #"+g.pekerjaId}
              <span style={{fontWeight:600,fontSize:10,color:"#94a3b8",marginLeft:6}}>{g.timers.length} proses</span>
            </div>
            {g.timers.map((t:any)=>{
              const panel=rekanPanels[t.panel_id];
              return(
                <div key={t.id} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,padding:"6px 0",borderTop:"1px dashed #f1f5f9"}}>
                  <div style={{minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:12,color:"#334155"}}>{panel?.nama||"Panel #"+t.panel_id}</div>
                    <div style={{fontSize:11,color:"#64748b",marginTop:1}}>
                      {panel?.wo?.proyek} · {t.proses} · {t.kode_komponen}{t.tahap?" · "+t.tahap:""}
                    </div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontWeight:800,fontSize:13,color:"#0f766e",fontFamily:"'DM Mono',monospace"}}>{fmtDurasi(t.mulai)}</div>
                    <div style={{fontSize:9,color:"#94a3b8"}}>berjalan</div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        {!rekanLoading&&rekanBasi>0&&(
          <div style={{fontSize:11,color:"#92400e",background:"#fffbeb",border:"1px solid #fde68a",borderRadius:8,padding:"8px 10px",marginTop:4}}>
            {rekanBasi} timer lama rekan (dimulai sebelum hari ini) belum di-stop - tidak ditampilkan.
          </div>
        )}
      </SectionCard>
    </div>
  );
}
