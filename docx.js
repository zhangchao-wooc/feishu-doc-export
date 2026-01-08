import JSZip from "jszip";
import fs from "fs";

async function replaceFileWithUrls(inputPath, outputPath, urlList) {
    const data = fs.readFileSync(inputPath);
    const zip = await JSZip.loadAsync(data);

    // 读取主文档 XML
    const docXmlPath = "word/document.xml";
    let docXml = await zip.file(docXmlPath).async("string");

    // 匹配所有图片相关的 XML 片段（简化匹配）
    // 常见结构：<w:p>...<w:drawing>...</w:drawing>...</w:p>
    // 或 <w:pict>...</w:pict>
    const imageParagraphRegex =
        /<w:drawing>[\s\S]*?<\/w:drawing>/g;

    let match;
    let index = 0;
    let newDocXml = docXml;

    // 由于 JS 不支持“多次替换不同内容”的全局替换，我们循环处理
    const matches = [];
    while ((match = imageParagraphRegex.exec(docXml)) !== null) {
        matches.push(match[0]);
    }

    // 从后往前替换（避免索引偏移）
    for (let i = matches.length - 1; i >= 0; i--) {
        const imgBlock = matches[i];
        const url = urlList[i] || `https://placeholder.com/image-${i + 1}.jpg`;

        // 创建一个简单的段落：只包含 URL 文本
        const urlParagraph = `<w:t>${url}</w:t>`.trim();

        newDocXml = newDocXml.replace(imgBlock, urlParagraph);
    }

    console.log('File replace total: ', matches.length)

    // 更新 document.xml
    zip.file(docXmlPath, newDocXml);

    // 可选：删除 media/ 下所有图片（非必须，但可减小文件）
    zip.folder("word/media")?.remove?.();

    // 生成新 .docx
    const outputBuffer = await zip.generateAsync({
        type: "nodebuffer",
        compression: "DEFLATE",
    });

    fs.writeFileSync(outputPath, outputBuffer);
    console.log(
        `✅ 已将 ${matches.length} 张图片替换为 URL，输出到: ${outputPath}`
    );
}

export default replaceFileWithUrls