import { join } from 'path';
import { v4 as uuidv4 } from 'uuid'
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createHash } from 'node:crypto';
import fs from 'fs';
import os from 'os';
import * as lark from '@larksuiteoapi/node-sdk';
import { uploadFile, findObjectByFilename } from './aws.js';
import config from './config.js';

export const client = new lark.Client({
    appId: config.feishu.appId,
    appSecret: config.feishu.appSecret
});

export const getDocMeta = async (docId) => {
    const res = await client.docx.v1.document.get({
        path: {
            document_id: docId
        }
    })
    return res.data
}

export const getMediaFile = async (fileToken) => {
    const TAG = 'getMediaFile'
    try {
        const res = await client.drive.v1.media.download({
            path: {
                file_token: fileToken,
            }
        })
        return res
    } catch (error) {
        console.error(error.message)
    }
}

export const downloadMediaFile = async (fileToken, fileName) => {
    try {
        const res = await client.drive.v1.media.download({
            path: {
                file_token: fileToken,
            }
        })
        res.writeFile(fileName);
    } catch (error) {
        console.error(error.message)
        console.log(`Download ${fileToken} fail！`)
    }
}

export const parseExtensionFromContentDisposition = (contentDisposition) => {
    if (!contentDisposition) {
        return null;
    }

    const filenameMatch = contentDisposition.match(/filename\*?=['"]?(?:UTF-\d['"]*)?([^;\r\n"']*)['"]?/i);
    if (filenameMatch && filenameMatch[1]) {
        let filename = decodeURIComponent(filenameMatch[1].replace(/\+/g, ' '));
        const lastDot = filename.lastIndexOf('.');
        if (lastDot > 0) {
            return filename.substring(lastDot + 1).toLowerCase();
        }
    }

    return '';
}

export const parseFileSizeFromContentLength = (contentLength) => {
    if (!contentLength) {
        return null;
    }

    const sizeUnits = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = parseInt(contentLength);
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < sizeUnits.length - 1) {
        size /= 1024;
        unitIndex++;
    }

    return `${size.toFixed(2)} ${sizeUnits[unitIndex]}`;
}

export const saveFeishuFileToAWS = async (fileToken, filename) => {
    const res = await getMediaFile(fileToken)
    let uploadPath = config.aws.key

    // 获取文件后缀, 某些情况下会为空则以无后缀名上传，例终端的截图
    let fileExtension = filename ? filename.substring(filename.lastIndexOf('.') + 1) : null
    if (!fileExtension) {
        const contentDisposition = res?.headers['content-disposition'] || ''
        fileExtension = parseExtensionFromContentDisposition(contentDisposition)
    }
    fileExtension = fileExtension ? `.${fileExtension}` : ''

    // 将远程流写入临时文件，同时计算 md5
    const readable = res.getReadableStream && res.getReadableStream();
    if (!readable) {
        throw new Error('No readable stream from getMediaFile response');
    }

    let contentLength = 0

    const tmpPath = join(os.tmpdir(), `${uuidv4()}${fileExtension}`)
    const writeStream = fs.createWriteStream(tmpPath);

    const hash = createHash('md5');
    const md5Transform = new Transform({
        transform(chunk, encoding, callback) {
            contentLength += chunk.length;
            hash.update(chunk);
            callback(null, chunk);
        }
    });

    await pipeline(readable, md5Transform, writeStream);
    const md5 = hash.digest('hex');
    const fileName = `${md5}${fileExtension}`


    // 检查是否已有相同 md5 的文件
    const existUrl = await findObjectByFilename(fileName);
    if (existUrl) {
        console.log(`🈶 File already exists in AWS: ${existUrl}`);
        try { fs.unlinkSync(tmpPath) } catch (e) { }
        return existUrl;
    }

    // 上传以 md5.ext 为文件名
    uploadPath = join(uploadPath, fileName)

    const readForUpload = fs.createReadStream(tmpPath);
    const url = await uploadFile(uploadPath, readForUpload, contentLength)

    try { fs.unlinkSync(tmpPath) } catch (e) { }
    return url
}

export const getDocContentMarkdown = async (docToken) => {
    const res = await client.docs.v1.content.get({
        params: {
            doc_token: docToken,
            doc_type: 'docx',
            content_type: 'markdown'
        },
    })
    return res.data.content
}

export const getDocContentDocx = async (docToken) => {
    const res = await client.docs.v1.content.get({
        params: {
            doc_token: docToken,
            doc_type: 'docx',
            content_type: 'docx'
        },
    })
    return res.data.content
}

export const getDocumentBlockAll = async (documentId, page_token = '') => {
    const response = await client.docx.v1.documentBlock.list({
        path: {
            document_id: documentId,
        },
        params: {
            page_size: 500,
            document_revision_id: -1,
            page_token: page_token,
        },
    });

    let allItems = response.data.items || [];

    if (response.data.has_more) {
        const moreItems = await getDocumentBlockAll(documentId, response.data.page_token);
        allItems = allItems.concat(moreItems);
    }

    return allItems;
}

export const getSpaceNode = async (spaceId, parentNodeToken = '') => {
    let allNodes = [];
    let hasMore = true;

    while (hasMore) {
        try {
            const response = await client.wiki.v2.spaceNode.list({
                path: {
                    space_id: spaceId
                },
                params: {
                    page_size: 50,
                    parent_node_token: parentNodeToken,
                },
            })

            if (response.code !== 0) {
                throw new Error(`Failed to get space nodes: ${response.msg}`);
            }

            if (response.data && response.data.items) {
                allNodes = allNodes.concat(response.data.items);
                console.log(`Obtained ${response.data.items.length} nodes`);
            }

            hasMore = response.data.has_more;
        } catch (error) {
            console.error(error.response);
            throw new Error(`Error getting space nodes: ${error.message}`);
        }
    }

    return allNodes
}

export const getSpaceNodeAll2 = async (spaceId, parentNodeToken = '', structure = false) => {
    let allNodes = [];

    const currentLevelNodes = await getSpaceNode(spaceId, parentNodeToken);
    allNodes = allNodes.concat(currentLevelNodes);
    // Keep directory level
    if (structure) {
        let index = 0
        for (const node of currentLevelNodes) {
            if (node.has_child) {
                const childNodes = await getSpaceNodeAll2(spaceId, node.node_token, structure);
                allNodes[index]['child_nodes'] = childNodes
            }
            index++
        }
    } else {
        // A single-level array
        for (const node of currentLevelNodes) {
            if (node.has_child) {
                const childNodes = await getSpaceNodeAll2(spaceId, node.node_token);
                allNodes = allNodes.concat(childNodes);
            }
        }
    }

    return allNodes;
}

// 官方 listWithIterator 接口有 bug 待修复，故使用 getSpaceNodeAll2 处理节点。
export const getSpaceNodeAll = async (spaceId) => {
    // for await (const item of await client.wiki.v2.spaceNode.listWithIterator({
    //     path: {
    //         space_id: spaceId,
    //     },
    //     params: {
    //         page_size: 10
    //     },
    // }
    // )) {
    //     console.log(item);
    //     return item.items
    // }

    for await (const item of await client.wiki.v2.spaceNode.listWithIterator({
        path: {
            space_id: spaceId,
        },
        params: {
            page_size: 50
        },
    }
    )) {
        console.log(item);
    }
}

export const createExportTask = async (fileExtension, token, type) => {
    console.log('createExportTask', fileExtension, token, type)
    try {
        const response = await client.drive.v1.exportTask.create({
            data: {
                file_extension: fileExtension,
                token: token,
                type: type
            },
        })

        if (response.code !== 0) {
            console.error("ERROR: failed to create export task", response);
            throw new Error(`failed to create export task: ${response.msg}`);
        }

        console.log("Success to create export task，ticket:", response.data.ticket);
        return response.data.ticket;
    } catch (error) {
        console.error(error.response);
        throw new Error(`Error creating export task: ${error.message}`);
    }
}

export const queryExportTask = async (ticket, token) => {
    try {
        const response = await client.drive.v1.exportTask.get({
            path: {
                ticket: ticket,
            },
            params: {
                token: token,
            },
        });

        if (response.code !== 0) {
            console.error("ERROR: failed to query export task", response);
            throw new Error(`failed to query export task: ${response.msg}`);
        }

        console.log("Export task status:", response.data.result.job_status);
        return response.data.result;
    } catch (error) {
        console.error(error.response);
        throw new Error(`Error querying export task: ${error.message}`);
    }
}

export const downloadExportFile = async (fileToken, outputPath) => {
    console.log('⬇️  Download export file', fileToken, outputPath)
    try {
        const response = await client.drive.v1.exportTask.download({
            path: {
                file_token: fileToken,
            },
        })

        await response.writeFile(outputPath);

        console.log(`✅ File download success, address: ${outputPath}`);

        return outputPath;
    } catch (error) {
        console.error(error.response);
        throw new Error(`Error downloading export file: ${error.message}`);
    }
}

export const downloadDocumentAsDocx = async (docToken, docType, outputPath) => {
    try {
        const ticket = await createExportTask('docx', docToken, docType);

        // Query export task status
        let exportResult = null;
        let retryCount = 0;
        const maxRetries = 30;
        const retryInterval = 2000;

        while (retryCount < maxRetries) {
            exportResult = await queryExportTask(ticket, docToken);

            if (exportResult.job_status === 0) {
                console.log("Export task completed successfully!");
                break;
            } else if (exportResult.job_status === 1 || exportResult.job_status === 2) {
                console.log(
                    `Exporting，status: ${exportResult.job_status}，retry in ${retryInterval / 1000} seconds...`
                );
                await new Promise((resolve) => setTimeout(resolve, retryInterval));
                retryCount++;
            } else {
                console.error("ERROR: export task fail", exportResult);
                throw new Error(
                    `export task fail，status code : ${exportResult.job_status}, error info: ${exportResult.job_error_msg}`
                );
            }
        }

        if (retryCount >= maxRetries) {
            throw new Error("Export task timed out");
        }

        const downloadedFilePath = await downloadExportFile(
            exportResult.file_token,
            outputPath
        );

        return downloadedFilePath;
    } catch (error) {
        console.error("ERROR: failed to download the document in docx format:", error.message);
        throw error;
    }
}