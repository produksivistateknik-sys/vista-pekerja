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

# EDIT 1: shift/shiftSet - baca dari localStorage saat init, scoped per user+hari
old1 = '''  const [shift,setShift]=useState("1");
  const [shiftSet,setShiftSet]=useState(false);'''

new1 = '''  const wsKey=`vista_pekerja_ws_${user.divisi}_${user.sub_bagian||""}_${user.id||user.username||user.nama||""}`;
  const [shift,setShift]=useState(()=>{
    try{
      const saved=JSON.parse(localStorage.getItem(wsKey)||"{}");
      return saved.tanggal===TODAY&&saved.shift?saved.shift:"1";
    }catch{return "1";}
  });
  const [shiftSet,setShiftSet]=useState(()=>{
    try{
      const saved=JSON.parse(localStorage.getItem(wsKey)||"{}");
      return saved.tanggal===TODAY?!!saved.shiftSet:false;
    }catch{return false;}
  });
  useEffect(()=>{
    try{localStorage.setItem(wsKey,JSON.stringify({tanggal:TODAY,shift,shiftSet}));}catch{}
  },[shift,shiftSet,wsKey]);'''

content = apply_edit(content, old1, new1, "Edit 1: Persist shift/shiftSet")

# EDIT 2: selectedKomponen - baca dari localStorage saat init, scoped per user+hari
old2 = '''  const [selectedKomponen,setSelectedKomponen]=useState<Record<string,string[]>>({});'''

new2 = '''  const [selectedKomponen,setSelectedKomponen]=useState<Record<string,string[]>>(()=>{
    try{
      const saved=JSON.parse(localStorage.getItem(wsKey+"_komp")||"{}");
      return saved.tanggal===TODAY&&saved.data?saved.data:{};
    }catch{return {};}
  });
  useEffect(()=>{
    try{localStorage.setItem(wsKey+"_komp",JSON.stringify({tanggal:TODAY,data:selectedKomponen}));}catch{}
  },[selectedKomponen,wsKey]);'''

content = apply_edit(content, old2, new2, "Edit 2: Persist selectedKomponen")

write_file(content)
print("\nBerhasil! Lanjut npm run build.")
