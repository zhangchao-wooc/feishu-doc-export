import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs'
import { mkdir } from 'node:fs/promises';
import config from './config.js';
import * as feishu from './feishu.js'
import replaceFileWithUrls from './docx.js'

const __dirname = dirname(fileURLToPath(import.meta.url));

const outputPath = join(__dirname, `${config.output.path}`);
const outputDocumentPath = join(__dirname, `${config.output.documentPath}`);

if (!fs.existsSync(outputPath)) {
    console.log(`📁 创建目录: ${outputPath}`);
    await mkdir(outputPath, { recursive: true });
}

if (!fs.existsSync(outputDocumentPath)) {
    console.log(`📁 创建 Document 目录: ${outputDocumentPath}`);
    await mkdir(outputDocumentPath, { recursive: true });
}

const AllSpaceNode = await feishu.getSpaceNodeAll2(config.feishu.spaceId)
fs.writeFileSync(join(__dirname, config.output.path, 'spaceNode.json'), JSON.stringify(AllSpaceNode, null, 2))

AllSpaceNode.forEach(async (item) => {
    const docMeta = await feishu.getDocMeta(item.obj_token)
    console.log('Doc Meta', `document_id: ${docMeta.document.document_id}`, `title: ${docMeta.document.title}`);

    const downloadedFilePath = await feishu.downloadDocumentAsDocx(item.obj_token, 'docx', join(outputDocumentPath, `${docMeta.document.title}.docx`))
    console.log('Downloaded Docx FilePath', downloadedFilePath)

    const documentBlockAll = await feishu.getDocumentBlockAll(obj_token)

    documentBlockAll.forEach(async (item) => {
        if (item.block_type === 23) {
            const fileToken = item.file.token
            const fileName = item.file.name
            const url = await feishu.saveFeishuFileToAWS(fileToken, join(config.aws.key, fileName))
            console.log(`✅ 完成: ${url}`)
        }
    })

    replaceFileWithUrls(downloadedFilePath, docMeta.document.title)
})