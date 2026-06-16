import { PDFDocument, rgb } from 'pdf-lib';

/** Generate a minimal but fully renderable PDF with the given number of A4 pages. */
export async function makePdf(pageCount: number): Promise<Buffer> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    const page = doc.addPage([595, 842]);
    page.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: rgb(1, 1, 1) });
    page.drawText(`Page ${String(i + 1)}`, { x: 50, y: 400, size: 24 });
  }
  return Buffer.from(await doc.save());
}
