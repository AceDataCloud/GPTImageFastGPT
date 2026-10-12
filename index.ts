import {
  createToolHandler,
  defineToolSet,
  type InputSchemaMetaType,
  type OutputSchemaMetaType,
  type SecretSchemaMetaType
} from '@fastgpt-plugin/sdk-factory';
import z from 'zod';
import type { TaskResult } from './src/client.ts';

import { editImage, generateImage, retrieveTask, retrieveTasks } from './src/client.ts';

const secretSchema = z.object({
  apiKey: z.string().min(1).meta({
    title: 'Ace Data Cloud API key',
    description: 'Create an application API key at platform.acedata.cloud. Do not include Bearer.',
    isSecret: true
  } satisfies SecretSchemaMetaType)
});

const outputSchema = z.object({
  taskId: z.string().meta({ title: 'Task ID' } satisfies OutputSchemaMetaType),
  traceId: z.string().meta({ title: 'Trace ID' } satisfies OutputSchemaMetaType),
  status: z.enum(['pending', 'succeeded', 'failed']).meta({
    title: 'Task status'
  } satisfies OutputSchemaMetaType),
  success: z.boolean().meta({ title: 'Succeeded' } satisfies OutputSchemaMetaType),
  mediaUrls: z.array(z.string()).meta({ title: 'Image URLs' } satisfies OutputSchemaMetaType)
});

const generateHandler = createToolHandler({
  inputSchema: z.object({
    prompt: z.string().trim().min(1).max(32000).meta({
      title: 'Prompt',
      description: 'Describe one image to generate.',
      isToolParam: true
    } satisfies InputSchemaMetaType),
    model: z.enum(['gpt-image-2', 'gpt-image-1.5', 'gpt-image-1']).default('gpt-image-2').meta({
      title: 'Model',
      description: 'Check access and current price before switching models.'
    } satisfies InputSchemaMetaType),
    size: z.enum(['1024x1024', '1024x1536', '1536x1024']).default('1024x1024').meta({
      title: 'Size'
    } satisfies InputSchemaMetaType),
    quality: z.enum(['auto', 'low', 'medium', 'high']).default('low').meta({
      title: 'Quality'
    } satisfies InputSchemaMetaType),
    count: z.number().int().min(1).max(10).default(1).meta({
      title: 'Image count',
      description: 'Each output image may be billed. Keep 1 for the first run.'
    } satisfies InputSchemaMetaType)
  }),
  outputSchema,
  secretSchema,
  handler: async (input, ctx) => generateImage(input, ctx.secrets?.apiKey ?? '')
});

const editHandler = createToolHandler({
  inputSchema: z.object({
    imageUrl: z.string().url().startsWith('https://').meta({
      title: 'Reference image URL',
      description: 'An accessible HTTPS image that you may edit.'
    } satisfies InputSchemaMetaType),
    prompt: z.string().trim().min(1).max(32000).meta({ title: 'Edit prompt', isToolParam: true } satisfies InputSchemaMetaType),
    model: z.enum(['gpt-image-2', 'gpt-image-1.5', 'gpt-image-1']).default('gpt-image-2').meta({ title: 'Model' } satisfies InputSchemaMetaType),
    size: z.enum(['1024x1024', '1024x1536', '1536x1024']).default('1024x1024').meta({ title: 'Size' } satisfies InputSchemaMetaType),
    quality: z.enum(['auto', 'low', 'medium', 'high']).default('low').meta({ title: 'Quality' } satisfies InputSchemaMetaType),
    count: z.number().int().min(1).max(10).default(1).meta({ title: 'Image count' } satisfies InputSchemaMetaType)
  }),
  outputSchema,
  secretSchema,
  handler: async (input, ctx) => editImage(input, ctx.secrets?.apiKey ?? '')
});

const retrieveHandler = createToolHandler({
  inputSchema: z.object({
    taskId: z.string().trim().min(1).meta({
      title: 'Task ID',
      description: 'Bind this to Generate image → Task ID. Querying the same ID does not generate again.',
      isToolParam: true
    } satisfies InputSchemaMetaType)
  }),
  outputSchema,
  secretSchema,
  handler: async (input, ctx) => retrieveTask(input.taskId, ctx.secrets?.apiKey ?? '')
});

