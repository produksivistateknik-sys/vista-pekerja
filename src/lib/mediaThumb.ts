// ─────────────────────────────────────────────────────────────────────────────
// Klasifikasi tipe media dari objek foto {url,mime?,name?} - dipakai bareng di
// tempat yang render thumbnail foto QC (grid + FotoZoomViewerPekerja). SENGAJA
// treat "tanpa field mime" sebagai gambar (bukan video/file) - semua foto lama
// yang udah kesimpan SEBELUM fitur video/file ini gak punya field mime sama
// sekali, jadi harus tetap ke-render persis kayak sebelumnya (<img>), gak
// boleh ada regresi ke data lama.
// ─────────────────────────────────────────────────────────────────────────────
export type MediaFoto={url:string,mime?:string,name?:string,uploaded_by?:string,uploaded_at?:string};

export const isVideoFoto=(f:MediaFoto):boolean=>!!f.mime&&f.mime.startsWith("video/");
export const isGenericFoto=(f:MediaFoto):boolean=>!!f.mime&&!f.mime.startsWith("image/")&&!f.mime.startsWith("video/");
