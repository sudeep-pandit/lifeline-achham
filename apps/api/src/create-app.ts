import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { json, urlencoded } from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

// Every app-level setup step lives here, in exactly one place, so the two
// entry points below can never drift apart:
//  - main.ts:      a traditional long-running server (Railway, local dev,
//                   any host that keeps a process alive) - calls app.listen().
//  - api/index.ts: a Vercel serverless function - never calls app.listen(),
//                  since Vercel invokes the exported handler per-request
//                  instead of running a persistent server.
export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule);

  // Member photos, template logos/reference images, and custom fonts are
  // all uploaded as base64 in the request body (no object storage is wired
  // up yet - see docs/DATABASE_PLAN.md), which inflates ~33% over the raw
  // file size. Express's default 100kb JSON limit is far too small for
  // that; 10mb comfortably covers a several-megabyte image or font file.
  app.use(json({ limit: "10mb" }));
  app.use(urlencoded({ extended: true, limit: "10mb" }));

  app.use(helmet());
  app.use(cookieParser());

  const allowedOrigins = (process.env.WEB_URL ?? "http://localhost:3000")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const isListed = allowedOrigins.includes(origin);
      const isVercelPreview = /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin);
      callback(null, isListed || isVercelPreview);
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.setGlobalPrefix("api/v1");

  return app;
}
