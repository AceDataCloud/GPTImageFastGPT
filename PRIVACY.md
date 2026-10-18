# Privacy

This plugin runs inside the FastGPT Plugin service. It sends the chosen prompt, model settings, and application API key over HTTPS to api.acedata.cloud to submit one image generation. The retrieval tool sends only the existing task ID and the same key to read task status. The plugin has no separate telemetry endpoint or persistent storage.

FastGPT stores the key through its plugin secret configuration. Do not put keys in workflow inputs, exported examples, screenshots, or support requests. Generated images and request records are governed by the [Ace Data Cloud privacy terms](https://platform.acedata.cloud/privacy). The FastGPT administrator controls plugin installation and credential access.
