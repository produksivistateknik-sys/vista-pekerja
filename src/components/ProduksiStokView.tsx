import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { produksiStokService } from "../lib/produksiStokService";
import { alertGagalSimpan } from "../lib/koneksi";
import { DIVISI_CONFIG } from "../lib/panelTypes";
import { SectionCard, EmptyState } from "./ui/Primitives";

// ─────────────────────────────────────────────────────────────────────────────
// PRODUKSI STOK - tampilan operator (2 Okt 2026). Produksi komponen setengah jadi SENGAJA untuk
// stok, TERPISAH TOTAL dari WO: tidak membaca/menulis panels, raw_schedule, renhar, maupun
// fcs_timer_kerja, dan tidak memblokir/mendahului pekerjaan WO manapun - murni menu tambahan.
// - Kartu per (batch, tahap) - cuma tahap milik sub-bagian operator (DIVISI_CONFIG.subBagianProses,
//   Mekanik: POTONG/BENDING/STEL/FINISHING, Painting: RENDAM/PAINTING) DAN yang masih ada qty
//   tersedia. Tahap tiap batch ikut aturan proses WO (dibaca dari bom_proses_relevan saat batch dibuat).
// - Angka "tersedia" dari view SQL (rumus yang sama dgn validasi RPC) - batas stepper di sini cuma
//   kenyamanan, server tetap menolak kalau lewat (mis. diambil operator lain duluan).
// - Chip 25-100% = indikator visual otomatis dari progress YANG SUDAH TERSIMPAN (qty baik tahap ini
//   di DB), BUKAN dari angka stepper yang belum disimpan (revisi 2 Okt 2026, diminta user).
// - "Mulai Kerja" cuma mencatat waktu mulai sesi (dikirim ke log), tidak terhubung ke timer WO /
//   Proses Aktif. Gaya tombolnya SAMA dgn tombol start timer WO (solid hijau, toolbar POTONG
//   OperatorView) - revisi 2 Okt 2026, dulu varian hijau muda yang kebaca kayak link.
// - Foto TIDAK wajib & tidak ada di Produksi Stok (revisi 2 Okt 2026, diminta user - beda dgn WO).
//   RPC/constraint sudah dilonggarkan (migration 20261002040000), kolom foto_urls dikirim kosong.
// ─────────────────────────────────────────────────────────────────────────────

const PCT_CHIP=[25,50,75,90,100];
const WARNA="#059669";

const bacaMulai=():Record<string,string>=>{try{return JSON.parse(localStorage.getItem("vista_produksi_stok_mulai")||"{}");}catch{return {};}};
const tulisMulai=(v:Record<string,string>)=>{try{localStorage.setItem("vista_produksi_stok_mulai",JSON.stringify(v));}catch{/* private mode - abaikan */}};

