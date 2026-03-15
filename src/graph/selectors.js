import {
  GOVERNANCE_AUTHORITATIVE,
  VOTE_DOWN,
  VOTE_NONE,
  VOTE_UP,
} from "./constants";

export function getVoteForUser(entity, userId) {
  const vote = entity.votesByUser[userId] || VOTE_NONE;

  console.log("[SELECTOR] getVoteForUser", {
    entityId: entity.id,
    userId,
    vote,
  });

  return vote;
}

export function getNodeVoteForUser(node, userId) {
  return getVoteForUser(node, userId);
}

export function getReplyVoteForUser(reply, userId) {
  return getVoteForUser(reply, userId);
}

export function getUpList(entity) {
  const result = Object.entries(entity.votesByUser)
    .filter(([, vote]) => vote === VOTE_UP)
    .map(([userId]) => userId);

  console.log("[SELECTOR] getUpList", {
    entityId: entity.id,
    result,
  });

  return result;
}

export function getDownList(entity) {
  const result = Object.entries(entity.votesByUser)
    .filter(([, vote]) => vote === VOTE_DOWN)
    .map(([userId]) => userId);

  console.log("[SELECTOR] getDownList", {
    entityId: entity.id,
    result,
  });

  return result;
}

export function formatNodeText(node) {
  const upList = getUpList(node);
  const downList = getDownList(node);

  const formatted = `[${node.label} : ${node.creatorId} + (${upList.join(", ")}) - (${downList.join(", ")})]`;

  console.log("[SELECTOR] formatNodeText", {
    nodeId: node.id,
    formatted,
  });

  return formatted;
}

export function formatReplyText(reply) {
  const upList = getUpList(reply);
  const downList = getDownList(reply);

  const formatted = `[${reply.label} : ${reply.creatorId} + (${upList.join(", ")}) - (${downList.join(", ")}) | support:${reply.supportType}]`;

  console.log("[SELECTOR] formatReplyText", {
    replyId: reply.id,
    formatted,
  });

  return formatted;
}

export function getRepliesForNode(replies, nodeId) {
  const result = replies.filter((reply) => reply.nodeId === nodeId);

  console.log("[SELECTOR] getRepliesForNode", {
    nodeId,
    replyIds: result.map((reply) => reply.id),
  });

  return result;
}

export function isEntityAuthoritativeByOrigin(entity) {
  const result = entity.governanceMode === GOVERNANCE_AUTHORITATIVE;

  console.log("[SELECTOR] isEntityAuthoritativeByOrigin", {
    entityId: entity.id,
    result,
  });

  return result;
}

export function isNodeAuthoritativeByOrigin(node) {
  return isEntityAuthoritativeByOrigin(node);
}

export function isReplyAuthoritativeByOrigin(reply) {
  return isEntityAuthoritativeByOrigin(reply);
}

export function getOwnerCanonicalVote(entity) {
  const result = entity.votesByUser["O"] || null;

  console.log("[SELECTOR] getOwnerCanonicalVote", {
    entityId: entity.id,
    result,
  });

  return result;
}

export function isEntityCanonizedByOwner(entity) {
  const ownerVote = getOwnerCanonicalVote(entity);
  const result = ownerVote === VOTE_UP || ownerVote === VOTE_DOWN;

  console.log("[SELECTOR] isEntityCanonizedByOwner", {
    entityId: entity.id,
    ownerVote,
    result,
  });

  return result;
}

export function getEntityCanonicalStatus(entity) {
  if (isEntityAuthoritativeByOrigin(entity)) {
    const result = "canonical_true";

    console.log("[SELECTOR] getEntityCanonicalStatus", {
      entityId: entity.id,
      result,
    });

    return result;
  }

  const ownerVote = getOwnerCanonicalVote(entity);

  if (ownerVote === VOTE_UP) {
    const result = "canonical_true";

    console.log("[SELECTOR] getEntityCanonicalStatus", {
      entityId: entity.id,
      result,
    });

    return result;
  }

  if (ownerVote === VOTE_DOWN) {
    const result = "canonical_false";

    console.log("[SELECTOR] getEntityCanonicalStatus", {
      entityId: entity.id,
      result,
    });

    return result;
  }

  const result = "none";

  console.log("[SELECTOR] getEntityCanonicalStatus", {
    entityId: entity.id,
    result,
  });

  return result;
}

