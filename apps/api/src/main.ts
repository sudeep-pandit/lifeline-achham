import { createApp } from "./create-app";

async function bootstrap() {
  const app = await createApp();
  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Lifeline Achham API listening on port ${port}`);
}

bootstrap();
