import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { Lbl, Card, SectionCard, EmptyState, CardToggle, SearchableSelect } from "./ui/Primitives";
import { DIVISI_CONFIG } from "../lib/panelTypes";

// ─────────────────────────────────────────────────────────────────────────────
// TAB PERMINTAAN BARANG (BBMB & BBMU) - sistem request/approve pengeluaran
// komponen. Independen total dari modul lama (komponen_stok/Warehouse progress
// panel) - tabel sendiri permintaan/permintaan_item.
// BBMB & BBMU sekarang STRUKTUR SAMA PERSIS (REVISI 2 Sep 2026 - lihat sejarah di bawah), komponen
// dari komponen_master (kategori BBMB/BBMU, hasil import DATABASE_BARU - REVISI.xlsx: 550 BBMB +
// 1.424 BBMU). Satuan TIDAK bebas ketik - dipilih dari satuan_list komponen itu (dropdown kalau
// >1 opsi, label otomatis read-only kalau cuma 1) - field ini reaktif: begitu komponen dipilih/
// diganti di dropdown "Pilih Komponen", satuanList & satuanDipilih ikut update/reset otomatis.
//
// RIWAYAT: BBMB awalnya (dan sampai 2 Sep 2026) sumbernya tabel LAMA komponen_bbmb_master
// (satuan cuma teks bebas, gak ada satuan_list) - dipindah ke komponen_master supaya field
// Satuan bisa reaktif kayak di atas (permintaan operator eksplisit: "field Satuan otomatis dari
// master, bukan input manual"). Tabel lama TIDAK dihapus, sekarang beneran gak dipakai sama
// sekali (sisi Database Gudang juga sudah pindah duluan).
// BBMU sempat DISEDERHANAKAN 14 Agu 2026 jadi 1 row header/catatan bebas (TIDAK pakai
// permintaan_item), tapi gak pernah ada data yang kepakai format itu (0 baris BBMU waktu
// direvisi balik 2 Sep 2026) - jadi gak ada migrasi data yang diperlukan.
//
// PENYATUAN PENUH (3 Sep 2026) - KEPUTUSAN FINAL: BBMB & BBMU PERSIS SAMA di semua sisi, satu-
// satunya beda adalah kategori data komponen (master BBMB vs BBMU), BUKAN status/layout. Status
// BBMU dulu beda vocab (tersedia/belum_lengkap/belum_datang, gak ada reject) - sekarang SAMA
// PERSIS BBMB (pending/submit/reject), disimpan di kolom permintaan_item.status yang sama (kolom
// text bebas, gak ada enum constraint - konfirmasi langsung ke migration, gak perlu migrasi DB).
// Konfirmasi "sudah diambil" sekarang berlaku BBMU juga, bukan BBMB doang.
// Tab ini SENGAJA muncul buat SEMUA divisi (gak dikondisikan kayak tab Komponen/Arsip), jadi
// App.tsx render ini tanpa cek user.divisi.
// ─────────────────────────────────────────────────────────────────────────────

type Jenis="BBMB"|"BBMU";
type ItemRow={value:string;namaKomponen:string;qty:number;satuanList:string[];satuanDipilih:string};

// Status SAMA PERSIS buat BBMB & BBMU (REVISI 3 Sep 2026) - dulu Record<Jenis,...> per jenis
// (vocab beda), sekarang cuma 1 mapping generik dipakai keduanya.
const STATUS_LABEL:Record<string,string>={pending:"Menunggu",submit:"✓ Sudah Siap",reject:"✕ Ditolak"};
const STATUS_COLOR:Record<string,string>={pending:"#94a3b8",submit:"#16a34a",reject:"#dc2626"};

const emptyItem=():ItemRow=>({value:"",namaKomponen:"",qty:1,satuanList:[],satuanDipilih:""});

// Supabase/PostgREST default cap 1000 baris tanpa .range() - komponen_master kategori BBMU
// sendirian udah 1.424 baris (lebih dari cap), jadi WAJIB paginasi penuh di sini, bukan
// .select() polos (persis kasus renhar/activity_log yang pernah kejadian sebelumnya).
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

