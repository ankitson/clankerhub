const http = require("node:http");

const server = http.createServer(async (_req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: "llm-gateway-mock" }));
});

server.listen(8080, () => {
  console.log("LLM gateway mock listening on 8080");
});
