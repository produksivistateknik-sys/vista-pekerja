import shutil
import sys

PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

OLD_1 = '''function LandingPage({onEnter}:any){
  return(
    <div style={{minHeight:"100vh",width:"100%",background:"#ffffff",fontFamily:"'Plus Jakarta Sans',sans-serif",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:24,padding:24}}>
      <style>{`
        @keyframes landFadeIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        .land-logo{animation:landFadeIn .6s cubic-bezier(.22,1,.36,1) forwards}
        .land-tagline{animation:landFadeIn .6s .15s cubic-bezier(.22,1,.36,1) both}
        .land-cta{animation:landFadeIn .6s .3s cubic-bezier(.22,1,.36,1) both}
        .land-cta-btn:hover{background:#e06a10!important;transform:translateY(-1px)}
        .land-cta-btn{transition:all .18s!important}
      `}</style>'''

NEW_1 = '''function LandingPage({onEnter}:any){
  const [exiting,setExiting]=useState(false);

  const handleEnter=()=>{
    setExiting(true);
    setTimeout(()=>{onEnter();},400);
  };

  return(
    <div style={{minHeight:"100vh",width:"100%",background:"#ffffff",fontFamily:"'Plus Jakarta Sans',sans-serif",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:24,padding:24,
      opacity:exiting?0:1,transform:exiting?"scale(1.04)":"scale(1)",transition:"opacity .4s cubic-bezier(.4,0,.2,1),transform .4s cubic-bezier(.4,0,.2,1)"}}>
      <style>{`
        @keyframes landFadeIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        .land-logo{animation:landFadeIn .6s cubic-bezier(.22,1,.36,1) forwards}
        .land-tagline{animation:landFadeIn .6s .15s cubic-bezier(.22,1,.36,1) both}
        .land-cta{animation:landFadeIn .6s .3s cubic-bezier(.22,1,.36,1) both}
        .land-cta-btn:hover{background:#e06a10!important;transform:translateY(-1px)}
        .land-cta-btn{transition:all .18s!important}
      `}</style>'''

OLD_2 = '''      <button onClick={onEnter} className="land-cta land-cta-btn"'''

NEW_2 = '''      <button onClick={handleEnter} className="land-cta land-cta-btn"'''

EDITS = [
    ("EDIT 1 (state exiting & handleEnter)", OLD_1, NEW_1),
    ("EDIT 2 (tombol pakai handleEnter)", OLD_2, NEW_2),
]

def main():
    shutil.copy(PATH, PATH + ".bak_smoothtransition")
    print(f"[OK] Backup dibuat: {PATH}.bak_smoothtransition")

    with open(PATH, "r", encoding="utf-8") as f:
        content = f.read()

    failed = []
    for name, old, new in EDITS:
        count = content.count(old)
        if count != 1:
            failed.append((name, count))

    if failed:
        print("[FAIL] Ada pattern yang tidak ditemukan tepat 1 kali. Tidak ada perubahan disimpan.")
        for name, count in failed:
            print(f"  - {name}: ditemukan {count} kali")
        sys.exit(1)

    for name, old, new in EDITS:
        content = content.replace(old, new)
        print(f"[OK] {name} berhasil diterapkan")

    with open(PATH, "w", encoding="utf-8") as f:
        f.write(content)

    print("")
    print("[OK] SEMUA EDIT BERHASIL DITERAPKAN")
    print("Selanjutnya jalankan: npm run build")

if __name__ == "__main__":
    main()
