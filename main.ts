// --- Config ---
const ICEDRIVE_USER = Deno.env.get("ICEDRIVE_USER");
const ICEDRIVE_PASS = Deno.env.get("ICEDRIVE_PASS");
const WEBDAV_URL = "https://webdav.icedrive.net";

Deno.serve(async (req) => {
  if (!ICEDRIVE_USER || !ICEDRIVE_PASS) {
    return new Response("Error: Missing ICEDRIVE_USER/PASS in Settings", { status: 500 });
  }

  const url = new URL(req.url);

  // 1. UI
  if (url.pathname === "/" || url.pathname === "") {
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>IceDrive Pro Streamer</title>
        <style>
          body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #1e272e; color: #00d2d3; margin: 0; }
          .card { background: #2f3640; padding: 40px; border-radius: 16px; width: 100%; max-width: 500px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
          h2 { margin-top: 0; color: #00d2d3; }
          p { color: #8395a7; font-size: 14px; }
          input { width: 100%; padding: 14px; margin-bottom: 20px; background: #1e272e; border: 1px solid #00d2d3; color: white; border-radius: 6px; box-sizing: border-box; outline: none; }
          button { width: 100%; padding: 14px; background: #00d2d3; color: black; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 16px; }
          button:hover { background: #01a3a4; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>❄️ WebDAV Player</h2>
          <p>Enter exact filename in your IceDrive (e.g. movie.txt)</p>
          <form id="form">
            <input type="text" id="filename" placeholder="Enter Filename..." required />
            <button type="submit">Play Video</button>
          </form>
        </div>
        <script>
          document.getElementById('form').onsubmit = (e) => {
            e.preventDefault();
            const name = document.getElementById('filename').value;
            // Forward to stream path
            window.location.href = "/stream/" + encodeURIComponent(name); 
          }
        </script>
      </body>
      </html>
    `;
    return new Response(html, { headers: { "content-type": "text/html" } });
  }

  // 2. Streaming Logic
  try {
    // URL: /stream/movie.txt
    if (!url.pathname.startsWith("/stream/")) return new Response("Not Found", { status: 404 });
    
    const filename = decodeURIComponent(url.pathname.replace("/stream/", ""));
    console.log("Streaming via WebDAV:", filename);

    // WebDAV Auth
    const auth = btoa(`${ICEDRIVE_USER}:${ICEDRIVE_PASS}`);
    
    // Handle Range Requests (For Seeking)
    const requestHeaders = new Headers();
    requestHeaders.set("Authorization", `Basic ${auth}`);
    
    const range = req.headers.get("range");
    if (range) requestHeaders.set("Range", range);

    // Call WebDAV
    const webdavRes = await fetch(`${WEBDAV_URL}/${encodeURIComponent(filename)}`, {
        method: "GET",
        headers: requestHeaders
    });

    if (!webdavRes.ok) {
        return new Response(`WebDAV Error: ${webdavRes.status} (Check filename or credentials)`, { status: webdavRes.status });
    }

    // Force Video Headers (Fix for .txt files)
    const responseHeaders = new Headers(webdavRes.headers);
    responseHeaders.set("Content-Type", "video/mp4"); // 🔥 Force Video
    responseHeaders.set("Content-Disposition", `inline; filename="${filename}"`); // 🔥 Force Play
    
    // CORS
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
