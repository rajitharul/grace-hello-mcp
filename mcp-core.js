// Shared MCP server logic, used by BOTH:
//   - server.js      (Express; local dev + Render)
//   - api/mcp.js     (Vercel serverless function)
// Keeping it here means the two deploy targets can never drift apart.
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { ICON_DATA_URI } from "./icon-data.js";

// Build the icon set we advertise: HTTPS first (cacheable, preferred), then the
// self-contained data: URI fallback. `publicUrl` is the absolute origin so the
// HTTPS icon resolves (e.g. https://isitnormal.space).
export function buildIcons(publicUrl) {
  return [
    { src: `${publicUrl}/icon.png`, mimeType: "image/png", sizes: ["512x512"] },
    { src: ICON_DATA_URI, mimeType: "image/png", sizes: ["128x128"] },
  ];
}

// Construct a fresh MCP server (used per-request in stateless mode).
export function buildServer(publicUrl) {
  const icons = buildIcons(publicUrl);

  const server = new Server(
    {
      name: "grace-hello-mcp",
      version: "1.0.0",
      title: "GRACE Hello MCP",
      websiteUrl: publicUrl,
      icons, // SEP-973 server-implementation icons
    },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "say_hello",
        title: "Say Hello",
        description: "Returns a friendly greeting for the given name.",
        icons,
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Who to greet." },
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

// Handle one POST to the MCP endpoint in stateless mode. Works with both
// Express (req.body parsed by express.json()) and Vercel (req.body parsed by
// the platform) since the parsed body is passed in explicitly.
export async function handleMcpPost(req, res, body, publicUrl) {
  const server = buildServer(publicUrl);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
  });
  res.on("close", () => {
    transport.close();
    server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, body);
}

// Derive the absolute origin from request headers (handles proxies / custom
// domains on both Render and Vercel).
export function originFromRequest(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

export const METHOD_NOT_ALLOWED = {
  jsonrpc: "2.0",
  error: { code: -32000, message: "Method not allowed." },
  id: null,
};
