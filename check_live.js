const https = require('https');

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      console.log(`Response for ${url}: status=${res.statusCode}`);
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function run() {
  const html = await get('https://chartered-mentor-haj6bfflp-jacob-droid-cryptos-projects.vercel.app/');
  console.log('HTML sample:\n', html.substring(0, 1000));
}

run();
