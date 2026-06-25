file_path = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_hapus_premature_v2", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

# Cek dulu apakah masih dalam kondisi broken original, atau sudah ke kondisi v1 (yang masih salah)
OLD_ORIGINAL = '''      </div>
    </div>
  );
}

      {lightbox&&('''

OLD_V1 = '''      </div>
    </div>
      {lightbox&&('''

NEW = '''      </div>
      {lightbox&&('''

count_orig = content.count(OLD_ORIGINAL)
count_v1 = content.count(OLD_V1)
print(f"  Kondisi ORIGINAL (belum difix): {count_orig}")
print(f"  Kondisi V1 (fix pertama, masih salah): {count_v1}")

if count_orig == 1:
    content = content.replace(OLD_ORIGINAL, NEW, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Berhasil diperbaiki dari kondisi ORIGINAL")
    print("[INFO] Jalankan: npm run build")
elif count_v1 == 1:
    content = content.replace(OLD_V1, NEW, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Berhasil diperbaiki dari kondisi V1")
    print("[INFO] Jalankan: npm run build")
else:
    print("[FAIL] Tidak ada kondisi yang cocok, TIDAK menyimpan apapun")
    print("[INFO] Perlu cek manual kondisi file saat ini")
