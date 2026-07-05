import shutil
from datetime import datetime

FILE_PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"
RESTORE_FROM = r"C:\Users\User\vista-pekerja\src\App.tsx.bak_20260705_095931"

# Backup dulu state SEKARANG (yang mau ditinggalkan), just in case
safety_backup = FILE_PATH + f".bak_before_restore_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
shutil.copy2(FILE_PATH, safety_backup)
print(f"📦 State sekarang di-backup dulu ke: {safety_backup}")

# Restore
shutil.copy2(RESTORE_FROM, FILE_PATH)
print(f"✅ App.tsx berhasil di-restore dari: {RESTORE_FROM}")
print("\nLanjut: npm run build untuk pastiin gak ada error.")
