const ICEDRIVE_USER = Deno.env.get("ICEDRIVE_USER");
const ICEDRIVE_PASS = Deno.env.get("ICEDRIVE_PASS");
const WEBDAV_URL = "https://webdav.icedrive.io";

Deno.serve(async (req) => {
  if (!ICEDRIVE_USER || !ICEDRIVE_PASS) {
    return new Response("Error: ICEDRIVE_USER or ICEDRIVE_PASS missing.", { status: 500 });
  }

  const url = new URL(req.url);

  // 1. Simple UI
  if (url.pathname === "/" || url.pathname === "") {
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>IceDrive Debugger</title>
        <style>
          body { font-family: sans-serif; background: #2d3436; color: #dfe6e9; display: flex; justify-content: center; align-items: center; height: 100vh; }
          .box { background: #000; padding: 30px; border-radius: 10px; text-align: center; border: 1px solid #0984e3; }
          input { padding: 10px; width: 80%; border-radius: 5px; border: none; margin-bottom: 10px; }
          button { padding: 10px 20px; background: #0984e3; color: white; border: none; border-radius: 5px; cursor: pointer; }
        </style>
      </head>
      <body>
        <div class="box">
          <h2>❄️ Connection Test</h2>
          <p>Enter a filename (e.g. movie.mp4) to test access.</p>
          <form id="form">
            <input type="text" id="fname" placeholder="Exact Filename..." required />
            <button type="submit">Try Play</button>
          </form>
        </div>
        <script>
          document.getElementById('form').onsubmit = (e) => {
            e.preventDefault();
            const name = document.getElementById('fname').value;
            window.location.href = "/stream/" + encodeURIComponent(name);
          }
        </script>
      </body>
      </html>
    `;
    return new Response(html, { headers: { "content-type": "text/html" } });
  }

  // 2. Direct Stream Logic (No PROPFIND)
  try {
    if (!url.pathname.startsWith("/stream/")) return new Response("Not Found", { status: 404 });

    const filename = decodeURIComponent(url.pathname.replace("/stream/", ""));
    
    // Trim spaces from Credentials (Just in case)
    const cleanUser = ICEDRIVE_USER.trim();
    const cleanPass = ICEDRIVE_PASS.trim();
    const auth = btoa(`${cleanUser}:${cleanPass}`);

    const requestHeaders = new Headers();
    requestHeaders.set("Authorization", `Basic ${auth}`);
    
    const range = req.headers.get("range");
    if (range) requestHeaders.set("Range", range);

    console.log(`Attempting to fetch: ${filename} from ${WEBDAV_URL}`);

    const webdavRes = await fetch(`${WEBDAV_URL}/${encodeURIComponent(filename)}`, {
        method: "GET",
        headers: requestHeaders
    });

    if (!webdavRes.ok) {
        // Log error details
        const errText = await webdavRes.text();
        console.error(`IceDrive Error: ${webdavRes.status} - ${errText}`);
        return new Response(`Failed: ${webdavRes.status} ${webdavRes.statusText}\nDetails: ${errText}`, { status: webdavRes.status });
    }

    const responseHeaders = new Headers(webdavRes.headers);
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
    return new Response("Internal Error: " + err.message, { status: 500 });
  }
});
