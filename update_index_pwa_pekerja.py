import shutil
import sys

PATH = r"C:\Users\User\vista-pekerja\index.html"

OLD = '''    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>vista-pekerja</title>'''

NEW = '''    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>vista-pekerja</title>
    <link rel="manifest" href="/manifest.json" />
    <meta name="theme-color" content="#f47920" />
    <link rel="apple-touch-icon" href="/icon-192.png" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="Vista Operator" />'''

def main():
    shutil.copy(PATH, PATH + ".bak_pwa")
    print(f"[OK] Backup dibuat: {PATH}.bak_pwa")

    with open(PATH, "r", encoding="utf-8") as f:
        content = f.read()

    count = content.count(OLD)
    if count != 1:
        print(f"[FAIL] Pattern OLD ditemukan {count} kali (harus tepat 1). Tidak ada perubahan disimpan.")
        sys.exit(1)

    content = content.replace(OLD, NEW)

    with open(PATH, "w", encoding="utf-8") as f:
        f.write(content)

    print("[OK] index.html berhasil ditambahkan link manifest dan meta tag PWA")
    print("Selanjutnya jalankan: npm run build")

if __name__ == "__main__":
    main()
