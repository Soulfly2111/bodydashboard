import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().default("file:./dev.db"),
  JWT_SECRET: z.string().min(12).default("change-this-in-production"),
  ENCRYPTION_KEY: z.string().min(32).default("0123456789abcdef0123456789abcdef"),
  PORT: z.coerce.number().default(4000),
  WEB_ORIGIN: z.string().default("http://localhost:5173"),
  META_WHATSAPP_VERIFY_TOKEN: z.string().default(""),
  META_WHATSAPP_APP_SECRET: z.string().default("")
});

export const env = schema.parse(process.env);
