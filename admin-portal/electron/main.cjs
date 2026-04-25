/**
 * Thouse 管理後台 — Electron 主程序
 * - 開發：載入本機 Vite（http://127.0.0.1:3010），與 `npm run dev` 一併用
 * - 安裝版：內建 express 在 127.0.0.1:隨機埠 提供 `dist/`，與一般網站相同、Supabase 可正常 CORS
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const http = require('http');

const startUrl = process.env.ELECTRON_START_URL; // 例如 http://127.0.0.1:3010

let mainWindow;
let staticServer;
let staticServerClose;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (startUrl) {
    void mainWindow.loadURL(startUrl);
  } else {
    const distPath = path.join(__dirname, '..', 'dist');
    const express = require('express');
    const ex = express();
    ex.use(express.static(distPath, { maxAge: 0 }));
    ex.use((req, res) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        return res.status(404).end();
      }
      if (req.path.startsWith('/assets/')) {
        return res.status(404).end();
      }
      if (path.extname(req.path)) {
        return res.status(404).end();
      }
      return res.sendFile(path.join(distPath, 'index.html'));
    });
    staticServer = http.createServer(ex);
    staticServer.listen(0, '127.0.0.1', () => {
      const addr = staticServer.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      void mainWindow.loadURL(`http://127.0.0.1:${port}/`);
    });
  }

  if (process.env.ELECTRON_DEVTOOLS === '1' && !app.isPackaged) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (staticServer) {
    staticServer.close();
    staticServer = null;
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (staticServer) {
    staticServer.close();
    staticServer = null;
  }
});
