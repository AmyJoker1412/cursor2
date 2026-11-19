# 入党积极分子刷题库（网页版）

把《入党积极分子学习知识题库》做成本地网页刷题站，**电脑和手机连同一个 WiFi 即可一起用**。
题目全部来自原 PDF，共 **373 题**（党的二十大报告题库 293 题 + 《中国共产党章程》80 题），含单选、多选。

## 功能

- **全部刷题 / 按章节练习 / 错题本 / 错题重练**
- **顺序 or 随机** 出题，可随时切换
- **断点续刷**：中途关掉页面，下次打开能「继续上次练习」
- 答对自动进入下一题；答错显示正确答案并自动加入错题本
- 错题、进度都保存在**本机浏览器**（`localStorage`），不上传服务器
- 首页自带「手机扫码访问」二维码，手机扫码直接进站

## 使用方法（Windows）

1. **双击 `start.bat`**（首次可能弹出「Windows 已保护你的电脑」，点「更多信息 → 仍要运行」）。
2. 稍等片刻，会自动打开电脑浏览器：`http://localhost:8080`。
3. 黑窗口里会显示「手机访问 http://192.168.x.x:8080」。
   - 手机连**同一个 WiFi**，扫首页二维码，或在手机浏览器输入这个地址即可。
4. **关闭那个黑色命令行窗口 = 停止服务**。

> 启动脚本会优先用 Python，没有 Python 就自动改用 Node.js。二者有其一即可。

## 常见问题

- **手机打不开？**
  - 确认手机和电脑连的是同一个 WiFi（不要一个连 WiFi、一个连 4G/热点）。
  - Windows 防火墙弹出提示时选「允许访问」；或手动放行：控制面板 → Windows Defender 防火墙 → 允许应用通过防火墙 → 勾选 Python / Node。
  - 部分路由器开启了「AP 隔离」，会导致设备间不能互访，需在路由器设置里关闭。
- **端口 8080 被占用？** 服务会自动尝试 8080~8089；也可手动运行：
  ```powershell
  py server.py --port 9000
  ```
- **想自己部署到公网？** 这整套是纯静态站点（`index.html` + `css/` + `js/` + `data/questions.json`），可直接传到 GitHub Pages、Gitee Pages、Vercel 等任意静态托管。注意：公网部署时没有 `/api/info` 接口，首页的扫码卡片会自动隐藏，不影响刷题。

## 目录结构

```
index.html            页面入口
css/styles.css        样式
js/app.js             刷题逻辑
js/qrcode.min.js      本地二维码生成（离线可用）
data/questions.json   题库数据（由 PDF 解析）
scripts/parse_pdf.py  重新解析题库的脚本
source.pdf            原始题库 PDF
server.py             本地服务器（Python 标准库，无需装依赖）
server.js             本地服务器（Node.js 备用版）
start.bat             一键启动（Windows）
```

## 重新解析题库（可选）

若题库 PDF 有更新，替换 `source.pdf` 后执行（需要 `pip install pypdf`）：

```bash
python scripts/parse_pdf.py
```
