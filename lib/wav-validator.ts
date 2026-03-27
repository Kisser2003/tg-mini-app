/**
 * Client-side WAV header validation.
 * Parses the RIFF/WAVE chunk (first 44 bytes) and enforces the spec required
 * for professional music distribution: 44.1 kHz, 16-bit or 24-bit PCM.
 *
 * Spec references (standard RIFF/WAV layout):
 *   Offset 0–3    "RIFF" chunk marker
 *   Offset 8–11   "WAVE" format marker
 *   Offset 20–21  AudioFormat (1 = PCM)
 *   Offset 22–23  NumChannels (1 = mono, 2 = stereo)
 *   Offset 24–27  SampleRate  (e.g. 44100)
 *   Offset 34–35  BitsPerSample (16 or 24)
 */

export type WavValidationResult =
  | { ok: true; sampleRate: number; bitDepth: number; channels: number }
  | { ok: false; reason: string };

const REQUIRED_SAMPLE_RATE = 44100;
const ALLOWED_BIT_DEPTHS = [16, 24];

function readFourCC(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3)
  );
}

/**
 * Validates the WAV file header without uploading the file.
 * Reads only the first 44 bytes.
 */
export async function validateWavFile(file: File): Promise<WavValidationResult> {
  if (file.size < 44) {
    return { ok: false, reason: "Файл слишком мал — не является допустимым WAV." };
  }

  let buffer: ArrayBuffer;
  try {
    buffer = await file.slice(0, 44).arrayBuffer();
  } catch {
    return { ok: false, reason: "Не удалось прочитать файл для проверки формата." };
  }

  const view = new DataView(buffer);

  const chunkId = readFourCC(view, 0);
  if (chunkId !== "RIFF") {
    return {
      ok: false,
      reason: `Файл не является RIFF-контейнером (найдено: "${chunkId}"). Требуется WAV.`
    };
  }

  const format = readFourCC(view, 8);
  if (format !== "WAVE") {
    return {
      ok: false,
      reason: `Формат не WAVE (найдено: "${format}"). Требуется WAV-файл.`
    };
  }

  // AudioFormat: 1 = PCM. Values > 1 indicate compression (e.g. 3 = IEEE float).
  const audioFormat = view.getUint16(20, true);
  if (audioFormat !== 1) {
    return {
      ok: false,
      reason:
        "Требуется PCM WAV (без сжатия). Используйте экспорт PCM / Uncompressed WAV в вашем DAW."
    };
  }

  const channels = view.getUint16(22, true);
  if (channels < 1 || channels > 2) {
    return {
      ok: false,
      reason: `Неподдерживаемое число каналов: ${channels}. Требуется моно или стерео.`
    };
  }

  const sampleRate = view.getUint32(24, true);
  if (sampleRate !== REQUIRED_SAMPLE_RATE) {
    return {
      ok: false,
      reason: `Частота дискретизации ${sampleRate} Гц не поддерживается. Требуется 44 100 Гц (44.1 kHz).`
    };
  }

  const bitDepth = view.getUint16(34, true);
  if (!ALLOWED_BIT_DEPTHS.includes(bitDepth)) {
    return {
      ok: false,
      reason: `Глубина ${bitDepth} бит не поддерживается. Требуется 16 или 24 бит.`
    };
  }

  return { ok: true, sampleRate, bitDepth, channels };
}
