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

export function canVoteLink({ userId, link }) {
  console.log("[GUARD] canVoteLink:start", {
    userId,
    linkId: link.id,
    linkCreatorId: link.creatorId,
    governanceMode: link.governanceMode,
    ownerVote: link.votesByUser["O"] || null,
    globalVoteLocked: link.globalVoteLocked,
    voteLocksByUser: link.voteLocksByUser,
  });

  if (link.governanceMode === GOVERNANCE_AUTHORITATIVE) {
    const result = {
      allowed: false,
      reason: "Authoritative links are not voteable.",
    };

    console.log("[GUARD] canVoteLink:deny:authoritative", result);
    return result;
  }

  if (link.creatorId === userId) {
    const result = {
      allowed: false,
      reason: "You cannot vote on your own link.",
    };

    console.log("[GUARD] canVoteLink:deny:selfVote", result);
    return result;
  }

  if (link.globalVoteLocked) {
    const result = {
      allowed: false,
      reason: "This link is globally vote-locked.",
    };

    console.log("[GUARD] canVoteLink:deny:globalLock", result);
    return result;
  }

  if (link.voteLocksByUser?.[userId]) {
    const result = {
      allowed: false,
      reason: "Your voting on this link is locked.",
    };

    console.log("[GUARD] canVoteLink:deny:userLock", result);
    return result;
  }

  const ownerVote = link.votesByUser["O"] || null;
  const ownerHasCanonized = ownerVote === VOTE_UP || ownerVote === VOTE_DOWN;

  if (userId !== "O" && ownerHasCanonized) {
    const result = {
      allowed: false,
      reason: "Guests cannot vote after the owner has canonized the link.",
    };

    console.log("[GUARD] canVoteLink:deny:ownerCanonized", result);
    return result;
  }

  const result = { allowed: true };

  console.log("[GUARD] canVoteLink:allow", result);
  return result;
}