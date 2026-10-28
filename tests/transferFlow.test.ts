import test from "node:test";
import assert from "node:assert/strict";
import {
  nextTransferStatus,
  canSubmit,
  isTerminal,
  type TransferFlowStatus,
  type TransferFlowEvent,
} from "../src/lib/transferFlow";

const allEvents: TransferFlowEvent[] = [
  "SUBMIT",
  "RESOLVE_OK",
  "RESOLVE_ERROR",
  "ANIMATION_DONE",
  "SKIP",
];

function checkAll(current: TransferFlowStatus) {
  const results: Record<string, TransferFlowStatus> = {};
  for (const e of allEvents) {
    results[e] = nextTransferStatus(current, e);
  }
  return results;
}

test("idle + SUBMIT -> submitting; other events ignored", () => {
  const r = checkAll("idle");
  assert.equal(r.SUBMIT, "submitting");
  assert.equal(r.RESOLVE_OK, "idle");
  assert.equal(r.RESOLVE_ERROR, "idle");
  assert.equal(r.ANIMATION_DONE, "idle");
  assert.equal(r.SKIP, "idle");
});

test("submitting + RESOLVE_OK -> success; RESOLVE_ERROR -> idle; others ignored", () => {
  const r = checkAll("submitting");
  assert.equal(r.SUBMIT, "submitting"); // double tap guarded by button + this
  assert.equal(r.RESOLVE_OK, "success");
  assert.equal(r.RESOLVE_ERROR, "idle");
  assert.equal(r.ANIMATION_DONE, "submitting");
  assert.equal(r.SKIP, "submitting");
});

test("success + ANIMATION_DONE|SKIP -> leaving; others ignored", () => {
  const r = checkAll("success");
  assert.equal(r.SUBMIT, "success");
  assert.equal(r.RESOLVE_OK, "success");
  assert.equal(r.RESOLVE_ERROR, "success");
  assert.equal(r.ANIMATION_DONE, "leaving");
  assert.equal(r.SKIP, "leaving");
});

test("leaving is absorbing (any event -> leaving)", () => {
  const r = checkAll("leaving");
  assert.equal(r.SUBMIT, "leaving");
  assert.equal(r.RESOLVE_OK, "leaving");
  assert.equal(r.RESOLVE_ERROR, "leaving");
  assert.equal(r.ANIMATION_DONE, "leaving");
  assert.equal(r.SKIP, "leaving");
});

test("canSubmit only true for idle", () => {
  assert.equal(canSubmit("idle"), true);
  assert.equal(canSubmit("submitting"), false);
  assert.equal(canSubmit("success"), false);
  assert.equal(canSubmit("leaving"), false);
});

test("isTerminal only true for leaving", () => {
  assert.equal(isTerminal("idle"), false);
  assert.equal(isTerminal("submitting"), false);
  assert.equal(isTerminal("success"), false);
  assert.equal(isTerminal("leaving"), true);
});

test("full success chain: idle -> SUBMIT -> submitting -> RESOLVE_OK -> success -> ANIMATION_DONE -> leaving", () => {
  let s: TransferFlowStatus = "idle";
  s = nextTransferStatus(s, "SUBMIT");
  assert.equal(s, "submitting");
  s = nextTransferStatus(s, "RESOLVE_OK");
  assert.equal(s, "success");
  s = nextTransferStatus(s, "ANIMATION_DONE");
  assert.equal(s, "leaving");
  assert.equal(isTerminal(s), true);
});

test("error chain returns to idle without reaching success", () => {
  let s: TransferFlowStatus = "idle";
  s = nextTransferStatus(s, "SUBMIT");
  assert.equal(s, "submitting");
  s = nextTransferStatus(s, "RESOLVE_ERROR");
  assert.equal(s, "idle");
  assert.equal(isTerminal(s), false);
});

test("double SUBMIT while submitting stays submitting (guard)", () => {
  let s: TransferFlowStatus = "idle";
  s = nextTransferStatus(s, "SUBMIT");
  assert.equal(s, "submitting");
  s = nextTransferStatus(s, "SUBMIT");
  assert.equal(s, "submitting");
});