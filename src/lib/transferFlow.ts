/**
 * Pure status machine for the Transfer success flow.
 * No side effects, no React — fully unit-testable.
 */
export type TransferFlowStatus = "idle" | "submitting" | "success" | "leaving";
export type TransferFlowEvent =
  | "SUBMIT"
  | "RESOLVE_OK"
  | "RESOLVE_ERROR"
  | "ANIMATION_DONE"
  | "SKIP";

export function nextTransferStatus(
  current: TransferFlowStatus,
  event: TransferFlowEvent
): TransferFlowStatus {
  switch (current) {
    case "idle":
      return event === "SUBMIT" ? "submitting" : current;
    case "submitting":
      if (event === "RESOLVE_OK") return "success";
      if (event === "RESOLVE_ERROR") return "idle";
      return current;
    case "success":
      return event === "ANIMATION_DONE" || event === "SKIP" ? "leaving" : current;
    case "leaving":
      return current;
  }
}

export function canSubmit(status: TransferFlowStatus): boolean {
  return status === "idle";
}

export function isTerminal(status: TransferFlowStatus): boolean {
  return status === "leaving";
}