import fs from 'fs';

async function downloadScreenshots() {
  try {
    // Mobile screenshot (1080x1920)
    const resMobile = await fetch('https://placehold.co/1080x1920/8b5cf6/ffffff.png?text=Inkwell+Mobile');
    const bufferMobile = await resMobile.arrayBuffer();
    fs.writeFileSync('public/screenshot-mobile.png', Buffer.from(bufferMobile));
    console.log('Downloaded mobile screenshot');

    // Desktop screenshot (1920x1080)
    const resDesktop = await fetch('https://placehold.co/1920x1080/8b5cf6/ffffff.png?text=Inkwell+Desktop');
    const bufferDesktop = await resDesktop.arrayBuffer();
    fs.writeFileSync('public/screenshot-desktop.png', Buffer.from(bufferDesktop));
    console.log('Downloaded desktop screenshot');
  } catch (e) {
    console.error(e);
  }
}
downloadScreenshots();
