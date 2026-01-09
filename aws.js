import { join } from 'path';
import { Upload } from '@aws-sdk/lib-storage';
import { S3Client } from '@aws-sdk/client-s3'
import config from './config.js'

const client = new S3Client({
    credentials: {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey
    },
    region: config.aws.region
})
export const uploadFile = async (uploadPath, data) => {
    try {
        const upload = new Upload({
            client: client,
            params: {
                Bucket: config.aws.bucket,
                Key: uploadPath,
                Body: data
            },
            queueSize: 4,
            partSize: 5 * 1024 * 1024,
        });

        upload.on('httpUploadProgress', (progress) => {
            console.log(`📊 Progress: ${progress.loaded} / ${progress.total}`);
        });

        try {
            const result = await upload.done();
            console.log(`✅ Done! ETag: ${result.ETag}`);
            if (config.aws.customDomain) {
                return join(config.aws.customDomain, uploadPath)
            }
            return encodeURIComponent(result.Location)
        } catch (error) {
            console.error('❌ Upload fail:', error);

            if (upload.singleUploadId) {
                console.log(`Upload ID: ${upload.singleUploadId}`);
            }
        }
    } catch (error) {
        console.error(`❌ Upload fail: ${uploadPath}`, error);
        throw error;
    }
}