const selStyle:any={width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid #cbd5e1",fontSize:14,fontWeight:600,color:"#0f172a",background:"#fff",fontFamily:"inherit"};
const inpStyle:any={width:"100%",padding:"8px 10px",borderRadius:8,border:"1.5px solid #cbd5e1",fontSize:13,fontWeight:600,color:"#0f172a",background:"#fff",fontFamily:"inherit"};

export function PermintaanView({user}:{user:any}){
  const namaOperator=user?.nama||user?.name||"Operator";
  const divisi:string=user?.divisi||"";
  const subBagian:string|null=user?.sub_bagian||null;
  const cfg=(DIVISI_CONFIG as any)[divisi];
  const accent:string=cfg?.color||"#0d9488";

  const[jenisTab,setJenisTab]=useState<Jenis>("BBMB");

  const[woList,setWoList]=useState<any[]>([]);
  const[selectedWoId,setSelectedWoId]=useState<number|null>(null);
  const[panelList,setPanelList]=useState<any[]>([]);
  const[selectedPanelId,setSelectedPanelId]=useState<number|null>(null);

  const[masterList,setMasterList]=useState<any[]>([]); // komponen_master, di-scope ke kategori=jenisTab
  // Guard race condition (2 Sep 2026, pola sama kayak DatabaseGudangTab.tsx - ketemu bug nyata di
  // situ) - toggle BBMB/BBMU cepat bisa bikin fetch lama nyampe belakangan & nimpa hasil fetch
  // yang lebih baru. Ref nyimpen jenis TERAKHIR yang diminta, response yang gak match lagi dibuang.
  const latestJenisRef=useRef<Jenis>("BBMB");

  const[items,setItems]=useState<ItemRow[]>([emptyItem()]); // BBMB & BBMU (REVISI 2 Sep 2026 - dulu BBMU cuma catatan bebas)
  const[submitting,setSubmitting]=useState(false);

  const[riwayat,setRiwayat]=useState<any[]>([]);
  const[loadingRiwayat,setLoadingRiwayat]=useState(true);
  const[confirmingId,setConfirmingId]=useState<number|null>(null);
  // Filter tanggal per hari (REVISI 2 Sep 2026, pola sama persis kayak RiwayatGudangTab.tsx sisi
  // Gudang) - Riwayat Permintaan operator dulu cuma nampilin 30 terakhir tanpa filter waktu.
  const[tanggal,setTanggal]=useState(new Date().toISOString().slice(0,10));

  // Lock permintaan dari Gudang (2 Sep 2026) - gudang_lock_status (1 baris, id=1). Realtime supaya
  // begitu Gudang kunci, form kirim langsung ke-block di semua device operator tanpa perlu refresh.
  // Riwayat Permintaan di bawah TETAP bisa dilihat walau terkunci - cuma form kirim baru yang diblokir.
  const[gudangLocked,setGudangLocked]=useState(false);
  useEffect(()=>{
    const fetchLock=async()=>{
      const{data}=await supabase.from("gudang_lock_status").select("is_locked").eq("id",1).single();
      setGudangLocked(data?.is_locked??false);
    };
    fetchLock();
    const ch=supabase.channel("realtime-permintaan-lock-status")
      .on("postgres_changes",{event:"*",schema:"public",table:"gudang_lock_status"},fetchLock)
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);

  useEffect(()=>{
    supabase.from("work_orders").select("id,wo,proyek").eq("is_archived",false).order("created_at",{ascending:false})
      .then(({data})=>setWoList(data??[]));
  },[]);

  useEffect(()=>{
    const jenisDiminta=jenisTab;
    latestJenisRef.current=jenisDiminta;
    fetchAllPaged((from,to)=>supabase.from("komponen_master").select("id,nama,satuan_utama,satuan_list").eq("kategori",jenisDiminta).order("nama",{ascending:true}).range(from,to))
      .then(data=>{ if(latestJenisRef.current===jenisDiminta)setMasterList(data); });
  },[jenisTab]);

  useEffect(()=>{
    setSelectedPanelId(null);
    setItems([emptyItem()]);
    if(selectedWoId){
      supabase.from("panels").select("id,no_pnl,nama,tipe,wo_id,checklist").eq("wo_id",selectedWoId).is("deleted_at",null)
        .order("no_pnl",{ascending:true}).then(({data})=>setPanelList(data??[]));
    } else {
      setPanelList([]);
    }
  },[selectedWoId]);

  useEffect(()=>{
    setItems([emptyItem()]);
  },[selectedPanelId,jenisTab]);

  // Riwayat SE-DIVISI (bukan cuma milik operator yang sedang login) - siapapun yang login di
  // divisi yang sama bisa lihat & konfirmasi pengambilan permintaan siapa saja di divisi itu,
  // gak dibatasi harus operator yang sama dengan yang minta.
  // "Aktif" = masih pending (belum diproses Gudang), baru berubah status dan belum dilihat, ATAU
  // (BBMB) sudah disiapkan tapi belum dikonfirmasi diambil - dipakai buat ngurutin (yang butuh
  // perhatian naik ke atas) DAN nentuin mana yang ditandai "sudah dibaca" begitu list ini tampil.
  const fetchRiwayat=async()=>{
    setLoadingRiwayat(true);
    const startIso=tanggal+"T00:00:00";
    const endIso=tanggal+"T23:59:59.999";
    const{data:perms}=await supabase.from("permintaan").select("*")
      .eq("jenis",jenisTab).eq("divisi",divisi)
      .gte("created_at",startIso).lte("created_at",endIso)
      .order("created_at",{ascending:false}).limit(30);
    // REVISI (2 Sep 2026) - BBMB & BBMU sekarang SAMA-SAMA per-item lewat permintaan_item, gak
    // ada lagi cabang terpisah header-only buat BBMU. Bedanya cuma di definisi "aktif" (BBMB
    // punya tahap sudah_diambil, BBMU enggak - BBMU beres begitu Gudang set status non-pending).
    if(perms&&perms.length>0){
      const ids=perms.map((p:any)=>p.id);
      const{data:itemRows}=await supabase.from("permintaan_item").select("*").in("permintaan_id",ids);
      const map:Record<number,any[]>={};
      (itemRows||[]).forEach((it:any)=>{(map[it.permintaan_id]=map[it.permintaan_id]||[]).push(it);});
      const merged=perms.map((p:any)=>({...p,items:map[p.id]||[]}));
      // PENYATUAN PENUH (3 Sep 2026) - dulu gate jenisTab==="BBMB" di kondisi terakhir (BBMU
      // dikecualikan dari "masih aktif nunggu diambil"). Sekarang BBMU juga punya tahap
      // pengambilan fisik sama seperti BBMB, jadi kondisinya berlaku buat keduanya.
      const isAktif=(p:any)=>(p.items||[]).some((it:any)=>
        it.status==="pending"||!it.dilihat_operator||(it.status==="submit"&&!it.sudah_diambil));
      merged.sort((a:any,b:any)=>{
        const diff=Number(isAktif(b))-Number(isAktif(a));
        return diff!==0?diff:(b.created_at||"").localeCompare(a.created_at||"");
      });
      setRiwayat(merged);
      const unreadIds=(itemRows||[]).filter((it:any)=>it.status!=="pending"&&!it.dilihat_operator).map((it:any)=>it.id);
      if(unreadIds.length>0)supabase.from("permintaan_item").update({dilihat_operator:true}).in("id",unreadIds).then(()=>{});
    } else {
      setRiwayat([]);
    }
    setLoadingRiwayat(false);
  };

  useEffect(()=>{
    fetchRiwayat();
    const ch=supabase.channel(`realtime-permintaan-${jenisTab}-${divisi}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"permintaan_item"},()=>fetchRiwayat())
      .on("postgres_changes",{event:"*",schema:"public",table:"permintaan"},()=>fetchRiwayat())
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[jenisTab,divisi,tanggal]);

  // Konfirmasi pengambilan fisik - SEKARANG dari sisi operator (bukan Gudang lagi, lihat
  // TarikGudangTab.tsx yang sudah jadi read-only). Siapapun yang login saat ini yang
  // mengonfirmasi (dicatat di diambil_oleh), gak harus operator yang sama dengan operator_nama
  // permintaan aslinya. Berlaku BBMB & BBMU (PENYATUAN PENUH 3 Sep 2026 - dulu BBMB saja).
  const konfirmasiDiambil=async(itemId:number)=>{
    setConfirmingId(itemId);
    await supabase.from("permintaan_item").update({
      sudah_diambil:true,diambil_oleh:namaOperator,diambil_at:new Date().toISOString(),
    }).eq("id",itemId);
    setConfirmingId(null);
    fetchRiwayat();
  };

  const updateItem=(idx:number,patch:Partial<ItemRow>)=>{
    setItems(prev=>prev.map((it,i)=>i===idx?{...it,...patch}:it));
  };
  const tambahBaris=()=>setItems(prev=>[...prev,emptyItem()]);
  const hapusBaris=(idx:number)=>setItems(prev=>prev.length<=1?prev:prev.filter((_,i)=>i!==idx));

  // Komponen dari komponen_master (BBMB & BBMU sama-sama, REVISI 2 Sep 2026 - field Satuan
  // sekarang OTOMATIS dari satuan_list komponen yang dipilih, operator gak bisa ketik manual lagi
  // sama sekali) - default satuanDipilih = satuan_utama (kalau valid ada di satuan_list), fallback
  // opsi pertama. Ganti komponen -> satuanList/satuanDipilih OTOMATIS reset ke komponen baru
  // (overwrite penuh tiap kali dipanggil, gak ada sisa dari komponen sebelumnya).
  const onPilihKomponen=(idx:number,id:string,label:string)=>{
    const m=masterList.find((x:any)=>String(x.id)===id);
    const satuanList:string[]=m?.satuan_list||[];
    const satuanDefault=m?.satuan_utama&&satuanList.includes(m.satuan_utama)?m.satuan_utama:(satuanList[0]||"");
    updateItem(idx,{value:id,namaKomponen:label,satuanList,satuanDipilih:satuanDefault});
  };

  const submitPermintaan=async()=>{
    if(gudangLocked){alert("Gudang sedang tutup - permintaan tidak bisa dikirim saat ini.");return;}
    if(!selectedWoId){alert("Pilih Work Order dulu");return;}
    if(!selectedPanelId){alert("Pilih Panel dulu");return;}
    const itemsValid=items.filter(it=>it.namaKomponen&&Number(it.qty)>0);
    if(itemsValid.length===0){alert("Isi minimal 1 komponen dengan qty lebih dari 0");return;}
    setSubmitting(true);
    const woObj=woList.find((w:any)=>w.id===selectedWoId);
    const panelObj=panelList.find((p:any)=>p.id===selectedPanelId);
    const{data:perm,error:permErr}=await supabase.from("permintaan").insert({
      jenis:jenisTab,operator_nama:namaOperator,divisi,sub_bagian:subBagian,
      wo_id:selectedWoId,panel_id:selectedPanelId,
      wo_number:woObj?.wo||null,proyek:woObj?.proyek||null,panel_nama:panelObj?.nama||null,
    }).select().single();
    if(permErr||!perm){
      alert("Gagal mengirim permintaan: "+(permErr?.message||"unknown error"));
      setSubmitting(false);
      return;
    }
    // REVISI (2 Sep 2026) - BBMB & BBMU sekarang SAMA PERSIS strukturnya, satu bentuk row buat
    // keduanya (dulu 2 cabang beda FK/sumber satuan). komponen_bbmb_master_id (kolom lama) gak
    // pernah ditulis lagi - kedua jenis sekarang eksklusif referensi komponen_master_id.
    const rows=itemsValid.map(it=>({
      permintaan_id:perm.id,
      komponen_master_id:it.value?Number(it.value):null,
      nama_komponen:it.namaKomponen,
      qty:Number(it.qty),
      satuan:it.satuanDipilih||null,
      satuan_dipilih:it.satuanDipilih||null,
      status:"pending",
    }));
    const{error:itemErr}=await supabase.from("permintaan_item").insert(rows);
    if(itemErr){
      alert("Permintaan tersimpan tapi gagal simpan komponen: "+itemErr.message);
      setSubmitting(false);
      return;
    }
    // Push notif ke Gudang - fitur tambahan, GAGAL DI SINI TIDAK BOLEH gagalin permintaan yang
    // udah tersimpan di atas, makanya dibungkus try/catch sendiri & gak di-await sebagai kondisi.
    try{
      await supabase.functions.invoke("notify-permintaan",{body:{
        trigger:"baru",jenis:jenisTab,operatorNama:namaOperator,divisi,
        proyek:woObj?.proyek||null,panelNama:panelObj?.nama||null,jumlahItem:itemsValid.length,
      }});
    }catch{/* notifikasi gagal - diabaikan, permintaan tetap tersimpan */}
    setSubmitting(false);
    setSelectedWoId(null);
    setItems([emptyItem()]);
    alert("Permintaan berhasil dikirim!");
    fetchRiwayat();
  };

  const fmtDateTime=(d:string)=>d?new Date(d).toLocaleString("id-ID",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):"-";

  return(
    <div style={{padding:16}} className="fi">
      <SectionCard icon="📥" iconBg={cfg?.bg} title="Permintaan Barang" subtitle="Ajukan permintaan komponen bantu atau utama.">
        <CardToggle options={[{key:"BBMB",label:"BBMB (Bantu)",icon:"🧰"},{key:"BBMU",label:"BBMU (Utama)",icon:"⚙️"}]}
          value={jenisTab} onChange={setJenisTab} color={accent}/>
      </SectionCard>

      <div style={{marginBottom:14,display:"flex",alignItems:"center",gap:12,background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:12,padding:"12px 16px"}}>
        <div style={{width:40,height:40,borderRadius:10,background:accent,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:17,color:"#fff",fontWeight:800}}>
          {namaOperator.charAt(0).toUpperCase()}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <Lbl>Operator · Divisi</Lbl>
          <div style={{fontSize:14,fontWeight:800,color:"#0f172a"}}>{namaOperator} · {divisi}</div>
        </div>
        <span style={{background:cfg?.bg,color:accent,border:`1px solid ${accent}30`,borderRadius:20,
          padding:"3px 10px",fontSize:11,fontWeight:700,whiteSpace:"nowrap" as const,flexShrink:0}}>
          {cfg?.icon} {subBagian||cfg?.label||divisi}
        </span>
      </div>

      {/* Lock permintaan (2 Sep 2026) - Gudang bisa "tutup" penerimaan baru, form WO/Panel/Komponen
          diganti catatan ini. Riwayat di bawah TETAP tampil apa adanya - cuma form kirim yang diblokir. */}
      {gudangLocked?(
        <div style={{marginBottom:20,padding:"16px",borderRadius:14,background:"#fef2f2",border:"1.5px solid #fecaca",display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:24}}>🔒</span>
          <div>
            <div style={{fontWeight:800,fontSize:14,color:"#991b1b"}}>Gudang Sedang Tutup</div>
            <div style={{fontSize:12,color:"#b91c1c",marginTop:2}}>Permintaan tidak bisa dikirim saat ini. Coba lagi nanti.</div>
          </div>
        </div>
      ):(
      <>
      <div style={{marginBottom:14}}>
        <Lbl>Work Order</Lbl>
        <select value={selectedWoId??""} onChange={(e:any)=>setSelectedWoId(e.target.value?Number(e.target.value):null)} style={selStyle}>
          <option value="">Pilih Work Order...</option>
          {woList.map((w:any)=><option key={w.id} value={w.id}>{w.wo} — {w.proyek}</option>)}
        </select>
      </div>

      {selectedWoId&&(
        <div style={{marginBottom:14}}>
          <Lbl>Panel</Lbl>
          <select value={selectedPanelId??""} onChange={(e:any)=>setSelectedPanelId(e.target.value?Number(e.target.value):null)} style={selStyle}>
            <option value="">Pilih Panel...</option>
            {panelList.map((p:any)=><option key={p.id} value={p.id}>#{p.no_pnl} {p.nama} ({p.tipe})</option>)}
          </select>
          {panelList.length===0&&<div style={{fontSize:12,color:"#94a3b8",marginTop:6}}>Belum ada panel untuk WO ini</div>}
        </div>
      )}

      {/* BBMB & BBMU sekarang 1 blok form yang sama persis (REVISI 2 Sep 2026 - dulu 2 blok
          terpisah, BBMB satuan ketik bebas + BBMU dari dropdown). Satuan SELALU dari
          komponen_master.satuan_list (masterList di-scope per jenisTab di useEffect atas),
          operator gak bisa ketik satuan manual lagi sama sekali di jenis manapun. */}
      {selectedWoId&&selectedPanelId&&(
        <>
          <Lbl>Daftar Komponen</Lbl>
          <div style={{display:"flex",flexDirection:"column" as const,gap:12,marginBottom:10}}>
            {items.map((it,idx)=>(
              <div key={idx} style={{background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:12,padding:14}}>
                <SearchableSelect options={masterList.map((m:any)=>({id:String(m.id),label:m.nama}))} value={it.value}
                  onChange={(id,label)=>onPilihKomponen(idx,id,label)} placeholder="Ketik nama komponen..."/>
                <div style={{display:"flex",alignItems:"flex-end",gap:8,marginTop:10}}>
                  <div style={{flex:1}}>
                    <Lbl>Satuan</Lbl>
                    {it.satuanList.length>1?(
                      <select value={it.satuanDipilih} onChange={(e:any)=>updateItem(idx,{satuanDipilih:e.target.value})} style={inpStyle}>
                        {it.satuanList.map((s:string)=><option key={s} value={s}>{s}</option>)}
                      </select>
                    ):(
                      <div style={{...inpStyle,display:"flex",alignItems:"center",color:it.satuanDipilih?"#0f172a":"#94a3b8",background:"#f8fafc"}}>
                        {it.satuanDipilih||"— pilih komponen dulu —"}
                      </div>
                    )}
                  </div>
                  <div style={{display:"flex",alignItems:"center",border:"1.5px solid #cbd5e1",borderRadius:8,overflow:"hidden",flexShrink:0}}>
                    <button onClick={()=>updateItem(idx,{qty:Math.max(1,it.qty-1)})}
                      style={{width:32,height:34,border:"none",background:"#f8fafc",color:"#475569",fontSize:16,fontWeight:700,cursor:"pointer"}}>−</button>
                    <input type="number" min="1" value={it.qty} onChange={(e:any)=>updateItem(idx,{qty:Math.max(1,Number(e.target.value))})}
                      style={{width:40,height:34,border:"none",borderLeft:"1px solid #e2e8f0",borderRight:"1px solid #e2e8f0",textAlign:"center" as const,fontSize:14,fontWeight:700,color:"#0f172a",background:"#fff",fontFamily:"inherit"}}/>
                    <button onClick={()=>updateItem(idx,{qty:it.qty+1})}
                      style={{width:32,height:34,border:"none",background:"#f8fafc",color:"#475569",fontSize:16,fontWeight:700,cursor:"pointer"}}>+</button>
                  </div>
                  <button onClick={()=>hapusBaris(idx)} disabled={items.length<=1}
                    style={{width:34,height:34,borderRadius:8,border:"1px solid #fecaca",background:items.length<=1?"#f8fafc":"#fef2f2",
                      color:items.length<=1?"#cbd5e1":"#dc2626",cursor:items.length<=1?"default":"pointer",fontSize:15,fontWeight:700,flexShrink:0}}>×</button>
                </div>
              </div>
            ))}
          </div>
          <button onClick={tambahBaris} style={{width:"100%",padding:"10px",borderRadius:10,border:"1.5px dashed #cbd5e1",background:"#f8fafc",color:"#64748b",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit",marginBottom:16}}>
            + Tambah Komponen Lagi
          </button>

          <button onClick={submitPermintaan} disabled={submitting}
            style={{width:"100%",padding:"14px",borderRadius:10,border:"none",
              background:submitting?"#94a3b8":accent,
              color:"#fff",fontSize:15,fontWeight:700,cursor:submitting?"default":"pointer",fontFamily:"inherit",marginBottom:20}}>
            {submitting?"Mengirim...":"Kirim Permintaan"}
          </button>
        </>
      )}
      </>
      )}

      <div style={{height:1,background:"#f1f5f9",margin:"4px 0 16px"}}/>

      <Lbl>Riwayat Permintaan Divisi ({jenisTab})</Lbl>
      <input type="date" value={tanggal} onChange={(e:any)=>setTanggal(e.target.value)}
        style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid #cbd5e1",fontSize:14,fontWeight:600,color:"#0f172a",background:"#fff",fontFamily:"inherit",marginBottom:12}}/>
      {loadingRiwayat?(
        <div style={{textAlign:"center" as const,padding:30,color:"#94a3b8",fontSize:13}}>Memuat...</div>
      ):riwayat.length===0?(
        <EmptyState variant="box-paper" title={`Belum ada permintaan ${jenisTab}`}
          description="Permintaan dari divisi ini akan muncul di sini."/>
      ):(
        <div style={{display:"flex",flexDirection:"column" as const,gap:10}}>
          {riwayat.map((r:any)=>(
            <Card key={r.id} style={{padding:"14px 16px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                <div>
                  <div style={{fontWeight:800,fontSize:13,color:"#0f172a"}}>{r.proyek||"-"} · {r.panel_nama||"-"}</div>
                  <div style={{fontSize:10.5,color:"#94a3b8"}}>{r.wo_number||"-"}</div>
                </div>
                <span style={{fontSize:10.5,fontWeight:600,color:"#94a3b8",whiteSpace:"nowrap" as const}}>{fmtDateTime(r.created_at)}</span>
              </div>
              {/* PENYATUAN PENUH (3 Sep 2026) - dulu 2 blok terpisah (BBMB ada tombol konfirmasi
                  diambil, BBMU cuma badge status). Sekarang 1 blok yang sama buat keduanya -
                  konfirmasi "sudah diambil" berlaku BBMU juga, bukan BBMB doang. */}
              <div style={{display:"flex",flexDirection:"column" as const,gap:6}}>
                {(r.items||[]).map((it:any)=>(
                  <div key={it.id} style={{background:"#f8fafc",borderRadius:8,padding:"6px 10px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                      <span style={{fontSize:12.5,fontWeight:600,color:"#334155",flex:1,minWidth:0}}>{it.nama_komponen} <span style={{color:"#64748b",fontWeight:500}}>×{it.qty}{it.satuan?` ${it.satuan}`:""}</span></span>
                      {/* REVISI (2 Sep 2026) - badge dulu macet di "Disiapkan" walau sudah_diambil
                          udah true (baris "Sudah diambil oleh..." di bawah cuma nambah, badge
                          atas gak ikut ganti). Sekarang badge nunjukin status TERKINI - begitu
                          sudah_diambil, badge BERUBAH jadi "Sudah Diambil" (gantiin, bukan numpuk). */}
                      {(()=>{
                        const badgeLabel=it.sudah_diambil?"✓ Sudah Diambil":(STATUS_LABEL[it.status]||it.status);
                        const badgeColor=it.sudah_diambil?"#0369a1":STATUS_COLOR[it.status];
                        return(
                          <span style={{background:badgeColor+"18",color:badgeColor,
                            borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700,whiteSpace:"nowrap" as const}}>
                            {badgeLabel}
                          </span>
                        );
                      })()}
                    </div>
                    {it.status==="submit"&&!it.sudah_diambil&&(
                      <button onClick={()=>konfirmasiDiambil(it.id)} disabled={confirmingId===it.id}
                        style={{width:"100%",marginTop:6,padding:"7px",borderRadius:7,border:"none",
                          background:confirmingId===it.id?"#94a3b8":accent,color:"#fff",fontWeight:700,fontSize:11,
                          cursor:confirmingId===it.id?"default":"pointer",fontFamily:"inherit"}}>
                        {confirmingId===it.id?"Menyimpan...":"Konfirmasi Sudah Diambil"}
                      </button>
                    )}
                    {it.sudah_diambil&&(
                      <div style={{marginTop:6,fontSize:10.5,color:"#16a34a",fontWeight:700}}>
                        ✓ Sudah diambil oleh {it.diambil_oleh||"-"} — {fmtDateTime(it.diambil_at)}
                      </div>
                    )}
                  </div>
                ))}
                {(r.items||[]).some((it:any)=>it.status==="reject"&&it.catatan_reject)&&(
                  <div style={{fontSize:11,color:"#dc2626",marginTop:2}}>
                    {(r.items||[]).filter((it:any)=>it.status==="reject"&&it.catatan_reject).map((it:any)=>(
                      <div key={it.id}>⚠ {it.nama_komponen}: {it.catatan_reject}</div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
