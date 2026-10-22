// Turns a Field Notes issue (src/content/issues/<n>.mdx) into a send-ready HTML email.
//   npm run email -- 001
// Writes email/<n>.html and email-sized images to public/field-notes/<n>/email/
// (those images go live with the site, so push before sending).
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const SITE = 'https://jonnystanback.com';
const num = process.argv[2] || '001';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const mdxPath = path.join(root, 'src/content/issues', `${num}.mdx`);
const src = fs.readFileSync(mdxPath, 'utf8');
const pageUrl = `${SITE}/inthefield/${num}`;
const imgDir = path.join(root, 'public/field-notes', num, 'email');
fs.mkdirSync(imgDir, { recursive: true });

// ---------- front matter + imports ----------
const fm = Object.fromEntries(
  src.split('---')[1].trim().split('\n').map((l) => {
    const i = l.indexOf(':');
    return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')];
  }),
);
const body = src.split('---').slice(2).join('---');
const imports = {};
for (const m of body.matchAll(/^import (\w+) from '([^']+\.(?:jpe?g|png))';/gm)) {
  imports[m[1]] = path.resolve(path.dirname(mdxPath), m[2]);
}
const text = body.replace(/^import .*$/gm, '').trim();

// ---------- images: resize for email (2x for sharp screens) ----------
const jobs = [];
const emailImg = (file, width, name) => {
  const ext = file.endsWith('.png') ? 'png' : 'jpg';
  const out = `${name}.${ext}`;
  jobs.push(
    sharp(file).resize({ width: width * 2, withoutEnlargement: true })
      [ext === 'png' ? 'png' : 'jpeg'](ext === 'png' ? { compressionLevel: 9 } : { quality: 82, progressive: true })
      .toFile(path.join(imgDir, out)),
  );
  return `${SITE}/field-notes/${num}/email/${out}`;
};

// ---------- styles ----------
const C = { paper: '#F4EBDA', ink: '#13100C', red: '#E41010', muted: '#5E5244' };
const FONT = "'American Typewriter', 'Courier New', Courier, monospace";
const SANS = "'Arial Narrow', 'Helvetica Neue', Arial, sans-serif";
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const P = (t) => `<p style="margin:0 0 18px;font-family:${FONT};font-size:17px;line-height:1.6;color:${C.ink};">${esc(t)}</p>`;
const caption = (t) => `<p style="margin:8px 0 0;font-family:${SANS};font-size:11px;line-height:1.4;letter-spacing:0.04em;text-transform:uppercase;color:${C.ink};text-align:center;">${esc(t)}</p>`;
const prop = (s, k) => (s.match(new RegExp(`${k}=(?:"([^"]*)"|\\{([^}]*)\\})`)) || [])[1] ?? (s.match(new RegExp(`${k}=\\{(\\w+)\\}`)) || [])[1];

// ---------- components -> email blocks ----------
const blocks = {
  VoiceMemos(s) {
    const items = [...s.matchAll(/title: '([^']+)', date: '([^']+)'/g)];
    return `<p style="margin:0 0 18px;font-family:${FONT};font-size:17px;line-height:1.8;color:${C.ink};text-align:center;">${
      items.map(([, t, d]) => `“${esc(t)}” <span style="color:${C.muted};">– ${esc(d)}</span>`).join('<br>')}</p>`;
  },
  Demo(s) {
    const id = prop(s, 'id'), title = prop(s, 'title'), note = prop(s, 'note');
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 22px;"><tr><td>
      <a href="${pageUrl}#${id}" style="display:block;background:#8A1E1E;border-radius:6px;padding:18px 20px;text-decoration:none;">
        <span style="font-family:${FONT};font-size:22px;color:#B4A884;">&#9654;</span>
        <span style="font-family:${FONT};font-size:15px;letter-spacing:0.08em;text-transform:uppercase;color:#B4A884;padding-left:10px;">${esc(title)} – Demo</span>
        <span style="display:block;font-family:${SANS};font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#F05454;padding-top:8px;">Tap to listen &rarr;</span>
      </a>${note ? caption(note) : ''}</td></tr></table>`;
  },
  MarginNote(s) {
    const v = prop(s, 'src'), alt = prop(s, 'alt') || '';
    const doodle = /kind="doodle"/.test(s);
    const w = doodle ? 110 : 380;
    const url = emailImg(imports[v], w, v);
    return `<p style="margin:4px 0 22px;text-align:center;"><img src="${url}" width="${w}" alt="${esc(alt)}" style="display:inline-block;width:${w}px;max-width:100%;height:auto;border:0;"></p>`;
  },
  PhotoPair(s) {
    const side = (k) => {
      const blk = s.match(new RegExp(`${k}=\\{\\{([\\s\\S]*?)\\}\\}`))[1];
      const v = blk.match(/src: (\w+)/)[1];
      const alt = blk.match(/alt: '([^']*)'/)?.[1] || '';
      const cap = blk.match(/caption: '([^']*)'/)?.[1];
      return `<img src="${emailImg(imports[v], 270, v)}" width="270" alt="${esc(alt)}" style="display:block;width:100%;height:auto;border:0;">${cap ? caption(cap) : ''}`;
    };
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 26px;"><tr>
      <td class="stack" width="50%" valign="top" style="padding-right:8px;">${side('left')}</td>
      <td class="stack" width="50%" valign="top" style="padding-left:8px;">${side('right')}</td></tr></table>`;
  },
  Signoff() {
    const sig = emailImg(path.join(root, 'src/assets/field-notes', num, 'signature.png'), 190, 'signature');
    return `<p style="margin:30px 0 6px;font-family:${FONT};font-size:17px;color:${C.ink};text-align:center;">See you next month,</p>
      <p style="margin:0 0 10px;text-align:center;"><img src="${sig}" width="190" alt="Jonny" style="display:inline-block;width:190px;height:auto;border:0;"></p>`;
  },
};

