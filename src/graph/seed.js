import { faker } from "@faker-js/faker";
import {
  GOVERNANCE_AUTHORITATIVE,
  GOVERNANCE_COMMUNITY,
} from "./constants";

let nodeSeq = 1;
let linkSeq = 1;

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

  return {
    id: `n${nodeSeq++}`,
    label: randomLabel(),
    creatorId,
    governanceMode,
    votesByUser: {},
  };
}

export function makeLink(sourceId, targetId, creatorId, supportType) {
  const governanceMode = resolveGovernanceMode(creatorId);

  return {
    id: `l${linkSeq++}`,
    sourceId,
    targetId,
    label: randomLabel(),
    creatorId,
    governanceMode,
    supportType,
    votesByUser: {},
    voteLocksByUser: {},
    globalVoteLocked: false,
  };
}

export function makeInitialNodes() {
  return [makeNode("O"), makeNode("G_1"), makeNode("G_2")];
}