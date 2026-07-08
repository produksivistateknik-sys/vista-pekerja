FILE_PATH = r"C:\Users\User\vista-pekerja\src\App.tsx"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    content = f.read()

idx = content.find("checkpointLogEntries")
if idx == -1:
    print("TIDAK DITEMUKAN sama sekali! checkpointLogEntries gak ada di file ini.")
else:
    count = content.count("checkpointLogEntries")
    print(f"Ditemukan {count}x kemunculan 'checkpointLogEntries'\n")
    start = 0
    occurrence = 0
    while True:
        idx = content.find("checkpointLogEntries", start)
        if idx == -1:
            break
        occurrence += 1
        line_no = content[:idx].count("\n") + 1
        snippet_start = max(0, idx-100)
        snippet_end = min(len(content), idx+150)
        print(f"--- Kemunculan #{occurrence} di baris {line_no} ---")
        print(content[snippet_start:snippet_end])
        print()
        start = idx + 1

print("Selesai.")
