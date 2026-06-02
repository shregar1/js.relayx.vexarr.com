# RelayX JavaScript / TypeScript SDK

TypeScript SDK for the [RelayX](https://relayx.vexarr.com) OpenAI-compatible AI gateway.

```ts
import { RelayXClient } from "@relayx/sdk";

const client = new RelayXClient({ apiKey: process.env.RELAYX_API_KEY! });

await client.chatCompletions({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello from RelayX" }],
});
```

## Build

```bash
npm install
npm run build
```
