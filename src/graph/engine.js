import {
  ACTION_ADD_NODE,
  ACTION_ADD_REPLY,
  ACTION_DELETE_REPLY,
  ACTION_TOGGLE_DOWN,
  ACTION_TOGGLE_UP,
  REPLY_SUPPORT_CANONICAL,
  REPLY_SUPPORT_LOCAL,
  VOTE_NONE,
  VOTE_DOWN,
  VOTE_UP,
} from "./constants";
import { makeNode, makeReply } from "./seed";
import { canVoteNode } from "./guards";
import { transitionVote } from "./voteStateMachine";
import { canAddReply, resolveNodeStance } from "./selectors";

function updateNodeVote(node, userId, nextVote) {
  console.log("[ENGINE] updateNodeVote:start", {
    nodeId: node.id,
    userId,
    nextVote,
    beforeVotesByUser: node.votesByUser,
  });

  const nextVotesByUser = { ...node.votesByUser };

  if (nextVote === VOTE_NONE) {
    delete nextVotesByUser[userId];
  } else {
    nextVotesByUser[userId] = nextVote;
  }

  const updatedNode = {
    ...node,
    votesByUser: nextVotesByUser,
  };

  console.log("[ENGINE] updateNodeVote:end", {
    nodeId: node.id,
    afterVotesByUser: updatedNode.votesByUser,
  });

  return updatedNode;
}

function resolveReplySupportType(node, userId) {
  const stance = resolveNodeStance(node, userId);

  const supportType =
    stance === "canonical_true"
      ? REPLY_SUPPORT_CANONICAL
      : REPLY_SUPPORT_LOCAL;

  console.log("[ENGINE] resolveReplySupportType", {
    nodeId: node.id,
    userId,
    stance,
    supportType,
  });

  return supportType;
}

function planReplyRevalidationCascade({
  originalNode,
  updatedNode,
  replies,
}) {
  console.log("[ENGINE] planReplyRevalidationCascade:start", {
    nodeId: originalNode.id,
    originalVotesByUser: originalNode.votesByUser,
    updatedVotesByUser: updatedNode.votesByUser,
  });

  const nodeReplies = replies.filter((reply) => reply.nodeId === updatedNode.id);

  const repliesToDelete = [];
  const cascadeMessages = [];

  for (const reply of nodeReplies) {
    const replyStillValid = canAddReply(updatedNode, reply.creatorId);

    console.log("[ENGINE] planReplyRevalidationCascade:replyCheck", {
      replyId: reply.id,
      nodeId: updatedNode.id,
      replyCreatorId: reply.creatorId,
      supportType: reply.supportType,
      replyStillValid,
      stanceAfterUpdate: resolveNodeStance(updatedNode, reply.creatorId),
    });

    if (!replyStillValid) {
      repliesToDelete.push(reply);
      cascadeMessages.push(
        `Cascade: deleted reply ${reply.id} because it no longer has valid support on node ${updatedNode.id}`
      );
    }
  }

  const result = {
    repliesToDelete,
    cascadeMessages,
  };

  console.log("[ENGINE] planReplyRevalidationCascade:end", {
    nodeId: updatedNode.id,
    replyIdsToDelete: repliesToDelete.map((reply) => reply.id),
  });

  return result;
}

