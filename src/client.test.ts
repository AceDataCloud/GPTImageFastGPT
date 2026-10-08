import { afterEach, expect, test, vi } from 'vitest';
import { generateImage, normalizeTask, retrieveTask } from './client.js';

afterEach(() => vi.unstubAllGlobals());

test('accepted generation returns a task ID without claiming success', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ task_id: 'task-1', status: 'pending' }), { status: 200 }));
  vi.stubGlobal('fetch', fetch);
  const result = await generateImage(
    { prompt: 'One blue sphere', model: 'gpt-image-2', size: '1024x1024', quality: 'low' },
    'test-key'
  );
  expect(result).toEqual({ taskId: 'task-1', traceId: '', status: 'pending', success: false, mediaUrls: [] });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][0]).toBe('https://api.acedata.cloud/openai/images/generations');
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ n: 1, async: true, response_format: 'url' });
});

test('retrieval only reads the same task and extracts the terminal URL', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    id: 'task-1', status: 'succeeded', result: { data: [{ url: 'https://cdn.example/result.png' }] }
  }), { status: 200 }));
  vi.stubGlobal('fetch', fetch);
  const result = await retrieveTask('task-1', 'test-key');
  expect(result).toEqual({
    taskId: 'task-1', traceId: '', status: 'succeeded', success: true,
    mediaUrls: ['https://cdn.example/result.png']
  });
  expect(fetch.mock.calls[0][0]).toBe('https://api.acedata.cloud/openai/tasks');
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ action: 'retrieve', id: 'task-1' });
});

test('failed task and empty accepted task remain distinct', () => {
  expect(normalizeTask({ task_id: 't', status: 'failed', error: { message: 'private upstream' } }).status).toBe('failed');
  expect(normalizeTask({ task_id: 't', status: 'pending' }).success).toBe(false);
});

test('normalizes the current task API response envelope', () => {
  expect(normalizeTask({
    id: 'task-1', finished_at: 123,
    response: { task_id: 'task-1', success: true, data: [{ url: 'https://cdn.example/image.png' }] }
  })).toEqual({
    taskId: 'task-1', traceId: '', status: 'succeeded', success: true,
    mediaUrls: ['https://cdn.example/image.png']
  });
});

test('HTTP errors do not expose API payloads or secrets', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
    JSON.stringify({ error: { message: 'private upstream and secret' } }), { status: 403 }
  )));
  await expect(retrieveTask('task-1', 'private-key')).rejects.toThrow('HTTP 403');
  await expect(retrieveTask('task-1', 'Bearer private-key')).rejects.toThrow('without the Bearer prefix');
});
