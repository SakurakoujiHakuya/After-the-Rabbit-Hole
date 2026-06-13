# 兔子洞尽头

基于手机方向传感器的爱丽丝式绘本 H5 重力迷宫游戏。

## 在线体验

[GitHub Pages](https://sakurakoujihakuya.github.io/After-the-Rabbit-Hole/)

## 本地运行

```bash
npm install
npm run dev
```

开发服务器默认监听局域网地址。手机与电脑连接同一 Wi-Fi 后，打开终端中显示的 `Network` 地址即可访问。

手机访问普通 HTTP 局域网地址时，iOS Safari 不会开放方向传感器；此时只能使用屏幕虚拟摇杆。要测试重力感应，需要将页面部署到 HTTPS 地址，或为本地开发服务器配置一张被 iPhone 信任的 HTTPS 证书。桌面浏览器可使用方向键或 WASD。

## 构建

```bash
npm test
npm run build
```

构建产物位于 `dist/`。

## 部署

推送到 `main` 分支后，GitHub Actions 会自动构建并部署到 GitHub Pages。

## 素材

- 兔子洞、白兔、梦境花园、金发紫眸主角头像、魔法茶杯与纸牌守卫为项目原创生成素材。
- BGM 使用作者提供的视频《BLACKSOULS 1 BGM 全收录》第 25 P《不思議の国》音轨。
- 图片与音频通过外部静态资源服务器加载，不提交到代码仓库。
- 默认资源地址：`https://hakuya.top/after-the-rabbit-hole`
- 本地开发可在 `.env.local` 中配置 `VITE_ASSET_BASE_URL`。
- GitHub Actions 使用仓库变量 `ASSET_BASE_URL`。