export function applyAction(state, action) {
  console.log("[ENGINE] applyAction:start", {
    action,
    stateSnapshot: state,
  });

  if (action.type === ACTION_ADD_NODE) {
    const newNode = makeNode(action.userId);

    const result = {
      allowed: true,
      nextState: {
        ...state,
        nodes: [newNode, ...state.nodes],
      },
      logMessage: `User ${action.userId} added node ${newNode.id}`,
    };

    console.log("[ENGINE] applyAction:addNode:success", result);
    return result;
  }

  if (action.type === ACTION_ADD_REPLY) {
    const parentNode = state.nodes.find((node) => node.id === action.nodeId);

    if (!parentNode) {
      const result = {
        allowed: false,
        nextState: state,
        logMessage: `Cannot add reply: node ${action.nodeId} not found`,
      };

      console.log("[ENGINE] applyAction:addReply:nodeNotFound", result);
      return result;
    }

    const supportType = resolveReplySupportType(parentNode, action.userId);
    const newReply = makeReply(action.nodeId, action.userId, supportType);

    const result = {
      allowed: true,
      nextState: {
        ...state,
        replies: [newReply, ...state.replies],
      },
      logMessage: `User ${action.userId} added reply ${newReply.id} to node ${action.nodeId} with support ${supportType}`,
    };

    console.log("[ENGINE] applyAction:addReply:success", result);
    return result;
  }

  if (action.type === ACTION_DELETE_REPLY) {
    const reply = state.replies.find((item) => item.id === action.replyId);

    if (!reply) {
      const result = {
        allowed: false,
        nextState: state,
        logMessage: `Reply ${action.replyId} not found`,
      };

      console.log("[ENGINE] applyAction:deleteReply:notFound", result);
      return result;
    }

    if (reply.creatorId !== action.userId) {
      const result = {
        allowed: false,
        nextState: state,
        logMessage: `User ${action.userId} cannot delete reply ${reply.id} because they are not the creator`,
      };

      console.log("[ENGINE] applyAction:deleteReply:denied", result);
      return result;
    }

    const nextReplies = state.replies.filter((item) => item.id !== reply.id);

    const result = {
      allowed: true,
      nextState: {
        ...state,
        replies: nextReplies,
      },
      logMessage: `User ${action.userId} deleted reply ${reply.id}`,
    };

    console.log("[ENGINE] applyAction:deleteReply:success", result);
    return result;
  }

  if (
    action.type === ACTION_TOGGLE_UP ||
    action.type === ACTION_TOGGLE_DOWN
  ) {
    const node = state.nodes.find((item) => item.id === action.nodeId);

    if (!node) {
      const result = {
        allowed: false,
        nextState: state,
        logMessage: `Node ${action.nodeId} not found`,
      };

      console.log("[ENGINE] applyAction:vote:nodeNotFound", result);
      return result;
    }

    const guard = canVoteNode({
      userId: action.userId,
      node,
    });

    if (!guard.allowed) {
      const result = {
        allowed: false,
        nextState: state,
        logMessage: `Action denied for ${action.userId} on ${node.id}: ${guard.reason}`,
      };

      console.log("[ENGINE] applyAction:vote:denied", result);
      return result;
    }

    const clickedVote =
      action.type === ACTION_TOGGLE_UP ? VOTE_UP : VOTE_DOWN;

    const currentVote = node.votesByUser[action.userId] || VOTE_NONE;

    console.log("[ENGINE] applyAction:vote:beforeTransition", {
      nodeId: node.id,
      userId: action.userId,
      currentVote,
      clickedVote,
    });

    const nextVote = transitionVote(currentVote, clickedVote);

    const updatedNodes = state.nodes.map((item) => {
      if (item.id !== node.id) return item;
      return updateNodeVote(item, action.userId, nextVote);
    });

    const updatedNode = updatedNodes.find((item) => item.id === node.id);

    const cascadePlan = planReplyRevalidationCascade({
      originalNode: node,
      updatedNode,
      replies: state.replies,
    });

    const remainingReplies = state.replies.filter(
      (reply) =>
        !cascadePlan.repliesToDelete.some(
          (replyToDelete) => replyToDelete.id === reply.id
        )
    );

    const logParts = [
      `User ${action.userId} changed vote on ${node.id} from ${currentVote} to ${nextVote}`,
      ...cascadePlan.cascadeMessages,
    ];

    const result = {
      allowed: true,
      nextState: {
        ...state,
        nodes: updatedNodes,
        replies: remainingReplies,
      },
      logMessage: logParts.join(" | "),
    };

    console.log("[ENGINE] applyAction:vote:success", result);
    return result;
  }

  const result = {
    allowed: false,
    nextState: state,
    logMessage: `Unknown action type: ${action.type}`,
  };

  console.log("[ENGINE] applyAction:unknownAction", result);
  return result;
}