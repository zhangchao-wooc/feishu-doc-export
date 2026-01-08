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
            queueSize: 4,      // 4个分片并发上传
            partSize: 5 * 1024 * 1024, // 1 MB 分片
        });

        upload.on('httpUploadProgress', (progress) => {
            console.log(`📊 进度: ${progress.loaded} / ${progress.total}`);
        });

        try {
            const result = await upload.done();
            console.log(`✅ 完成! ETag: ${result.ETag}`);
            if (config.aws.customDomain) {
                return join(config.aws.customDomain, uploadPath)
            }
            return result.Location
        } catch (error) {
            console.error('❌ 上传失败:', error);

            // 4. 可选的恢复机制
            if (upload.singleUploadId) {
                console.log(`上传ID: ${upload.singleUploadId}`);
                // 可以保存这个 ID 用于后续恢复
            }
        }
    } catch (error) {
        console.error(`❌ 上传失败: ${uploadPath}`, error);
        throw error;
    }
}