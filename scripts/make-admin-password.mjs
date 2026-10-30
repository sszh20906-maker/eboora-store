// Run in Termux:  node scripts/make-admin-password.mjs
// Prints the password hash for ADMIN_PASSWORD_HASH. Only this hash goes into Cloudflare, never the password itself.
import { pbkdf2Sync, randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const rl = createInterface({ input, output });
const password = await rl.question("Naya admin password type karo (screen par dikhega): ");
rl.close();

if (password.length < 12) {
  console.error("Password kam se kam 12 characters ka rakho.");
  process.exit(1);
}

const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, 100000, 32, "sha256");
console.log("\nADMIN_PASSWORD_HASH (ye value Cloudflare Secret mein daalo):\n");
console.log(`pbkdf2$100000$${salt.toString("base64")}$${hash.toString("base64")}`);
