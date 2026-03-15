export function createActionPlan() {
  return {
    allowed: true,
    reason: "",

    nodeChanges: [],
    linkChanges: [],

    deletions: [],
    locks: [],
  };
}

export function denyPlan(reason) {
  return {
    allowed: false,
    reason,

    nodeChanges: [],
    linkChanges: [],
    deletions: [],
    locks: [],
  };
}