# GRACE Hello MCP

A very simple **remote MCP server** (Streamable HTTP transport) that advertises a
**custom icon** per the MCP spec (rev `2025-11-25`, SEP-973), ready to deploy on
[Render](https://render.com).

It exposes one tool, `say_hello`, and serves a custom PNG icon that is advertised
in the `initialize` response's `serverInfo.icons`.

## Project layout

| File | Purpose |
|------|---------|
| `server.js` | The MCP server (Express + `@modelcontextprotocol/sdk`, Streamable HTTP). |
| `make_icon.py` | Generates `static/icon.png` (stdlib only, no deps). Edit to change the icon. |
| `static/icon.png` | The icon that gets advertised + served. |
| `render.yaml` | Render blueprint for one-click deploy. |

## Run locally

```bash
npm install
npm start            # serves on http://localhost:3000
```

- Landing/health page (shows the icon): http://localhost:3000/
- MCP endpoint: `http://localhost:3000/mcp`
- Icon: http://localhost:3000/icon.png

Quick smoke test:

```bash
curl -s -X POST http://localhost:3000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'
```

You should see `serverInfo.icons` in the response.

Or use the official **MCP Inspector** (renders the icon):

```bash
npx @modelcontextprotocol/inspector
# then connect to http://localhost:3000/mcp  (Streamable HTTP)
```

## Deploy on Render

1. Push this folder to a GitHub repo.
2. In Render: **New ➜ Blueprint**, point it at the repo. It reads `render.yaml`
   and creates a free Node web service. (Or **New ➜ Web Service** manually:
   build `npm install`, start `npm start`.)
3. Render injects `RENDER_EXTERNAL_URL` automatically, so `server.js` builds the
   correct absolute `https://<your-service>.onrender.com/icon.png` icon URL — no
   manual env vars needed.
4. Your MCP endpoint is `https://<your-service>.onrender.com/mcp`.

> Note: Render's free plan sleeps on idle, so the first request after a while
> may take ~30s to wake.

## Add it to an MCP client

**Claude Code (CLI):**

```bash
claude mcp add --transport http grace-hello https://<your-service>.onrender.com/mcp
```

Then in a session: `/mcp` to see it, and ask Claude to "use say_hello to greet Rajith".

**Claude Desktop / other GUI clients:** add a remote/HTTP MCP server pointing at
`https://<your-service>.onrender.com/mcp`.

## About the icon (read this)

This server advertises its icon **correctly per the MCP spec**: the `icons` array
appears on `serverInfo` (and on the tool). It must be an `https://` or `data:`
URI — we use the hosted `https://.../icon.png`.

**Whether a client shows it is up to that client.** Icon rendering is a newer,
inconsistently-supported feature:

- ✅ **MCP Inspector** and other spec-aware clients read and display it.
- ⚠️ **Claude Code / Claude Desktop** currently still show their default
  placeholder for arbitrary third-party servers — the branded icons in Claude's
  marketplace are first-party integrations configured on Anthropic's side. As
  client icon support matures, this server is already compliant and will "just
  work" with no changes.

## Customize

- **Icon:** edit colors/shapes in `make_icon.py`, then `npm run make-icon`
  (regenerates `static/icon.png`). Or just drop your own 512×512 PNG at
  `static/icon.png`.
- **Tools:** add more `setRequestHandler` cases / tool definitions in `server.js`.
