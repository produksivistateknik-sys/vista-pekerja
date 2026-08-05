import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { DIVISI_CONFIG } from "../lib/panelTypes";
import { GCss } from "../lib/globalCss";

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN - dipisah dari App.tsx (Sprint 7)
// ─────────────────────────────────────────────────────────────────────────────
export function Login({onLogin}:any){
  const [div,setDiv]=useState("mekanik");
  const [username,setUsername]=useState("");
  const [userList,setUserList]=useState<any[]>([]);
  const [pekerjaOptions,setPekerjaOptions]=useState<any[]>([]);
  const [pekerjaTerpilihId,setPekerjaTerpilihId]=useState("");
  const [namaManualTeks,setNamaManualTeks]=useState("");
  const [pwd,setPwd]=useState("");
  const [err,setErr]=useState("");
  const [show,setShow]=useState(false);
  const [loading,setLoading]=useState(false);
  const [success,setSuccess]=useState(false);

  const operatorDivisi=Object.entries(DIVISI_CONFIG)
    .filter(([k])=>k!=="admin")
    .map(([k,v]:any)=>({key:k,...v}));

  useEffect(()=>{
    if(div){
      supabase.from("operator_users").select("id,nama,username").eq("divisi",div).eq("is_active",true)
        .then(({data})=>{setUserList(data??[]);setUsername("");});
      supabase.from("pekerja").select("id,nama,divisi").eq("divisi",div)
        .then(({data})=>{setPekerjaOptions(data??[]);setPekerjaTerpilihId("");});
      setSubBagianTerpilih(null);
      setNamaManualTeks("");
    }
  },[div]);

  const isManualName=!!(DIVISI_CONFIG as any)[div]?.manualName;
  const subBagianOptions=(DIVISI_CONFIG as any)[div]?.subBagianPassword;
  const [subBagianTerpilih,setSubBagianTerpilih]=useState<string|null>(null);

  const go=async()=>{
    if(isManualName&&subBagianOptions){
      if(!subBagianTerpilih){setErr("Pilih sub-bagian dulu!");return;}
      // Warehouse/QS ketik nama manual (bebas, gak perlu terdaftar di tabel pekerja) - beda
      // dari sub-bagian lain yang masih wajib pilih dari daftar pekerja terdaftar.
      const isNamaBebas=subBagianTerpilih==="Warehouse"||subBagianTerpilih==="QS";
      if(isNamaBebas){
        if(!namaManualTeks.trim()){setErr("Ketik nama kamu!");return;}
      } else if(!pekerjaTerpilihId){setErr("Pilih nama kamu!");return;}
      if(!pwd){setErr("Masukkan password!");return;}
      setLoading(true);
      const{data:pwRow,error:pwErr}=await supabase.from("fcs_sub_bagian_password").select("password").eq("sub_bagian",subBagianTerpilih).single();
      const expectedPwd=pwErr?subBagianOptions[subBagianTerpilih]:pwRow?.password;
      if(pwd!==expectedPwd){setErr("Password salah!");setLoading(false);return;}
      if(isNamaBebas){
        const namaBebas=namaManualTeks.trim();
        setSuccess(true);
        setTimeout(()=>onLogin({id:0,nama:namaBebas,name:namaBebas,divisi:div,sub_bagian:subBagianTerpilih}),800);
        setLoading(false);
        return;
      }
      const pekerjaTerpilih=pekerjaOptions.find((p:any)=>String(p.id)===pekerjaTerpilihId);
      if(!pekerjaTerpilih){setErr("Data pekerja gak valid, coba pilih ulang.");setLoading(false);return;}
      setSuccess(true);
      setTimeout(()=>onLogin({id:pekerjaTerpilih.id,nama:pekerjaTerpilih.nama,name:pekerjaTerpilih.nama,divisi:div,sub_bagian:subBagianTerpilih}),800);
      setLoading(false);
      return;
    }
    if(isManualName){
      if(!pekerjaTerpilihId){setErr("Pilih nama kamu!");return;}
      if(!pwd){setErr("Masukkan password!");return;}
      setLoading(true);
      const expectedPwd=(DIVISI_CONFIG as any)[div]?.password;
      if(pwd!==expectedPwd){setErr("Password salah!");setLoading(false);return;}
      const pekerjaTerpilih=pekerjaOptions.find((p:any)=>String(p.id)===pekerjaTerpilihId);
      if(!pekerjaTerpilih){setErr("Data pekerja gak valid, coba pilih ulang.");setLoading(false);return;}
      setSuccess(true);
      setTimeout(()=>onLogin({id:pekerjaTerpilih.id,nama:pekerjaTerpilih.nama,name:pekerjaTerpilih.nama,divisi:div}),800);
      setLoading(false);
      return;
    }
    if(!username){setErr("Pilih nama!");return;}
    if(!pwd){setErr("Masukkan password!");return;}
    setLoading(true);
    // Password di-hash (bcrypt) - verifikasi lewat RPC yang compare pakai crypt() di server,
    // bukan compare plaintext di WHERE client-side kayak sebelumnya.
    const{data,error}=await supabase.rpc("verify_operator_login",{p_username:username,p_password:pwd}).single();
    if(error||!data){setErr("Password salah!");setLoading(false);return;}
    await supabase.from("operator_users").update({last_login:new Date().toISOString()}).eq("id",(data as any).id);
    const{password:_pw,...safeData}=data as any;
    setSuccess(true);
    setTimeout(()=>onLogin({...safeData,name:safeData.nama}),800);
    setLoading(false);
  };

  const css=`
    @keyframes lgFadeIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
    @keyframes lgSpin{to{transform:rotate(360deg)}}
    .lg-card{animation:lgFadeIn .5s cubic-bezier(.22,1,.36,1) forwards}
    .lg-inp{width:100%;height:48px;padding:0 16px 0 46px;border-radius:10px;border:1.5px solid #e2e8f0;background:#f8fafc;color:#0f172a;font-size:16px;font-family:inherit;outline:none;transition:border .2s,box-shadow .2s}
    .lg-inp:focus{border-color:#2563eb;background:#fff;box-shadow:0 0 0 3px rgba(37,99,235,.12)}
    .lg-inp.err{border-color:#f87171}
    .lg-sel{width:100%;height:48px;padding:0 16px 0 46px;border-radius:10px;border:1.5px solid #e2e8f0;background:#f8fafc;color:#0f172a;font-size:16px;font-family:inherit;outline:none;cursor:pointer;appearance:none}
    .lg-sel:focus{border-color:#2563eb;background:#fff;box-shadow:0 0 0 3px rgba(37,99,235,.12)}
    .lg-btn{width:100%;height:50px;border-radius:10px;border:none;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 4px 14px rgba(37,99,235,.3)}
    .lg-btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 8px 24px rgba(37,99,235,.4)}
    .lg-btn:disabled{opacity:.75;cursor:not-allowed}
    .lg-btn.success{background:linear-gradient(135deg,#16a34a,#15803d)}
    .lg-spinner{width:16px;height:16px;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;border-radius:50%;animation:lgSpin .65s linear infinite}
    .lg-label{font-size:11px;font-weight:700;color:#475569;margin-bottom:6px;letter-spacing:.3px;text-transform:uppercase}
    .lg-icon{position:absolute;left:14px;top:50%;transform:translateY(-50%);font-size:15px;color:#94a3b8;pointer-events:none}
    .lg-eye{position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#94a3b8;font-size:14px;padding:4px}
    .lg-err{background:#fef2f2;border:1px solid #fecaca;color:#dc2626;border-radius:10px;padding:11px 14px;font-size:13px;display:flex;align-items:center;gap:8px;margin-top:12px}
    .lg-success-overlay{position:fixed;inset:0;background:rgba(255,255,255,.92);display:flex;align-items:center;justify-content:center;z-index:9999}
    .div-tab{flex:1;padding:10px 8px;min-height:48px;border:none;cursor:pointer;font-size:11px;font-weight:700;font-family:inherit;transition:all .15s;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px}
    .subbagian-btn{flex:1;min-width:90px;min-height:44px;padding:10px 8px;border-radius:8px;cursor:pointer;font-weight:700;font-size:12px;font-family:inherit}
    .lg-outer{min-height:100vh;min-height:100dvh;}
    @media(max-width:700px){
      .lg-left{display:none!important}
      .lg-right{width:100%!important;align-items:flex-start!important;overflow-y:auto!important;
        padding:max(24px,calc(env(safe-area-inset-top) + 12px)) 20px max(24px,calc(env(safe-area-inset-bottom) + 12px)) 20px!important;}
    }
  `;


  return(
    <div className="lg-outer" style={{width:"100%",display:"flex",background:"#f1f5f9"}}>
      <style>{GCss}</style>
      <style>{css}</style>
      {success&&(
        <div className="lg-success-overlay">
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:64}}>✅</div>
            <div style={{marginTop:12,fontSize:16,fontWeight:700,color:"#16a34a"}}>Login berhasil!</div>
          </div>
        </div>
      )}
      {/* Left panel */}
      <div className="lg-left" style={{width:"45%",background:"linear-gradient(145deg,#0f172a,#1e3a8a 45%,#1d4ed8 100%)",
        display:"flex",flexDirection:"column",padding:"44px 48px",color:"#fff",position:"relative",overflow:"hidden",flexShrink:0}}>
        <div style={{position:"absolute",top:-80,right:-80,width:320,height:320,borderRadius:"50%",background:"rgba(255,255,255,.04)"}}/>
        <div style={{position:"absolute",bottom:-60,left:-60,width:240,height:240,borderRadius:"50%",background:"rgba(255,255,255,.03)"}}/>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:48,position:"relative",zIndex:1}}>
          <div style={{width:42,height:42,background:"rgba(255,255,255,.15)",borderRadius:11,border:"1px solid rgba(255,255,255,.25)",
            display:"flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{color:"#fff",fontWeight:900,fontSize:19}}>V</span>
          </div>
          <div>
            <div style={{fontWeight:800,fontSize:15,letterSpacing:.3}}>Vista Teknik</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,.55)",fontWeight:500}}>Electrical Switchboard Manufacturing</div>
          </div>
        </div>
        <div style={{position:"relative",zIndex:1}}>
          <div style={{fontSize:28,fontWeight:800,lineHeight:1.3,marginBottom:12}}>Portal Operator<br/>Vista Pekerja</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,.7)",lineHeight:1.8,marginBottom:28,maxWidth:300}}>
            Pilih divisi dan masukkan username + password untuk mengakses jadwal produksi harian Anda.
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {["Jadwal kerja harian","Update progress real-time","Monitoring per shift","Laporan produksi"].map((f:string)=>(
              <div key={f} style={{display:"flex",alignItems:"center",gap:10,fontSize:13}}>
                <div style={{width:26,height:26,borderRadius:7,background:"rgba(255,255,255,.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,flexShrink:0}}>✓</div>
                <span style={{color:"rgba(255,255,255,.82)",fontWeight:500}}>{f}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{fontSize:11,color:"rgba(255,255,255,.38)",marginTop:"auto",paddingTop:32,position:"relative",zIndex:1}}>
          2026 Vista Teknik. All rights reserved.
        </div>
      </div>
      {/* Right panel */}
      <div className="lg-right" style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"48px 40px"}}>
        <div className="lg-card" style={{width:"100%",maxWidth:420,background:"#fff",borderRadius:20,
          padding:"32px 36px",boxShadow:"0 4px 6px rgba(0,0,0,.04),0 24px 60px rgba(0,0,0,.08)"}}>
          <div style={{marginBottom:20}}>
            <div style={{fontSize:22,fontWeight:700,color:"#0f172a",marginBottom:4}}>Selamat datang</div>
            <div style={{fontSize:13,color:"#64748b"}}>Masuk ke akun operator Anda</div>
          </div>
          {/* Divisi tabs */}
          <div style={{marginBottom:16}}>
            <div className="lg-label">Divisi</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap" as const}}>
              {operatorDivisi.map((d:any)=>(
                <button key={d.key} className="div-tab" onClick={()=>setDiv(d.key)}
                  style={{background:div===d.key?d.color+"18":"#f8fafc",
                    border:`1.5px solid ${div===d.key?d.color:"#e2e8f0"}`,
                    color:div===d.key?d.color:"#64748b"}}>
                  <span style={{fontSize:16}}>{d.icon}</span>
                  <span style={{fontSize:10}}>{d.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div style={{height:1,background:"#f1f5f9",marginBottom:16}}/>
          {subBagianOptions&&(
            <div style={{marginBottom:16}}>
              <div className="lg-label">Sub-bagian</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap" as const}}>
                {Object.keys(subBagianOptions).map((sb:string)=>(
                  <button key={sb} type="button" className="subbagian-btn" onClick={()=>{setSubBagianTerpilih(sb);setErr("");setNamaManualTeks("");setPekerjaTerpilihId("");}}
                    style={{
                      border:`1.5px solid ${subBagianTerpilih===sb?"#0d9488":"#e2e8f0"}`,
                      background:subBagianTerpilih===sb?"#0d948818":"#f8fafc",
                      color:subBagianTerpilih===sb?"#0d9488":"#64748b"}}>
                    {sb}
                  </button>
                ))}
              </div>
            </div>
          )}
          {/* Nama */}
          <div style={{marginBottom:12}}>
            <div className="lg-label">Nama</div>
            <div style={{position:"relative"}}>
              <span className="lg-icon">👤</span>
              {isManualName&&(subBagianTerpilih==="Warehouse"||subBagianTerpilih==="QS")?(
                <input className="lg-sel" type="text" value={namaManualTeks}
                  onChange={(e:any)=>{setNamaManualTeks(e.target.value);setErr("");}}
                  placeholder="Ketik nama kamu..."/>
              ):isManualName?(
                <>
                  <select className="lg-sel" value={pekerjaTerpilihId} onChange={(e:any)=>{setPekerjaTerpilihId(e.target.value);setErr("");}}>
                    <option value="">-- Pilih Nama --</option>
                    {pekerjaOptions.map((p:any)=><option key={p.id} value={p.id}>{p.nama}</option>)}
                  </select>
                  <span style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",fontSize:11,color:"#94a3b8",pointerEvents:"none"}}>▼</span>
                </>
              ):(
                <>
                  <select className="lg-sel" value={username} onChange={(e:any)=>{setUsername(e.target.value);setErr("");}}>
                    <option value="">-- Pilih Nama --</option>
                    {userList.map((u:any)=><option key={u.id} value={u.username}>{u.nama}</option>)}
                  </select>
                  <span style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",fontSize:11,color:"#94a3b8",pointerEvents:"none"}}>▼</span>
                </>
              )}
            </div>
          </div>
          {/* Password */}
          <div style={{marginBottom:4}}>
            <div className="lg-label">Password</div>
            <div style={{position:"relative"}}>
              <span className="lg-icon">🔒</span>
              <input className={"lg-inp"+(err?" err":"")} type={show?"text":"password"} value={pwd}
                onChange={(e:any)=>{setPwd(e.target.value);setErr("");}}
                onKeyDown={(e:any)=>e.key==="Enter"&&go()}
                placeholder="Masukkan password..." style={{paddingRight:44}}/>
              <button className="lg-eye" onClick={()=>setShow(!show)}>{show?"🙈":"👁"}</button>
            </div>
          </div>
          {err&&<div className="lg-err"><span>⚠️</span><span>{err}</span></div>}
          <button className={"lg-btn"+(success?" success":"")} onClick={go} disabled={loading||success} style={{marginTop:20}}>
            {loading?<><span className="lg-spinner"/><span>Memuat...</span></>
             :success?<><span>✓</span><span>Berhasil!</span></>
             :<><span>Masuk</span><span style={{fontSize:16}}>→</span></>}
          </button>
          <div style={{marginTop:16,paddingTop:14,borderTop:"1px solid #f1f5f9",textAlign:"center",fontSize:11,color:"#cbd5e1"}}>
            2026 Vista Teknik · Electrical Switchboard Manufacturing
          </div>
        </div>
      </div>
    </div>
  );
}
