file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_perbaiki_posisi", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

# Hapus blok lightbox yang nyasar DAN penutup asli yang ganda, gabung jadi 1 struktur benar
OLD = '''      </div>
    </div>
  );
}

      {lightbox&&(
        <div onClick={()=>setLightbox(null)}
          style={{position:"fixed" as const,inset:0,background:"rgba(0,0,0,0.85)",zIndex:200,display:"flex",flexDirection:"column" as const,alignItems:"center",justifyContent:"center",padding:20}}>
          <button onClick={()=>setLightbox(null)}
            style={{position:"absolute" as const,top:16,right:16,width:36,height:36,borderRadius:99,background:"rgba(255,255,255,0.15)",color:"#fff",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <i className="ti ti-x" style={{fontSize:18}}/>
          </button>
          <img src={lightbox.url} onClick={(e:any)=>e.stopPropagation()} style={{maxWidth:"100%",maxHeight:"75vh",borderRadius:8,objectFit:"contain" as const}}/>
          <div onClick={(e:any)=>e.stopPropagation()} style={{marginTop:16,textAlign:"center"as const,color:"#fff"}}>
            <div style={{fontSize:13,fontWeight:600}}>{lightbox.name||"Foto QC"}</div>
            <div style={{fontSize:11,color:"#cbd5e1",marginTop:2}}>
              Diupload oleh {lightbox.uploaded_by}{lightbox.uploaded_at?" \u00b7 "+new Date(lightbox.uploaded_at).toLocaleString("id-ID"):""}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NameplateView({user}:any){'''

NEW = '''      </div>
      {lightbox&&(
        <div onClick={()=>setLightbox(null)}
          style={{position:"fixed" as const,inset:0,background:"rgba(0,0,0,0.85)",zIndex:200,display:"flex",flexDirection:"column" as const,alignItems:"center",justifyContent:"center",padding:20}}>
          <button onClick={()=>setLightbox(null)}
            style={{position:"absolute" as const,top:16,right:16,width:36,height:36,borderRadius:99,background:"rgba(255,255,255,0.15)",color:"#fff",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <i className="ti ti-x" style={{fontSize:18}}/>
          </button>
          <img src={lightbox.url} onClick={(e:any)=>e.stopPropagation()} style={{maxWidth:"100%",maxHeight:"75vh",borderRadius:8,objectFit:"contain" as const}}/>
          <div onClick={(e:any)=>e.stopPropagation()} style={{marginTop:16,textAlign:"center" as const,color:"#fff"}}>
            <div style={{fontSize:13,fontWeight:600}}>{lightbox.name||"Foto QC"}</div>
            <div style={{fontSize:11,color:"#cbd5e1",marginTop:2}}>
              Diupload oleh {lightbox.uploaded_by}{lightbox.uploaded_at?" \u00b7 "+new Date(lightbox.uploaded_at).toLocaleString("id-ID"):""}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NameplateView({user}:any){'''

count = content.count(OLD)
print(f"  PATTERN occurrences: {count}")

if count == 1:
    content = content.replace(OLD, NEW, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Lightbox sekarang berada DI DALAM function, posisi struktur sudah benar")
    print("[INFO] Jalankan: npm run build")
else:
    print(f"[FAIL] PATTERN occurrences = {count}, bukan 1. TIDAK menyimpan apapun")
