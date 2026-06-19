import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const PORT = process.env.PORT || 3000;

// On Render this is injected automatically (e.g. https://grace-hello-mcp.onrender.com).
// Locally it falls back to localhost. The icon MUST be advertised as an absolute
// https:// (or data:) URI per the MCP spec, so we build it from this base.
const PUBLIC_URL = (
  process.env.RENDER_EXTERNAL_URL ||
  process.env.PUBLIC_URL ||
  `http://localhost:${PORT}`
).replace(/\/$/, "");

const ICON_URL = `${PUBLIC_URL}/icon.png`;

// --- The MCP server definition -------------------------------------------------
// We use the low-level Server so we have full control over what goes into the
// initialize response's `serverInfo` (this is where the icon lives).
function buildServer() {
  const server = new Server(
    {
      name: "grace-hello-mcp",
      version: "1.0.0",
      title: "GRACE Hello MCP",
      websiteUrl: PUBLIC_URL,
      // SEP-973: icons advertised by the server implementation. Clients that
      // support icon rendering will use this instead of their default placeholder.
      icons: [
        {
          src: ICON_URL,
          mimeType: "image/png",
          sizes: ["512x512"],
        },
      ],
    },
    {
      capabilities: { tools: {} },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "say_hello",
        title: "Say Hello",
        description: "Returns a friendly greeting for the given name.",
        // Tools can carry their own icons too — handy in clients that show
        // per-tool icons in a palette.
        icons: [{ src: ICON_URL, mimeType: "image/png", sizes: ["512x512"] }],
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Who to greet.",
            },
          },
          required: ["name"],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== "say_hello") {
      throw new Error(`Unknown tool: ${request.params.name}`);
    }
    const who = request.params.arguments?.name ?? "world";
    return {
      content: [
        { type: "text", text: `👋 Hello, ${who}! Greetings from GRACE Hello MCP.` },
      ],
    };
  });

  return server;
}

// --- HTTP layer (Streamable HTTP transport, stateless mode) --------------------
const app = express();
app.use(express.json());

// Serve the icon (and anything else in /static) at the site root.
app.use(express.static("static"));

// A tiny human-friendly landing/health page so you can eyeball the icon.
app.get("/", (_req, res) => {
  res.type("html").send(`<!doctype html>
<meta charset="utf-8">
<title>GRACE Hello MCP</title>
<body style="font-family:system-ui;max-width:640px;margin:60px auto;color:#0f2027">
  <img src="/icon.png" width="96" height="96" alt="icon" style="border-radius:20px">
  <h1>GRACE Hello MCP</h1>
  <p>This is a remote MCP server (Streamable HTTP).</p>
  <p>MCP endpoint: <code>${PUBLIC_URL}/mcp</code></p>
  <p>Icon advertised at: <code>${ICON_URL}</code></p>
</body>`);
});

// MCP endpoint. New server+transport per request = simple stateless mode.
app.post("/mcp", async (req, res) => {
  try {
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
    });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
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
const methodNotAllowed = (_req, res) =>
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed." },
    id: null,
  });
app.get("/mcp", methodNotAllowed);
app.delete("/mcp", methodNotAllowed);

app.listen(PORT, () => {
  console.log(`GRACE Hello MCP listening on ${PUBLIC_URL}`);
  console.log(`  MCP endpoint:  ${PUBLIC_URL}/mcp`);
  console.log(`  Icon:          ${ICON_URL}`);
});
