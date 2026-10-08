export type TaskResult = {
  taskId: string;
  traceId: string;
  status: 'pending' | 'succeeded' | 'failed';
  success: boolean;
  mediaUrls: string[];
};

type JsonObject = Record<string, unknown>;

const BASE_URL = 'https://api.acedata.cloud';
const succeeded = new Set(['succeeded', 'success', 'completed', 'complete', 'finished']);
const failed = new Set(['failed', 'failure', 'error', 'cancelled', 'canceled', 'rejected']);
const mediaKeys = new Set(['url', 'image_url', 'media_url', 'file_url']);

function object(value: unknown): JsonObject | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function string(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function imageUrls(value: unknown): string[] {
  const urls = new Set<string>();
  function visit(node: unknown): void {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const item = object(node);
    if (!item) return;
    for (const [key, child] of Object.entries(item)) {
      if (mediaKeys.has(key) && typeof child === 'string' && /^https:\/\//.test(child)) {
        urls.add(child);
      } else if (['data', 'result', 'response', 'output', 'images', 'media_urls'].includes(key)) {
        visit(child);
        if (key === 'media_urls' && Array.isArray(child)) {
          for (const url of child) if (typeof url === 'string' && /^https:\/\//.test(url)) urls.add(url);
        }
      }
    }
  }
  visit(value);
  return [...urls];
}

export function normalizeTask(body: unknown, fallbackTaskId = ''): TaskResult {
  const data = object(body);
  if (!data) throw new Error('Ace Data Cloud returned an invalid task response.');
  const task = object(data.task);
  const response = object(
    typeof data.response === 'string'
      ? (() => { try { return JSON.parse(data.response as string); } catch { return null; } })()
      : data.response
  );
  const taskId = string(data.task_id) || string(data.id) || string(task?.id) || string(response?.task_id) || fallbackTaskId;
  const traceId = string(data.trace_id) || string(task?.trace_id) || string(response?.trace_id);
  const state = (string(data.status) || string(task?.status) || string(response?.status)).toLowerCase();
  const urls = imageUrls(response ?? data);
  const unfinished = 'finished_at' in data && data.finished_at == null;
  const status: TaskResult['status'] = unfinished
    ? 'pending'
    : failed.has(state) || data.success === false || response?.success === false || Boolean(data.error) || Boolean(response?.error)
      ? 'failed'
      : succeeded.has(state) || response?.success === true || urls.length > 0
        ? 'succeeded'
        : 'pending';
  return { taskId, traceId, status, success: status === 'succeeded', mediaUrls: status === 'succeeded' ? urls : [] };
}

async function request(path: string, apiKey: string, payload: JsonObject): Promise<unknown> {
  const key = apiKey.trim();
  if (!key || /^Bearer\s/i.test(key)) {
    throw new Error('Enter the Ace Data Cloud API key without the Bearer prefix.');
  }
  let response: Response;
  try {
    response = await fetch(BASE_URL + path, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'error',
      signal: AbortSignal.timeout(60000)
    });
  } catch {
    throw new Error('Connection failed. Check the original request history before submitting again.');
  }
  if (!response.ok) {
    throw new Error(
      'Ace Data Cloud HTTP ' + response.status + '. Check your key, service access, balance, and request history.'
    );
  }
  try {
    return await response.json();
  } catch {
    throw new Error('Ace Data Cloud returned invalid JSON. Check the original request history.');
  }
}

export async function generateImage(
  input: { prompt: string; model: string; size: string; quality: string },
  apiKey: string
): Promise<TaskResult> {
  const body = await request('/openai/images/generations', apiKey, {
    prompt: input.prompt,
    model: input.model,
    size: input.size,
    quality: input.quality,
    n: 1,
    async: true,
    response_format: 'url'
  });
  const result = normalizeTask(body);
  if (result.status === 'pending' && !result.taskId) {
    throw new Error('Generation was accepted without a task ID. Check request history before retrying.');
  }
  return result;
}

export async function retrieveTask(taskId: string, apiKey: string): Promise<TaskResult> {
  const body = await request('/openai/tasks', apiKey, { action: 'retrieve', id: taskId });
  return normalizeTask(body, taskId);
}
