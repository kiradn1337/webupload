declare module 'clamscan';
declare module 'file-type' {
  export function fileTypeFromBuffer(buffer: Buffer): Promise<{mime: string, ext: string} | undefined>;
}
