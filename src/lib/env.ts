import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  STORAGE_ROOT: z.string().default("./data"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  EXPORT_RENDER_TOKEN: z.string().min(24),
  CHROMIUM_EXECUTABLE_PATH: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().optional(),
  BACKUP_ENCRYPTION_KEY: z.string().optional(),
});

let cached: z.infer<typeof schema> | undefined;

export function env() {
  cached ??= schema.parse(process.env);
  return cached;
}
