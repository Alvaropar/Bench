/**
 * Minimal ZIP writer.
 *
 * Store-only (compression method 0): no deflate, so no dependency and no
 * WASM. Generated projects are a few tens of kilobytes of text, where the
 * difference between stored and deflated is irrelevant, and every unzip tool
 * reads stored entries.
 *
 * Structure written here: a local header + data per file, then a central
 * directory describing them, then the end-of-central-directory record.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index++) {
    let value = index;
    for (let bit = 0; bit < 8; bit++) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index++) {
    crc = CRC_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** MS-DOS date and time, which is what the ZIP format stores. */
function dosDateTime(date: Date): { time: number; date: number } {
  return {
    time:
      (date.getHours() << 11) | (date.getMinutes() << 5) | (Math.floor(date.getSeconds() / 2)),
    date:
      ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

class ByteWriter {
  private chunks: Uint8Array[] = [];
  length = 0;

  push(bytes: Uint8Array) {
    this.chunks.push(bytes);
    this.length += bytes.length;
  }

  u16(value: number) {
    this.push(new Uint8Array([value & 0xff, (value >>> 8) & 0xff]));
  }

  u32(value: number) {
    this.push(
      new Uint8Array([
        value & 0xff,
        (value >>> 8) & 0xff,
        (value >>> 16) & 0xff,
        (value >>> 24) & 0xff,
      ]),
    );
  }

  toBlob(): Blob {
    return new Blob(this.chunks as BlobPart[], { type: "application/zip" });
  }
}

export interface ZipEntry {
  path: string;
  content: string;
}

export function createZip(entries: ZipEntry[], now = new Date()): Blob {
  const encoder = new TextEncoder();
  const { time, date } = dosDateTime(now);

  const out = new ByteWriter();
  const directory: { name: Uint8Array; crc: number; size: number; offset: number }[] = [];

  for (const entry of entries) {
    const name = encoder.encode(entry.path);
    const data = encoder.encode(entry.content);
    const crc = crc32(data);
    const offset = out.length;

    out.u32(0x04034b50); // local file header
    out.u16(20); // version needed
    out.u16(0); // flags
    out.u16(0); // stored
    out.u16(time);
    out.u16(date);
    out.u32(crc);
    out.u32(data.length);
    out.u32(data.length);
    out.u16(name.length);
    out.u16(0); // extra field length
    out.push(name);
    out.push(data);

    directory.push({ name, crc, size: data.length, offset });
  }

  const directoryOffset = out.length;

  for (const entry of directory) {
    out.u32(0x02014b50); // central directory header
    out.u16(20); // version made by
    out.u16(20); // version needed
    out.u16(0);
    out.u16(0); // stored
    out.u16(time);
    out.u16(date);
    out.u32(entry.crc);
    out.u32(entry.size);
    out.u32(entry.size);
    out.u16(entry.name.length);
    out.u16(0); // extra
    out.u16(0); // comment
    out.u16(0); // disk number
    out.u16(0); // internal attributes
    out.u32(0); // external attributes
    out.u32(entry.offset);
    out.push(entry.name);
  }

  const directorySize = out.length - directoryOffset;

  out.u32(0x06054b50); // end of central directory
  out.u16(0);
  out.u16(0);
  out.u16(directory.length);
  out.u16(directory.length);
  out.u32(directorySize);
  out.u32(directoryOffset);
  out.u16(0); // comment length

  return out.toBlob();
}
