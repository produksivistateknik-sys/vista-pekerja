from pathlib import Path
import re

APP_PATH = Path(r"C:\Users\User\vista-pekerja\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

def find_function_bounds(text, func_name):
    pattern = rf'\nfunction {re.escape(func_name)}\s*\('
    matches = list(re.finditer(pattern, text))
    if not matches:
        return -1, -1
    match = matches[0]
    func_start = match.start() + 1
    i = match.end()
    paren_depth = 1
    while i < len(text) and paren_depth > 0:
        if text[i] == '(': paren_depth += 1
        elif text[i] == ')': paren_depth -= 1
        i += 1
    while i < len(text) and text[i] != '{':
        i += 1
    if i >= len(text): return -1, -1
    depth = 0
    while i < len(text):
        if text[i] == '{': depth += 1
        elif text[i] == '}':
            depth -= 1
            if depth == 0: return func_start, i + 1
        i += 1
    return -1, -1

# ── NEW LANDING PAGE ──
NEW_LANDING = r"""function LandingPage({onEnter}:any){
  return(
    <div style={{minHeight:"100vh",width:"100%",background:"#f8fafc",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
      <style>{GCss}</style>
      <style>{`
        @keyframes float1{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-12px) rotate(-2deg)}}
        @keyframes float2{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @keyframes float3{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
        @keyframes landIn{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        .land-in{animation:landIn .6s cubic-bezier(.22,1,.36,1) forwards}
        .land-in-2{animation:landIn .6s .15s cubic-bezier(.22,1,.36,1) both}
        .land-in-3{animation:landIn .6s .3s cubic-bezier(.22,1,.36,1) both}
        .land-in-4{animation:landIn .6s .45s cubic-bezier(.22,1,.36,1) both}
        .cta-btn:hover{background:#1d4ed8!important;transform:translateY(-1px);box-shadow:0 8px 28px #2563eb44!important}
        .cta-btn{transition:all .18s!important}
        .feat-card:hover{transform:translateY(-3px);box-shadow:0 8px 24px #00000012!important}
        .feat-card{transition:all .2s}
        .nav-link{color:#475569;font-size:13px;font-weight:600;cursor:pointer;padding:6px 4px;border-bottom:2px solid transparent;transition:all .15s}
        .nav-link:hover{color:#1d4ed8;border-bottom-color:#1d4ed8}
      `}</style>
      <nav style={{background:"#fff",borderBottom:"1px solid #e2e8f0",padding:"0 48px",height:64,
        display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100,
        boxShadow:"0 1px 8px #00000008"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:32,height:32,background:"linear-gradient(135deg,#f97316,#ea580c)",borderRadius:8,
            display:"flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{color:"#fff",fontWeight:900,fontSize:15,letterSpacing:-1}}>V</span>
          </div>
          <div>
            <div style={{fontWeight:900,fontSize:15,color:"#1e293b",letterSpacing:.5,lineHeight:1}}>
              <span style={{color:"#ea580c"}}>VISTA</span> TEKNIK
            </div>
            <div style={{fontSize:8,color:"#94a3b8",fontWeight:600,letterSpacing:.8,textTransform:"uppercase"}}>Solusi Produksi Panel Listrik</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:28}}>
          {["Beranda","Produksi","Material","QC / Testing","Laporan"].map((l:string)=>(
            <span key={l} className="nav-link">{l}</span>
          ))}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:32,height:32,borderRadius:"50%",background:"#eff6ff",display:"flex",
            alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"#1d4ed8"}}>AD</div>
        </div>
      </nav>
      <div style={{maxWidth:1280,margin:"0 auto",padding:"72px 48px 80px",display:"grid",
        gridTemplateColumns:"1fr 1fr",gap:60,alignItems:"center"}}>
        <div>
          <div className="land-in" style={{display:"inline-flex",alignItems:"center",gap:8,
            background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:20,padding:"5px 14px",
            fontSize:12,fontWeight:700,color:"#1d4ed8",marginBottom:24}}>
            <span style={{width:7,height:7,borderRadius:"50%",background:"#3b82f6",display:"inline-block"}}/>
            Sistem Terintegrasi
          </div>
          <h1 className="land-in-2" style={{fontSize:52,fontWeight:900,lineHeight:1.1,color:"#0f172a",marginBottom:16}}>
            Your Electrical<br/><span style={{color:"#1d4ed8"}}>Safety Is Our Priority</span>
          </h1>
          <p className="land-in-3" style={{fontSize:15,color:"#64748b",lineHeight:1.8,marginBottom:36,maxWidth:400}}>
            Solusi lengkap untuk produksi panel listrik yang lebih cepat, akurat, dan terorganisir.
          </p>
          <div className="land-in-4" style={{display:"flex",gap:14,alignItems:"center"}}>
            <button className="cta-btn" onClick={onEnter}
              style={{background:"#2563eb",color:"#fff",fontWeight:800,fontSize:15,padding:"14px 32px",
                borderRadius:12,border:"none",cursor:"pointer",boxShadow:"0 4px 18px #2563eb33",
                display:"flex",alignItems:"center",gap:8}}>
              Masuk ke Aplikasi <span style={{fontSize:18}}>›</span>
            </button>
          </div>
        </div>
        <div style={{position:"relative",height:420,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{position:"absolute",width:380,height:380,borderRadius:"50%",
            background:"linear-gradient(135deg,#eff6ff 0%,#e0f2fe 100%)",zIndex:0}}/>
          <div style={{position:"relative",zIndex:1,animation:"float1 4s ease-in-out infinite"}}>
            <svg width="220" height="300" viewBox="0 0 220 300" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="20" y="10" width="180" height="280" rx="6" fill="#d1d5db" stroke="#9ca3af" strokeWidth="1.5"/>
              <rect x="26" y="16" width="168" height="268" rx="4" fill="#e5e7eb"/>
              <rect x="34" y="24" width="152" height="80" rx="3" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="1"/>
              <rect x="40" y="30" width="60" height="16" rx="2" fill="#9ca3af"/>
              <rect x="108" y="30" width="70" height="16" rx="2" fill="#9ca3af"/>
              <rect x="40" y="68" width="140" height="28" rx="2" fill="#374151" stroke="#1f2937" strokeWidth="1"/>
              <rect x="46" y="74" width="8" height="16" rx="1" fill="#f59e0b"/>
              <rect x="58" y="74" width="8" height="16" rx="1" fill="#f59e0b"/>
              <rect x="70" y="74" width="8" height="16" rx="1" fill="#ef4444"/>
              <rect x="82" y="74" width="8" height="16" rx="1" fill="#22c55e"/>
              <circle cx="148" cy="82" r="8" fill="#1f2937" stroke="#374151" strokeWidth="1"/>
              <rect x="34" y="112" width="152" height="120" rx="3" fill="#f9fafb" stroke="#d1d5db" strokeWidth="1"/>
              <polygon points="110,205 120,222 100,222" fill="#f59e0b"/>
              <text x="110" y="219" textAnchor="middle" fontSize="9" fill="#fff" fontWeight="bold">!</text>
            </svg>
          </div>
          <div style={{position:"absolute",top:30,left:-10,animation:"float2 3.5s ease-in-out infinite",
            background:"#fff",borderRadius:14,padding:"14px 18px",boxShadow:"0 8px 32px #00000018",minWidth:170,zIndex:2}}>
            <div style={{fontSize:11,color:"#64748b",fontWeight:600,marginBottom:4}}>Progress Produksi</div>
            <div style={{fontSize:28,fontWeight:900,color:"#2563eb",lineHeight:1}}>75%</div>
            <div style={{margin:"8px 0 6px",height:5,background:"#e2e8f0",borderRadius:99}}>
              <div style={{width:"75%",height:"100%",background:"#2563eb",borderRadius:99}}/>
            </div>
            <div style={{fontSize:10,color:"#22c55e",fontWeight:700}}>On Progress</div>
          </div>
          <div style={{position:"absolute",bottom:40,left:-10,animation:"float2 3.8s 1s ease-in-out infinite",
            background:"#fff",borderRadius:14,padding:"14px 18px",boxShadow:"0 8px 32px #00000018",minWidth:160,zIndex:2}}>
            <div style={{fontSize:11,color:"#64748b",fontWeight:600,marginBottom:4}}>QC Pass Rate</div>
            <div style={{display:"flex",alignItems:"baseline",gap:8}}>
              <div style={{fontSize:28,fontWeight:900,color:"#1d4ed8",lineHeight:1}}>98%</div>
              <div style={{fontSize:11,color:"#22c55e",fontWeight:700}}>4%</div>
            </div>
          </div>
        </div>
      </div>
      <div style={{background:"#fff",borderTop:"1px solid #f1f5f9",borderBottom:"1px solid #f1f5f9",padding:"32px 48px"}}>
        <div style={{maxWidth:1280,margin:"0 auto",display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:32}}>
          {[
            {icon:"\uD83D\uDD27",title:"Produksi",sub:"Kelola proses produksi"},
            {icon:"\uD83D\uDCE6",title:"Material",sub:"Stok & BOM"},
            {icon:"\uD83D\uDD0D",title:"QC / Testing",sub:"Kontrol kualitas"},
            {icon:"\uD83D\uDCCA",title:"Laporan",sub:"Data & laporan"},
          ].map((f:any)=>(
            <div key={f.title} className="feat-card" style={{display:"flex",alignItems:"center",gap:14,
              padding:"16px 20px",borderRadius:12,border:"1px solid #f1f5f9",cursor:"pointer"}}>
              <div style={{width:44,height:44,background:"#eff6ff",borderRadius:12,display:"flex",
                alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{f.icon}</div>
              <div>
                <div style={{fontWeight:800,fontSize:14,color:"#1e293b"}}>{f.title}</div>
                <div style={{fontSize:12,color:"#94a3b8",marginTop:2}}>{f.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{textAlign:"center",padding:"24px",fontSize:12,color:"#94a3b8"}}>
        2025 <span style={{color:"#ea580c",fontWeight:700}}>Vista Teknik</span>. All rights reserved.
      </div>
    </div>
  );
}
"""

# ── NEW LOGIN (operator only, username+password dari operator_users) ──
NEW_LOGIN = r"""function Login({onLogin}:any){
  const [username,setUsername]=useState("");
  const [pwd,setPwd]=useState("");
  const [err,setErr]=useState("");
  const [show,setShow]=useState(false);
  const [loading,setLoading]=useState(false);
  const [success,setSuccess]=useState(false);

  const go=async()=>{
    if(!username.trim()){setErr("Masukkan username!");return;}
    if(!pwd){setErr("Masukkan password!");return;}
    setLoading(true);
    const{data,error}=await supabase.from("operator_users").select("*")
      .eq("username",username.trim()).eq("password",pwd).eq("is_active",true).single();
    if(error||!data){setErr("Username atau password salah!");setLoading(false);return;}
    // update last_login
    await supabase.from("operator_users").update({last_login:new Date().toISOString()}).eq("id",data.id);
    setSuccess(true);
    setTimeout(()=>onLogin({...data,name:data.nama}),800);
    setLoading(false);
  };

  const css=`
    @keyframes lgFadeIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
    @keyframes lgSpin{to{transform:rotate(360deg)}}
    .lg-card{animation:lgFadeIn .5s cubic-bezier(.22,1,.36,1) forwards}
    .lg-inp{width:100%;height:52px;padding:0 16px 0 46px;border-radius:10px;border:1.5px solid #e2e8f0;background:#f8fafc;color:#0f172a;font-size:14px;font-family:inherit;outline:none;transition:border .2s,box-shadow .2s,background .2s}
    .lg-inp:focus{border-color:#2563eb;background:#fff;box-shadow:0 0 0 3px rgba(37,99,235,.12)}
    .lg-inp.err{border-color:#f87171;background:#fff8f8}
    .lg-inp::placeholder{color:#94a3b8}
    .lg-btn{width:100%;height:52px;border-radius:10px;border:none;background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);color:#fff;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:8px;letter-spacing:.2px;box-shadow:0 4px 14px rgba(37,99,235,.3)}
    .lg-btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 8px 24px rgba(37,99,235,.4)}
    .lg-btn:disabled{opacity:.75;cursor:not-allowed}
    .lg-btn.success{background:linear-gradient(135deg,#16a34a,#15803d)}
    .lg-spinner{width:16px;height:16px;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;border-radius:50%;animation:lgSpin .65s linear infinite}
    .lg-label{font-size:12px;font-weight:600;color:#475569;margin-bottom:7px;letter-spacing:.2px;text-transform:uppercase}
    .lg-icon{position:absolute;left:14px;top:50%;transform:translateY(-50%);font-size:15px;color:#94a3b8;pointer-events:none}
    .lg-eye{position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#94a3b8;font-size:14px;padding:4px;display:flex;align-items:center}
    .lg-err{background:#fef2f2;border:1px solid #fecaca;color:#dc2626;border-radius:10px;padding:11px 14px;font-size:13px;display:flex;align-items:center;gap:8px}
    .lg-success-overlay{position:fixed;inset:0;background:rgba(255,255,255,.92);display:flex;align-items:center;justify-content:center;z-index:9999;backdrop-filter:blur(4px)}
    @media(max-width:700px){.lg-left{display:none!important}.lg-right{width:100%!important;padding:24px!important}}
  `;

  return(
    <div style={{minHeight:"100vh",width:"100%",display:"flex",background:"#f1f5f9"}}>
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
      <div className="lg-left" style={{width:"45%",background:"linear-gradient(145deg,#0f172a 0%,#1e3a8a 45%,#1d4ed8 100%)",display:"flex",flexDirection:"column",padding:"44px 48px",color:"#fff",position:"relative",overflow:"hidden",flexShrink:0}}>
        <div style={{position:"absolute",top:-80,right:-80,width:320,height:320,borderRadius:"50%",background:"rgba(255,255,255,.04)"}}/>
        <div style={{position:"absolute",bottom:-60,left:-60,width:240,height:240,borderRadius:"50%",background:"rgba(255,255,255,.03)"}}/>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:56,position:"relative",zIndex:1}}>
          <div style={{width:42,height:42,background:"rgba(255,255,255,.15)",borderRadius:11,border:"1px solid rgba(255,255,255,.25)",display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(8px)"}}>
            <span style={{color:"#fff",fontWeight:900,fontSize:19,letterSpacing:-1}}>V</span>
          </div>
          <div>
            <div style={{fontWeight:800,fontSize:15,letterSpacing:.3,lineHeight:1.2}}>Vista Teknik</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,.55)",fontWeight:500,marginTop:2}}>Electrical Switchboard Manufacturing</div>
          </div>
        </div>
        <div style={{position:"relative",zIndex:1,marginBottom:28}}>
          <svg width="100%" height="130" viewBox="0 0 340 130" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="114" y="5" width="112" height="122" rx="5" fill="rgba(255,255,255,.09)" stroke="rgba(255,255,255,.28)" strokeWidth="2"/>
            <rect x="122" y="13" width="96" height="106" rx="3" fill="rgba(255,255,255,.05)"/>
            <rect x="126" y="31" width="88" height="20" rx="3" fill="rgba(29,78,216,.65)"/>
            <rect x="131" y="37" width="6" height="8" rx="1" fill="#f59e0b"/>
            <rect x="141" y="37" width="6" height="8" rx="1" fill="#f59e0b"/>
            <rect x="151" y="37" width="6" height="8" rx="1" fill="#ef4444"/>
            <rect x="161" y="37" width="6" height="8" rx="1" fill="#22c55e"/>
            <polygon points="170,100 178,114 162,114" fill="rgba(245,158,11,.75)"/>
            <text x="170" y="112" textAnchor="middle" fontSize="8" fill="#fff" fontWeight="bold">!</text>
          </svg>
        </div>
        <div style={{position:"relative",zIndex:1}}>
          <div style={{fontSize:26,fontWeight:800,lineHeight:1.3,marginBottom:12}}>
            Portal Operator<br/>Vista Pekerja
          </div>
          <div style={{fontSize:13,color:"rgba(255,255,255,.7)",lineHeight:1.8,marginBottom:28,maxWidth:300}}>
            Login menggunakan username dan password yang diberikan oleh admin.
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {[
              {i:"\uD83D\uDCCB",t:"Jadwal kerja harian"},
              {i:"\u26A1",t:"Update progress real-time"},
              {i:"\uD83D\uDD27",t:"Monitoring per shift"},
              {i:"\uD83D\uDCCA",t:"Laporan produksi"},
            ].map((f:any)=>(
              <div key={f.t} style={{display:"flex",alignItems:"center",gap:10,fontSize:13}}>
                <div style={{width:26,height:26,borderRadius:7,background:"rgba(255,255,255,.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0}}>{f.i}</div>
                <span style={{color:"rgba(255,255,255,.82)",fontWeight:500}}>{f.t}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{fontSize:11,color:"rgba(255,255,255,.38)",marginTop:"auto",paddingTop:32,position:"relative",zIndex:1}}>
          2026 Vista Teknik. All rights reserved.
        </div>
      </div>
      <div className="lg-right" style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"48px 64px"}}>
        <div className="lg-card" style={{width:"100%",maxWidth:440,background:"#fff",borderRadius:20,padding:"36px 40px",boxShadow:"0 4px 6px rgba(0,0,0,.04),0 24px 60px rgba(0,0,0,.08)"}}>
          <div style={{marginBottom:6}}>
            <div style={{fontSize:24,fontWeight:700,color:"#0f172a",marginBottom:5}}>Selamat datang</div>
            <div style={{fontSize:13,color:"#64748b"}}>Masuk ke akun operator Anda</div>
          </div>
          <div style={{height:1,background:"#f1f5f9",margin:"20px 0"}}/>
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            <div>
              <div className="lg-label">Username</div>
              <div style={{position:"relative"}}>
                <span className="lg-icon">{"\uD83D\uDC64"}</span>
                <input className={"lg-inp"+(err?" err":"")} value={username}
                  onChange={(e:any)=>{setUsername(e.target.value);setErr("");}}
                  onKeyDown={(e:any)=>e.key==="Enter"&&go()}
                  placeholder="Masukkan username..."/>
              </div>
            </div>
            <div>
              <div className="lg-label">Password</div>
              <div style={{position:"relative"}}>
                <span className="lg-icon">{"\uD83D\uDD12"}</span>
                <input className={"lg-inp"+(err?" err":"")} type={show?"text":"password"} value={pwd}
                  onChange={(e:any)=>{setPwd(e.target.value);setErr("");}}
                  onKeyDown={(e:any)=>e.key==="Enter"&&go()}
                  placeholder="Masukkan password..." style={{paddingRight:44}}/>
                <button className="lg-eye" onClick={()=>setShow(!show)}>{show?"\uD83D\uDE48":"\uD83D\uDC41"}</button>
              </div>
            </div>
          </div>
          {err&&(
            <div className="lg-err" style={{marginTop:16}}>
              <span>⚠️</span><span>{err}</span>
            </div>
          )}
          <button className={"lg-btn"+(success?" success":"")} onClick={go} disabled={loading||success} style={{marginTop:20}}>
            {loading?<><span className="lg-spinner"/><span>Memuat...</span></>
             :success?<><span>✓</span><span>Berhasil!</span></>
             :<><span>Masuk</span><span style={{fontSize:16}}>→</span></>}
          </button>
          <div style={{marginTop:20,paddingTop:16,borderTop:"1px solid #f1f5f9",textAlign:"center",fontSize:11,color:"#cbd5e1"}}>
            2026 Vista Teknik · Electrical Switchboard Manufacturing
          </div>
        </div>
      </div>
    </div>
  );
}
"""

# ── Replace LandingPage ──
print("🔄 Replace LandingPage...")
s1, e1 = find_function_bounds(content, "LandingPage")
if s1 == -1:
    print("❌ LandingPage tidak ditemukan!")
else:
    print(f"   Ditemukan karakter {s1}–{e1}")
    content = content[:s1] + NEW_LANDING + content[e1:]
    print("✅ LandingPage replaced")

# ── Replace Login ──
print("🔄 Replace Login...")
s2, e2 = find_function_bounds(content, "Login")
if s2 == -1:
    print("❌ Login tidak ditemukan!")
else:
    print(f"   Ditemukan karakter {s2}–{e2}")
    content = content[:s2] + NEW_LOGIN + content[e2:]
    print("✅ Login replaced")

# ── Fix fullscreen di GCss ──
old_css = '*{box-sizing:border-box;margin:0;padding:0}'
new_css = '*{box-sizing:border-box;margin:0;padding:0}html,body,#root{width:100%;height:100%;overflow-x:hidden}'
if old_css in content:
    content = content.replace(old_css, new_css)
    print("✅ Fullscreen CSS fixed")
else:
    print("⚠️  GCss not found")

APP_PATH.write_text(content, encoding="utf-8")
print("\n✅ Selesai! Jalankan: npm run dev di folder vista-pekerja")
