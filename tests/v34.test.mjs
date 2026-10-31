import assert from "node:assert/strict";
import { makeDb, ADMIN_COOKIE, TEST_ADMIN_HASH } from "./helpers/mockdb.mjs";
import { onRequestDelete as deleteCoupon } from "../functions/api/admin/coupons.js";

const base = makeDb();
const seen = [];
const db = { prepare(sql) { seen.push(sql); return base.prepare(sql); } };
const env = { ORDERS_DB: db, ADMIN_EMAIL: "owner@example.test", ADMIN_PASSWORD_HASH: TEST_ADMIN_HASH };
const req = (code, cookie = ADMIN_COOKIE) => new Request("https://shop.example.test/api/admin/coupons?code=" + code, {
  method: "DELETE", headers: { ...(cookie ? { Cookie: cookie } : {}), "Content-Type": "application/json" }, body: "{}"
});

const ok = await deleteCoupon({ request: req("launch30"), env });
assert.equal(ok.status, 200);
assert.ok(seen.some((s) => s.includes("DELETE FROM coupons")), "the coupon must be deleted from the database");
assert.equal((await deleteCoupon({ request: req("x;drop"), env })).status, 400, "bad codes are refused");
assert.equal((await deleteCoupon({ request: req("launch30", null), env })).status, 401, "login is required");
console.log("Coupon delete test passed.");
