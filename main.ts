const ICEDRIVE_USER = Deno.env.get("ICEDRIVE_USER");
const ICEDRIVE_PASS = Deno.env.get("ICEDRIVE_PASS");
const WEBDAV_URL = "https://webdav.icedrive.io";

Deno.serve(async (req) => {
  if (!ICEDRIVE_USER || !ICEDRIVE_PASS) {
    return new Response("Error: Missing ICEDRIVE_USER/PASS", { status: 500 });
  }

  const url = new URL(req.url);
  const auth = btoa(`${ICEDRIVE_USER}:${ICEDRIVE_PASS}`);

  // 1. File Browser (Home Page)
  if (url.pathname === "/" || url.pathname === "") {
    try {
      // Fetch File List using PROPFIND
      const davRes = await fetch(WEBDAV_URL + "/", {
        method: "PROPFIND",
        headers: {
          "Authorization": `Basic ${auth}`,
          "Depth": "1"
        }
      });

      if (!davRes.ok) {
        return new Response(`IceDrive Connection Failed: ${davRes.status} ${davRes.statusText} (Check Email/Key)`, { status: 500 });
      }

      // Parse XML response (Simple Regex Extraction)
      const xmlText = await davRes.text();
      const files = [];
      const regex = /<d:href>([^<]+)<\/d:href>/g;
      let match;
      
      while ((match = regex.exec(xmlText)) !== null) {
        // Decode and clean path
        let rawPath = match[1];
        if (rawPath.endsWith("/")) rawPath = rawPath.slice(0, -1); // Remove trailing slash
        const name = rawPath.split("/").pop();
        
        // Skip empty names
        if (name && name.trim() !== "") {
            files.push(decodeURIComponent(name));
        }
      }

      // Render HTML List
      const fileListHtml = files.map(f => `
        <li class="file-item">
          <span class="icon">📄</span>
          <span class="name">${f}</span>
          <a href="/stream/${encodeURIComponent(f)}" class="play-btn">▶ Play</a>
        </li>
      `).join("");

      const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>IceDrive Browser</title>
          <style>
            body { font-family: system-ui, sans-serif; background: #1e272e; color: #d2dae2; margin: 0; padding: 20px; }
            h2 { color: #00d2d3; text-align: center; }
            .container { max-width: 600px; margin: 0 auto; background: #2f3640; border-radius: 12px; padding: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.3); }
            ul { list-style: none; padding: 0; }
            .file-item { display: flex; justify-content: space-between; align-items: center; padding: 15px; border-bottom: 1px solid #353b48; }
            .file-item:last-child { border-bottom: none; }
            .name { flex-grow: 1; margin-left: 10px; word-break: break-all; }
            .play-btn { text-decoration: none; background: #00d2d3; color: black; padding: 8px 15px; border-radius: 4px; font-weight: bold; font-size: 14px; }
            .play-btn:hover { background: #01a3a4; }
            .icon { font-size: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>❄️ IceDrive Files</h2>
            <p style="text-align:center; font-size:12px; color:#808e9b;">Files in Root Folder</p>
            <ul>${fileListHtml || "<li style='text-align:center; padding:20px;'>No files found in root folder.</li>"}</ul>
          </div>
        </body>
        </html>
      `;
      return new Response(html, { headers: { "content-type": "text/html" } });

    } catch (err) {
      return new Response("Browser Error: " + err.message, { status: 500 });
    }
  }

  // 2. Streaming Logic
  try {
    if (!url.pathname.startsWith("/stream/")) return new Response("Not Found", { status: 404 });
    
    const filename = decodeURIComponent(url.pathname.replace("/stream/", ""));
    
    const requestHeaders = new Headers();
    requestHeaders.set("Authorization", `Basic ${auth}`);
    
    const range = req.headers.get("range");
    if (range) requestHeaders.set("Range", range);

    const webdavRes = await fetch(`${WEBDAV_URL}/${encodeURIComponent(filename)}`, {
        method: "GET",
        headers: requestHeaders
    });

    if (!webdavRes.ok) {
        return new Response(`File Not Found (404). Ensure '${filename}' exists in root.`, { status: 404 });
    }

    const responseHeaders = new Headers(webdavRes.headers);
    // Force Video
    responseHeaders.set("Content-Type", "video/mp4"); 
    responseHeaders.set("Content-Disposition", `inline; filename="${filename}"`); 
    
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Headers", "Range");
    responseHeaders.set("Access-Control-Expose-Headers", "Content-Range, Content-Length");

    return new Response(webdavRes.body, {
        status: webdavRes.status,
        headers: responseHeaders
    });

  } catch (err) {
    return new Response("Server Error: " + err.message, { status: 500 });
  }
});
