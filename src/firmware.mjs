export const MAX_BYTES = 128 * 1024 * 1024;
export const APP_ADDRESS = 0x10000;

export function validateFile(file) {
  if (!/\.bin$/i.test(file.name)) throw new Error(`${file.name}: hanya file .bin yang didukung.`);
  if (!Number.isSafeInteger(file.size) || file.size <= 0) throw new Error(`${file.name}: file kosong atau tidak valid.`);
  if (file.size > MAX_BYTES) throw new Error(`${file.name}: ukuran melebihi 128 MiB.`);
}

export function validateFirmware(file) {
  if (!file) throw new Error('Pilih file firmware terlebih dahulu.');
  validateFile(file);
  return { file, address: APP_ADDRESS };
}
