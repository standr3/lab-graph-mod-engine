import {
  GOVERNANCE_AUTHORITATIVE,
  VOTE_DOWN,
  VOTE_NONE,
  VOTE_UP,
} from "./constants";

export function getNodeVoteForUser(node, userId) {
  const vote = node.votesByUser[userId] || VOTE_NONE;

  console.log("[SELECTOR] getNodeVoteForUser", {
    nodeId: node.id,
    userId,
    vote,
  });

  return vote;
}

export function getVoteForUser(entity, userId) {
  const vote = entity.votesByUser[userId] || VOTE_NONE;

  console.log("[SELECTOR] getVoteForUser", {
    entityId: entity.id,
    userId,
    vote,
  });

  return vote;
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

export function getNodeUpList(node) {
  return getUpList(node);
}

export function getNodeDownList(node) {
  return getDownList(node);
}

export function formatNodeText(node) {
  const upList = getNodeUpList(node);
  const downList = getNodeDownList(node);

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

export function isNodeAuthoritativeByOrigin(node) {
  const result = node.governanceMode === GOVERNANCE_AUTHORITATIVE;

  console.log("[SELECTOR] isNodeAuthoritativeByOrigin", {
    nodeId: node.id,
    result,
  });

  return result;
}

export function getOwnerCanonicalVote(node) {
  const result = node.votesByUser["O"] || null;

  console.log("[SELECTOR] getOwnerCanonicalVote", {
    nodeId: node.id,
    result,
  });

  return result;
}

export function isNodeCanonizedByOwner(node) {
  const ownerVote = getOwnerCanonicalVote(node);
  const result = ownerVote === VOTE_UP || ownerVote === VOTE_DOWN;

  console.log("[SELECTOR] isNodeCanonizedByOwner", {
    nodeId: node.id,
    ownerVote,
    result,
  });

  return result;
}

export function getNodeCanonicalStatus(node) {
  if (isNodeAuthoritativeByOrigin(node)) {
    const result = "canonical_true";

    console.log("[SELECTOR] getNodeCanonicalStatus", {
      nodeId: node.id,
      result,
    });

    return result;
  }

  const ownerVote = getOwnerCanonicalVote(node);

  if (ownerVote === VOTE_UP) {
    const result = "canonical_true";

    console.log("[SELECTOR] getNodeCanonicalStatus", {
      nodeId: node.id,
      result,
    });

    return result;
  }

  if (ownerVote === VOTE_DOWN) {
    const result = "canonical_false";

    console.log("[SELECTOR] getNodeCanonicalStatus", {
      nodeId: node.id,
      result,
    });

    return result;
  }

  const result = "none";

  console.log("[SELECTOR] getNodeCanonicalStatus", {
    nodeId: node.id,
    result,
  });

  return result;
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

  if (isNodeAuthoritativeByOrigin(node)) {
    const result = "canonical_true";

    console.log("[STANCE] resolveNodeStance:authoritativeByOrigin", {
      nodeId: node.id,
      userId,
      result,
    });

    return result;
  }

  const ownerVote = getOwnerCanonicalVote(node);

  if (ownerVote === VOTE_UP) {
    const result = "canonical_true";

    console.log("[STANCE] resolveNodeStance:ownerUp", {
      nodeId: node.id,
      userId,
      result,
    });

    return result;
  }

  if (ownerVote === VOTE_DOWN) {
    const result = "canonical_false";

    console.log("[STANCE] resolveNodeStance:ownerDown", {
      nodeId: node.id,
      userId,
      result,
    });

    return result;
  }

  if (node.creatorId === userId) {
    const result = "local_true";

    console.log("[STANCE] resolveNodeStance:creatorPresumption", {
      nodeId: node.id,
      userId,
      result,
    });

    return result;
  }

  const userVote = getNodeVoteForUser(node, userId);

  if (userVote === VOTE_UP) {
    const result = "local_true";

    console.log("[STANCE] resolveNodeStance:userUp", {
      nodeId: node.id,
      userId,
      result,
    });

    return result;
  }

  if (userVote === VOTE_DOWN) {
    const result = "local_false";

    console.log("[STANCE] resolveNodeStance:userDown", {
      nodeId: node.id,
      userId,
      result,
    });

    return result;
  }

  const result = "undecided";

  console.log("[STANCE] resolveNodeStance:undecided", {
    nodeId: node.id,
    userId,
    result,
  });

  return result;
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

export function getVoteControlsMode(node, userId) {
  if (isNodeAuthoritativeByOrigin(node)) {
    const result = "hidden";

    console.log("[SELECTOR] getVoteControlsMode", {
      nodeId: node.id,
      userId,
      result,
      reason: "authoritative_by_origin",
    });

    return result;
  }

  if (node.creatorId === userId) {
    const result = "hidden";

    console.log("[SELECTOR] getVoteControlsMode", {
      nodeId: node.id,
      userId,
      result,
      reason: "own_node",
    });

    return result;
  }

  if (userId !== "O" && isNodeCanonizedByOwner(node)) {
    const result = "disabled";

    console.log("[SELECTOR] getVoteControlsMode", {
      nodeId: node.id,
      userId,
      result,
      reason: "canonized_by_owner",
    });

    return result;
  }

  const result = "enabled";

  console.log("[SELECTOR] getVoteControlsMode", {
    nodeId: node.id,
    userId,
    result,
    reason: "default",
  });

  return result;
}