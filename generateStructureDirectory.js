import fs from 'fs'
import { join } from 'path';
import { mkdir, rm } from 'node:fs/promises';
import * as feishu from './feishu.js'
import config from './config.js';
import __dirname from './dirname.js';

const createStructureDirectory = async (structureNode, sourcePath, outputPath) => {
    for (const item of structureNode) {
        const safeFileName = item.title.replace(/\//g, "_");
        const sourceFilePath = join(sourcePath, `${safeFileName}.docx`)
        const outputFilePath = join(outputPath, `${safeFileName}.docx`)

        // If child_nodes exists, create a new directory
        if (item?.child_nodes && item?.child_nodes.length > 0) {
            const outputDirectory = join(outputPath, safeFileName)
            if (!fs.existsSync(outputDirectory)) {
                console.log(`📁 Create origina document directory: ${outputDirectory}`);
                await mkdir(outputDirectory, { recursive: true });
                const outputDirectoryFilePath = join(outputDirectory, `${safeFileName}.docx`)
                // Copy current directory file to new directory.
                fs.cpSync(sourceFilePath, outputDirectoryFilePath, { recursive: true });
            }

            await createStructureDirectory(item.child_nodes, sourcePath, outputDirectory)
        } else {
            // Copy to current directory
            fs.cpSync(sourceFilePath, outputFilePath, { recursive: true });
        }
    }
}

const generateStructureDirectory = async () => {
    const sourceDocumentPath = join(__dirname, `${config.output.path}`, 'documents');
    const outputDocumentStructurePath = join(__dirname, `${config.output.path}`, 'documents-structure');
    const nodeFilePath = join(__dirname, config.output.path, 'structureNode.json')

    const structureNode = await feishu.getSpaceNodeAll2(config.feishu.spaceId, '', true)

    if (fs.existsSync(outputDocumentStructurePath)) {
        // Delete the old directory
        await rm(outputDocumentStructurePath, { recursive: true, force: true });
    }

    console.log(`📁 Create directory: ${outputDocumentStructurePath}`);
    await mkdir(outputDocumentStructurePath, { recursive: true });
    await createStructureDirectory(structureNode, sourceDocumentPath, outputDocumentStructurePath)
    fs.writeFileSync(nodeFilePath, JSON.stringify(structureNode, null, 2))
}

export default generateStructureDirectory