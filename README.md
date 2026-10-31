# 你好，我是 FLYF

**FLYF® · 创意开发者** —— 这是我的个人主页，一个用 WebGL 做的交互作品集。

70,000 个 GPU 粒子随滚动穿过 INDEX / ABOUT / WORK / CONTACT 四章，依次化成四种形态：斐波那契球壳、环面纽结、起伏波场，最后收束成 **FLYF** 字样——每一次变形都由你的滚动与光标实时驱动。

**线上地址：https://aiflyf.github.io/FLYFWEB/**

## 技术栈

- [Three.js](https://threejs.org) r160 —— 自定义 GLSL 着色器：单纯形噪声湍流、morph 目标、光标斥力场
- 原生 JavaScript —— 惯性平滑滚动、按滚动速度倾斜的字形、自定义光标、由滚动驱动的章节系统
- 内联 [Lucide](https://lucide.dev) 图标（只保留实际用到的 12 个）· Clash Display / Space Mono / Instrument Serif 三套自托管字体
- 零构建步骤、零外部请求 —— 字体与 Three.js 全部本地存放，图标直接内联，部署到 GitHub Pages 即可上线

## 本地预览

```bash
python -m http.server 9420
# 浏览器打开 http://localhost:9420
```

窄屏设备会把粒子数降到 26,000，用来换取更稳的帧率。

第三方资源的许可信息见 [assets/vendor/LICENSES.md](assets/vendor/LICENSES.md)
