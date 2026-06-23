// Vercel serverless function for the MCP endpoint.
// Mapped to /mcp via vercel.json rewrites. Static assets (icon, favicon,
// landing page) are served from /public by Vercel directly.
import { handleMcpPost, originFromRequest, METHOD_NOT_ALLOWED } from "../mcp-core.js";

export default async function handler(req, res) {
  // Stateless server: only POST is supported (no GET/SSE, no DELETE sessions).
  if (req.method !== "POST") {
    res.status(405).json(METHOD_NOT_ALLOWED);
    return;
  }
  try {
    const publicUrl = originFromRequest(req);
    // On Vercel's Node runtime, req.body is already parsed for application/json.
    await handleMcpPost(req, res, req.body, publicUrl);
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
}
