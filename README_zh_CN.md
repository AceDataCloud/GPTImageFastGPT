# Ace Data Cloud GPT 图像工具 for FastGPT

[English guide](README.md) · [API 与价格](https://platform.acedata.cloud/models)

本插件提供两个独立工具：**生成图像**与**查询任务**。生成只提交一次；后续只查询原任务 ID。异步返回任务 ID 或工作流显示成功，都不代表图片已生成。

## 从零开始

1. 使用 FastGPT 4.15 或更新版本。在 FastGPT 的插件市场搜索 **Ace Data Cloud GPT Image**，核对作者是 **Ace Data Cloud** 后安装。市场上架前，企业版或自部署管理员可以从本仓库的源码构建 .pkg，在插件管理页上传；FastGPT 云服务目前不支持用户直接上传自定义插件。
2. 登录 [Ace Data Cloud 应用管理](https://platform.acedata.cloud/console/applications)，打开 **General Application**。确认已开通 OpenAI generation、余额足够，并查看当期价格。直接复制 API Key；如果要单独创建 FastGPT 密钥，点击 **Manage Keys → Create**。开启 Allowed APIs 时同时允许 /openai/images/generations 与 /openai/tasks。

![Ace Data Cloud 的真实应用密钥界面，密钥已遮挡](assets/get-api-key-en.png)

3. 在 FastGPT 的插件配置中，将密钥填入 **Ace Data Cloud API key**。只填令牌本身，不加 Bearer、引号或空格。不要放进提示词或工作流导出。
4. 创建空白工作流并连线：**开始 → Ace Data Cloud GPT Image / Generate image → Ace Data Cloud GPT Image / Retrieve task → 输出**。生成工具填写 examples/generate.json 中的四项。将查询工具的 **Task ID** 绑定到生成工具输出的 **Task ID** 变量，不要手动输入节点名称。
5. 输出节点添加查询工具的 **status、success、taskId、mediaUrls**。执行一次。若 status 是 pending，保存 taskId，之后只运行查询工具或单独的“开始 → Retrieve task → 输出”工作流，直到 status=succeeded 且 success=true，再打开 mediaUrls 中的图片。不要重跑整条生成流程来轮询。
6. 到 Ace Data Cloud 控制台核对该 taskId 对应的一次调用和 Credits 扣费。Credits 与 USD 的换算以当前套餐价格为准。

## 本地可复制的无密钥示例

examples/generate.json 不含密钥。把真实密钥写在本地的 .secrets.local.json，内容为 {"apiKey":"YOUR_OWN_KEY"}，然后运行：

~~~sh
pnpm install
pnpm exec fastgpt-plugin debug . --run --tool generateImage --input-file examples/generate.json --secrets-file .secrets.local.json
pnpm exec fastgpt-plugin build --entry . --output ./dist
pnpm exec fastgpt-plugin check --entry . --output ./dist
pnpm exec fastgpt-plugin pack --entry . --dist ./dist --output ./out
~~~

若返回 pending，复制 taskId，另建不含密钥的 examples/retrieve.local.json（内容为 {"taskId":"返回的任务 ID"}），只运行：

~~~sh
pnpm exec fastgpt-plugin debug . --run --tool retrieveTask --input-file examples/retrieve.local.json --secrets-file .secrets.local.json
~~~

本地密钥文件已被 .gitignore 排除。不要将它提交或截图。

| 情况 | 处理 |
|---|---|
| 401 / 403 | 检查令牌完整性、有效期、服务权限、Allowed APIs 和余额。 |
| 400 | 使用示例模型、尺寸、质量和单张图片；核对实际报错参数。 |
| pending / 无图片 | 只查询相同 taskId，稍后再看。 |
| 429 | 降低并发，等待额度恢复，不自动重试付费生成。 |
| 超时 / 5xx / 任务失败 | 先查原任务与请求记录，再决定是否重新提交；给客服 taskId 或 traceId，不给密钥。 |

插件仅向 api.acedata.cloud 发送所选输入及令牌。图片生成按 [当前服务价格](https://platform.acedata.cloud/models) 计费。[源码与问题反馈](https://github.com/AceDataCloud/GPTImageFastGPT)。
