/**
 * Unit tests for 15-minute Task Agent frequency.
 * Run: node cronJob/taskAgentJob.15min.test.js
 */
const assert = require("assert");
const moment = require("moment-timezone");
const {
  is15MinuteFrequency,
  isTimeInWindow,
  parseTimeToMinutes,
  shouldTriggerAgent,
} = require("./taskAgentJob");

const TZ = "America/New_York";

const atLocal = (hhmm, dateStr = "2026-03-17") =>
  moment.tz(`${dateStr} ${hhmm}`, "YYYY-MM-DD HH:mm", TZ);

const baseAgent = (overrides = {}) => ({
  frequency: "15min",
  timezone: TZ,
  fromTime: "09:00",
  toTime: "17:00",
  lastTriggeredAt: null,
  ...overrides,
});

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ❌ ${name}`);
    console.error(`     ${err.message}`);
  }
}

console.log("\n=== 15min frequency recognition ===");
test("recognizes 15min", () => {
  assert.strictEqual(is15MinuteFrequency("15min"), true);
});
test("recognizes Every 15 Minutes", () => {
  assert.strictEqual(is15MinuteFrequency("Every 15 Minutes"), true);
});
test("recognizes 15 min", () => {
  assert.strictEqual(is15MinuteFrequency("15 min"), true);
});
test("rejects Daily", () => {
  assert.strictEqual(is15MinuteFrequency("Daily"), false);
});

console.log("\n=== parseTimeToMinutes / isTimeInWindow ===");
test("parse 09:00 → 540", () => {
  assert.strictEqual(parseTimeToMinutes("09:00"), 540);
});
test("08:59 → false", () => {
  assert.strictEqual(isTimeInWindow(atLocal("08:59"), "09:00", "17:00"), false);
});
test("09:00 → true", () => {
  assert.strictEqual(isTimeInWindow(atLocal("09:00"), "09:00", "17:00"), true);
});
test("09:15 → true", () => {
  assert.strictEqual(isTimeInWindow(atLocal("09:15"), "09:00", "17:00"), true);
});
test("17:00 → true (inclusive)", () => {
  assert.strictEqual(isTimeInWindow(atLocal("17:00"), "09:00", "17:00"), true);
});
test("17:01 → false", () => {
  assert.strictEqual(isTimeInWindow(atLocal("17:01"), "09:00", "17:00"), false);
});

console.log("\n=== First execution (lastTriggeredAt null, inside window) ===");
test("null lastTriggeredAt inside window → true", () => {
  const result = shouldTriggerAgent(baseAgent(), { nowLocal: atLocal("09:00") });
  assert.strictEqual(result.shouldTrigger, true);
});

console.log("\n=== Outside window ===");
test("08:59 → false", () => {
  const result = shouldTriggerAgent(baseAgent(), { nowLocal: atLocal("08:59") });
  assert.strictEqual(result.shouldTrigger, false);
});
test("17:01 → false", () => {
  const result = shouldTriggerAgent(baseAgent(), { nowLocal: atLocal("17:01") });
  assert.strictEqual(result.shouldTrigger, false);
});

console.log("\n=== Throttling after lastTriggeredAt = 09:00 ===");
test("09:05 → false", () => {
  const last = atLocal("09:00").toDate();
  const result = shouldTriggerAgent(baseAgent({ lastTriggeredAt: last }), {
    nowLocal: atLocal("09:05"),
  });
  assert.strictEqual(result.shouldTrigger, false);
});
test("09:10 → false", () => {
  const last = atLocal("09:00").toDate();
  const result = shouldTriggerAgent(baseAgent({ lastTriggeredAt: last }), {
    nowLocal: atLocal("09:10"),
  });
  assert.strictEqual(result.shouldTrigger, false);
});
test("09:14 → false", () => {
  const last = atLocal("09:00").toDate();
  const result = shouldTriggerAgent(baseAgent({ lastTriggeredAt: last }), {
    nowLocal: atLocal("09:14"),
  });
  assert.strictEqual(result.shouldTrigger, false);
});
test("09:15 → true", () => {
  const last = atLocal("09:00").toDate();
  const result = shouldTriggerAgent(baseAgent({ lastTriggeredAt: last }), {
    nowLocal: atLocal("09:15"),
  });
  assert.strictEqual(result.shouldTrigger, true);
});

console.log("\n=== After execution lastTriggeredAt = 09:15 ===");
test("09:20 → false", () => {
  const last = atLocal("09:15").toDate();
  const result = shouldTriggerAgent(baseAgent({ lastTriggeredAt: last }), {
    nowLocal: atLocal("09:20"),
  });
  assert.strictEqual(result.shouldTrigger, false);
});
test("09:30 → true", () => {
  const last = atLocal("09:15").toDate();
  const result = shouldTriggerAgent(baseAgent({ lastTriggeredAt: last }), {
    nowLocal: atLocal("09:30"),
  });
  assert.strictEqual(result.shouldTrigger, true);
});

console.log("\n=== Boundary 17:00 still eligible if throttle allows ===");
test("17:00 with null lastTriggeredAt → true", () => {
  const result = shouldTriggerAgent(baseAgent(), { nowLocal: atLocal("17:00") });
  assert.strictEqual(result.shouldTrigger, true);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