export function ProduksiStokView({user}:{user:any;registerBackHandler?:(fn:(()=>boolean)|null)=>void}){
  const cfg=(DIVISI_CONFIG as any)[user?.divisi];
  const tahapSaya:string[]=(user?.sub_bagian&&cfg?.subBagianProses?.[user.sub_bagian])||cfg?.proses||[];
  const [tab,setTab]=useState<"tugas"|"riwayat">("tugas");
  const [loading,setLoading]=useState(true);
  const [errMuat,setErrMuat]=useState<string|null>(null);
  const [data,setData]=useState<{batch:any[];tahap:any[];komponen:any[]}>({batch:[],tahap:[],komponen:[]});
  const [riwayat,setRiwayat]=useState<{log:any[];batch:any[];komponen:any[]}|null>(null);
  const [qtyInput,setQtyInput]=useState<Record<string,number>>({});
  const [rejectInput,setRejectInput]=useState<Record<string,number>>({});
  const [catatan,setCatatan]=useState<Record<string,string>>({});
  const [mulai,setMulai]=useState<Record<string,string>>(bacaMulai);
  const [saving,setSaving]=useState<string|null>(null);
  const [flash,setFlash]=useState<string|null>(null);
  const [,setTick]=useState(0);

  const muat=async()=>{
    try{
      setData(await produksiStokService.ambilAktif());
      setErrMuat(null);
    }catch(err:any){
      console.error("[ProduksiStok] gagal memuat:",err);
      setErrMuat(err?.message||String(err));
    }finally{
      setLoading(false);
    }
  };

  useEffect(()=>{
    muat();
    let t:any=null;
    const muatUlang=()=>{clearTimeout(t);t=setTimeout(muat,800);};
    const ch=supabase.channel("realtime-produksi-stok-operator-"+(user?.id??"x"))
      .on("postgres_changes",{event:"*",schema:"public",table:"produksi_stok_tahap"},muatUlang)
      .on("postgres_changes",{event:"*",schema:"public",table:"produksi_stok_batch"},muatUlang)
      .subscribe();
    const onVisible=()=>{if(document.visibilityState==="visible")muat();};
    document.addEventListener("visibilitychange",onVisible);
    const tick=setInterval(()=>setTick(x=>x+1),30000); // durasi sesi di tombol Mulai
    return()=>{clearTimeout(t);supabase.removeChannel(ch);document.removeEventListener("visibilitychange",onVisible);clearInterval(tick);};
  },[]);

  useEffect(()=>{
    if(tab!=="riwayat")return;
    setRiwayat(null);
    produksiStokService.ambilRiwayatSaya(user?.id||null,user?.nama||"")
      .then(setRiwayat)
      .catch((err:any)=>{console.error("[ProduksiStok] gagal memuat riwayat:",err);setRiwayat({log:[],batch:[],komponen:[]});alert("Gagal memuat riwayat: "+(err?.message||err));});
  },[tab]);

  const namaKomp=(id:number,list:any[])=>list.find(k=>k.id===id);

  // Kartu = pasangan (batch, tahap) yang tahap-nya milik sub-bagian ini & masih ada qty tersedia.
  const kartu=data.batch.flatMap(b=>{
    const th=data.tahap.filter(t=>t.batch_id===b.id).sort((x,y)=>x.urutan-y.urutan);
    return th.filter(t=>tahapSaya.includes(t.tahap)&&t.tersedia>0).map(t=>({b,t,th}));
  });

  const mulaiKerja=(key:string)=>{
    const baru={...mulai,[key]:new Date().toISOString()};setMulai(baru);tulisMulai(baru);
  };
  const durasi=(iso?:string)=>{
    if(!iso)return"";const m=Math.max(0,Math.round((Date.now()-new Date(iso).getTime())/60000));
    return m>=60?`${Math.floor(m/60)}j ${m%60}m`:`${m}m`;
  };

  const simpan=async(b:any,t:any,komp:any)=>{
    const key=`${b.id}_${t.tahap}`;
    const qty=qtyInput[key]??1;
    const reject=Math.min(rejectInput[key]??0,qty);
    if(qty<=0){alert("Jumlah selesai sesi ini minimal 1.");return;}
    setSaving(key);
    try{
      await produksiStokService.simpanProgress({
        batchId:b.id,tahap:t.tahap,qty,qtyReject:reject,fotoUrls:[],
        operatorId:user?.id||null,operatorNama:user?.nama||user?.name||"-",
        catatan:(catatan[key]||"").trim()||null,mulaiAt:mulai[key]||null,
      });
      setQtyInput(prev=>{const n={...prev};delete n[key];return n;});
      setRejectInput(prev=>{const n={...prev};delete n[key];return n;});
      setCatatan(prev=>{const n={...prev};delete n[key];return n;});
      const m={...mulai};delete m[key];setMulai(m);tulisMulai(m);
      setFlash(`✅ ${komp?.nama||"Batch #"+b.id} · ${t.tahap}: ${qty} pcs tersimpan`);
      setTimeout(()=>setFlash(null),3000);
      await muat();
    }catch(err:any){
      alertGagalSimpan(err,`Simpan Produksi Stok batch ${b.id} ${t.tahap}`,{ulangi:"Simpan Progress",
        catatanServer:"Kalau pesannya soal jumlah maksimal, kemungkinan operator lain baru saja mengisi tahap yang sama - angka tersedia sudah diperbarui, sesuaikan lalu simpan lagi."});
      await muat();
    }finally{
      setSaving(null);
    }
  };

  if(loading)return <div style={{padding:16}}><SectionCard icon="🏭" title="Produksi Stok" subtitle="Memuat..."><div style={{textAlign:"center",padding:20,color:"#94a3b8",fontSize:12}}>Memuat...</div></SectionCard></div>;

  return(
    <div style={{padding:16}}>
      <SectionCard icon="🏭" title="Produksi Stok" subtitle={`${user?.sub_bagian||cfg?.label||""} · menu terpisah dari Tugas Saya / WO`}>
        <div style={{display:"flex",gap:6,background:"#f8fafc",border:"1px solid #eef0f3",borderRadius:10,padding:4,marginBottom:12}}>
          {(["tugas","riwayat"] as const).map(k=>(
            <button key={k} onClick={()=>setTab(k)}
              style={{flex:1,border:"none",borderRadius:7,padding:"7px 0",fontSize:12,fontWeight:700,cursor:"pointer",
                background:tab===k?"#fff":"transparent",color:tab===k?"#0f172a":"#94a3b8",boxShadow:tab===k?"0 1px 2px rgba(0,0,0,.08)":"none"}}>
              {k==="tugas"?`Tugas Saya (${kartu.length})`:"Riwayat Saya"}
            </button>
          ))}
        </div>
        {errMuat&&<div style={{fontSize:11,color:"#b91c1c",background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"8px 10px",marginBottom:10}}>Gagal memuat data: {errMuat}. Coba buka ulang menu ini.</div>}
        {flash&&<div style={{fontSize:12,fontWeight:700,color:"#166534",background:"#dcfce7",borderRadius:8,padding:"8px 10px",marginBottom:10}}>{flash}</div>}

        {tab==="tugas"&&(kartu.length===0?(
          <EmptyState title="Belum ada produksi stok untuk Anda" description={`Tidak ada batch aktif yang punya qty tersedia di tahap ${tahapSaya.join("/")||"Anda"} saat ini.`}/>
        ):kartu.map(({b,t,th})=>{
          const key=`${b.id}_${t.tahap}`;
          const komp=namaKomp(b.komponen_id,data.komponen);
          const qty=Math.min(qtyInput[key]??1,t.tersedia);
          const reject=Math.min(rejectInput[key]??0,qty);
          const idx=th.findIndex((x:any)=>x.tahap===t.tahap);
          const sebelum=idx>0?th[idx-1]:null;
          const rejectSesudah=th.slice(idx+1).reduce((a:number,x:any)=>a+x.qty_reject,0);
          const alasan=sebelum
            ?`${sebelum.tahap} sudah baik ${sebelum.qty_baik} pcs, ${t.tahap} sudah mengerjakan ${t.qty_selesai} → sisa ${t.tersedia} yang boleh dikerjakan`
            :`Target ${b.target_qty} pcs, unit yang sudah berjalan ${t.qty_baik-rejectSesudah} pcs → sisa ${t.tersedia} yang perlu ${t.tahap.toLowerCase()}`;
          // Chip = progress YANG SUDAH TERSIMPAN (qty baik tahap ini di DB, sama dgn angka header &
          // progress bar), mulai 0% - angka stepper yang belum disimpan TIDAK ikut dihitung.
          const pctTersimpan=Math.min(100,Math.round((t.qty_baik/b.target_qty)*100));
          const sedangSimpan=saving===key;
          return(
            <div key={key} style={{border:"1.5px solid #eef0f3",borderRadius:12,marginBottom:12,background:"#fff",overflow:"hidden"}}>
              <div style={{padding:"12px 13px 0"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                  <div style={{minWidth:0}}>
                    <div style={{fontWeight:800,fontSize:14,color:"#0f172a"}}>{komp?.nama||"Komponen #"+b.komponen_id}</div>
                    <div style={{fontSize:10.5,color:"#94a3b8",fontFamily:"'DM Mono',monospace"}}>{komp?.kode||""} · batch #{b.id}</div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontWeight:800,fontSize:15,color:"#0f172a"}}>{t.qty_baik}/{b.target_qty}</div>
                    <div style={{fontSize:9,color:"#94a3b8",textTransform:"uppercase" as const}}>pcs baik {t.tahap}</div>
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column" as const,gap:5,margin:"10px 0"}}>
                  {th.map((x:any)=>{
                    const p=Math.min(100,Math.round((x.qty_baik/b.target_qty)*100));
                    const aktif=x.tahap===t.tahap;
                    return(
                      <div key={x.tahap} style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{width:66,fontSize:9.5,fontWeight:800,color:aktif?"#ea580c":x.qty_baik>=b.target_qty?"#16a34a":"#94a3b8"}}>{x.tahap}</span>
                        <div style={{flex:1,height:6,borderRadius:99,background:"#eef0f4",overflow:"hidden"}}>
                          <div style={{width:p+"%",height:"100%",borderRadius:99,background:aktif?"#ea580c":x.qty_baik>=b.target_qty?"#16a34a":"#94a3b8"}}/>
                        </div>
                        <span style={{width:52,textAlign:"right" as const,fontSize:9.5,fontWeight:700,color:"#64748b"}}>{x.qty_baik}/{b.target_qty}{x.qty_reject>0?` ·${x.qty_reject}R`:""}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{background:"#fff7ed",color:"#c2410c",fontSize:11,fontWeight:700,padding:"7px 13px",display:"flex",justifyContent:"space-between"}}>
                <span>Tahap Anda: {t.tahap}</span><span>tersedia {t.tersedia} pcs</span>
              </div>
              <div style={{padding:"12px 13px"}}>
                <div style={{fontSize:11,fontWeight:700,color:"#c2410c",background:"#fffbeb",border:"1px solid #fde68a",borderRadius:8,padding:"7px 10px",marginBottom:10}}>⚠ {alasan}</div>
                {/* Gaya SAMA PERSIS tombol start timer WO (toolbar POTONG OperatorView: solid hijau,
                    teks putih, minHeight 48). Perilaku tetap: cuma catat waktu mulai sesi. */}
                <button onClick={()=>mulaiKerja(key)}
                  style={{width:"100%",marginBottom:10,minHeight:48,padding:"10px",borderRadius:10,border:"none",
                    background:"#16a34a",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>
                  {mulai[key]?`⏱ Sesi berjalan ${durasi(mulai[key])} · Mulai Ulang`:"▶ Mulai Kerja"}
                </button>
                {[
                  {lbl:`Jumlah selesai sesi ini (maks. ${t.tersedia})`,val:qty,set:(v:number)=>setQtyInput(p=>({...p,[key]:Math.max(1,Math.min(t.tersedia,v))})),min:1,max:t.tersedia},
                  {lbl:`Di antaranya reject (maks. ${qty})`,val:reject,set:(v:number)=>setRejectInput(p=>({...p,[key]:Math.max(0,Math.min(qty,v))})),min:0,max:qty},
                ].map((s,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:8,background:"#f8fafc",border:"1px solid #eef0f3",borderRadius:10,padding:"8px 12px",marginBottom:8}}>
                    <span style={{fontSize:11.5,color:"#64748b",flex:1}}>{s.lbl}</span>
                    <button disabled={s.val<=s.min} onClick={()=>s.set(s.val-1)} style={{width:30,height:30,borderRadius:8,border:"1px solid #e2e8f0",background:"#fff",fontWeight:800,fontSize:15,color:"#0f172a",cursor:"pointer"}}>−</button>
                    <span style={{minWidth:24,textAlign:"center" as const,fontWeight:800,fontSize:14}}>{s.val}</span>
                    <button disabled={s.val>=s.max} onClick={()=>s.set(s.val+1)} style={{width:30,height:30,borderRadius:8,border:"1px solid #e2e8f0",background:"#fff",fontWeight:800,fontSize:15,color:"#0f172a",cursor:"pointer"}}>+</button>
                  </div>
                ))}
                {reject>0&&<div style={{fontSize:10.5,color:"#b91c1c",marginBottom:8}}>Reject tidak diteruskan ke tahap berikutnya dan akan diganti dari {th[0].tahap} (tidak ada perbaikan/rework).</div>}
                <div style={{display:"flex",gap:6,marginBottom:10}}>
                  {PCT_CHIP.map(c=>(
                    <span key={c} style={{flex:1,textAlign:"center" as const,padding:"8px 3px",borderRadius:8,fontWeight:700,fontSize:10.5,
                      background:pctTersimpan>=c?WARNA:"#f1f5f9",color:pctTersimpan>=c?"#fff":"#94a3b8"}}>{pctTersimpan>=c?"✓":`${c}%`}</span>
                  ))}
                </div>
                <input value={catatan[key]||""} onChange={e=>setCatatan(p=>({...p,[key]:e.target.value}))} placeholder="Catatan (opsional)"
                  style={{width:"100%",boxSizing:"border-box" as const,fontSize:12,padding:"8px 10px",borderRadius:8,border:"1px solid #e2e8f0",marginBottom:10,fontFamily:"inherit"}}/>
                <button onClick={()=>simpan(b,t,komp)} disabled={sedangSimpan}
                  style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,width:"100%",border:"none",borderRadius:10,padding:"10px",fontSize:12,fontWeight:700,
                    background:sedangSimpan?"#cbd5e1":WARNA,color:"#fff",cursor:sedangSimpan?"not-allowed":"pointer"}}>
                  <i className={sedangSimpan?"ti ti-loader-2":"ti ti-device-floppy"} style={{fontSize:14}}/>
                  {sedangSimpan?"Menyimpan...":`Simpan Progress (${qty} pcs${reject>0?`, ${reject} reject`:""})`}
                </button>
              </div>
            </div>
          );
        }))}

        {tab==="riwayat"&&(riwayat===null?(
          <div style={{textAlign:"center",padding:20,color:"#94a3b8",fontSize:12}}>Memuat...</div>
        ):riwayat.log.length===0?(
          <EmptyState title="Belum ada riwayat" description="Sesi Produksi Stok yang Anda simpan akan muncul di sini."/>
        ):riwayat.log.map((l:any)=>{
          const b=riwayat.batch.find((x:any)=>x.id===l.batch_id);
          const k=b?namaKomp(b.komponen_id,riwayat.komponen):null;
          return(
            <div key={l.id} style={{border:"1px solid #eef0f3",borderRadius:10,padding:"9px 12px",marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:8}}>
                <span style={{fontWeight:700,fontSize:12.5,color:"#1e293b"}}>{k?.nama||"Batch #"+l.batch_id} · {l.tahap}</span>
                <span style={{fontWeight:800,fontSize:12.5,color:WARNA}}>{l.qty_sesi_ini} pcs{l.qty_reject_sesi_ini>0&&<span style={{color:"#dc2626"}}> ({l.qty_reject_sesi_ini}R)</span>}</span>
              </div>
              <div style={{fontSize:10.5,color:"#94a3b8",marginTop:2}}>{new Date(l.created_at).toLocaleString("id-ID",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}{l.catatan?` · ${l.catatan}`:""}</div>
            </div>
          );
        }))}
      </SectionCard>
    </div>
  );
}
