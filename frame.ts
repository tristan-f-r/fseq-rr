interface FSEQHeader {
  channel_data_start_offset: number;
  minor_version: number;
  major_version: number;
  header_length: number;
  channel_count: number;
  frame_count: number;
  step_time_ms: number;
  flags: number; // ignored, default is 0,
  universe_count: number; // ignored
  universe_size: number; // ignored
  gamma: number; // ignored, default is 1
  color_encoding: number; // ignored, default is 2 (RGB)
  reserved: Uint8Array; // ignored, default is 0
}

const HEADER_LENGTH = 28;

export function createFSEQHeader(
  step_time_ms: number,
  frame_count: number,
  pixels: number,
): FSEQHeader {
  return {
    channel_data_start_offset: HEADER_LENGTH,
    minor_version: 0,
    major_version: 1,
    header_length: HEADER_LENGTH,
    channel_count: pixels * 3,
    frame_count,
    step_time_ms,
    flags: 0,
    universe_count: 0,
    universe_size: 0,
    gamma: 1,
    color_encoding: 2,
    reserved: new Uint8Array(2),
  };
}

const encoder = new TextEncoder();
export function writeFSEQHeader(
  header: FSEQHeader,
  writer: WritableStreamDefaultWriter<Uint8Array>,
): Promise<void> {
  const headerBytes = new Uint8Array(HEADER_LENGTH);
  const dataView = new DataView(headerBytes.buffer);

  const magic = encoder.encode("PSEQ");
  headerBytes.set(magic, 0);
  dataView.setUint16(4, header.channel_data_start_offset, true);
  dataView.setUint8(6, header.minor_version);
  dataView.setUint8(7, header.major_version);
  dataView.setUint16(8, header.header_length, true);
  dataView.setUint32(10, header.channel_count, true);
  dataView.setUint32(14, header.frame_count, true);
  dataView.setUint8(18, header.step_time_ms);
  dataView.setUint8(19, header.flags);
  dataView.setUint16(20, header.universe_count, true);
  dataView.setUint16(22, header.universe_size, true);
  dataView.setUint8(24, header.gamma);
  dataView.setUint8(25, header.color_encoding);
  header.reserved.forEach((byte, index) => {
    dataView.setUint8(26 + index, byte);
  });

  return writer.write(headerBytes).then(() => {});
}
