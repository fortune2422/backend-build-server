const fs = require('fs');
const path = require('path');
const sharpExists = false;

function replaceIcon(projectPath, iconSrc) {
  // densities list (mipmap folders)
  const densities = ['mipmap-mdpi','mipmap-hdpi','mipmap-xhdpi','mipmap-xxhdpi','mipmap-xxxhdpi'];

  densities.forEach(d => {
    const dest = path.join(projectPath, 'app', 'src', 'main', 'res', d, 'ic_launcher.png');
    if (fs.existsSync(dest)) {
      fs.copyFileSync(iconSrc, dest);
      console.log('replaced', dest);
    }
    const fg = path.join(projectPath, 'app', 'src', 'main', 'res', d, 'ic_launcher_foreground.png');
    if (fs.existsSync(fg)) {
      fs.copyFileSync(iconSrc, fg);
      console.log('replaced', fg);
    }
  });
}

module.exports = { replaceIcon };
