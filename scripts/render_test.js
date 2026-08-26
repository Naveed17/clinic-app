const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 900,
    height: 600,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <body>
    <script>
      const width = 800;
      const height = 400;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, width, height);

      const boxX = 20;
      const boxY = 20;
      const boxW = width - 40;
      const boxH = height - 40;
      const boxR = 24;

      ctx.save();
      ctx.shadowColor = 'rgba(15, 23, 42, 0.12)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 6;

      const vecGrad = ctx.createLinearGradient(boxX, boxY, boxX + boxW, boxY + boxH);
      vecGrad.addColorStop(0, '#e0f2fe');
      vecGrad.addColorStop(0.5, '#bae6fd');
      vecGrad.addColorStop(1, '#e0e7ff');
      ctx.fillStyle = vecGrad;

      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, boxR);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, boxR);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, boxR);
      ctx.clip();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.beginPath();
      ctx.arc(boxX + 120, boxY + 100, 160, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(14, 165, 233, 0.14)';
      ctx.beginPath();
      ctx.arc(boxX + boxW - 100, boxY + 260, 200, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.beginPath();
      ctx.arc(boxX + boxW - 140, boxY + 80, 110, 0, Math.PI * 2);
      ctx.fill();

      const phoneW = 160;
      const phoneH = 240;
      const phoneX = boxX + (boxW - phoneW) / 2;
      const phoneY = boxY + 60;

      ctx.shadowColor = 'rgba(15, 23, 42, 0.18)';
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 8;

      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(phoneX, phoneY, phoneW, phoneH, 22);
      ctx.fill();
      ctx.shadowColor = 'transparent';

      const screenX = phoneX + 8;
      const screenY = phoneY + 8;
      const screenW = phoneW - 16;
      const screenH = phoneH - 16;
      const screenR = 16;

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(screenX, screenY, screenW, screenH, screenR);
      ctx.fill();

      ctx.fillStyle = '#0ea5e9';
      ctx.beginPath();
      ctx.roundRect(screenX, screenY, screenW, 36, [16, 16, 0, 0]);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = '700 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Online Doctor', screenX + screenW / 2, screenY + 23);

      const docCx = screenX + screenW / 2;
      const docCy = screenY + 105;

      ctx.fillStyle = '#e0f2fe';
      ctx.beginPath();
      ctx.arc(docCx, docCy, 40, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(docCx, docCy + 60, 38, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.moveTo(docCx - 9, docCy + 24);
      ctx.lineTo(docCx + 9, docCy + 24);
      ctx.lineTo(docCx, docCy + 44);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.arc(docCx, docCy - 4, 20, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(docCx, docCy - 9, 20, Math.PI, 0);
      ctx.fill();

      ctx.strokeStyle = '#0ea5e9';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(docCx, docCy + 14, 13, 0, Math.PI);
      ctx.stroke();

      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(docCx + 24, docCy - 14, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✓', docCx + 24, docCy - 14);

      ctx.fillStyle = '#f1f5f9';
      ctx.beginPath();
      ctx.roundRect(screenX + 10, screenY + 160, screenW - 20, 26, 8);
      ctx.fill();
      ctx.fillStyle = '#0284c7';
      ctx.font = '700 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Appointment Confirmed', screenX + screenW / 2, screenY + 176);

      const bubble1X = boxX + 80;
      const bubble1Y = boxY + 80;
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(14, 165, 233, 0.15)';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.roundRect(bubble1X, bubble1Y, 130, 48, 14);
      ctx.fill();
      ctx.shadowColor = 'transparent';

      ctx.fillStyle = '#0284c7';
      ctx.font = '700 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('💬 Healthcare', bubble1X + 65, bubble1Y + 28);

      const card2X = boxX + boxW - 210;
      const card2Y = boxY + 110;
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(14, 165, 233, 0.15)';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.roundRect(card2X, card2Y, 135, 52, 14);
      ctx.fill();
      ctx.shadowColor = 'transparent';

      ctx.fillStyle = '#10b981';
      ctx.font = '700 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🩺 Tele-Clinic', card2X + 67, card2Y + 30);

      ctx.strokeStyle = 'rgba(14, 165, 233, 0.45)';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(boxX + 50, boxY + 270);
      ctx.lineTo(boxX + 100, boxY + 270);
      ctx.lineTo(boxX + 118, boxY + 240);
      ctx.lineTo(boxX + 136, boxY + 295);
      ctx.lineTo(boxX + 154, boxY + 255);
      ctx.lineTo(boxX + 172, boxY + 270);
      ctx.lineTo(boxX + 220, boxY + 270);
      ctx.stroke();

      ctx.restore();

      window.cardDataUrl = canvas.toDataURL('image/png');
    </script>
    </body>
    </html>
  `;

  win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  win.webContents.on('did-finish-load', async () => {
    try {
      await new Promise(r => setTimeout(r, 400));
      const dataUrl = await win.webContents.executeJavaScript('window.cardDataUrl');
      const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
      const outPath = path.join(__dirname, 'test_output.png');
      fs.writeFileSync(outPath, base64, 'base64');
      console.log('Successfully saved image to:', outPath);
    } catch (err) {
      console.error(err);
    } finally {
      app.quit();
    }
  });
});
