# ESP32 Flash Tools

Web berbahasa Indonesia untuk menulis firmware `.bin` ke ESP32 melalui USB, menggunakan Web Serial dan esptool-js. File diproses di browser tanpa diunggah ke server.

Desktop menggunakan Web Serial. Android menggunakan WebUSB melalui webserial-core. Pilih `CP210x` untuk ESP32 DevKit yang memakai adaptor Silicon Labs (`VID 0x10c4`), atau `USB native · ESP32-S3` untuk port USB internal S3 (`VID 0x303a`). Sambungkan board memakai adaptor USB OTG dan Google Chrome. Sebelum memilih perangkat, tahan BOOT, tekan lalu lepaskan EN/RESET, kemudian lepaskan BOOT. Mode Android melewati reset otomatis dan berkomunikasi langsung dengan ROM bootloader. Setelah flash selesai, tekan EN/RESET.

## Menjalankan

Gunakan Node.js 22.12+.

```sh
npm install
npm run dev
```

Buka alamat localhost yang ditampilkan Vite menggunakan Chrome atau Edge desktop. Untuk hosting, jalankan `npm run build` lalu sajikan folder `dist` melalui HTTPS. Konfigurasi dasar mengasumsikan hosting pada root domain.

## Penggunaan

1. Sambungkan ESP32 memakai kabel USB data dan tutup Serial Monitor/aplikasi lain yang memakai port.
2. Pilih kecepatan upload, klik **Hubungkan ESP32**, lalu pilih port perangkat.
3. Pilih satu file firmware aplikasi `.bin`.
4. Klik **Flash firmware**. Tunggu penulisan dan verifikasi MD5 selesai.
5. Aplikasi mengirim reset dan menutup koneksi. Tekan EN/RESET jika diperlukan. Hubungkan ulang sebelum flash berikutnya.

Web ini ditujukan untuk pembaruan firmware aplikasi melalui kabel, mirip OTA. File ditulis otomatis ke alamat aplikasi standar `0x10000`; pengguna tidak perlu mengisi alamat. Bootloader, tabel partisi, dan data lain tidak dihapus. Karena itu, perangkat harus sudah memiliki bootloader dan tabel partisi yang menempatkan aplikasi pada `0x10000`. Gunakan file aplikasi hasil export/build, bukan merged binary atau paket yang berisi bootloader dan partisi.

Penulisan menimpa sektor yang dituju tanpa menghapus seluruh flash. Progres mencapai 100% setelah penulisan dan pemeriksaan MD5 berhasil. Kapasitas diperiksa memakai hasil deteksi esptool-js; library versi 0.6.1 memakai fallback 4 MB untuk ID flash yang tidak dikenal, yang tercatat pada log.

Jika koneksi gagal, coba 115200 baud, periksa kabel/driver/izin port, atau tahan BOOT sambil menekan lalu melepas EN/RESET sebelum menghubungkan. Lepas BOOT setelah chip terdeteksi. Firefox dan Safari belum menjadi target aplikasi ini. Alamat HTTP jaringan lokal biasa tidak memenuhi syarat secure context untuk Web Serial.

## Pemeriksaan

```sh
npm test
npm run build
```

Tes otomatis memeriksa validasi berkas dan alamat aplikasi otomatis. Pengujian flash fisik membutuhkan board ESP32 dan firmware yang sesuai; build atau tes perangkat lunak tidak membuktikan keberhasilan flash pada hardware.

Referensi: [esptool-js Espressif](https://espressif.github.io/esptool-js/docs/) dan [Web Serial API](https://developer.chrome.com/docs/capabilities/serial).
