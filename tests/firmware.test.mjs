import test from 'node:test';
import assert from 'node:assert/strict';
import { APP_ADDRESS, MAX_BYTES, validateFile, validateFirmware } from '../src/firmware.mjs';

const firmware = (size = 4096, name = 'firmware.bin') => ({ name, size });
test('uses the standard application offset automatically', () => {
  const result = validateFirmware(firmware());
  assert.equal(result.address, APP_ADDRESS);
});
test('rejects empty, non-binary and oversized files', () => {
  for (const file of [{ name: 'app.txt', size: 10 }, { name: 'empty.bin', size: 0 }, { name: 'large.bin', size: MAX_BYTES + 1 }]) assert.throws(() => validateFile(file));
});
test('requires a selected firmware', () => {
  assert.throws(() => validateFirmware(null));
});
