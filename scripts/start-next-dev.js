const { startServer } = require("../node_modules/next/dist/server/lib/start-server");

function readPort() {
  const portFlagIndex = process.argv.findIndex((arg) => arg === "-p" || arg === "--port");
  const portValue = portFlagIndex >= 0 ? process.argv[portFlagIndex + 1] : process.env.PORT;
  const port = Number(portValue || 3001);

  return Number.isFinite(port) && port > 0 ? port : 3001;
}

startServer({
  dir: process.cwd(),
  port: readPort(),
  isDev: true,
  hostname: "localhost",
  allowRetry: false,
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
