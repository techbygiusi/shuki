/**
 * @type {import('electron-builder').Configuration}
 */
module.exports = {
  appId: 'com.shuki.app',
  productName: 'SHUKI',
  directories: {
    output: 'release',
    buildResources: 'build',
  },
  files: [
    {
      from: 'dist',
      to: 'dist',
      filter: ['**/*'],
    },
    'package.json',
  ],
  mac: {
    target: ['dmg', 'zip'],
    category: 'public.app-category.productivity',
    icon: 'assets/icon.png',
  },
  win: {
    target: ['nsis', 'zip'],
    icon: 'assets/icon.ico',
  },
  linux: {
    target: ['AppImage', 'deb'],
    category: 'Office',
    icon: 'assets/icon.png',
  },
};
