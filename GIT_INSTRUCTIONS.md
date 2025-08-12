## Menggunakan Git dengan render.yaml

### Persiapan dan Push ke GitHub

Berikut adalah langkah-langkah untuk menambahkan file render.yaml ke repositori Git dan mendorongnya ke GitHub:

```bash
# 1. Pastikan Anda berada di direktori root proyek
cd d:\webupload

# 2. Periksa status perubahan
git status

# 3. Tambahkan file render.yaml ke staging
git add render.yaml

# 4. Tambahkan juga file DEPLOYMENT.md yang telah diperbarui
git add DEPLOYMENT.md

# 5. Buat commit dengan pesan yang informatif
git commit -m "Add render.yaml for automated deployment and update deployment docs"

# 6. Dorong perubahan ke repositori GitHub
git push origin main
```

### Jika mengalami error saat push

Jika Anda mendapatkan error saat melakukan push, berikut adalah beberapa situasi umum dan solusinya:

#### 1. Error: Remote branch tidak ditemukan
```
error: src refspec main does not match any
```

Solusi: Pastikan nama branch lokal dan remote sesuai (biasanya 'main' atau 'master')
```bash
# Periksa branch yang Anda gunakan saat ini
git branch

# Jika branch adalah 'master' tapi remote menggunakan 'main'
git checkout -b main
git push origin main
```

#### 2. Error: Remote memiliki perubahan yang belum Anda ambil
```
error: failed to push some refs... updates were rejected...
```

Solusi: Ambil perubahan dari remote terlebih dahulu
```bash
# Ambil perubahan dari remote
git pull origin main

# Selesaikan konflik jika ada, lalu push kembali
git push origin main
```

#### 3. Error: Remote berbeda dengan ekspektasi
```
error: remote origin already exists
```

Solusi: Periksa dan update remote jika perlu
```bash
# Periksa konfigurasi remote saat ini
git remote -v

# Jika perlu mengupdate URL
git remote set-url origin https://github.com/kiradn1337/webupload.git
```

### Setelah berhasil push

Setelah berhasil mendorong perubahan ke GitHub, Anda dapat:

1. Buka repositori GitHub di browser
2. Verifikasi bahwa file `render.yaml` dan perubahan pada `DEPLOYMENT.md` telah ditambahkan
3. Login ke dashboard Render.com dan deploy aplikasi menggunakan Blueprint yang telah dibuat

### Catatan Penting

- Pastikan semua variabel rahasia (secrets) ditambahkan melalui dashboard Render, bukan di file render.yaml
- Sesuaikan region dan plan di render.yaml jika diperlukan sebelum melakukan deployment