const batchOutputSchema = z.object({
  status: z.enum(['pending', 'succeeded', 'failed']).meta({ title: 'Batch status' } satisfies OutputSchemaMetaType),
  success: z.boolean().meta({ title: 'All succeeded' } satisfies OutputSchemaMetaType),
  taskIds: z.array(z.string()).meta({ title: 'Requested task IDs' } satisfies OutputSchemaMetaType),
  mediaUrls: z.array(z.string()).meta({ title: 'Completed media URLs' } satisfies OutputSchemaMetaType),
  items: z.array(z.object({
    taskId: z.string(),
    traceId: z.string(),
    status: z.enum(['pending', 'succeeded', 'failed']),
    success: z.boolean(),
    mediaUrls: z.array(z.string()),
  })).meta({ title: 'Tasks' } satisfies OutputSchemaMetaType)
});

const batchHandler = createToolHandler({
  inputSchema: z.object({
    taskIds: z.array(z.string().trim().min(1)).min(1).max(20).meta({
      title: 'Task IDs',
      description: 'Existing task IDs only. Batch retrieval never submits a new generation.'
    } satisfies InputSchemaMetaType)
  }),
  outputSchema: batchOutputSchema,
  secretSchema,
  handler: async (input, ctx) => retrieveTasks(input.taskIds, ctx.secrets?.apiKey ?? '')
});

export default defineToolSet({
  manifest: {
    pluginId: 'acedataGptImage',
    version: '0.2.0',
    name: { en: 'Ace Data Cloud GPT Image', 'zh-CN': 'Ace Data Cloud GPT 图像' },
    description: {
      en: 'Generate GPT images and retrieve the same task in Ace Data Cloud.',
      'zh-CN': '通过 Ace Data Cloud 生成 GPT 图像并查询同一任务。'
    },
    versionDescription: { en: 'Align API limits, task status and edit actions', 'zh-CN': '对齐 API 限制和任务状态处理' },
    author: 'Ace Data Cloud',
    repoUrl: 'https://github.com/AceDataCloud/GPTImageFastGPT',
    tutorialUrl: 'https://github.com/AceDataCloud/GPTImageFastGPT#quick-start',
    tags: ['multimodal'],
    permission: []
  },
  secretSchema,
  children: [
    {
      id: 'generateImage',
      name: { en: 'Generate image', 'zh-CN': '生成图像' },
      description: {
        en: 'Submit one GPT Image generation and return its task ID.',
        'zh-CN': '提交一次 GPT 图像生成并返回任务 ID。'
      },
      toolDescription: 'Generate one image. Do not call again to check a pending task.',
      handler: generateHandler
    },
    {
      id: 'editImage',
      name: { en: 'Edit image', 'zh-CN': '编辑图像' },
      description: { en: 'Edit one authorized image and return its task ID.', 'zh-CN': '编辑一张经授权的图片并返回任务 ID。' },
      toolDescription: 'Submit one edit. Use Retrieve task to check its ID without editing again.',
      handler: editHandler
    },
    {
      id: 'retrieveTasks',
      name: { en: 'Retrieve tasks', 'zh-CN': '批量查询任务' },
      description: { en: 'Read existing task IDs without submitting a generation.', 'zh-CN': '只读查询已有任务 ID，不重新生成。' },
      toolDescription: 'Use only existing task IDs. Each item retains its own pending, failed, or succeeded state.',
      handler: batchHandler
    },
    {
      id: 'retrieveTask',
      name: { en: 'Retrieve task', 'zh-CN': '查询任务' },
      description: {
        en: 'Read the current status and result of an existing GPT Image task.',
        'zh-CN': '读取已有 GPT 图像任务的状态和结果。'
      },
      toolDescription: 'Retrieve an existing task by ID without submitting a new generation.',
      handler: retrieveHandler
    }
  ]
});
