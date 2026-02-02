import JSZip from "jszip";
import fs from "fs";

export const replaceByKeyword = async (docXml, fileUrlList = []) => {
    let newDocXml = docXml;
    let index = 0
    for (const { keyword, url } of fileUrlList) {
        if (!keyword || !url) continue;

        // 转义关键词中的正则特殊字符
        const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // 匹配完整的 <w:t>keyword</w:t>（确保是独立文本节点）
        const regex = new RegExp(`<w:t>${escapedKeyword}</w:t>`, 'g');

        if (!regex.test(newDocXml)) {
            throw new Error(`replaceByKeyword: Keyword not found in document XML: ${keyword}`)
        }

        const newXml = `<w:t>${url}</w:t>`.trim();
        console.log(`Replace file: current ${index + 1} replace to ${url}`);
        newDocXml = newDocXml.replace(regex, newXml);
        index++
    }
    console.log(`Replace file done: ${fileUrlList.length}`);
    return newDocXml
}

export const replaceImagesWithUrls = async (docXml, imageUrlList = []) => {
    // 匹配所有图片相关的 XML 片段（简化匹配）
    // 常见结构：<w:p>...<w:drawing>...</w:drawing>...</w:p>
    // 或 <w:pict>...</w:pict>
    const imageParagraphRegex =
        /<w:drawing>[\s\S]*?<\/w:drawing>/g;

    let match;
    let newDocXml = docXml;

    // 由于 JS 不支持“多次替换不同内容”的全局替换，我们循环处理
    const matches = [];
    while ((match = imageParagraphRegex.exec(docXml)) !== null) {
        matches.push(match[0]);
    }

    console.log(`Replace image: total ${matches.length}, imageUrlList length ${imageUrlList.length}`);

    if (matches.length !== imageUrlList.length) {
        throw new Error(`replaceImagesWithUrls: Mismatch between image blocks (${matches.length}) and URLs (${imageUrlList.length})`);
    }

    // 从后往前替换（避免索引偏移）
    for (let i = matches.length - 1; i >= 0; i--) {
        const imgBlock = matches[i];
        const url = imageUrlList[i].url;

        // 创建一个简单的段落：只包含 URL 文本
        const urlParagraph = `<w:t>${url}</w:t>`.trim();

        newDocXml = newDocXml.replace(imgBlock, urlParagraph);
        console.log(`Replace image: current ${i + 1} replace to ${url}`);
    }
    console.log(`Replace image done: ${imageUrlList.length}`);
    return newDocXml
}

export const replaceFileWithUrls = async (filePath, urlList = []) => {
    if (urlList.length === 0) {
        console.log('No file to replace')
        return
    }
    const data = fs.readFileSync(filePath);
    const zip = await JSZip.loadAsync(data);

    // 读取主文档 XML
    const docXmlPath = "word/document.xml";
    let docXml = await zip.file(docXmlPath).async("string");
    let newDocXml = docXml;

    const imageUrlList = urlList.filter(item => item.type === 'Image');
    const fileUrlList = urlList.filter(item => item.type === 'File');

    if (imageUrlList.length != 0) {
        newDocXml = await replaceImagesWithUrls(newDocXml, imageUrlList)
    }

    if (fileUrlList.length != 0) {
        newDocXml = await replaceByKeyword(newDocXml, fileUrlList)
    }

    // 更新 document.xml
    zip.file(docXmlPath, newDocXml);

    // 可选：删除 media/ 下所有图片（非必须，但可减小文件）
    zip.folder("word/media")?.remove?.();

    // 生成新 .docx
    const outputBuffer = await zip.generateAsync({
        type: "nodebuffer",
        compression: "DEFLATE",
    });

    fs.writeFileSync(filePath, outputBuffer);
    console.log(
        `✅ 📁 已将 ${urlList.length} 张图片替换为 URL，输出到: ${filePath}`
    );
}

export const queryDocumentXML = async (inputPath, outputPath) => {
    const data = fs.readFileSync(inputPath);
    const zip = await JSZip.loadAsync(data);

    // 读取主文档 XML
    const docXmlPath = "word/document.xml";
    let docXml = await zip.file(docXmlPath).async("string");
    fs.writeFileSync(outputPath, docXml)
    return
}