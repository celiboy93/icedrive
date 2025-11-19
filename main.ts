const ICEDRIVE_USER = Deno.env.get("ICEDRIVE_USER");
const ICEDRIVE_PASS = Deno.env.get("ICEDRIVE_PASS");
const WEBDAV_URL = "https://webdav.icedrive.io";

Deno.serve(async (req) => {
  if (!ICEDRIVE_USER || !ICEDRIVE_PASS) {
    return new Response("Configuration Error: Missing ICEDRIVE_USER or ICEDRIVE_PASS.", { status: 500 });
  }

  const url = new URL(req.url);

  if (url.pathname === "/" || url.pathname === "") {
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>IceDrive WebDAV</title>
        <style>
          body { font-family: system-ui, sans-serif; background: #1e272e; color: #d2dae2; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
          .box { background: #2f3640; padding: 30px; border-radius: 12px; text-align: center; width: 90%; max-width: 450px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
          input { width: 100%; padding: 12px; margin-bottom: 15px; border: 1px solid #00d2d3; background: #1e272e; color: white; border-radius: 6px; box-sizing: border-box; outline: none; }
          button { padding: 12px 20px; background: #00d2d3; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; width: 100%; transition: 0.2s; }
          button:hover { background: #01a3a4; }
          .hint { font-size: 12px; color: #808e9b; margin-top: 10px; text-align: left; }
        </style>
      </head>
      <body>
        <div class="box">
          <h2 style="color:#00d2d3; margin-top:0;">❄️ IceDrive Player</h2>
          <form id="form">
            <input type="text" id="path" placeholder="Folder/File.mp4" required />
            <button type="submit">Play Video</button>
          </form>
          <div class="hint">
            Enter exact path (Case Sensitive).<br>Example: <b>Movies/Action/Batman.mp4</b>
          </div>
        </div>
        <script>
          document.getElementById('form').onsubmit = (e) => {
            e.preventDefault();
            const path = document.getElementById('path').value.trim();
            window.location.href = "/stream/" + encodeURIComponent(path);
          }
        </script>
      </body>
      </html>
    `;
    return new Response(html, { headers: { "content-type": "text/html" } });
  }

  try {
    if (!url.pathname.startsWith("/stream/")) return new Response("Not Found", { status: 404 });

    const rawPath = decodeURIComponent(url.pathname.replace("/stream/", ""));
    const safeWebDAVPath = rawPath.split('/').map(segment => encodeURIComponent(segment)).join('/');

    const auth = btoa(`${ICEDRIVE_USER}:${ICEDRIVE_PASS}`);

    const requestHeaders = new Headers();
    requestHeaders.set("Authorization", `Basic ${auth}`);

    const range = req.headers.get("range");
    if (range) requestHeaders.set("Range", range);

    const webdavRes = await fetch(`${WEBDAV_URL}/${safeWebDAVPath}`, {
        method: "GET",
        headers: requestHeaders
    });

    if (!webdavRes.ok) {
        return new Response(`WebDAV Error: ${webdavRes.status} ${webdavRes.statusText}`, { status: webdavRes.status });
    }

    const responseHeaders = new Headers(webdavRes.headers);
    responseHeaders.set("Content-Type", "video/mp4");
    
    const filenameOnly = rawPath.split('/').pop();
    responseHeaders.set("Content-Disposition", `inline; filename="${filenameOnly}"`);

    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Headers", "Range");
    responseHeaders.set("Access-Control-Expose-Headers", "Content-Range, Content-Length");

    return new Response(webdavRes.body, {
        status: webdavRes.status,
        headers: responseHeaders
    });

  } catch (err) {
    return new Response("Internal Error: " + err.message, { status: 500 });
  }
});
