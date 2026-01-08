# feishu-doc-export
导出飞书文档（包括文件转储）

## 安装

安装飞书 SDK
```bash
npm install @larksuiteoapi/node-sdk
```

安装 AWS SDK
```bash
npm install @aws-sdk/client-s3 --save
```

## 参考文档
飞书开发文档：https://open.feishu.cn/document/server-side-sdk/nodejs-sdk/preparation-before-development  
飞书 SDK Github 地址：https://github.com/larksuite/node-sdk/blob/main/README.zh.md

## 参考项目

### AndroidTransToolPlus
只支持安卓的网页翻译工具

https://github.com/huanfeng/AndroidTransToolPlus/blob/main/src/services/translation/openai.ts 


### feishu-backup
飞书云文档备份。不支持文件转储需求。  
https://github.com/dicarne/feishu-backup/blob/main/src/components/api.ts#L128