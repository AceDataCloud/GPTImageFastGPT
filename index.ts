import {
  createToolHandler,
  defineToolSet,
  type InputSchemaMetaType,
  type OutputSchemaMetaType,
  type SecretSchemaMetaType
} from '@fastgpt-plugin/sdk-factory';
import z from 'zod';

import { generateImage, retrieveTask } from './src/client.ts';

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
    quality: z.enum(['low', 'medium', 'high']).default('low').meta({
      title: 'Quality'
    } satisfies InputSchemaMetaType)
  }),
  outputSchema,
  secretSchema,
  handler: async (input, ctx) => generateImage(input, ctx.secrets?.apiKey ?? '')
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

export default defineToolSet({
  manifest: {
    pluginId: 'acedataGptImage',
    version: '0.1.0',
    name: { en: 'Ace Data Cloud GPT Image', 'zh-CN': 'Ace Data Cloud GPT 图像' },
    description: {
      en: 'Generate GPT images and retrieve the same task in Ace Data Cloud.',
      'zh-CN': '通过 Ace Data Cloud 生成 GPT 图像并查询同一任务。'
    },
    versionDescription: { en: 'Initial release', 'zh-CN': '首次发布' },
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
