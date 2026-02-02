import { join } from 'path';
import { Upload } from '@aws-sdk/lib-storage';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3'
import { NodeHttpHandler } from "@smithy/node-http-handler";
import ProgressBar from 'progress'
import config from './config.js'

const client = new S3Client({
    credentials: {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey
    },
    region: config.aws.region,
    requestHandler: new NodeHttpHandler({
        connectionTimeout: 15000, // 连接超时（毫秒）
    }),
})
export const uploadFile = async (uploadPath, data, contentLength) => {
    console.log(`⬆️  Uploading file to AWS: ${uploadPath}`)
    const partSize = 5  // MB

    const progressBar = new ProgressBar(`Uploading  [:bar] :percent :rate / bps size: ${(contentLength / 1024 / 1024).toFixed(2)} M  :eta`, {
        total: parseInt(contentLength, 10),
        width: 20
    });

    console.log('UploadFile', uploadPath)
    try {
        const upload = new Upload({
            client: client,
            params: {
                Bucket: config.aws.bucket,
                Key: uploadPath,
                Body: data
            },
            queueSize: 4,
            partSize: partSize * 1024 * 1024 // bytes
        });

        upload.on('httpUploadProgress', (progress) => {
            progressBar.tick(progress.loaded);
        });

        try {
            const result = await upload.done();
            if (config.aws.customDomain) {
                return join(config.aws.customDomain, uploadPath)
            }
            console.log(`ETag: ${result.ETag} \n Url: ${encodeURIComponent(result.Location)} \n ✅ Done! \n`);
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

export const findObjectByFilename = async (filename) => {
    try {
        const key = join(config.aws.key, filename);
        const cmd = new HeadObjectCommand({
            Bucket: config.aws.bucket,
            Key: key,
        });
        await client.send(cmd);
        if (config.aws.customDomain) {
            return join(config.aws.customDomain, key);
        }
        return encodeURIComponent(`https://${config.aws.bucket}.s3.${config.aws.region}.amazonaws.com/${key}`);
    } catch (error) {
        // 若对象不存在，HeadObject 会抛错，返回 null 表示未找到
        if (error && (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404)) {
            return null;
        }
        console.error('Error finding object by md5 filename', error);
        throw error;
    }
}