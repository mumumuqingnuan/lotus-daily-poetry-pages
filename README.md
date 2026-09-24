# 莲心 · 每日诗笺

[打开独立网站](https://mumumuqingnuan.github.io/lotus-daily-poetry-pages/) · [GitHub 仓库](https://github.com/mumumuqingnuan/lotus-daily-poetry-pages) · [构建与部署](https://github.com/mumumuqingnuan/lotus-daily-poetry-pages/actions)

沿用用户提供的《莲心_每日诗笺_GitHub_Pages迁移源码.zip》（交接版本 `3a552b47a29d4abf76760c2afb12a6f98dc404ce`）制作的独立静态副本。保留白莲插画、白金界面、24 组古诗、六种主题、可选清音、图片放大、手机布局、个人手记与历史，以及日历、农历、节气和时辰。

体验仍然是「读一句诗 → 想一个问题 → 做一件小事」，内容不作吉凶预测。

原来的[观音抽签](https://guanyin-lotus.wendyrh.chatgpt.site/)和[每日诗笺](https://lotus-daily-poetry.wendyrh.chatgpt.site/)保持独立。本仓库没有原站点部署标识、数据库、凭据或任何真实个人手记。

## 静态实现与存档

- React + Vite，仅输出 HTML、CSS、JavaScript 和图片；不需要 Worker、D1、API 服务器或 ChatGPT 登录。
- 24 组诗文和插画与交接包逐字节一致。日期通过设备时钟按 UTC+8 换算，同一天诗句固定；当日开始后，主题、手记和诗文编号一起锁定。三次展开逐步保存；重试不重复推进。
- 午夜、页面重新激活和交互开始时检查北京时间；旧动画不会推进新一天。更改日历查询日期不会改变今日诗笺。
- 独立 localStorage 键：`lotus-daily-poetry-pages:v1:daily-records`。开启诗笺时保存手记，每次展开立即保存进度。历史按日期显示全部已存记录，包括未读完的诗笺；旧日期不能补抽。
- **记录保存在当前浏览器。** 不上传、不跨设备或跨浏览器同步。清除站点数据、更换浏览器或使用无痕窗口可能导致记录丢失；无账号找回或云端恢复。原站点账号中的手记不会迁入。
- 网站网址的协议、域名或端口改变会使用不同存储；本地预览与线上存档独立。浏览器存储不是加密保险箱。同源网页共用浏览器安全边界，独立键用于防止误覆盖，不构成安全隔离。
- 存储权限受限、容量不足或存档损坏时显示错误，不默默清空旧记录，也不虚报保存成功。当前版本没有导入/导出备份功能；重要文字请另行备份。
- 清音默认关闭，点击后才启动 Web Audio 合成音效；切到后台会关闭。没有外部音频下载。诗文出处与历法库链接只有主动打开时才访问。

## 本地运行

安装 Node.js 22.13 或更高版本，再在本仓库目录运行：

```sh
npm install --global pnpm@11.25.0
pnpm install --frozen-lockfile
pnpm dev
```

打开终端显示的地址，默认子路径为 `/lotus-daily-poetry-pages/`。

```sh
pnpm test       # 存档、跨日、历法和音效单元检查
pnpm build      # TypeScript 检查并生成 dist/
pnpm preview   # 预览生产构建
```

不要通过双击 `index.html` 的 `file://` 方式运行。独立静态网站仍需 HTTP(S) 静态文件服务。构建可用于任何静态主机；根目录发布时用 `VITE_BASE_PATH=/ pnpm build`。

## 更新与发布

GitHub Settings → Pages 的 Source 应为 **GitHub Actions**。`.github/workflows/deploy.yml` 在推送到 `main` 后安装锁定依赖、运行测试、检查类型并构建，最后部署 `dist/`；失败的构建不会进入部署。

```sh
git clone https://github.com/mumumuqingnuan/lotus-daily-poetry-pages.git
cd lotus-daily-poetry-pages
pnpm install --frozen-lockfile
# 修改 src/ 或 public/ 后：
pnpm test
pnpm build
git add src public README.md package.json pnpm-lock.yaml
git commit -m "Update daily poetry"
git push origin main
```

修改其他配置文件时也应明确加入提交。在 Actions 页等待部署成功，再打开公开网址检查。不要提交 `.env`、数据库、浏览器存档、个人手记或 `node_modules`。

Vite 在 Actions 中从 `GITHUB_REPOSITORY` 自动取得仓库名并配置 `base`，图片和图标使用相同基础路径。应用以单页标签切换，不生成需要服务器转发的深层 URL；刷新网站根地址和带查询/片段的地址均加载同一页面。未定义的深层路径正常返回 GitHub Pages 404。没有 Service Worker，站点更新后刷新即可获得新版本；本版本不承诺断网首次打开。

修改已有诗文 ID 或存档结构时需编写迁移，避免已有手记与诗文错配。保留独立存储键，不要读取或清理其他 Lotus 应用的记录。

## 来源与验证范围

保留 `public/lunar-javascript-LICENSE.txt` 和 `vendor/shadcn-tailwind-4.13.0.LICENSE.md`，依赖各自许可随包提供。古诗条目保留原数字版出处链接，赏读、问题和行动保留交接内容。

部署方法参考 [GitHub 自定义 Pages 工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)和 [Vite 静态部署文档](https://vite.dev/guide/static-deploy.html)。浏览器验收会区分桌面/手机尺寸模拟与真实手机硬件测试；屏幕尺寸模拟不能代替 iPhone/Android 的扬声器与触摸实机验收。
