Deno.serve(async (req) => {
  const url = new URL(req.url);

  // 1. UI Section
  if (url.pathname === "/" || url.pathname === "") {
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>IceDrive Fixer</title>
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
          <h2>❄️ IceDrive Streamer</h2>
          <p>Fix for .txt video files</p>
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
    const rawPath = decodeURIComponent(url.pathname + url.search).substring(1);
    
    if (!rawPath.includes("icedrive.net/s/")) {
        return new Response("Invalid IceDrive URL.", { status: 400 });
    }

    // Extract File ID
    const parts = rawPath.split("/s/");
    const fileId = parts[1];

    if (!fileId) return new Response("Could not find File ID.", { status: 400 });

    // --- FIX 1: ADD FAKE HEADERS (Pretend to be Chrome) ---
    const fakeHeaders = {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Origin": "https://icedrive.net",
        "Referer": "https://icedrive.net/",
        "X-Requested-With": "XMLHttpRequest"
    };

    // Call IceDrive API
    const apiRes = await fetch("https://icedrive.net/app/api/delivery/get_public_link", {
        method: "POST",
        body: JSON.stringify({ id: fileId }),
        headers: fakeHeaders
    });

    // Check if response is actually JSON before parsing
    const contentType = apiRes.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
        const text = await apiRes.text();
        console.log("IceDrive blocked the request:", text.substring(0, 100));
        return new Response("IceDrive Blocked Deno (Anti-Bot). Try using R2 method instead.", { status: 403 });
    }

    const apiData = await apiRes.json();

    if (apiData.error || !apiData.url) {
        return new Response("IceDrive API Error: " + (apiData.error?.message || "Link not found"), { status: 404 });
    }

    const directLink = apiData.url;

    // --- Stream Video ---
    const requestHeaders = new Headers();
    const range = req.headers.get("range");
    if (range) requestHeaders.set("Range", range);
    
    // Pass User-Agent to the file server too
    requestHeaders.set("User-Agent", fakeHeaders["User-Agent"]);

    const fileRes = await fetch(directLink, {
        headers: requestHeaders 
    });

    // --- FIX 2: FORCE VIDEO CONTENT TYPE ---
    const responseHeaders = new Headers(fileRes.headers);
    
    // Even if file is .txt, tell browser it is MP4
    responseHeaders.set("Content-Type", "video/mp4"); 
    responseHeaders.set("Content-Disposition", `inline; filename="video.mp4"`);
    
    responseHeaders.set("Access-Control-Allow-Origin", "*");
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
