import { expect, it, vi } from 'vitest';
import { prepareImage } from './image';

it('limits the longest image side to 2000 pixels', async () => {
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 4000, height: 3000, close: vi.fn() }));
  const canvas = { width: 0, height: 0, getContext: () => ({ drawImage: vi.fn() }), toBlob: (callback: (blob: Blob) => void) => callback(new Blob(['jpg'], { type: 'image/jpeg' })) };
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => tag === 'canvas' ? canvas : {}) as typeof document.createElement);
  const result = await prepareImage(new Blob(['image']));
  expect([canvas.width, canvas.height]).toEqual([2000, 1500]);
  expect(result.type).toBe('image/jpeg');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
