// Express entrypoint for local dev and Render. (Vercel uses api/mcp.js instead;
// both share mcp-core.js so behaviour can't drift.)
import express from "express";
import {
  handleMcpPost,
  originFromRequest,
  METHOD_NOT_ALLOWED,
} from "./mcp-core.js";

const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());

// Serve static assets (icon.png, icon-128.png, favicon.ico, index.html) from
// /public — the same directory Vercel serves as the web root.
app.use(express.static("public"));

// MCP endpoint (stateless Streamable HTTP). New server+transport per request.
app.post("/mcp", async (req, res) => {
  try {
    await handleMcpPost(req, res, req.body, originFromRequest(req));
  } catch (err) {
    console.error("MCP request error:", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

// Stateless servers don't support GET (SSE) or DELETE sessions.
const methodNotAllowed = (_req, res) => res.status(405).json(METHOD_NOT_ALLOWED);
app.get("/mcp", methodNotAllowed);
app.delete("/mcp", methodNotAllowed);

app.listen(PORT, () => {
  console.log(`GRACE Hello MCP listening on http://localhost:${PORT}`);
  console.log(`  MCP endpoint:  http://localhost:${PORT}/mcp`);
});
