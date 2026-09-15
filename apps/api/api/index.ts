import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { Express } from "express";
import { createApp } from "../src/create-app";

// Vercel's Node.js runtime calls this handler with plain (req, res)
// objects - the same shape Node's own http.createServer expects. An
// Express app instance is *itself* directly callable with that exact
// signature (Express apps satisfy Node's request-listener interface
// natively), so no Lambda-style adapter is needed or correct here - that
// would only be right for AWS Lambda's event/context invocation model,
// which is not what Vercel uses.
//
// Cached at module scope so a warm container (a request arriving while a
// previous one's container is still alive) skips NestJS's full bootstrap
// and only a genuine cold start pays that cost.
let cachedApp: Express | undefined;

async function getExpressApp(): Promise<Express> {
  if (!cachedApp) {
    const app = await createApp();
    await app.init(); // wires up the HTTP layer without calling listen()
    cachedApp = app.getHttpAdapter().getInstance();
  }
  return cachedApp;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const expressApp = await getExpressApp();
  expressApp(req, res);
}
