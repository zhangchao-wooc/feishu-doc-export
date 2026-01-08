import fs from 'fs'
import * as lark from '@larksuiteoapi/node-sdk';
import { uploadFile } from './aws.js';
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
        console.log(`D ${fileToken} 失败！`)
    }
}

export const saveFeishuFileToAWS = async (fileToken, uploadPath) => {
    const res = await getMediaFile(fileToken)
    const url = await uploadFile(uploadPath, res.getReadableStream())
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

export const getDocumentBlockAll = async (documentId) => {
    for await (const item of await client.docx.v1.documentBlock.listWithIterator({
        path: {
            document_id: documentId,
        },
        params: {
            page_size: 500,
            document_revision_id: -1,
        },
    }
    )) {
        return item.items;
    }
}

export const getSpaceNode = async (spaceId, parentNodeToken = '') => {
    let allNodes = [];
    let pageToken = "";
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
                console.error("ERROR: 获取知识空间子节点失败", response);
                throw new Error(`failed to get space nodes: ${response.msg}`);
            }

            if (response.data && response.data.items) {
                allNodes = allNodes.concat(response.data.items);
                console.log(`获取到 ${response.data.items.length} 个节点`);
            }

            hasMore = response.data.has_more;
            pageToken = response.data.page_token;
        } catch (error) {
            console.error(error.response);
            throw new Error(`Error getting space nodes: ${error.message}`);
        }
    }

    return allNodes
}

export const getSpaceNodeAll2 = async (spaceId, parentNodeToken = '') => {
    // 递归获取所有层级的节点
    let allNodes = [];

    // 获取当前层级的节点
    const currentLevelNodes = await getSpaceNode(spaceId, parentNodeToken);
    allNodes = allNodes.concat(currentLevelNodes);

    // 对每个有子节点的节点递归获取其子节点

    // 保持目录层级
    // currentLevelNodes.forEach(async (node, index) => {
    //     if (node.has_child) {
    //         const childNodes = await getSpaceNodeAll2(spaceId, node.node_token);
    //         allNodes[index][child_nodes] = allNodes.concat(childNodes);
    //     }
    // })
    for (const node of currentLevelNodes) {
        if (node.has_child) {
            const childNodes = await getSpaceNodeAll2(spaceId, node.node_token);
            allNodes = allNodes.concat(childNodes);
        }
    }

    return allNodes;
}

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
            console.error("ERROR: 创建导出任务失败", response);
            throw new Error(`failed to create export task: ${response.msg}`);
        }

        console.log("导出任务创建成功，ticket:", response.data.ticket);
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
            console.error("ERROR: 查询导出任务失败", response);
            throw new Error(`failed to query export task: ${response.msg}`);
        }

        console.log("导出任务状态:", response.data.result.job_status);
        return response.data.result;
    } catch (error) {
        console.error(error.response);
        throw new Error(`Error querying export task: ${error.message}`);
    }
}

export const downloadExportFile = async (fileToken, outputPath) => {
    console.log('downloadExportFile', fileToken, outputPath)
    try {
        const response = await client.drive.v1.exportTask.download({
            path: {
                file_token: fileToken,
            },
        })

        // 保存文件
        await response.writeFile(outputPath);

        console.log(`文件下载完成，已保存到: ${outputPath}`);

        return outputPath;
    } catch (error) {
        console.error(error.response);
        throw new Error(`Error downloading export file: ${error.message}`);
    }
}

export const downloadDocumentAsDocx = async (docToken, docType, outputPath) => {
    try {
        // 创建导出任务
        const ticket = await createExportTask('docx', docToken, docType);

        // 轮询查询导出任务结果
        let exportResult = null;
        let retryCount = 0;
        const maxRetries = 30; // 最大重试次数
        const retryInterval = 2000; // 重试间隔2秒

        while (retryCount < maxRetries) {
            exportResult = await queryExportTask(ticket, docToken);

            if (exportResult.job_status === 0) {
                // 导出成功
                console.log("导出任务完成");
                break;
            } else if (exportResult.job_status === 1 || exportResult.job_status === 2) {
                // 任务初始化或处理中，等待后重试
                console.log(
                    `导出任务处理中，状态: ${exportResult.job_status}，${retryInterval / 1000}秒后重试...`
                );
                await new Promise((resolve) => setTimeout(resolve, retryInterval));
                retryCount++;
            } else {
                // 其他错误状态
                console.error("ERROR: 导出任务失败", exportResult);
                throw new Error(
                    `导出任务失败，状态码: ${exportResult.job_status}, 错误信息: ${exportResult.job_error_msg}`
                );
            }
        }

        if (retryCount >= maxRetries) {
            throw new Error("导出任务超时");
        }

        // 下载导出文件
        const downloadedFilePath = await downloadExportFile(
            exportResult.file_token,
            outputPath
        );

        return downloadedFilePath;
    } catch (error) {
        console.error("ERROR: 下载文档为docx格式失败:", error.message);
        throw error;
    }
}