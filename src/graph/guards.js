import { GOVERNANCE_AUTHORITATIVE, VOTE_DOWN, VOTE_UP } from "./constants";

export function canVoteNode({ userId, node }) {
  console.log("[GUARD] canVoteNode:start", {
    userId,
    nodeId: node.id,
    nodeCreatorId: node.creatorId,
    governanceMode: node.governanceMode,
    ownerVote: node.votesByUser["O"] || null,
  });

  if (node.governanceMode === GOVERNANCE_AUTHORITATIVE) {
    const result = {
      allowed: false,
      reason: "Authoritative nodes are not voteable.",
    };

    console.log("[GUARD] canVoteNode:deny:authoritative", result);
    return result;
  }

  if (node.creatorId === userId) {
    const result = {
      allowed: false,
      reason: "You cannot vote on your own node.",
    };

    console.log("[GUARD] canVoteNode:deny:selfVote", result);
    return result;
  }

  const ownerVote = node.votesByUser["O"] || null;
  const ownerHasCanonized = ownerVote === VOTE_UP || ownerVote === VOTE_DOWN;

  if (userId !== "O" && ownerHasCanonized) {
    const result = {
      allowed: false,
      reason: "Guests cannot vote after the owner has canonized the node.",
    };

    console.log("[GUARD] canVoteNode:deny:ownerCanonized", result);
    return result;
  }

  const result = { allowed: true };

  console.log("[GUARD] canVoteNode:allow", result);
  return result;
}