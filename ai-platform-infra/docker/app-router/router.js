const http = require("node:http");

const server = http.createServer(async (_req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: "edge-router-mock" }));
});

server.listen(8787, () => {
  console.log("Edge router mock listening on 8787");
});
