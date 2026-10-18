const { app, BrowserWindow, nativeImage } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  const iconPath = path.join(__dirname, 'icon.jpeg');
  const appIcon = nativeImage.createFromPath(iconPath);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    icon: appIcon,
    title: "Digital ALT ERP",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // URLs definition
  const primaryUrl = 'https://alt.elfakir.com';
  const fallbackUrl = 'http://localhost:3000';

  // Fallback Logic
  mainWindow.loadURL(primaryUrl).catch((err) => {
    console.error('Failed to load primary URL (alt.elfakir.com). Trying local...', err.message);
    mainWindow.loadURL(fallbackUrl).catch(e => {
        console.error('Both Primary and Localhost completely failed. Check servers.', e.message);
    });
  });

  // Trigger loading failure on actual net errors not just promise catch
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    if (validatedURL === primaryUrl) {
      console.log("Primary URL failed loading with error: ", errorDescription, " Switching to local...");
      mainWindow.loadURL(fallbackUrl);
    }
  });

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});
