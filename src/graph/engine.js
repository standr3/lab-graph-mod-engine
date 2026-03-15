import {
  ACTION_ADD_NODE,
  ACTION_ADD_REPLY,
  ACTION_DELETE_REPLY,
  ACTION_TOGGLE_DOWN,
  ACTION_TOGGLE_REPLY_DOWN,
  ACTION_TOGGLE_REPLY_UP,
  ACTION_TOGGLE_UP,
  REPLY_SUPPORT_CANONICAL,
  REPLY_SUPPORT_LOCAL,
  VOTE_NONE,
  VOTE_DOWN,
  VOTE_UP,
} from "./constants";
import { makeNode, makeReply } from "./seed";
import { canVoteNode, canVoteReply } from "./guards";
import { transitionVote } from "./voteStateMachine";
import { canAddReply, resolveNodeStance } from "./selectors";

function updateEntityVote(entity, userId, nextVote) {
  console.log("[ENGINE] updateEntityVote:start", {
    entityId: entity.id,
    userId,
    nextVote,
    beforeVotesByUser: entity.votesByUser,
  });

  const nextVotesByUser = { ...entity.votesByUser };

  if (nextVote === VOTE_NONE) {
    delete nextVotesByUser[userId];
  } else {
    nextVotesByUser[userId] = nextVote;
  }

  const updatedEntity = {
    ...entity,
    votesByUser: nextVotesByUser,
  };

  console.log("[ENGINE] updateEntityVote:end", {
    entityId: entity.id,
    afterVotesByUser: updatedEntity.votesByUser,
  });

  return updatedEntity;
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

function isDownEvent({ currentVote, nextVote }) {
  const result = currentVote !== VOTE_DOWN && nextVote === VOTE_DOWN;

  console.log("[ENGINE] isDownEvent", {
    currentVote,
    nextVote,
    result,
  });

  return result;
}

function propagateDownToReplies({ actorUserId, updatedNode, replies }) {
  console.log("[ENGINE] propagateDownToReplies:start", {
    actorUserId,
    nodeId: updatedNode.id,
  });

  const cascadeMessages = [];

  const nextReplies = replies.map((reply) => {
    if (reply.nodeId !== updatedNode.id) return reply;

    let nextReply = reply;

    const currentActorVote = nextReply.votesByUser[actorUserId] || VOTE_NONE;
    if (currentActorVote !== VOTE_DOWN) {
      nextReply = updateEntityVote(nextReply, actorUserId, VOTE_DOWN);
    }

    if (actorUserId === "O") {
      if (!nextReply.globalVoteLocked) {
        nextReply = {
          ...nextReply,
          globalVoteLocked: true,
        };
      }

      cascadeMessages.push(
        `Cascade: owner down propagated to reply ${nextReply.id} from node ${updatedNode.id} and globally locked voting`
      );
    } else {
      const alreadyLockedForUser = !!nextReply.voteLocksByUser?.[actorUserId];

      if (!alreadyLockedForUser) {
        nextReply = {
          ...nextReply,
          voteLocksByUser: {
            ...(nextReply.voteLocksByUser || {}),
            [actorUserId]: true,
          },
        };
      }

      cascadeMessages.push(
        `Cascade: down from ${actorUserId} propagated to reply ${nextReply.id} from node ${updatedNode.id} and locked voting for that user`
      );
    }

    return nextReply;
  });

  const result = {
    nextReplies,
    cascadeMessages,
  };

  console.log("[ENGINE] propagateDownToReplies:end", result);

  return result;
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

    return {
      allowed: true,
      nextState: {
        ...state,
        nodes: [newNode, ...state.nodes],
      },
      logMessage: `User ${action.userId} added node ${newNode.id}`,
    };
  }

  if (action.type === ACTION_ADD_REPLY) {
    const parentNode = state.nodes.find((node) => node.id === action.nodeId);

    if (!parentNode) {
      return {
        allowed: false,
        nextState: state,
        logMessage: `Cannot add reply: node ${action.nodeId} not found`,
      };
    }

    const supportType = resolveReplySupportType(parentNode, action.userId);
    const newReply = makeReply(action.nodeId, action.userId, supportType);

    return {
      allowed: true,
      nextState: {
        ...state,
        replies: [newReply, ...state.replies],
      },
      logMessage: `User ${action.userId} added reply ${newReply.id} to node ${action.nodeId} with support ${supportType}`,
    };
  }

  if (action.type === ACTION_DELETE_REPLY) {
    const reply = state.replies.find((item) => item.id === action.replyId);

    if (!reply) {
      return {
        allowed: false,
        nextState: state,
        logMessage: `Reply ${action.replyId} not found`,
      };
    }

    if (reply.creatorId !== action.userId) {
      return {
        allowed: false,
        nextState: state,
        logMessage: `User ${action.userId} cannot delete reply ${reply.id} because they are not the creator`,
      };
    }

    const nextReplies = state.replies.filter((item) => item.id !== reply.id);

    return {
      allowed: true,
      nextState: {
        ...state,
        replies: nextReplies,
      },
      logMessage: `User ${action.userId} deleted reply ${reply.id}`,
    };
  }

  if (
    action.type === ACTION_TOGGLE_UP ||
    action.type === ACTION_TOGGLE_DOWN
  ) {
    const node = state.nodes.find((item) => item.id === action.nodeId);

    if (!node) {
      return {
        allowed: false,
        nextState: state,
        logMessage: `Node ${action.nodeId} not found`,
      };
    }

    const guard = canVoteNode({
      userId: action.userId,
      node,
    });

    if (!guard.allowed) {
      return {
        allowed: false,
        nextState: state,
        logMessage: `Action denied for ${action.userId} on ${node.id}: ${guard.reason}`,
      };
    }

    const clickedVote =
      action.type === ACTION_TOGGLE_UP ? VOTE_UP : VOTE_DOWN;

    const currentVote = node.votesByUser[action.userId] || VOTE_NONE;
    const nextVote = transitionVote(currentVote, clickedVote);

    const updatedNodes = state.nodes.map((item) => {
      if (item.id !== node.id) return item;
      return updateEntityVote(item, action.userId, nextVote);
    });

    const updatedNode = updatedNodes.find((item) => item.id === node.id);

    const downEvent = isDownEvent({
      currentVote,
      nextVote,
    });

    let nextReplies = state.replies;
    let cascadeMessages = [];

    if (downEvent) {
      const propagationResult = propagateDownToReplies({
        actorUserId: action.userId,
        updatedNode,
        replies: state.replies,
      });

      nextReplies = propagationResult.nextReplies;
      cascadeMessages = propagationResult.cascadeMessages;
    } else {
      const cascadePlan = planReplyRevalidationCascade({
        originalNode: node,
        updatedNode,
        replies: state.replies,
      });

      nextReplies = state.replies.filter(
        (reply) =>
          !cascadePlan.repliesToDelete.some(
            (replyToDelete) => replyToDelete.id === reply.id
          )
      );

      cascadeMessages = cascadePlan.cascadeMessages;
    }

    const logParts = [
      `User ${action.userId} changed vote on ${node.id} from ${currentVote} to ${nextVote}`,
      ...cascadeMessages,
    ];

    return {
      allowed: true,
      nextState: {
        ...state,
        nodes: updatedNodes,
        replies: nextReplies,
      },
      logMessage: logParts.join(" | "),
    };
  }

  if (
    action.type === ACTION_TOGGLE_REPLY_UP ||
    action.type === ACTION_TOGGLE_REPLY_DOWN
  ) {
    const reply = state.replies.find((item) => item.id === action.replyId);

    if (!reply) {
      return {
        allowed: false,
        nextState: state,
        logMessage: `Reply ${action.replyId} not found`,
      };
    }

    const guard = canVoteReply({
      userId: action.userId,
      reply,
    });

    if (!guard.allowed) {
      return {
        allowed: false,
        nextState: state,
        logMessage: `Action denied for ${action.userId} on reply ${reply.id}: ${guard.reason}`,
      };
    }

    const clickedVote =
      action.type === ACTION_TOGGLE_REPLY_UP ? VOTE_UP : VOTE_DOWN;

    const currentVote = reply.votesByUser[action.userId] || VOTE_NONE;
    const nextVote = transitionVote(currentVote, clickedVote);

    const updatedReplies = state.replies.map((item) => {
      if (item.id !== reply.id) return item;
      return updateEntityVote(item, action.userId, nextVote);
    });

    return {
      allowed: true,
      nextState: {
        ...state,
        replies: updatedReplies,
      },
      logMessage: `User ${action.userId} changed vote on reply ${reply.id} from ${currentVote} to ${nextVote}`,
    };
  }

  return {
    allowed: false,
    nextState: state,
    logMessage: `Unknown action type: ${action.type}`,
  };
}