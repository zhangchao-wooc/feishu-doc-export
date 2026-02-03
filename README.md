# feishu-doc-export
导出飞书文档（资源转储）

## 运行

### 安装 Nodejs
MAC 下使用 Homebrew 安装 Nodejs
```bash
brew search node                       // 搜索 node 版本
brew install node                      // 安装最新版本
brew install node@14                   // 安装指定版本
```

### 安装依赖
```bash
npm install
```

### 运行脚本
在项目根目录下运行以下命令
```bash
npm run start
```
或
```bash
node index.js
```


## 策略
### 文件名  
根据飞书提供的 fileToken 下载文件，多个文档中的文件名可能会重复或不存在，因此使用 MD5 + 文件后缀 作为文件名。
同时使用 md5 校验文件是否存在，避免重复上传以节省存储空间。

### 流式上传  
使用流式上传，避免上传过大文件导致内存溢出。

### 文件替换
根据飞书接口返回的文件块的顺序，顺序替换 docx 中匹配到的资源文件。然后删除 docx 中本地的静态资源。

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