import {
  ACTION_ADD_NODE,
  ACTION_ADD_REPLY,
  ACTION_TOGGLE_DOWN,
  ACTION_TOGGLE_UP,
  VOTE_NONE,
  VOTE_DOWN,
  VOTE_UP,
} from "./constants";
import { makeNode, makeReply } from "./seed";
import { canVoteNode } from "./guards";
import { transitionVote } from "./voteStateMachine";

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

    const newReply = makeReply(action.nodeId, action.userId);

    const result = {
      allowed: true,
      nextState: {
        ...state,
        replies: [newReply, ...state.replies],
      },
      logMessage: `User ${action.userId} added reply ${newReply.id} to node ${action.nodeId}`,
    };

    console.log("[ENGINE] applyAction:addReply:success", result);
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

    const result = {
      allowed: true,
      nextState: {
        ...state,
        nodes: updatedNodes,
      },
      logMessage: `User ${action.userId} changed vote on ${node.id} from ${currentVote} to ${nextVote}`,
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