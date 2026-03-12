import fs from 'fs';

async function download() {
  try {
    const res192 = await fetch('https://placehold.co/192x192/8b5cf6/ffffff.png?text=IW');
    const buffer192 = await res192.arrayBuffer();
    fs.writeFileSync('public/icon-192.png', Buffer.from(buffer192));
    console.log('Downloaded 192');

    const res512 = await fetch('https://placehold.co/512x512/8b5cf6/ffffff.png?text=IW');
    const buffer512 = await res512.arrayBuffer();
    fs.writeFileSync('public/icon-512.png', Buffer.from(buffer512));
    console.log('Downloaded 512');
  } catch (e) {
    console.error(e);
  }
}
download();
