
import { IpcMain } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import { PDFParse } from 'pdf-parse'
import mammoth from 'mammoth'
import pptx2json from 'pptx2json'

export default function registerFileRead(ipcMain: IpcMain) {
  ipcMain.handle('read-file', async (_event, filePath) => {
    try {
      const ext = path.extname(filePath).toLowerCase();
      let content = '';
      if (ext === '.txt') {
        content = await fs.readFile(filePath, 'utf-8');
      } else if (ext === '.pdf') {
        const data = await fs.readFile(filePath);
        const parser = new PDFParse({ data });
        const textResult = await parser.getText();
        content = textResult.text;
      } else if (ext === '.docx') {
        const data = await fs.readFile(filePath);
        const result = await mammoth.extractRawText({ buffer: data });
        content = result.value;
      } else if (ext === '.pptx') {
        // pptx2json returns an array of slides, each with an array of text items
        const slides = await pptx2json(filePath);
        content = slides.map(slide => slide.texts?.map(t => t.text).join(' ') || '').join('\n---\n');
      } else {
        // fallback: try to read as utf-8, else return binary/truncated
        try {
          content = await fs.readFile(filePath, 'utf-8');
        } catch {
          const data = await fs.readFile(filePath);
          content = '[Binary file] Size: ' + data.length + ' bytes.';
        }
      }
      return content.length > 2000 ? content.slice(0, 2000) + '\n...(Truncated)' : content;
    } catch (err) {
      return `Error reading file: ${err}`;
    }
  });
}
