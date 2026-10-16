// Run: npx tsx --test scripts/test-visible-interval.ts
import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { startVisibleInterval } from "../lib/visible-interval";

function fakeDocument(initial: "visible" | "hidden") {
  const target = new EventTarget();
  const doc = {
    visibilityState: initial as DocumentVisibilityState,
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
  };
  return {
    doc,
    set(state: "visible" | "hidden") {
      doc.visibilityState = state;
      target.dispatchEvent(new Event("visibilitychange"));
    },
  };
}

test("fires every interval while the page is visible", () => {
  mock.timers.enable({ apis: ["setInterval"] });
  const { doc } = fakeDocument("visible");
  let calls = 0;
  const stop = startVisibleInterval(doc, () => calls++, 60_000);
  mock.timers.tick(59_999);
  assert.equal(calls, 0);
  mock.timers.tick(1);
  assert.equal(calls, 1);
  mock.timers.tick(120_000);
  assert.equal(calls, 3);
  stop();
  mock.timers.reset();
});

test("pauses while hidden and refetches immediately when visible again", () => {
  mock.timers.enable({ apis: ["setInterval"] });
  const page = fakeDocument("visible");
  let calls = 0;
  const stop = startVisibleInterval(page.doc, () => calls++, 60_000);

  mock.timers.tick(60_000);
  assert.equal(calls, 1);

  page.set("hidden");
  mock.timers.tick(10 * 60_000);
  assert.equal(calls, 1, "no calls while hidden");

  page.set("visible");
  assert.equal(calls, 2, "immediate refetch on becoming visible");

  mock.timers.tick(59_999);
  assert.equal(calls, 2, "interval restarts from the moment it became visible");
  mock.timers.tick(1);
  assert.equal(calls, 3);
  stop();
  mock.timers.reset();
});

test("does not start the interval if the page is initially hidden, but refetches when shown", () => {
  mock.timers.enable({ apis: ["setInterval"] });
  const page = fakeDocument("hidden");
  let calls = 0;
  const stop = startVisibleInterval(page.doc, () => calls++, 60_000);
  mock.timers.tick(5 * 60_000);
  assert.equal(calls, 0);
  page.set("visible");
  assert.equal(calls, 1);
  stop();
  mock.timers.reset();
});

test("cleanup stops the interval and removes the listener", () => {
  mock.timers.enable({ apis: ["setInterval"] });
  const page = fakeDocument("visible");
  let calls = 0;
  const stop = startVisibleInterval(page.doc, () => calls++, 60_000);
  stop();
  mock.timers.tick(5 * 60_000);
  page.set("hidden");
  page.set("visible");
  assert.equal(calls, 0);
  mock.timers.reset();
});

test("repeated visible events do not stack intervals", () => {
  mock.timers.enable({ apis: ["setInterval"] });
  const page = fakeDocument("visible");
  let calls = 0;
  const stop = startVisibleInterval(page.doc, () => calls++, 60_000);
  page.set("visible");
  page.set("visible");
  assert.equal(calls, 2);
  mock.timers.tick(60_000);
  assert.equal(calls, 3, "only one interval is running");
  stop();
  mock.timers.reset();
});
