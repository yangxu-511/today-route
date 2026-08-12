#!/bin/zsh
set -e

cd "${0:A:h}"

if ! command -v node >/dev/null 2>&1; then
  echo "尚未安装 Node.js。请先访问 https://nodejs.org 安装长期支持版，然后重新双击本文件。"
  read "?按回车键退出..."
  exit 1
fi

if [[ ! -d node_modules ]]; then
  echo "首次启动：正在安装本地依赖..."
  npm install
fi

echo "正在检查并构建今日航线..."
npm run build
echo ""
echo "今日航线已启动："
echo "Mac 本机：http://localhost:4173"
echo "同一 Wi-Fi 的其他设备：请使用下方 Network 地址"
echo "关闭本窗口即可停止服务。"
npm run preview -- --port 4173
