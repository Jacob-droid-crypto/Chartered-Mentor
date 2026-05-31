const https = require('https');
function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}
async function checkLiveSite() {
  try {
    const html = await get('https://chartered-mentor.vercel.app/');
    const match = html.match(/src="(\/assets\/index-[^\.]+\.js)"/);
    if (!match) {
      console.log('Could not find JS bundle in HTML');
      return;
    }
    const jsUrl = 'https://chartered-mentor.vercel.app' + match[1];
    console.log('Fetching JS bundle:', jsUrl);
    const jsContent = await get(jsUrl);
    if (jsContent.includes('localhost:5000')) {
      console.log('❌ BROKEN: The live JS bundle contains localhost:5000!');
    } else {
      console.log('✅ FIXED: The live JS bundle does NOT contain localhost:5000.');
    }
  } catch (e) {
    console.error(e);
  }
}
checkLiveSite();
