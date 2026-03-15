import { createActionPlan, denyPlan } from "./actionPlan";
import { VOTE_UP, VOTE_DOWN } from "./constants";
import { resolveNodeStance, getNodeById } from "./selectors";
import { stanceToLevel } from "./stanceLevel";

function planEndpointTransition(node, userId, desiredDirection) {
  const stance = resolveNodeStance(node, userId);
  const level = stanceToLevel(stance);

  if (desiredDirection === "up") {
    if (level === -2) {
      return { allowed: false, action: "blocked", nextVote: null };
    }

    if (level >= 1) {
      return { allowed: true, action: "noop", nextVote: null };
    }

    if (level === 0) {
      return { allowed: true, action: "set_up_local", nextVote: VOTE_UP };
    }

    if (level === -1) {
      return { allowed: true, action: "flip_to_up_local", nextVote: VOTE_UP };
    }
  }

  if (desiredDirection === "down") {
    if (level === 2) {
      return { allowed: false, action: "blocked", nextVote: null };
    }

    if (level <= -1) {
      return { allowed: true, action: "noop", nextVote: null };
    }

    if (level === 0) {
      return { allowed: true, action: "set_down_local", nextVote: VOTE_DOWN };
    }

    if (level === 1) {
      return { allowed: true, action: "flip_to_down_local", nextVote: VOTE_DOWN };
    }
  }

  return { allowed: false, action: "blocked", nextVote: null };
}

export function planLinkVoteCascade(link, userId, direction, nodes) {
  const plan = createActionPlan();

  const sourceNode = getNodeById(nodes, link.sourceId);
  const targetNode = getNodeById(nodes, link.targetId);

  if (!sourceNode || !targetNode) {
    return denyPlan("missing endpoint");
  }

  const sourcePlan = planEndpointTransition(sourceNode, userId, direction);
  const targetPlan = planEndpointTransition(targetNode, userId, direction);

  if (!sourcePlan.allowed || !targetPlan.allowed) {
    return denyPlan("cascade impossible");
  }

  if (sourcePlan.nextVote) {
    plan.nodeChanges.push({
      nodeId: sourceNode.id,
      userId,
      vote: sourcePlan.nextVote,
    });
  }

  if (targetPlan.nextVote) {
    plan.nodeChanges.push({
      nodeId: targetNode.id,
      userId,
      vote: targetPlan.nextVote,
    });
  }

  plan.linkChanges.push({
    linkId: link.id,
    userId,
    vote: direction === "up" ? VOTE_UP : VOTE_DOWN,
  });

  return plan;
}
function evaluateEndpoint(node, userId, direction) {
  const stance = resolveNodeStance(node, userId);

  if (direction === "up") {
    if (stance === "canonical_false") return { allowed: false };

    if (stance === "undecided") return { allowed: true, vote: VOTE_UP };
    if (stance === "local_false") return { allowed: true, vote: VOTE_UP };

    return { allowed: true };
  }

  if (direction === "down") {
    if (stance === "canonical_true") return { allowed: false };

    if (stance === "undecided") return { allowed: true, vote: VOTE_DOWN };
    if (stance === "local_true") return { allowed: true, vote: VOTE_DOWN };

    return { allowed: true };
  }

  return { allowed: false };
}