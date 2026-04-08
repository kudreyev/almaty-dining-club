import 'dotenv/config';
import { z } from 'zod';
const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().default(4000),
    APP_URL: z.string().url(),
    FRONTEND_URL: z.string().url(),
    DATABASE_URL: z.string().min(1),
    SESSION_SECRET: z.string().min(32),
    SESSION_COOKIE_NAME: z.string().default('adc_session'),
    SESSION_TTL_SECONDS: z.coerce.number().default(60 * 60 * 24 * 30),
    WHATSAPP_LOGIN_CODE_SECRET: z.string().min(16),
    TWILIO_ACCOUNT_SID: z.string().optional(),
    TWILIO_AUTH_TOKEN: z.string().optional(),
    TWILIO_PHONE_NUMBER: z.string().optional(),
    TWILIO_CONTENT_SID_VERIFICATION: z.string().optional(),
    S3_ENDPOINT: z.string().url(),
    S3_REGION: z.string().default('us-east-1'),
    S3_ACCESS_KEY_ID: z.string().min(1),
    S3_SECRET_ACCESS_KEY: z.string().min(1),
    S3_BUCKET: z.string().min(1),
    S3_FORCE_PATH_STYLE: z
        .string()
        .optional()
        .transform((v) => (v ? v === 'true' : true)),
    S3_PUBLIC_BASE_URL: z.string().url(),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    throw new Error(`Invalid backend env: ${parsed.error.message}`);
}
export const env = parsed.data;
