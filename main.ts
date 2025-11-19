Deno.serve(async (req) => {
  const url = new URL(req.url);

  // 1. Frontend UI
  if (url.pathname === "/" || url.pathname === "") {
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>IceDrive Streamer</title>
        <style>
          body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #0b0c10; color: #66fcf1; margin: 0; }
          .card { background: #1f2833; padding: 40px; border-radius: 16px; width: 100%; max-width: 500px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
          h2 { margin-top: 0; color: #45a29e; }
          input { width: 100%; padding: 14px; margin-bottom: 20px; background: #0b0c10; border: 1px solid #45a29e; color: white; border-radius: 6px; box-sizing: border-box; outline: none; }
          button { width: 100%; padding: 14px; background: #45a29e; color: black; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 16px; }
          button:hover { background: #66fcf1; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>❄️ IceDrive Player</h2>
          <p>Paste IceDrive Link to Stream Video</p>
          <form id="form">
            <input type="url" id="iceUrl" placeholder="https://icedrive.net/s/..." required />
            <button type="submit">Play Video</button>
          </form>
        </div>
        <script>
          document.getElementById('form').onsubmit = (e) => {
            e.preventDefault();
            const url = document.getElementById('iceUrl').value;
            window.location.href = "/" + url; 
          }
        </script>
      </body>
      </html>
    `;
    return new Response(html, { headers: { "content-type": "text/html" } });
  }

  try {
    // Extract IceDrive URL from path
    const rawPath = decodeURIComponent(url.pathname + url.search).substring(1);
    
    if (!rawPath.includes("icedrive.net/s/")) {
        return new Response("Invalid IceDrive URL.", { status: 400 });
    }

    // --- STEP A: Extract File ID & Call API ---
    // URL Format: https://icedrive.net/s/123ABC456
    const parts = rawPath.split("/s/");
    const fileId = parts[1];

    if (!fileId) return new Response("Could not find File ID.", { status: 400 });

    // Call IceDrive Public API to get Direct Link
    const apiRes = await fetch("https://icedrive.net/app/api/delivery/get_public_link", {
        method: "POST",
        body: JSON.stringify({ id: fileId }),
        headers: { "Content-Type": "application/json" }
    });

    const apiData = await apiRes.json();

    if (apiData.error || !apiData.url) {
        return new Response("IceDrive API Error: " + (apiData.error?.message || "Link not found"), { status: 404 });
    }

    const directLink = apiData.url;

    // --- STEP B: Stream the Video (Range Request) ---
    const requestHeaders = new Headers();
    const range = req.headers.get("range");
    if (range) requestHeaders.set("Range", range);
    
    // Spoof User-Agent just in case
    requestHeaders.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");

    const fileRes = await fetch(directLink, {
        headers: requestHeaders 
    });

    // --- STEP C: Prepare Headers for Inline Playback ---
    const responseHeaders = new Headers(fileRes.headers);
    
    // 'inline' makes the browser play it instead of downloading
    let filename = "video.mp4";
    // Try to get real filename from IceDrive response headers
    const disp = fileRes.headers.get("content-disposition");
    if (disp && disp.includes("filename=")) {
        filename = disp.split("filename=")[1].replace(/"/g, "");
    }

    responseHeaders.set("Content-Disposition", `inline; filename="${filename}"`);
    responseHeaders.set("Access-Control-Allow-Origin", "*"); // For Players
    responseHeaders.set("Access-Control-Allow-Headers", "Range");
    responseHeaders.set("Access-Control-Expose-Headers", "Content-Range, Content-Length");

    return new Response(fileRes.body, {
        status: fileRes.status,
        headers: responseHeaders
    });

  } catch (err) {
    return new Response("Stream Error: " + err.message, { status: 500 });
  }
});