export function getNodeCanonicalStatus(node) {
  return getEntityCanonicalStatus(node);
}

export function getReplyCanonicalStatus(reply) {
  return getEntityCanonicalStatus(reply);
}

export function resolveNodeStance(node, userId) {
  console.log("[STANCE] resolveNodeStance:start", {
    nodeId: node.id,
    userId,
    creatorId: node.creatorId,
    governanceMode: node.governanceMode,
    ownerVote: node.votesByUser["O"] || null,
    userVote: node.votesByUser[userId] || null,
  });

  if (isEntityAuthoritativeByOrigin(node)) {
    return "canonical_true";
  }

  const ownerVote = getOwnerCanonicalVote(node);

  if (ownerVote === VOTE_UP) return "canonical_true";
  if (ownerVote === VOTE_DOWN) return "canonical_false";
  if (node.creatorId === userId) return "local_true";

  const userVote = getVoteForUser(node, userId);

  if (userVote === VOTE_UP) return "local_true";
  if (userVote === VOTE_DOWN) return "local_false";

  return "undecided";
}

export function canAddReply(node, userId) {
  const stance = resolveNodeStance(node, userId);
  const result = stance === "canonical_true" || stance === "local_true";

  console.log("[POLICY] canAddReply", {
    nodeId: node.id,
    userId,
    stance,
    result,
  });

  return result;
}

export function getReplyControlsMode(node, userId) {
  const allowed = canAddReply(node, userId);
  const result = allowed ? "enabled" : "disabled";

  console.log("[POLICY] getReplyControlsMode", {
    nodeId: node.id,
    userId,
    result,
  });

  return result;
}

export function getReplyBlockReason(node, userId) {
  const stance = resolveNodeStance(node, userId);

  let result = "reply allowed";

  if (stance === "canonical_true") {
    result = "reply allowed: canonical truth";
  } else if (stance === "canonical_false") {
    result = "reply blocked: owner marked node as false";
  } else if (stance === "local_true") {
    result = "reply allowed: you support this node";
  } else if (stance === "local_false") {
    result = "reply blocked: you marked this node as false";
  } else if (stance === "undecided") {
    result = "reply blocked: endorse this node first";
  }

  console.log("[POLICY] getReplyBlockReason", {
    nodeId: node.id,
    userId,
    stance,
    result,
  });

  return result;
}

export function getEntityVoteControlsMode(entity, userId) {
  if (isEntityAuthoritativeByOrigin(entity)) {
    const result = "hidden";

    console.log("[SELECTOR] getEntityVoteControlsMode", {
      entityId: entity.id,
      userId,
      result,
      reason: "authoritative_by_origin",
    });

    return result;
  }

  if (entity.creatorId === userId) {
    const result = "hidden";

    console.log("[SELECTOR] getEntityVoteControlsMode", {
      entityId: entity.id,
      userId,
      result,
      reason: "own_entity",
    });

    return result;
  }

  if (userId !== "O" && isEntityCanonizedByOwner(entity)) {
    const result = "disabled";

    console.log("[SELECTOR] getEntityVoteControlsMode", {
      entityId: entity.id,
      userId,
      result,
      reason: "canonized_by_owner",
    });

    return result;
  }

  const result = "enabled";

  console.log("[SELECTOR] getEntityVoteControlsMode", {
    entityId: entity.id,
    userId,
    result,
    reason: "default",
  });

  return result;
}

export function getVoteControlsMode(node, userId) {
  return getEntityVoteControlsMode(node, userId);
}

export function getReplyVoteControlsMode(reply, userId) {
  return getEntityVoteControlsMode(reply, userId);
}