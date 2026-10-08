# Ace Data Cloud GPT Image for FastGPT

Generate one image and retrieve its result in a FastGPT workflow. [简体中文](README_zh_CN.md) · [Models and current pricing](https://platform.acedata.cloud/models)

The plugin exposes two separate tools: **Generate image** submits a generation once, and **Retrieve task** reads its existing task ID. A returned task ID or a green workflow run does not mean the image is finished.

## Quick start

### 1. Install the plugin

Use FastGPT 4.15 or later. In FastGPT Marketplace, search for **Ace Data Cloud GPT Image** and verify the author is **Ace Data Cloud** before installing. Until the Marketplace listing is published, an administrator of a business or self-hosted FastGPT instance can build and upload this repository's .pkg on the plugin management page. FastGPT Cloud does not currently allow users to upload custom plugins directly.

### 2. Get an application API key

1. Sign in to [Ace Data Cloud → Applications](https://platform.acedata.cloud/console/applications) and open **General Application**. Confirm **OpenAI generation** access, the current price, and sufficient balance.
2. Copy the existing API key using the icon marked **1** below. To create a separate FastGPT key, select **Manage Keys** marked **2**, then **Create**. Name it, set expiration or usage limits if useful, and copy the resulting key.
3. If you enable **Allowed APIs**, include both /openai/images/generations and /openai/tasks. A service-specific key must grant this service and task query.

![Actual Ace Data Cloud application screen with the key redacted](assets/get-api-key-en.png)

Copy only the token string. Do not add Bearer, quotes, or the redacted characters in the screenshot. A platform management token is not the generation API key.

### 3. Authorize and build the first workflow

In FastGPT's installed plugin configuration, enter the copied key in **Ace Data Cloud API key**. Keep the key out of prompts and workflow exports.

Create a blank workflow and connect:

**Start → Ace Data Cloud GPT Image / Generate image → Ace Data Cloud GPT Image / Retrieve task → Output**.

For **Generate image**, use these first-run values from [examples/generate.json](examples/generate.json):

| Field | Value |
|---|---|
| Prompt | A single blue paper sphere on a plain cream background, clean studio photograph, no text. FastGPT integration test. |
| Model | gpt-image-2 |
| Size | 1024x1024 |
| Quality | low |

Bind **Retrieve task → Task ID** to the **Task ID** output of **Generate image** using FastGPT's variable picker. Do not type the node name as text. In **Output**, expose **status**, **success**, **taskId**, and **mediaUrls** from **Retrieve task**.

Run the workflow once. If status is **pending**, save its taskId. Run only **Retrieve task** with that same ID later, either directly or in a separate **Start → Retrieve task → Output** workflow. Do not rerun the full workflow to poll: that would buy another image.

When status is **succeeded** and success is **true**, open a URL in mediaUrls. In Ace Data Cloud request history, match the task ID to one generation and its Credits charge. The USD value of Credits depends on your current package rate.

### 4. Copyable local example without a key in the repository

The [sample input](examples/generate.json) contains no credentials. Create a local .secrets.local.json containing {"apiKey":"YOUR_OWN_KEY"} and run:

~~~sh
pnpm install
pnpm exec fastgpt-plugin debug . --run --tool generateImage --input-file examples/generate.json --secrets-file .secrets.local.json
pnpm exec fastgpt-plugin build --entry . --output ./dist
pnpm exec fastgpt-plugin check --entry . --output ./dist
pnpm exec fastgpt-plugin pack --entry . --dist ./dist --output ./out
~~~

If the result is pending, create a local examples/retrieve.local.json containing {"taskId":"THE_RETURNED_TASK_ID"} and query that same task:

~~~sh
pnpm exec fastgpt-plugin debug . --run --tool retrieveTask --input-file examples/retrieve.local.json --secrets-file .secrets.local.json
~~~

Both local files are ignored by Git. Never publish them or a screenshot of your key.

## Expected result

A completed task returns status=succeeded, success=true, and one or more HTTPS image URLs in mediaUrls. The taskId lets you check the same request without another generation. Generated media links may expire; save a permitted copy when needed.

## Troubleshooting

| What you see | What to do |
|---|---|
| 401 / 403 | Check the complete key, expiration, OpenAI generation access, Allowed APIs, and balance. |
| 400 | Use the exact example model, size, quality, and one image. Check the invalid parameter. |
| pending or empty mediaUrls | Query the same taskId later. Never regenerate just to poll. |
| 429 | Wait and reduce concurrency. Do not enable automatic paid retries. |
| Timeout, 5xx, or failed task | Inspect the original task and request history before resubmitting. Give support the taskId or traceId, never your key. |

The plugin sends your selected inputs and credential to api.acedata.cloud. Calls follow [current service pricing](https://platform.acedata.cloud/models). [Source and support](https://github.com/AceDataCloud/GPTImageFastGPT/issues).
