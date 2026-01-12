import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs'
import { mkdir } from 'node:fs/promises';
import config from './config.js';
import * as feishu from './feishu.js'
import diffSpaceNodes from './utils/diffSpaceNodes.js';
import getFormattedCurrentTime from './utils/getFormattedCurrentTime.js';
import { replaceFileWithUrls } from './docx.js'

const __dirname = dirname(fileURLToPath(import.meta.url));

let report = {
    add: [],
    update: [],
    delete: []
}
const outputPath = join(__dirname, `${config.output.path}`);
const outputReportPath = join(__dirname, `${config.output.path}`, 'report');
const outputDocumentPath = join(__dirname, `${config.output.path}`, 'documents');

if (!fs.existsSync(outputPath)) {
    console.log(`📁 Create directory: ${outputPath}`);
    await mkdir(outputPath, { recursive: true });
}

if (!fs.existsSync(outputDocumentPath)) {
    console.log(`📁 Create origina document directory: ${outputDocumentPath}`);
    await mkdir(outputDocumentPath, { recursive: true });
}

if (!fs.existsSync(outputReportPath)) {
    console.log(`📁 Create report directory: ${outputReportPath}`)
    await mkdir(outputReportPath, { recursive: true });
}

let LocalAllSpaceNode = []
const NewAllSpaceNode = await feishu.getSpaceNodeAll2(config.feishu.spaceId)
const spaceNodeFilePath = join(__dirname, config.output.path, 'spaceNode.json')

const applyNodeChangesAndSave = async (spaceNode, action, allSpaceNode) => {
    let newAllSpaceNode = allSpaceNode
    let index = 0

    for (const item of spaceNode) {
        console.log('Current document info: ', `obj_token: ${item.obj_token}`, `title: ${item.title}`);

        const safeFileName = item.title.replace(/\//g, "_");

        const downloadedFilePath = await feishu.downloadDocumentAsDocx(item.obj_token, 'docx', join(outputDocumentPath, `${safeFileName}.docx`))
        console.log('Downloaded docx filePath: ', downloadedFilePath)

        const documentBlockAll = await feishu.getDocumentBlockAll(item.obj_token)

        const replaceFileList = []
        for (const item of documentBlockAll) {
            if (item.block_type === 23) {
                const fileToken = item.file.token
                const fileName = item.file.name
                const url = await feishu.saveFeishuFileToAWS(fileToken, fileName)
                console.log(`📁 Upload success (File): ${url}`)
                replaceFileList.push({
                    name: fileName,
                    keyword: `[${fileName}]`,
                    url: url,
                    type: 'File'
                })
            } else if (item.block_type === 27) {
                const fileToken = item.image.token
                const fileName = ''
                const url = await feishu.saveFeishuFileToAWS(fileToken, fileName)
                console.log(`📁 Upload success (Image): ${url}`)
                replaceFileList.push({
                    name: fileName,
                    keyword: fileName,
                    url: url,
                    type: 'Image'
                })
            }
        }

        if (replaceFileList.length != 0) {
            console.log('Document haven file or media, start replace file with url.', `total: ${replaceFileList.length}.`)
            await replaceFileWithUrls(downloadedFilePath, replaceFileList)
        } else {
            console.log('There are no files or media files in the document, skip replace file with url')
        }

        if (action === 'ADD') {
            console.log('Update local space node file list: ', `obj_token: ${item.obj_token}`, `title: ${item.title}`);
            newAllSpaceNode.push(item)
            report.add.push(item)
            fs.writeFileSync(spaceNodeFilePath, JSON.stringify(newAllSpaceNode, null, 2))
        } else if (action === 'UPDATE') {
            console.log('Update space node: ', spaceNode.length)
            const index = spaceNode.filter((node) => node.obj_token === item.obj_token)
            if (index !== -1) {
                newAllSpaceNode[index] = item
                report.update.push(item)
                fs.writeFileSync(spaceNodeFilePath, JSON.stringify(newAllSpaceNode, null, 2))
            }
        }

        console.log('✅ Complete Document: ', `${index + 1}/${spaceNode.length} \n`)
        index++;
    }
}

const deleteSpaceNode = async (deleteSpaceNodeList, allSpaceNode) => {
    let newAllSpaceNode = allSpaceNode
    for (const item of deleteSpaceNodeList) {
        console.log('Delete space node: ', item.title)
        const index = newAllSpaceNode.findIndex((node) => node.obj_token === item.obj_token)
        if (index !== -1) {
            newAllSpaceNode.splice(index, 1)
        }
    }
    report.delete = deleteSpaceNodeList
    fs.writeFileSync(spaceNodeFilePath, JSON.stringify(newAllSpaceNode, null, 2))
    console.log('✅ Delete Complete Document. ', `delete_numbers: ${deleteSpaceNodeList.length} total: ${allSpaceNode.length} delete_result_numbers: ${newAllSpaceNode}\n`)
}

const queryLocalSpaceNode = async (filePath) => {
    if (fs.existsSync(filePath)) {
        LocalAllSpaceNode = JSON.parse(fs.readFileSync(filePath, 'utf8'))
        return LocalAllSpaceNode
    }
    return []
}

try {
    if (fs.existsSync(spaceNodeFilePath)) {
        LocalAllSpaceNode = queryLocalSpaceNode(spaceNodeFilePath)
        const { AddSpaceNodeList,
            DeleteSpaceNodeList,
            UpdateSpaceNodeList } = diffSpaceNodes(LocalAllSpaceNode, NewAllSpaceNode)
        if (AddSpaceNodeList.length === 0) {
            console.log('No new nodes were added: ', AddSpaceNodeList.length)
        } else {
            console.log('New node added: ', AddSpaceNodeList.length)
            LocalAllSpaceNode = queryLocalSpaceNode(spaceNodeFilePath)
            await applyNodeChangesAndSave(AddSpaceNodeList, 'ADD', LocalAllSpaceNode)
        }

        if (UpdateSpaceNodeList.length === 0) {
            console.log('No updated nodes: ', UpdateSpaceNodeList.length)

        } else {
            console.log('Update node: ', UpdateSpaceNodeList.length)
            LocalAllSpaceNode = queryLocalSpaceNode(spaceNodeFilePath)
            await applyNodeChangesAndSave(UpdateSpaceNodeList, 'UPDATE', LocalAllSpaceNode)
        }

        if (DeleteSpaceNodeList.length === 0) {
            console.log('No deleted nodes: ', DeleteSpaceNodeList.length)

        } else {
            console.log('Delete node: ', DeleteSpaceNodeList.length)
            LocalAllSpaceNode = queryLocalSpaceNode(spaceNodeFilePath)
            await deleteSpaceNode(DeleteSpaceNodeList, LocalAllSpaceNode)
        }

    } else {
        console.log('New node added: ', NewAllSpaceNode.length)
        await applyNodeChangesAndSave(NewAllSpaceNode, 'ADD', [])
    }
    fs.writeFileSync(join(outputReportPath, `${getFormattedCurrentTime()}.json`), JSON.stringify(report, null, 2))
} catch (error) {
    console.error(error.message)
    fs.writeFileSync(join(outputReportPath, `${getFormattedCurrentTime()}.json`), JSON.stringify(report, null, 2))
}


