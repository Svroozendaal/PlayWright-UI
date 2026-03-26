const e = require("electron");
console.log("type:", typeof e);
console.log("keys:", Object.keys(e).slice(0, 10));
console.log("has app:", "app" in e);
if (e.app) {
  e.app.whenReady().then(() => { console.log("OK"); e.app.quit(); });
} else {
  process.exit(1);
}
