import shutil
import sys

PATH = r"C:\Users\User\vista-pekerja\src\main.tsx"

OLD = '''createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)'''

NEW = '''createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('Service worker registration failed:', err)
    })
  })
}'''

def main():
    shutil.copy(PATH, PATH + ".bak_sw")
    print(f"[OK] Backup dibuat: {PATH}.bak_sw")

    with open(PATH, "r", encoding="utf-8") as f:
        content = f.read()

    count = content.count(OLD)
    if count != 1:
        print(f"[FAIL] Pattern OLD ditemukan {count} kali (harus tepat 1). Tidak ada perubahan disimpan.")
        sys.exit(1)

    content = content.replace(OLD, NEW)

    with open(PATH, "w", encoding="utf-8") as f:
        f.write(content)

    print("[OK] Service worker berhasil didaftarkan di main.tsx")
    print("Selanjutnya jalankan: npm run build")

if __name__ == "__main__":
    main()
