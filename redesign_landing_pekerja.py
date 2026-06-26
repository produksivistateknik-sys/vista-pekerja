import shutil
import sys

PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"
LOGO_TXT_PATH = r"C:\Users\User\vista-pekerja\logo_hd_base64_pekerja.txt"

EXPECTED_LENGTH = 95028

def main():
    try:
        with open(LOGO_TXT_PATH, "r", encoding="utf-8") as f:
            logo_b64 = f.read().strip()
    except FileNotFoundError:
        print(f"[FAIL] File {LOGO_TXT_PATH} tidak ditemukan.")
        print("Pastikan logo_hd_base64_pekerja.txt sudah didownload dan ditaruh di folder root vista-pekerja (sejajar package.json).")
        sys.exit(1)

    print(f"[INFO] Panjang base64 dari file: {len(logo_b64)}")
    if len(logo_b64) != EXPECTED_LENGTH:
        print(f"[FAIL] Panjang base64 tidak sesuai ekspektasi ({EXPECTED_LENGTH}). Ditemukan: {len(logo_b64)}. Tidak ada perubahan disimpan.")
        sys.exit(1)

    with open(PATH, "r", encoding="utf-8") as f:
        lines = f.readlines()

    start_idx = 175
    end_idx = 301

    if "function LandingPage" not in lines[start_idx]:
        print(f"[FAIL] Baris {start_idx+1} bukan 'function LandingPage'. Isinya: {repr(lines[start_idx])}")
        print("Tidak ada perubahan disimpan.")
        sys.exit(1)

    if lines[end_idx].strip() != "}":
        print(f"[FAIL] Baris {end_idx+1} bukan penutup '}}'. Isinya: {repr(lines[end_idx])}")
        print("Tidak ada perubahan disimpan.")
        sys.exit(1)

    new_landing = '''function LandingPage({onEnter}:any){
  return(
    <div style={{minHeight:"100vh",width:"100%",background:"#ffffff",fontFamily:"'Plus Jakarta Sans',sans-serif",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:24,padding:24}}>
      <style>{`
        @keyframes landFadeIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        .land-logo{animation:landFadeIn .6s cubic-bezier(.22,1,.36,1) forwards}
        .land-tagline{animation:landFadeIn .6s .15s cubic-bezier(.22,1,.36,1) both}
        .land-cta{animation:landFadeIn .6s .3s cubic-bezier(.22,1,.36,1) both}
        .land-cta-btn:hover{background:#e06a10!important;transform:translateY(-1px)}
        .land-cta-btn{transition:all .18s!important}
      `}</style>
      <img src="data:image/png;base64,''' + logo_b64 + '''" alt="Vista Teknik" className="land-logo" style={{width:260,height:"auto"}}/>
      <p className="land-tagline" style={{fontSize:15,color:"#64748b",margin:0,textAlign:"center",letterSpacing:.3}}>Your electrical safety is our priority</p>
      <button onClick={onEnter} className="land-cta land-cta-btn"
        style={{marginTop:16,padding:"13px 36px",borderRadius:10,border:"none",background:"#f47920",color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
        Masuk ke Aplikasi
      </button>
    </div>
  );
}'''

    shutil.copy(PATH, PATH + ".bak_landingpekerja")
    print(f"[OK] Backup dibuat: {PATH}.bak_landingpekerja")

    new_lines = lines[:start_idx] + [new_landing + "\n"] + lines[end_idx+1:]

    with open(PATH, "w", encoding="utf-8") as f:
        f.writelines(new_lines)

    print(f"[OK] LandingPage (baris {start_idx+1}-{end_idx+1}) berhasil diganti dengan desain minimalis")
    print("Ringkasan:")
    print("  - Logo HD (base64, sama dengan Vista Teknik) tampil besar di tengah")
    print("  - Tagline: 'Your electrical safety is our priority'")
    print("  - Tombol 'Masuk ke Aplikasi' warna oranye")
    print("  - Setelah klik tombol, lanjut ke halaman form login (hero kiri + form kanan) seperti biasa")
    print("Selanjutnya jalankan: npm run build")

if __name__ == "__main__":
    main()
