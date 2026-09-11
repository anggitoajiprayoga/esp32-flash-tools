import { ESPLoader, Transport, type FlashSizeValues } from 'esptool-js';
import { WebUsbProvider, type SerialProvider } from 'webserial-core';
import SparkMD5 from 'spark-md5';
import { APP_ADDRESS, validateFile, validateFirmware } from './firmware.mjs';
import './style.css';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const connectButton = $<HTMLButtonElement>('connect');
const flashButton = $<HTMLButtonElement>('flash');
const baudrate = $<HTMLSelectElement>('baudrate');
const androidUsbMode = $<HTMLSelectElement>('android-usb-mode');
const fileInput = $<HTMLInputElement>('firmware-input');
const dropzone = $('dropzone');
const progress = $<HTMLProgressElement>('progress');
const output = $('log');
const nativeSerial = 'serial' in navigator ? navigator.serial : null;
const usingWebUsb = !nativeSerial && 'usb' in navigator;
const supported = window.isSecureContext && (!!nativeSerial || usingWebUsb);
let port: SerialPort | null = null;
let transport: Transport | null = null;
let loader: ESPLoader | null = null;
let busy = false;
let flashing = false;
let disconnected = false;
let firmware: File | null = null;

if (usingWebUsb) {
  baudrate.value = '115200';
  $('android-usb-setting').hidden = false;
}

function getSerialApi(): Serial | SerialProvider | null {
  if (nativeSerial) return nativeSerial;
  if (!usingWebUsb) return null;
  if (androidUsbMode.value === 's3-native') return new WebUsbProvider();
  return new WebUsbProvider({
    usbControlInterfaceClass: 255,
    usbTransferInterfaceClass: 255,
    protocol: 'cp210x',
  });
}

function log(message: string) {
  output.textContent = ((output.textContent ?? '') + message).slice(-40000);
  output.scrollTop = output.scrollHeight;
}
function info(message: string) {
  log(`[${new Date().toLocaleTimeString('id-ID')}] ${message}\n`);
}
function setProgress(value: number, label: string) {
  progress.value = value;
  $('progress-value').textContent = `${Math.round(value)}%`;
  $('progress-label').textContent = label;
}
function updateControls() {
  connectButton.disabled = !supported || busy;
  connectButton.textContent = loader
    ? 'Putuskan koneksi'
    : busy
      ? 'Menghubungkan…'
      : usingWebUsb
        ? 'Hubungkan ESP32 (mode BOOT) ↗'
        : 'Hubungkan ESP32 ↗';
  baudrate.disabled = busy || !!loader;
  androidUsbMode.disabled = busy || !!loader;
  fileInput.disabled = busy;
  dropzone.classList.toggle('disabled', busy);
  document.querySelectorAll<HTMLButtonElement>('.remove-file').forEach(el => el.disabled = busy);
  let valid = false;
  try { validateFirmware(firmware); valid = true; } catch { /* Firmware belum dipilih. */ }
  flashButton.disabled = busy || !loader || !valid;
  flashButton.textContent = flashing ? 'Sedang mem-flash…' : '⚡ Flash firmware';
}
function setConnected(chip?: string) {
  const state = $('connection-state');
  state.classList.toggle('connected', !!chip);
  state.replaceChildren(document.createElement('i'), document.createTextNode(chip ? ' Terhubung' : ' Belum terhubung'));
  $('chip-name').textContent = chip || 'ESP32 Anda siap?';
  $('device-description').textContent = chip ? 'Perangkat terdeteksi. Siap menerima firmware.' : 'Gunakan kabel USB yang mendukung transfer data.';
}
async function releasePort() {
  const activeTransport = transport;
  const activePort = port;
  loader = null;
  try {
    if (activeTransport) await activeTransport.disconnect();
    else if (activePort?.readable) await activePort.close();
  } catch (error) {
    info(`Port tidak dapat ditutup sepenuhnya: ${error instanceof Error ? error.message : String(error)}. Cabut dan hubungkan kembali perangkat jika port masih sibuk.`);
  } finally {
    transport = null;
    port = null;
    setConnected();
  }
}
function showError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  info(`Kesalahan: ${message}`);
  $('progress-label').textContent = `Gagal: ${message}`;
}

