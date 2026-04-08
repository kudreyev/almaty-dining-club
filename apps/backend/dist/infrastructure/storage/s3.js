import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { env } from '@/common/config/env';
export const s3Client = new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
});
export async function uploadPublicObject(args) {
    await s3Client.send(new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: args.key,
        Body: args.body,
        ContentType: args.contentType,
    }));
    return `${env.S3_PUBLIC_BASE_URL}/${env.S3_BUCKET}/${args.key}`;
}
