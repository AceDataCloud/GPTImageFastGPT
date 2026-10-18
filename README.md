# GPT Image by Ace Data Cloud for FastGPT

This independent plugin is maintained by **Ace Data Cloud** and uses your Ace application API token. It integrates GPT Image; it is not an official GPT Image or FastGPT plugin.

Generate one image and retrieve its result in a FastGPT workflow. [简体中文](README_zh_CN.md) · [Models and current pricing](https://platform.acedata.cloud/models?utm_source=opensource&utm_medium=referral&utm_campaign=evergreen&utm_content=gptimagefastgpt_readme_pricing)

Use **Generate GPT Image** or **Edit GPT Image image** to submit an operation once. **Retrieve GPT Image task** and **Retrieve GPT Image tasks** read existing task IDs. A returned task ID or a green workflow run does not mean the image is finished.

## Quick start

### 1. Install the plugin

[Official FastGPT plugin Marketplace](https://cloud.fastgpt.io/config/tool/marketplace) · [Current listing review](https://github.com/labring/fastgpt-community-plugins/pull/71). This candidate is not listed yet; the review link is not an install button.

Use FastGPT 4.15 or later. In FastGPT Marketplace, search for **GPT Image by Ace Data Cloud** and verify the author is **Ace Data Cloud** before installing. Until the Marketplace listing is published, an administrator of a business or self-hosted FastGPT instance can build and upload this repository's .pkg on the plugin management page. FastGPT Cloud does not currently allow users to upload custom plugins directly.

### 2. Get an application API key

New account? Register and sign in first. If General application is missing, choose **Initialize General Application** in Applications. This token belongs to Ace Data Cloud, not your FastGPT login.

1. Sign in to [Ace Data Cloud → Applications](https://platform.acedata.cloud/console/applications?utm_source=opensource&utm_medium=referral&utm_campaign=evergreen&utm_content=gptimagefastgpt_readme_api_key) and open **General Application**. Confirm **OpenAI generation** access, the current price, and sufficient balance.
2. Copy the existing API key using the icon marked **1** below. To create a separate FastGPT key, select **Manage Keys** marked **2**, then **Create**. Name it, set expiration or usage limits if useful, and copy the resulting key.
3. If you enable **Allowed APIs**, include /openai/images/generations and /openai/tasks. To use **Edit GPT Image image**, also allow /openai/images/edits. A service-specific key must grant this service and task query.

![Actual Ace Data Cloud application screen with the key redacted](assets/get-api-key-en.png)

Copy only the token string. Do not add Bearer, quotes, or the redacted characters in the screenshot. A platform management token is not the generation API key.

To create an optional dedicated token, choose **Manage Keys → Create**, give it a name such as `FastGPT GPT Image`, set only the expiration and API restrictions you need, then create and copy it. Use the service and task paths listed above.

![Real Ace Console Create New Credential dialog](assets/create-api-key-en.png)

This is a real Ace Console screenshot reused from the [Suno Dify source guide](https://github.com/AceDataCloud/SunoDify/blob/8d3d03570e73324220f111f7fe343da0792a8071/README.md), 2026-10-08/09. The image uses the example name `Dify tutorial`; use your own FastGPT token name. No live credential is shown.

### 3. Authorize and build the first workflow

In FastGPT's installed plugin configuration, enter the copied key in **Ace Data Cloud API key**. Keep the key out of prompts and workflow exports.

In **Studio → Create Agent → Workflow**, start with **Process starts**. From **System Tools**, add **GPT Image by Ace Data Cloud / Generate GPT Image** and **Retrieve GPT Image task**. Activate both tools with the configured **System secret**. Connect **Process starts → Generate GPT Image → Retrieve GPT Image task → Basic / Assigned Reply**.

For **Generate GPT Image**, use these first-run values from [examples/generate.json](examples/generate.json):

| Field | Value |
|---|---|
| Prompt | A single blue paper sphere on a plain cream background, clean studio photograph, no text. FastGPT integration test. |
| Model | gpt-image-2 |
| Size | 1024x1024 |
| Quality | low |
| Image count | 1 |

For **Retrieve GPT Image task → Task ID**, choose **Variable Reference → Generate GPT Image → Task ID**; do not type the node name. In **Assigned Reply**, insert **status**, **success**, **taskId**, and **mediaUrls** from Retrieve GPT Image task with the variable picker. Choose **Save Only**, then **Run Preview** once.

If status is **pending**, save its taskId. To check later, create a separate **Process starts → Retrieve GPT Image task → Basic / Assigned Reply** workflow and enter that same ID. Run this lookup in **Run Preview**. Do not rerun the generation workflow to poll: that would buy another image.

When status is **succeeded** and success is **true**, open a URL in mediaUrls. In Ace Data Cloud request history, match the task ID to one generation and its Credits charge. The USD value of Credits depends on your current package rate.

This local FastGPT run submitted **one new GPT Image task**. The first preview returned its task ID while the image was pending; a separate lookup of that same ID returned the completed image.

![Installed plugin with Normal status and Configured system key](assets/fastgpt-installed-configured.png)

![Complete FastGPT generation workflow](assets/fastgpt-generation-workflow.png)

![First preview returned a pending task ID](assets/fastgpt-pending-result.png)

![Separate lookup returned the completed image URL](assets/fastgpt-lookup-result.png)

For edits, **Edit GPT Image image** accepts one authorized HTTPS reference image URL. It returns a task ID; connect that ID to the same **Retrieve GPT Image task** tool. Editing is a separate billable submission.

For several existing tasks, **Retrieve GPT Image tasks** accepts 1–20 Task IDs and queries them in one read-only call. Check each item’s status; a batch is complete only when all items succeed. This does not submit new generation.

A batch stays pending if a requested task is missing or a returned task ID cannot be matched. Verify the existing IDs; do not submit generation again.

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

The plugin sends your selected inputs and credential to api.acedata.cloud. Calls follow [current service pricing](https://platform.acedata.cloud/models?utm_source=opensource&utm_medium=referral&utm_campaign=evergreen&utm_content=gptimagefastgpt_readme_pricing). [Source and support](https://github.com/AceDataCloud/GPTImageFastGPT/issues).

## Screenshot scope

FastGPT screenshots below/above are real self-hosted FastGPT 4.15.8 test captures from 2026-10-09. They show the earlier display names and plugin 0.1.0. Current 0.2.2 service-first names and Marketplace installation are not established by those historical images.