connectButton.addEventListener('click', async () => {
  if (busy) return;
  busy = true;
  updateControls();
  try {
    if (loader) {
      await releasePort();
      setProgress(0, 'Koneksi diputus. Hubungkan kembali untuk flash.');
      info('Koneksi diputus.');
      return;
    }
    disconnected = false;
    const serialApi = getSerialApi();
    if (!serialApi) throw new Error('Browser tidak menyediakan akses USB serial.');
    const usbVendorId = androidUsbMode.value === 's3-native' ? 0x303a : 0x10c4;
    port = await serialApi.requestPort(usingWebUsb ? { filters: [{ usbVendorId }] } : undefined);
    transport = new Transport(port, true);
    const candidate = new ESPLoader({
      transport,
      baudrate: Number(baudrate.value),
      terminal: { clean: () => {}, writeLine: (line: string) => log(`${line}\n`), write: (text: string) => log(text) },
      debugLogging: false,
    });
    info(usingWebUsb
      ? `Android (${androidUsbMode.value === 's3-native' ? 'ESP32-S3 USB native' : 'CP210x'}): menghubungkan tanpa reset otomatis. ESP32 harus sudah berada dalam mode BOOT.`
      : 'Menghubungkan ke bootloader. Jika perlu, tahan tombol BOOT pada board.');
    setProgress(0, 'Mendeteksi perangkat…');
    const chip = await candidate.main(usingWebUsb ? 'no_reset' : 'default_reset');
    if (disconnected) throw new Error('Perangkat terlepas saat menghubungkan.');
    if (!chip.toUpperCase().startsWith('ESP32')) throw new Error(`Chip ${chip} tidak termasuk keluarga ESP32.`);
    loader = candidate;
    setConnected(chip);
    setProgress(0, 'Perangkat siap. Pilih firmware aplikasi.');
    info(`${chip} terhubung.`);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') {
      info('Pemilihan port dibatalkan.');
      setProgress(0, 'Pilih perangkat untuk melanjutkan.');
    } else {
      showError(error);
      info('Coba kecepatan 115200, periksa kabel, tutup Serial Monitor, atau gunakan tombol BOOT.');
    }
    await releasePort();
  } finally {
    busy = false;
    updateControls();
  }
});

