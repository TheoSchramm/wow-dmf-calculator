// Local stand-in for GitHub Pages: static files only, served under a project sub-path.
// Usage: node serve.js [port]   ->  http://localhost:8080/wow-dmf-calculator/
const http = require("http"), fs = require("fs"), path = require("path");
const PORT = +process.argv[2] || 8080;
const BASE = "/wow-dmf-calculator";   // GitHub Pages project sites live at /<repo-name>/
const TYPES = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".lua": "text/plain; charset=utf-8", ".png": "image/png"};
// Only what you'd actually publish: the page, its scripts, the stylesheet and UI components.
const PUBLIC = new Set(["index.html", "dmf.js", "app.js"]);
const PUBLIC_DIRS = /^(css\/[\w-]+\.css|components\/[\w-]+\.js|assets\/ui\/[\w-]+\.png)$/;

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") { res.writeHead(302, {Location: BASE + "/"}); return res.end(); }
  if (!p.startsWith(BASE + "/")) { res.writeHead(404); return res.end("404 (not under " + BASE + "/)"); }
  const rel = p.slice(BASE.length + 1) || "index.html";
  const file = path.join(__dirname, rel);
  if (!(PUBLIC.has(rel) || PUBLIC_DIRS.test(rel)) || !fs.existsSync(file)) { res.writeHead(404); return res.end("404"); }
  res.writeHead(200, {"Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store"});
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`Staging: http://localhost:${PORT}${BASE}/`));
