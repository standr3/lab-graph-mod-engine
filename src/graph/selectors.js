import {
  GOVERNANCE_AUTHORITATIVE,
  VOTE_DOWN,
  VOTE_NONE,
  VOTE_UP,
} from "./constants";
import { planLinkVoteCascade } from "./planners";

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

export function canAddLink(sourceNode, targetNode, userId) {
  const sourceStance = resolveNodeStance(sourceNode, userId);
  const targetStance = resolveNodeStance(targetNode, userId);

  const sourceAllowed =
    sourceStance === "canonical_true" || sourceStance === "local_true";
  const targetAllowed =
    targetStance === "canonical_true" || targetStance === "local_true";

  return sourceAllowed && targetAllowed;
}

export function getLinkCreationMode(sourceNode, targetNode, userId) {
  if (!sourceNode || !targetNode) return "disabled";
  return canAddLink(sourceNode, targetNode, userId) ? "enabled" : "disabled";
}

export function getLinkCreationReason(sourceNode, targetNode, userId) {
  if (!sourceNode || !targetNode) {
    return "link blocked: select a valid target node";
  }

  const sourceStance = resolveNodeStance(sourceNode, userId);
  const targetStance = resolveNodeStance(targetNode, userId);

  const sourceAllowed =
    sourceStance === "canonical_true" || sourceStance === "local_true";
  const targetAllowed =
    targetStance === "canonical_true" || targetStance === "local_true";

  if (!sourceAllowed && !targetAllowed) {
    return "link blocked: endorse both source and target nodes first";
  }

  if (!sourceAllowed) {
    return "link blocked: endorse source node first";
  }

  if (!targetAllowed) {
    return "link blocked: endorse target node first";
  }

  return "link allowed: you support both source and target nodes";
}

export function linkHasForeignReviews(link) {
  return Object.entries(link.votesByUser).some(
    ([reviewerId, vote]) => reviewerId !== link.creatorId && vote !== VOTE_NONE
  );
}

export function isGuestLinkCreatorReviewLockedByForeignReviews(link, userId) {
  return (
    link.creatorId === userId &&
    link.creatorId !== "O" &&
    linkHasForeignReviews(link)
  );
}

export function isNodeReviewLockedByReviewedUserLink(nodeId, links, userId) {
  return links.some(
    (link) =>
      link.creatorId === userId &&
      link.creatorId !== "O" &&
      linkHasForeignReviews(link) &&
      (link.sourceId === nodeId || link.targetId === nodeId)
  );
}

export function getEntityVoteControlsMode(entity, userId) {
  if (isEntityAuthoritativeByOrigin(entity)) return "hidden";
  if (entity.creatorId === userId) return "hidden";
  if (userId !== "O" && isEntityCanonizedByOwner(entity)) return "disabled";
  return "enabled";
}

export function getVoteControlsMode(node, userId, links = []) {
  const baseMode = getEntityVoteControlsMode(node, userId);

  if (baseMode === "hidden") return "hidden";

  if (isNodeReviewLockedByReviewedUserLink(node.id, links, userId)) {
    return "disabled";
  }

  return baseMode;
}

export function getLinkVoteControlsMode(link, userId) {
  if (isEntityAuthoritativeByOrigin(link)) return "hidden";
  if (link.creatorId === userId) return "hidden";
  if (link.globalVoteLocked) return "disabled";
  if (link.voteLocksByUser?.[userId]) return "disabled";
  if (userId !== "O" && isEntityCanonizedByOwner(link)) return "disabled";
  return "enabled";
}

export function getLinkDeleteMode(link, userId) {
  if (link.creatorId !== userId) return "hidden";
  if (isGuestLinkCreatorReviewLockedByForeignReviews(link, userId)) {
    return "disabled";
  }
  return "enabled";
}

export function getLinkDeleteReason(link, userId) {
  if (link.creatorId !== userId) return "";
  if (isGuestLinkCreatorReviewLockedByForeignReviews(link, userId)) {
    return "delete blocked: this guest link has reviews from other users";
  }
  return "delete allowed";
}

export function getLinkUpActionMode(link, userId, nodes) {
  const baseMode = getLinkVoteControlsMode(link, userId);
  if (baseMode === "hidden" || baseMode === "disabled") return baseMode;

  const plan = planLinkVoteCascade(link, userId, "up", nodes);
  return plan.allowed ? "enabled" : "disabled";
}

export function getLinkDownActionMode(link, userId, nodes) {
  const baseMode = getLinkVoteControlsMode(link, userId);
  if (baseMode === "hidden" || baseMode === "disabled") return baseMode;

  const plan = planLinkVoteCascade(link, userId, "down", nodes);
  return plan.allowed ? "enabled" : "disabled";
}