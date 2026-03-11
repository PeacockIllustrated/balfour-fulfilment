process.chdir(__dirname);
const { execSync } = require("child_process");
const args = process.argv.slice(2).join(" ");
try {
  execSync(`npx next ${args}`, { cwd: __dirname, stdio: "inherit", env: { ...process.env } });
} catch (e) {
  process.exit(e.status || 1);
}
