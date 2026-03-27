/**
 * Client-side WAV header validation.
 * Finds the RIFF `fmt ` chunk (handles JUNK/bext before fmt) and supports:
 * - WAVE_FORMAT_PCM (1), WAVE_FORMAT_IEEE_FLOAT (3)
 * - WAVE_FORMAT_EXTENSIBLE (0xFFFE) with KSDATAFORMAT_SUBTYPE_PCM / _IEEE_FLOAT
 *
 * Many DAWs write extensible headers even for plain stereo PCM/float.
 */

export type WavValidationResult =
  | { ok: true; sampleRate: number; bitDepth: number; channels: number; encoding: "pcm" | "float" }
  | { ok: false; reason: string };

/** WAVE_FORMAT_EXTENSIBLE — actual codec in SubFormat GUID */
const FORMAT_EXTENSIBLE = 0xfffe;

const ALLOWED_SAMPLE_RATES = [44100, 48000];
const PCM_BIT_DEPTHS = [16, 24];
const FLOAT_BIT_DEPTH = 32;

/** First DWORD of KSDATAFORMAT_SUBTYPE_PCM / _IEEE_FLOAT (little-endian). */
const SUBFORMAT_PCM = 1;
const SUBFORMAT_IEEE_FLOAT = 3;

const HEADER_READ_BYTES = 2048;

function readFourCC(view: DataView, offset: number): string {
  if (offset + 4 > view.byteLength) return "";
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3)
  );
}

function findFmtChunk(view: DataView): { dataOffset: number; dataSize: number } | null {
  if (readFourCC(view, 0) !== "RIFF") return null;
  if (readFourCC(view, 8) !== "WAVE") return null;

  let pos = 12;
  while (pos + 8 <= view.byteLength) {
    const id = readFourCC(view, pos);
    const chunkSize = view.getUint32(pos + 4, true);
    const dataOffset = pos + 8;
    const padded = chunkSize + (chunkSize % 2);
    if (id === "fmt ") {
      return { dataOffset, dataSize: chunkSize };
    }
    if (padded > view.byteLength - dataOffset) break;
    pos = dataOffset + padded;
  }
  return null;
}

function parseFmtChunk(
  view: DataView,
  dataOffset: number,
  dataSize: number
): WavValidationResult {
  if (dataSize < 16) {
    return { ok: false, reason: "Слишком короткий блок fmt в WAV." };
  }

  const wFormatTag = view.getUint16(dataOffset, true);
  const channels = view.getUint16(dataOffset + 2, true);
  const sampleRate = view.getUint32(dataOffset + 4, true);
  const bitsPerSampleField = view.getUint16(dataOffset + 14, true);

  let effectiveCodec = wFormatTag;
  let bitDepth = bitsPerSampleField;

  if (wFormatTag === FORMAT_EXTENSIBLE) {
    if (dataSize < 40) {
      return {
        ok: false,
        reason:
          "WAV с расширенным заголовком (EXTENSIBLE), но без полного SubFormat. Пересохраните файл в DAW."
      };
    }
    const cbSize = view.getUint16(dataOffset + 16, true);
    if (cbSize < 22) {
      return { ok: false, reason: "Некорректный расширенный WAV (cbSize)." };
    }
    const validBits = view.getUint16(dataOffset + 18, true);
    if (validBits > 0) {
      bitDepth = validBits;
    }
    const subFormatLo = view.getUint32(dataOffset + 24, true);
    effectiveCodec = subFormatLo;
  }

  const isPcm = effectiveCodec === SUBFORMAT_PCM;
  const isFloat = effectiveCodec === SUBFORMAT_IEEE_FLOAT;

  if (!isPcm && !isFloat) {
    return {
      ok: false,
      reason:
        "Неподдерживаемое сжатие в WAV. Экспортируйте PCM (16/24 bit) или WAV float 32 bit (44.1 или 48 kHz) из DAW."
    };
  }

  if (channels < 1 || channels > 2) {
    return {
      ok: false,
      reason: `Неподдерживаемое число каналов: ${channels}. Требуется моно или стерео.`
    };
  }

  if (!ALLOWED_SAMPLE_RATES.includes(sampleRate)) {
    return {
      ok: false,
      reason: `Частота ${sampleRate} Гц не поддерживается. Нужны 44 100 или 48 000 Гц.`
    };
  }

  if (isPcm) {
    if (!PCM_BIT_DEPTHS.includes(bitDepth)) {
      return {
        ok: false,
        reason: `Для PCM нужна глубина 16 или 24 бит (сейчас ${bitDepth}).`
      };
    }
    return { ok: true, sampleRate, bitDepth, channels, encoding: "pcm" };
  }

  if (bitDepth !== FLOAT_BIT_DEPTH && bitsPerSampleField !== FLOAT_BIT_DEPTH) {
    return {
      ok: false,
      reason: `Для float WAV ожидается 32 бит на сэмпл (сейчас ${bitDepth}). Переэкспортируйте как 32-bit float WAV.`
    };
  }

  return {
    ok: true,
    sampleRate,
    bitDepth: FLOAT_BIT_DEPTH,
    channels,
    encoding: "float"
  };
}

/**
 * Validates the WAV file header without uploading the file.
 */
export async function validateWavFile(file: File): Promise<WavValidationResult> {
  if (file.size < 12) {
    return { ok: false, reason: "Файл слишком мал — не является допустимым WAV." };
  }

  let buffer: ArrayBuffer;
  try {
    buffer = await file.slice(0, Math.min(HEADER_READ_BYTES, file.size)).arrayBuffer();
  } catch {
    return { ok: false, reason: "Не удалось прочитать файл для проверки формата." };
  }

  const view = new DataView(buffer);

  if (readFourCC(view, 0) !== "RIFF") {
    return {
      ok: false,
      reason: `Файл не является RIFF-контейнером. Требуется WAV.`
    };
  }

  if (readFourCC(view, 8) !== "WAVE") {
    return {
      ok: false,
      reason: `Контейнер не WAVE. Требуется WAV-файл.`
    };
  }

  const fmt = findFmtChunk(view);
  if (!fmt) {
    return { ok: false, reason: "В файле не найден блок fmt (некорректный WAV)." };
  }

  return parseFmtChunk(view, fmt.dataOffset, fmt.dataSize);
}