let html = '';
for (const chunk of text.split(/\n\s*\n(?=[^\s])/)) {
  const c = chunk.trim();
  if (!c) continue;
  const comp = c.match(/^<(\w+)/);
  if (comp && blocks[comp[1]]) html += blocks[comp[1]](c);
  else if (!c.startsWith('<')) html += P(c.replace(/\s*\n\s*/g, ' '));
}

// ---------- cover + dateline ----------
const cover = emailImg(path.resolve(path.dirname(mdxPath), fm.cover), 600, 'cover');
const d = new Date(fm.date);
const dateline = `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}-${String(d.getUTCFullYear()).slice(-2)}`;

const out = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>Field Notes No. ${num}</title>
<style>
  @media (max-width:620px){ .wrap{width:100%!important} .pad{padding-left:22px!important;padding-right:22px!important} .stack{display:block!important;width:100%!important;padding:0 0 18px!important} }
  a{color:${C.red}}
</style></head>
<body style="margin:0;padding:0;background:${C.paper};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(fm.description)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper};"><tr><td align="center" style="padding:20px 0 40px;">
  <table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;">
    <tr><td class="pad" style="padding:0 0 12px;font-family:${SANS};font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:${C.muted};text-align:center;">
      Field Notes No. ${num} &nbsp;·&nbsp; <a href="${pageUrl}" style="color:${C.red};text-decoration:underline;">Read on the web</a></td></tr>
    <tr><td><a href="${pageUrl}"><img src="${cover}" width="600" alt="${esc(fm.coverAlt)}" style="display:block;width:100%;height:auto;border:0;"></a></td></tr>
    <tr><td class="pad" style="padding:22px 40px 8px;font-family:${FONT};font-size:14px;letter-spacing:0.08em;color:${C.ink};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-family:${FONT};font-size:14px;color:${C.ink};">${dateline}</td>
        <td align="right" style="font-family:${FONT};font-size:14px;text-transform:uppercase;color:${C.ink};">${esc(fm.location)}</td></tr></table></td></tr>
    <tr><td class="pad" style="padding:18px 40px 10px;">${html}</td></tr>
    <tr><td class="pad" style="padding:26px 40px 0;border-top:1px solid #D9CCB4;font-family:${SANS};font-size:12px;line-height:1.6;color:${C.muted};text-align:center;">
      Hit reply anytime. It comes straight to me.<br>
      <a href="${pageUrl}" style="color:${C.red};">Read this letter on the web</a> &nbsp;·&nbsp; <a href="${SITE}" style="color:${C.red};">jonnystanback.com</a><br><br>
      You’re getting this because you signed up for Field Notes.<br>
      Don’t want these? <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:${C.muted};">Unsubscribe</a>.
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;

await Promise.all(jobs);
fs.mkdirSync(path.join(root, 'email'), { recursive: true });
fs.writeFileSync(path.join(root, 'email', `${num}.html`), out);
console.log(`email/${num}.html written; ${jobs.length} images in public/field-notes/${num}/email/`);
