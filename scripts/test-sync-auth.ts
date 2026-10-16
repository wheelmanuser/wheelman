// Run: npx tsx --test scripts/test-sync-auth.ts
import test from "node:test";
import assert from "node:assert/strict";
import { checkAuthorization, timingSafeEqual } from "../supabase/functions/sync-telemetry/auth";

const KEY = "test-key-0123456789abcdef"; // fake value, not a real secret

test("correct bearer key is accepted", () => {
  assert.equal(checkAuthorization(`Bearer ${KEY}`, KEY), "ok");
});

test("the Bearer scheme is case-insensitive", () => {
  assert.equal(checkAuthorization(`bearer ${KEY}`, KEY), "ok");
  assert.equal(checkAuthorization(`BEARER ${KEY}`, KEY), "ok");
});

test("missing or empty header is unauthorized", () => {
  assert.equal(checkAuthorization(null, KEY), "unauthorized");
  assert.equal(checkAuthorization("", KEY), "unauthorized");
  assert.equal(checkAuthorization("Bearer ", KEY), "unauthorized");
  assert.equal(checkAuthorization("Bearer", KEY), "unauthorized");
});

test("wrong key is unauthorized", () => {
  assert.equal(checkAuthorization("Bearer wrong-key", KEY), "unauthorized");
  assert.equal(checkAuthorization(`Bearer ${"x".repeat(KEY.length)}`, KEY), "unauthorized");
});

test("same-length keys that differ at the first, middle, or last byte are unauthorized", () => {
  const flip = (i: number) => KEY.slice(0, i) + (KEY[i] === "z" ? "y" : "z") + KEY.slice(i + 1);
  for (const i of [0, Math.floor(KEY.length / 2), KEY.length - 1]) {
    assert.equal(checkAuthorization(`Bearer ${flip(i)}`, KEY), "unauthorized", `byte ${i}`);
  }
});

test("a prefix, an extension, or a padded key is unauthorized", () => {
  assert.equal(checkAuthorization(`Bearer ${KEY.slice(0, -1)}`, KEY), "unauthorized");
  assert.equal(checkAuthorization(`Bearer ${KEY}x`, KEY), "unauthorized");
  assert.equal(checkAuthorization(`Bearer  ${KEY}`, KEY), "unauthorized");
  assert.equal(checkAuthorization(`Bearer ${KEY} `, KEY), "unauthorized");
});

test("other schemes and a bare key are unauthorized", () => {
  assert.equal(checkAuthorization(`Basic ${KEY}`, KEY), "unauthorized");
  assert.equal(checkAuthorization(`Token ${KEY}`, KEY), "unauthorized");
  assert.equal(checkAuthorization(KEY, KEY), "unauthorized");
});

test("an unset or empty server key fails closed as misconfigured, whatever the header says", () => {
  assert.equal(checkAuthorization(`Bearer ${KEY}`, undefined), "misconfigured");
  assert.equal(checkAuthorization(`Bearer ${KEY}`, ""), "misconfigured");
  assert.equal(checkAuthorization(null, undefined), "misconfigured");
  assert.equal(checkAuthorization("Bearer ", ""), "misconfigured");
});

test("an empty bearer token never matches an empty-looking key", () => {
  assert.equal(checkAuthorization("Bearer ", KEY), "unauthorized");
});

test("timingSafeEqual compares by bytes, including multi-byte characters", () => {
  assert.equal(timingSafeEqual("abc", "abc"), true);
  assert.equal(timingSafeEqual("abc", "abd"), false);
  assert.equal(timingSafeEqual("abc", "abcd"), false);
  assert.equal(timingSafeEqual("", ""), true);
  assert.equal(timingSafeEqual("é", "é"), true);
  assert.equal(timingSafeEqual("é", "e"), false);
  assert.equal(timingSafeEqual("ab", "éa"), false); // 2 chars vs 3 bytes
});
