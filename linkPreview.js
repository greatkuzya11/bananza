const { URL } = require('url');

const URL_REGEX = /https?:\/\/[^\s<>"')\]]+/gi;

function extractUrls(text) {
  if (!text) return [];
  const matches = text.match(URL_REGEX);
  return matches ? [...new Set(matches)] : [];
}

async function fetchPreview(url) {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BananZa/1.0)',
        'Accept': 'text/html',
      },
      redirect: 'follow',
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('text/html')) return null;

    const html = await res.text();

    const getMeta = (prop) => {
      const patterns = [
        new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']+)["']`, 'i'),
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${prop}["']`, 'i'),
        new RegExp(`<meta[^>]+name=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'),
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${prop}["']`, 'i'),
      ];
      for (const p of patterns) {
        const m = html.match(p);
        if (m) return m[1];
      }
      return null;
    };

    const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    let title = getMeta('title') || (titleTag ? titleTag[1].trim() : null);
    let description = getMeta('description');
    let image = getMeta('image');

    if (image && !image.startsWith('http')) {
      try { image = new URL(image, url).href; } catch { image = null; }
    }

    const hostname = parsedUrl.hostname;
    if (!title && !description && !image) return null;

    return {
      url,
      title: title ? decode(title).substring(0, 200) : null,
      description: description ? decode(description).substring(0, 300) : null,
      image,
      hostname,
    };
  } catch {
    return null;
  }
}

function decode(s) {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&#x27;/g, "'");
}

module.exports = { extractUrls, fetchPreview };
