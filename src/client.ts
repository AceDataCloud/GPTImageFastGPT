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
const pending = new Set(['pending', 'queued', 'processing', 'running', 'in_progress', 'accepted', 'submitted', 'waiting']);
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
  const states = [data.status, data.state, task?.status, task?.state, response?.status, response?.state]
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.toLowerCase());
  const urls = [...new Set([...imageUrls(data), ...imageUrls(response)])];
  const unfinished = 'finished_at' in data && data.finished_at == null;
  const hasFailure = states.some((state) => failed.has(state)) || data.success === false || response?.success === false || Boolean(data.error) || Boolean(response?.error);
  const isPending = unfinished || states.some((state) => pending.has(state));
  const hasSuccess = states.some((state) => succeeded.has(state)) || response?.success === true || urls.length > 0;
  const outerPending = (typeof data.status === 'string' && pending.has(data.status.toLowerCase())) || (typeof data.state === 'string' && pending.has(data.state.toLowerCase()));
  const status: TaskResult['status'] = outerPending ? 'pending' : hasFailure ? 'failed' : isPending ? 'pending' : hasSuccess ? 'succeeded' : 'pending';
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
  input: { prompt: string; model: string; size: string; quality: string; count: number },
  apiKey: string
): Promise<TaskResult> {
  const body = await request('/openai/images/generations', apiKey, {
    prompt: input.prompt,
    model: input.model,
    size: input.size,
    quality: input.quality,
    n: input.count,
    async: true,
    response_format: 'url'
  });
  const result = normalizeTask(body);
  if (result.status === 'pending' && !result.taskId) {
    throw new Error('Generation was accepted without a task ID. Check request history before retrying.');
  }
  return result;
}

export async function editImage(
  input: { prompt: string; imageUrl: string; model: string; size: string; quality: string; count: number },
  apiKey: string
): Promise<TaskResult> {
  const body = await request('/openai/images/edits', apiKey, {
    image: input.imageUrl,
    prompt: input.prompt,
    model: input.model,
    size: input.size,
    quality: input.quality,
    n: input.count,
    async: true,
    response_format: 'url'
  });
  const result = normalizeTask(body);
  if (result.status === 'pending' && !result.taskId) {
    throw new Error('Edit was accepted without a task ID. Check request history before retrying.');
  }
  return result;
}

export async function retrieveTask(taskId: string, apiKey: string): Promise<TaskResult> {
  const body = await request('/openai/tasks', apiKey, { action: 'retrieve', id: taskId });
  return normalizeTask(body, taskId);
}

export async function retrieveTasks(taskIds: string[], apiKey: string): Promise<{ status: 'pending' | 'succeeded' | 'failed'; success: boolean; taskIds: string[]; mediaUrls: string[]; items: TaskResult[] }> {
  if (taskIds.length === 0 || taskIds.length > 20 || taskIds.some((taskId) => !taskId.trim())) {
    throw new Error('Provide 1 to 20 existing task IDs.');
  }
  const body = await request('/openai/tasks', apiKey, { action: 'retrieve_batch', ids: taskIds });
  const envelope = object(body);
  const rawItems = Array.isArray(body)
    ? body
    : Array.isArray(envelope?.items) ? envelope.items
    : Array.isArray(envelope?.tasks) ? envelope.tasks
    : Array.isArray(envelope?.data) ? envelope.data
    : [];
  // Batch APIs omit missing tasks; response position does not identify a task.
  const items = rawItems.map((item) => normalizeTask(item));
  const returnedIds = new Set(items.map((item) => item.taskId));
  const hasAllTasks = taskIds.every((taskId) => returnedIds.has(taskId))
    && items.every((item) => taskIds.includes(item.taskId));
  const status = !hasAllTasks || items.length === 0 || items.some((item) => item.status === 'pending')
    ? 'pending'
    : items.some((item) => item.status === 'failed') ? 'failed' : 'succeeded';
  return {
    status,
    success: status === 'succeeded',
    taskIds,
    mediaUrls: status === 'succeeded' ? [...new Set(items.flatMap((item) => item.mediaUrls))] : [],
    items
  };
}
