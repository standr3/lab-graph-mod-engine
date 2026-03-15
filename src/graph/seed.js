import { faker } from "@faker-js/faker";
import {
  GOVERNANCE_AUTHORITATIVE,
  GOVERNANCE_COMMUNITY,
} from "./constants";

let nodeSeq = 1;
let replySeq = 1;

export function randomLabel() {
  return faker.word.words({ count: { min: 1, max: 3 } });
}

function resolveGovernanceMode(creatorId) {
  return creatorId === "O"
    ? GOVERNANCE_AUTHORITATIVE
    : GOVERNANCE_COMMUNITY;
}

export function makeNode(creatorId) {
  const governanceMode = resolveGovernanceMode(creatorId);

  console.log("[SEED] makeNode", {
    creatorId,
    governanceMode,
  });

  return {
    id: `n${nodeSeq++}`,
    label: randomLabel(),
    creatorId,
    governanceMode,
    votesByUser: {},
  };
}

export function makeReply(nodeId, creatorId, supportType) {
  const reply = {
    id: `r${replySeq++}`,
    nodeId,
    label: randomLabel(),
    creatorId,
    supportType,
    votesByUser: {},
  };

  console.log("[SEED] makeReply", reply);

  return reply;
}

export function makeInitialNodes() {
  const nodes = [makeNode("O"), makeNode("G_1"), makeNode("G_2")];

  console.log("[SEED] makeInitialNodes", nodes);

  return nodes;
}