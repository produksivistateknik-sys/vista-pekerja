import shutil
import sys
from datetime import datetime

FILE_PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

def read_file():
    with open(FILE_PATH, "r", encoding="utf-8") as f:
        return f.read()

def write_file(content):
    with open(FILE_PATH, "w", encoding="utf-8") as f:
        f.write(content)

def apply_edit(content, old, new, label):
    count = content.count(old)
    if count == 0:
        print(f"GAGAL [{label}]: pattern tidak ditemukan.")
        print(old)
        sys.exit(1)
    if count > 1:
        print(f"GAGAL [{label}]: ditemukan {count}x.")
        sys.exit(1)
    print(f"OK [{label}]")
    return content.replace(old, new)


backup_path = FILE_PATH + f".bak_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
shutil.copy2(FILE_PATH, backup_path)
print(f"Backup: {backup_path}\n")

content = read_file()

old1 = '''  const [page,setPage]=useState("landing");
  const [user,setUser]=useState<any>(null);

  const cfg=user?DIVISI_CONFIG[user.divisi]:null;

  if(page==="landing") return <LandingPage onEnter={()=>setPage("login")}/>;
  if(!user) return <Login onLogin={(u:any)=>{setUser(u);setPage("app");}}/>;'''

new1 = '''  const [user,setUser]=useState<any>(()=>{
    try{
      const saved=localStorage.getItem("vista_pekerja_session");
      return saved?JSON.parse(saved):null;
    }catch{return null;}
  });
  const [page,setPage]=useState<string>(()=>{
    try{
      return localStorage.getItem("vista_pekerja_session")?"app":"landing";
    }catch{return "landing";}
  });

  const cfg=user?DIVISI_CONFIG[user.divisi]:null;

  if(page==="landing") return <LandingPage onEnter={()=>setPage("login")}/>;
  if(!user) return <Login onLogin={(u:any)=>{
    setUser(u);
    try{localStorage.setItem("vista_pekerja_session",JSON.stringify(u));}catch{}
    setPage("app");
  }}/>;'''

content = apply_edit(content, old1, new1, "Edit 1: Restore session dari localStorage")

old2 = '''            <button onClick={()=>{setUser(null);setPage("landing");}}'''

new2 = '''            <button onClick={()=>{setUser(null);try{localStorage.removeItem("vista_pekerja_session");}catch{}setPage("landing");}}'''

content = apply_edit(content, old2, new2, "Edit 2: Clear session pas logout")

write_file(content)
print("\nBerhasil! Lanjut npm run build.")
