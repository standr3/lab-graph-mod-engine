import {
  GOVERNANCE_AUTHORITATIVE,
  VOTE_DOWN,
  VOTE_NONE,
  VOTE_UP,
} from "./constants";

export function getVoteForUser(entity, userId) {
  return entity.votesByUser[userId] || VOTE_NONE;
}

export function getNodeVoteForUser(node, userId) {
  return getVoteForUser(node, userId);
}

export function getLinkVoteForUser(link, userId) {
  return getVoteForUser(link, userId);
}

export function getUpList(entity) {
  return Object.entries(entity.votesByUser)
    .filter(([, vote]) => vote === VOTE_UP)
    .map(([userId]) => userId);
}

export function getDownList(entity) {
  return Object.entries(entity.votesByUser)
    .filter(([, vote]) => vote === VOTE_DOWN)
    .map(([userId]) => userId);
}

export function formatNodeText(node) {
  const upList = getUpList(node);
  const downList = getDownList(node);

  return `[${node.label} : ${node.creatorId} + (${upList.join(", ")}) - (${downList.join(", ")})]`;
}

export function formatLinkText(link) {
  const upList = getUpList(link);
  const downList = getDownList(link);

  return `[${link.label} : ${link.creatorId} + (${upList.join(", ")}) - (${downList.join(", ")}) | support:${link.supportType}]`;
}

export function getOutgoingLinks(links, sourceId) {
  return links.filter((link) => link.sourceId === sourceId);
}

export function getNodeById(nodes, nodeId) {
  return nodes.find((node) => node.id === nodeId) || null;
}

export function isEntityAuthoritativeByOrigin(entity) {
  return entity.governanceMode === GOVERNANCE_AUTHORITATIVE;
}

export function isNodeAuthoritativeByOrigin(node) {
  return isEntityAuthoritativeByOrigin(node);
}

export function isLinkAuthoritativeByOrigin(link) {
  return isEntityAuthoritativeByOrigin(link);
}

export function getOwnerCanonicalVote(entity) {
  return entity.votesByUser["O"] || null;
}

export function isEntityCanonizedByOwner(entity) {
  const ownerVote = getOwnerCanonicalVote(entity);
  return ownerVote === VOTE_UP || ownerVote === VOTE_DOWN;
}

export function getEntityCanonicalStatus(entity) {
  if (isEntityAuthoritativeByOrigin(entity)) return "canonical_true";

  const ownerVote = getOwnerCanonicalVote(entity);
  if (ownerVote === VOTE_UP) return "canonical_true";
  if (ownerVote === VOTE_DOWN) return "canonical_false";

  return "none";
}

export function getNodeCanonicalStatus(node) {
  return getEntityCanonicalStatus(node);
}

export function getLinkCanonicalStatus(link) {
  return getEntityCanonicalStatus(link);
}

export function resolveNodeStance(node, userId) {
  if (isEntityAuthoritativeByOrigin(node)) return "canonical_true";

  const ownerVote = getOwnerCanonicalVote(node);
  if (ownerVote === VOTE_UP) return "canonical_true";
  if (ownerVote === VOTE_DOWN) return "canonical_false";

  if (node.creatorId === userId) return "local_true";

  const userVote = getVoteForUser(node, userId);
  if (userVote === VOTE_UP) return "local_true";
  if (userVote === VOTE_DOWN) return "local_false";

  return "undecided";
}

export function canAddLink(sourceNode, userId) {
  const stance = resolveNodeStance(sourceNode, userId);
  return stance === "canonical_true" || stance === "local_true";
}

export function getLinkCreationMode(sourceNode, userId) {
  return canAddLink(sourceNode, userId) ? "enabled" : "disabled";
}

export function getLinkCreationReason(sourceNode, userId) {
  const stance = resolveNodeStance(sourceNode, userId);

  if (stance === "canonical_true") return "link allowed: canonical truth";
  if (stance === "canonical_false") return "link blocked: owner marked source node as false";
  if (stance === "local_true") return "link allowed: you support this source node";
  if (stance === "local_false") return "link blocked: you marked source node as false";

  return "link blocked: endorse source node first";
}

export function getEntityVoteControlsMode(entity, userId) {
  if (isEntityAuthoritativeByOrigin(entity)) return "hidden";
  if (entity.creatorId === userId) return "hidden";
  if (userId !== "O" && isEntityCanonizedByOwner(entity)) return "disabled";
  return "enabled";
}

export function getVoteControlsMode(node, userId) {
  return getEntityVoteControlsMode(node, userId);
}

export function getLinkVoteControlsMode(link, userId) {
  if (isEntityAuthoritativeByOrigin(link)) return "hidden";
  if (link.creatorId === userId) return "hidden";
  if (link.globalVoteLocked) return "disabled";
  if (link.voteLocksByUser?.[userId]) return "disabled";
  if (userId !== "O" && isEntityCanonizedByOwner(link)) return "disabled";
  return "enabled";
}