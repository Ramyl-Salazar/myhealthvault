export async function readImage(file: Blob): Promise<{ text: string; confidence: number }> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng');
  try {
    const result = await worker.recognize(file);
    return { text: result.data.text, confidence: result.data.confidence };
  } finally {
    await worker.terminate();
  }
}
