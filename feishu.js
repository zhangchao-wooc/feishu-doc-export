import { join } from 'path';
import { v4 as uuidv4 } from 'uuid'
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
        console.log(`Download ${fileToken} fail！`)
    }
}

export const parseFilenameFromContentDisposition = (contentDisposition) => {
    if (!contentDisposition) {
        return null;
    }

    const filenameMatch = contentDisposition.match(/filename\*?=['"]?(?:UTF-\d['"]*)?([^;\r\n"']*)['"]?/i);
    if (filenameMatch && filenameMatch[1]) {
        let filename = decodeURIComponent(filenameMatch[1].replace(/\+/g, ' '));
        return filename;
    }

    return null;
}

export const saveFeishuFileToAWS = async (fileToken, filename) => {
    const res = await getMediaFile(fileToken)
    let uploadPath = config.aws.key
    let newFilename = `${uuidv4()}-`
    if (!filename) {
        const parseFilename = parseFilenameFromContentDisposition(res.headers['content-disposition'])
        if (!parseFilename) {
            console.error("ERROR: Parse filename failed.");
            throw new Error("Parse filename failed.");
        }
        newFilename += parseFilename
    }
    newFilename += filename

    uploadPath = join(uploadPath, newFilename)

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
    let allNodes = [];

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
    console.log('downloadExportFile', fileToken, outputPath)
    try {
        const response = await client.drive.v1.exportTask.download({
            path: {
                file_token: fileToken,
            },
        })

        await response.writeFile(outputPath);

        console.log(`File download success, address: ${outputPath}`);

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