function renderFiles() {
  $('files').replaceChildren();
  if (firmware) {
    const row = document.createElement('div');
    row.className = 'file-row';
    const description = document.createElement('div');
    const name = document.createElement('strong');
    name.className = 'file-name';
    name.textContent = firmware.name;
    const size = document.createElement('span');
    size.className = 'file-meta';
    size.textContent = `${(firmware.size / 1024).toLocaleString('id-ID', { maximumFractionDigits: 1 })} KiB · aplikasi ESP32`;
    description.append(name, size);
    const destination = document.createElement('span');
    destination.className = 'file-destination';
    destination.textContent = 'Siap di-flash';
    const remove = document.createElement('button');
    remove.className = 'remove-file';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Hapus ${firmware.name}`);
    remove.addEventListener('click', () => { firmware = null; renderFiles(); refreshValidation(); });
    row.append(description, destination, remove);
    $('files').append(row);
  }
}
function refreshValidation() {
  try {
    validateFirmware(firmware);
    setProgress(0, loader ? 'Firmware siap untuk di-flash.' : 'Firmware siap. Hubungkan ESP32.');
  } catch (error) {
    setProgress(0, error instanceof Error ? error.message : String(error));
  }
  updateControls();
}
function addFiles(files: FileList | File[]) {
  if (busy) return;
  try {
    const added = Array.from(files);
    if (!added.length) return;
    if (added.length > 1) throw new Error('Pilih satu file firmware .bin saja.');
    validateFile(added[0]);
    firmware = added[0];
    renderFiles();
    info(`${firmware.name} siap ditulis sebagai firmware aplikasi.`);
    refreshValidation();
  } catch (error) { showError(error); }
  fileInput.value = '';
}
fileInput.addEventListener('change', () => { if (fileInput.files) addFiles(fileInput.files); });
for (const type of ['dragenter', 'dragover']) dropzone.addEventListener(type, event => { event.preventDefault(); if (!busy) dropzone.classList.add('dragging'); });
for (const type of ['dragleave', 'drop']) dropzone.addEventListener(type, () => dropzone.classList.remove('dragging'));
dropzone.addEventListener('drop', event => { event.preventDefault(); if (event.dataTransfer?.files) addFiles(event.dataTransfer.files); });
window.addEventListener('dragover', event => event.preventDefault());
window.addEventListener('drop', event => event.preventDefault());

flashButton.addEventListener('click', async () => {
  if (busy || !loader) return;
  const activeLoader = loader;
  let segment: { file: File; address: number };
  try { segment = validateFirmware(firmware); } catch (error) { showError(error); return; }
  busy = true;
  flashing = true;
  updateControls();
  try {
    setProgress(0, 'Membaca firmware dan kapasitas flash…');
    const flashSize = await activeLoader.detectFlashSize();
    const capacity = activeLoader.flashSizeBytes(flashSize as FlashSizeValues);
    if (segment.address + segment.file.size > capacity) throw new Error(`Firmware melampaui kapasitas flash yang dilaporkan (${flashSize}).`);
    const data = new Uint8Array(await segment.file.arrayBuffer());
    if (data[0] !== 0xe9) throw new Error('File ini tidak memiliki header firmware ESP32 yang valid.');
    const fileArray = [{ address: APP_ADDRESS, data }];
    if (disconnected) throw new Error('Perangkat terlepas. Hubungkan kembali.');
    info(`Menulis ${segment.file.name} ke partisi aplikasi. Jangan cabut kabel USB.`);
    await activeLoader.writeFlash({
      fileArray,
      flashSize: 'keep', flashMode: 'keep', flashFreq: 'keep',
      eraseAll: false, compress: true,
      calculateMD5Hash: data => SparkMD5.ArrayBuffer.hash(new Uint8Array(data).buffer),
      reportProgress: (_index, written, total) => {
        const fraction = total > 0 ? Math.min(1, written / total) : 0;
        setProgress(Math.min(99, fraction * 100), `Menulis ${segment.file.name}…`);
      },
    });
    if (disconnected) throw new Error('Koneksi terputus saat flash. Hubungkan kembali dan ulangi.');
    setProgress(100, 'Flash selesai. Firmware berhasil diverifikasi.');
    info('Penulisan dan verifikasi MD5 selesai.');
    if (usingWebUsb) {
      info('Firmware berhasil ditulis. Tekan EN/RESET untuk menjalankannya.');
    } else {
      try {
        await activeLoader.after('hard_reset');
        info('Perintah reset dikirim. Tekan EN/RESET jika firmware belum berjalan.');
      } catch {
        info('Firmware berhasil ditulis. Tekan EN/RESET untuk menjalankannya.');
      }
    }
  } catch (error) {
    showError(error);
    info('Hubungkan kembali perangkat sebelum mencoba flash ulang.');
  } finally {
    await releasePort();
    flashing = false;
    busy = false;
    updateControls();
  }
});

if (nativeSerial) nativeSerial.addEventListener('disconnect', event => {
  if (event.target !== port) return;
  disconnected = true;
  info('Perangkat USB terlepas.');
  setConnected();
  if (!busy) {
    busy = true;
    updateControls();
    void releasePort().finally(() => { busy = false; updateControls(); });
    setProgress(0, 'Perangkat terlepas. Hubungkan kembali.');
  }
});
window.addEventListener('beforeunload', event => {
  if (!busy) return;
  event.preventDefault();
  event.returnValue = '';
});
$('clear-log').addEventListener('click', () => { output.textContent = ''; });
const compatibility = $('compatibility');
compatibility.classList.toggle('warning', !supported);
compatibility.textContent = supported
  ? usingWebUsb
    ? 'Mode Android aktif. Pilih jenis USB board, masukkan ESP32 ke mode BOOT, lalu klik Hubungkan.'
    : 'Browser mendukung koneksi USB serial. Hubungkan ESP32 untuk memulai.'
  : !window.isSecureContext
    ? 'Koneksi USB memerlukan HTTPS atau localhost. Jalankan web melalui npm run dev atau hosting HTTPS.'
    : 'Browser ini belum menyediakan Web Serial atau WebUSB. Gunakan Google Chrome pada Android atau Chrome/Edge di komputer.';
info('ESP32 Flash Tools siap. File firmware diproses lokal di browser.');
updateControls();
