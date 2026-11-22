import { afterEach, expect, test, vi } from 'vitest';
import plugin from '../index.ts';
import { GENERATION_MODELS, EDIT_MODELS } from './model-catalog.ts';

afterEach(() => vi.unstubAllGlobals());

for (const [child, models, path] of [
  ['generateImage', GENERATION_MODELS, '/openai/images/generations'],
  ['editImage', EDIT_MODELS, '/openai/images/edits']
] as const) {
  test.each(models)(`${child} accepts and preserves published model %s`, async (model) => {
    const definition = plugin.getToolHandler(child)!;
    const input = definition.inputSchema.parse({ prompt: 'One blue sphere', model, imageUrl: 'https://example.com/source.png' });
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ task_id: 'submitted-once', status: 'pending' }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await definition.handler(input, { secrets: { apiKey: 'fixture-key' }, systemVar: {} as never, invoke: {} as never, streamResponse: () => {} });
    expect(result).toMatchObject({ taskId: 'submitted-once', status: 'pending', success: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe(`https://api.acedata.cloud${path}`);
    const request = fetchMock.mock.calls[0]![1];
    const body = JSON.parse(request.body);
    expect(body).toMatchObject({ model, size: '1024x1024', n: 1, async: true });
    expect(request.headers.Authorization).toBe('Bearer fixture-key');
    if (['gpt-image-1', 'gpt-image-1.5', 'gpt-image-2'].includes(model)) expect(body.quality).toBe('low');
    else expect(body).not.toHaveProperty('quality');
    if (child === 'editImage') expect(body.image).toBe('https://example.com/source.png');
  });
}

test('existing omitted model and explicit quality keep their behavior', async () => {
  const definition = plugin.getToolHandler('generateImage')!;
  const input = definition.inputSchema.parse({ prompt: 'One blue sphere', quality: 'high' });
  expect(input.model).toBe('gpt-image-2');
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ task_id: 'existing', status: 'pending' }));
  vi.stubGlobal('fetch', fetchMock);
  await definition.handler(input, { secrets: { apiKey: 'fixture-key' }, systemVar: {} as never, invoke: {} as never, streamResponse: () => {} });
  expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toMatchObject({ model: 'gpt-image-2', quality: 'high', size: '1024x1024', n: 1 });
});

test('operation-specific quality choices follow the API contracts', () => {
  expect(plugin.getToolHandler('generateImage')!.inputSchema.parse({ prompt: 'Image', model: 'dall-e-3', quality: 'hd' }).quality).toBe('hd');
  expect(() => plugin.getToolHandler('editImage')!.inputSchema.parse({ prompt: 'Image', imageUrl: 'https://example.com/source.png', model: 'dall-e-3', quality: 'hd' })).toThrow();
  for (const child of ['generateImage', 'editImage']) {
    expect(plugin.getToolHandler(child)!.inputSchema.parse({ prompt: 'Image', imageUrl: 'https://example.com/source.png', model: 'gpt-image-2.6-flare', quality: 'max' }).quality).toBe('max');
  }
});
