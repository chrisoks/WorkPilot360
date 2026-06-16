const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const nextCachePath = path.resolve(projectRoot, ".next");

if (!nextCachePath.startsWith(projectRoot + path.sep)) {
  throw new Error("Refusing to remove a path outside the project.");
}

fs.rmSync(nextCachePath, { force: true, recursive: true });

