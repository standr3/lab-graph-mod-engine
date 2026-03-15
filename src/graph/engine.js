import {
  ACTION_ADD_NODE,
  ACTION_ADD_LINK,
  ACTION_DELETE_LINK,
  ACTION_TOGGLE_DOWN,
  ACTION_TOGGLE_LINK_DOWN,
  ACTION_TOGGLE_LINK_UP,
  ACTION_TOGGLE_UP,
  LINK_SUPPORT_CANONICAL,
  LINK_SUPPORT_LOCAL,
  VOTE_NONE,
  VOTE_DOWN,
  VOTE_UP,
} from "./constants";
import { makeLink, makeNode } from "./seed";
import { canVoteLink, canVoteNode } from "./guards";
import { transitionVote } from "./voteStateMachine";
import {
  canAddLink,
  getNodeById,
  isGuestLinkCreatorReviewLockedByForeignReviews,
  resolveNodeStance,
} from "./selectors";
import { planLinkVoteCascade } from "./planners";
import { revalidateGraph } from "./revalidateGraph";

function updateEntityVote(entity, userId, nextVote) {
  const nextVotesByUser = { ...entity.votesByUser };

  if (nextVote === VOTE_NONE) {
    delete nextVotesByUser[userId];
  } else {
    nextVotesByUser[userId] = nextVote;
  }

  return {
    ...entity,
    votesByUser: nextVotesByUser,
  };
}

function resolveLinkSupportType(node, userId) {
  const stance = resolveNodeStance(node, userId);
  return stance === "canonical_true"
    ? LINK_SUPPORT_CANONICAL
    : LINK_SUPPORT_LOCAL;
}

function isDownEvent({ currentVote, nextVote }) {
  return currentVote !== VOTE_DOWN && nextVote === VOTE_DOWN;
}

function propagateDownToLinks({ actorUserId, updatedNode, links }) {
  const cascadeMessages = [];

  const nextLinks = links.map((link) => {
    if (link.sourceId !== updatedNode.id) return link;

    let nextLink = link;

    const currentActorVote = nextLink.votesByUser[actorUserId] || VOTE_NONE;
    if (currentActorVote !== VOTE_DOWN) {
      nextLink = updateEntityVote(nextLink, actorUserId, VOTE_DOWN);
    }

    if (actorUserId === "O") {
      if (!nextLink.globalVoteLocked) {
        nextLink = {
          ...nextLink,
          globalVoteLocked: true,
        };
      }

      cascadeMessages.push(
        `Cascade: owner down propagated to link ${nextLink.id} from node ${updatedNode.id} and globally locked voting`,
      );
    } else {
      const alreadyLockedForUser = !!nextLink.voteLocksByUser?.[actorUserId];

      if (!alreadyLockedForUser) {
        nextLink = {
          ...nextLink,
          voteLocksByUser: {
            ...(nextLink.voteLocksByUser || {}),
            [actorUserId]: true,
          },
        };
      }

      cascadeMessages.push(
        `Cascade: down from ${actorUserId} propagated to link ${nextLink.id} from node ${updatedNode.id} and locked voting for that user`,
      );
    }

    return nextLink;
  });

  return {
    nextLinks,
    cascadeMessages,
  };
}

function planLinkRevalidationCascade({ updatedNode, nodes, links }) {
  const adjacentLinks = links.filter(
    (link) =>
      link.sourceId === updatedNode.id || link.targetId === updatedNode.id,
  );

  const linksToDelete = [];
  const cascadeMessages = [];

  for (const link of adjacentLinks) {
    const sourceNode = getNodeById(nodes, link.sourceId);
    const targetNode = getNodeById(nodes, link.targetId);

    if (!sourceNode || !targetNode) {
      linksToDelete.push(link);
      cascadeMessages.push(
        `Cascade: deleted link ${link.id} because one of its nodes is missing`,
      );
      continue;
    }

    const linkStillValid = canAddLink(sourceNode, targetNode, link.creatorId);

    if (!linkStillValid) {
      linksToDelete.push(link);
      cascadeMessages.push(
        `Cascade: deleted link ${link.id} because creator ${link.creatorId} no longer supports both endpoints`,
      );
    }
  }

  return {
    linksToDelete,
    cascadeMessages,
  };
}

function applyEndpointCascadeChanges(nodes, userId, plan, nodeId) {
  if (!plan || plan.action === "noop" || !plan.nextVote) {
    return nodes;
  }

  return nodes.map((node) => {
    if (node.id !== nodeId) return node;
    return updateEntityVote(node, userId, plan.nextVote);
  });
}

function applyPlan(state, plan) {
  if (!plan.allowed) return state;

  let nodes = state.nodes;
  let links = state.links;

  for (const change of plan.nodeChanges) {
    nodes = nodes.map((n) => {
      if (n.id !== change.nodeId) return n;

      const nextVotes = { ...n.votesByUser };

      if (change.vote === null) {
        delete nextVotes[change.userId];
      } else {
        nextVotes[change.userId] = change.vote;
      }

      return { ...n, votesByUser: nextVotes };
    });
  }

  for (const change of plan.linkChanges) {
    links = links.map((l) => {
      if (l.id !== change.linkId) return l;

      const nextVotes = { ...l.votesByUser };

      if (change.vote === null) {
        delete nextVotes[change.userId];
      } else {
        nextVotes[change.userId] = change.vote;
      }

      return { ...l, votesByUser: nextVotes };
    });
  }

  for (const del of plan.deletions) {
    links = links.filter((l) => l.id !== del.linkId);
  }

  return {
    ...state,
    nodes,
    links,
  };
}
export function applyAction(state, action) {
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

  if (action.type === ACTION_ADD_LINK) {
    const sourceNode = state.nodes.find((node) => node.id === action.sourceId);
    const targetNode = state.nodes.find((node) => node.id === action.targetId);

    if (!sourceNode) {
      return {
        allowed: false,
        nextState: state,
        logMessage: `Cannot add link: source node ${action.sourceId} not found`,
      };
    }

    if (!targetNode) {
      return {
        allowed: false,
        nextState: state,
        logMessage: `Cannot add link: target node ${action.targetId} not found`,
      };
    }

    if (action.sourceId === action.targetId) {
      return {
        allowed: false,
        nextState: state,
        logMessage: `Cannot add link: source and target must be different`,
      };
    }

    const alreadyExists = state.links.some(
      (link) =>
        link.sourceId === action.sourceId && link.targetId === action.targetId,
    );

    if (alreadyExists) {
      return {
        allowed: false,
        nextState: state,
        logMessage: `Cannot add link: unique directional link already exists from ${action.sourceId} to ${action.targetId}`,
      };
    }

    const linkAllowed = canAddLink(sourceNode, targetNode, action.userId);

    if (!linkAllowed) {
      return {
        allowed: false,
        nextState: state,
        logMessage: `Cannot add link: user ${action.userId} must support both source ${action.sourceId} and target ${action.targetId}`,
      };
    }

    const sourceStance = resolveNodeStance(sourceNode, action.userId);
    const targetStance = resolveNodeStance(targetNode, action.userId);

    const supportType =
      sourceStance === "canonical_true" && targetStance === "canonical_true"
        ? LINK_SUPPORT_CANONICAL
        : LINK_SUPPORT_LOCAL;

    const newLink = makeLink(
      action.sourceId,
      action.targetId,
      action.userId,
      supportType,
    );

    return {
      allowed: true,
      nextState: {
        ...state,
        links: [newLink, ...state.links],
      },
      logMessage: `User ${action.userId} added link ${newLink.id} from ${action.sourceId} to ${action.targetId} with support ${supportType}`,
    };
  }

  if (action.type === ACTION_DELETE_LINK) {
    const link = state.links.find((item) => item.id === action.linkId);

    if (!link) {
      return {
        allowed: false,
        nextState: state,
        logMessage: `Link ${action.linkId} not found`,
      };
    }

    if (link.creatorId !== action.userId) {
      return {
        allowed: false,
        nextState: state,
        logMessage: `User ${action.userId} cannot delete link ${link.id} because they are not the creator`,
      };
    }

    if (isGuestLinkCreatorReviewLockedByForeignReviews(link, action.userId)) {
      return {
        allowed: false,
        nextState: state,
        logMessage: `Cannot delete link ${link.id}: guest-created link has foreign reviews and is delete-locked`,
      };
    }

    const nextLinks = state.links.filter((item) => item.id !== link.id);

    return {
      allowed: true,
      nextState: {
        ...state,
        links: nextLinks,
      },
      logMessage: `User ${action.userId} deleted link ${link.id}`,
    };
  }

  if (action.type === ACTION_TOGGLE_UP || action.type === ACTION_TOGGLE_DOWN) {
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

    const clickedVote = action.type === ACTION_TOGGLE_UP ? VOTE_UP : VOTE_DOWN;

    const currentVote = node.votesByUser[action.userId] || VOTE_NONE;
    const nextVote = transitionVote(currentVote, clickedVote);

    const updatedNodes = state.nodes.map((item) => {
      if (item.id !== node.id) return item;
      return updateEntityVote(item, action.userId, nextVote);
    });

    const updatedNode = updatedNodes.find((item) => item.id === node.id);

    const downEvent = isDownEvent({ currentVote, nextVote });

    let intermediateLinks = state.links;
    let cascadeMessages = [];

    if (downEvent) {
      const propagationResult = propagateDownToLinks({
        actorUserId: action.userId,
        updatedNode,
        links: state.links,
      });

      intermediateLinks = propagationResult.nextLinks;
      cascadeMessages.push(...propagationResult.cascadeMessages);
    }

    const cascadePlan = planLinkRevalidationCascade({
      updatedNode,
      nodes: updatedNodes,
      links: intermediateLinks,
    });

    const nextLinks = intermediateLinks.filter(
      (link) =>
        !cascadePlan.linksToDelete.some(
          (linkToDelete) => linkToDelete.id === link.id,
        ),
    );

    cascadeMessages.push(...cascadePlan.cascadeMessages);

    const logParts = [
      `User ${action.userId} changed vote on ${node.id} from ${currentVote} to ${nextVote}`,
      ...cascadeMessages,
    ];

    return {
      allowed: true,
      nextState: {
        ...state,
        nodes: updatedNodes,
        links: nextLinks,
      },
      logMessage: logParts.join(" | "),
    };
  }

  if (
    action.type === ACTION_TOGGLE_LINK_UP ||
    action.type === ACTION_TOGGLE_LINK_DOWN
  ) {
    const link = state.links.find((item) => item.id === action.linkId);

    if (!link) {
      return {
        allowed: false,
        nextState: state,
        logMessage: `Link ${action.linkId} not found`,
      };
    }

    const guard = canVoteLink({
      userId: action.userId,
      link,
    });

    if (!guard.allowed) {
      return {
        allowed: false,
        nextState: state,
        logMessage: `Action denied for ${action.userId} on link ${link.id}: ${guard.reason}`,
      };
    }

    const direction = action.type === ACTION_TOGGLE_LINK_UP ? "up" : "down";

    const plan = planLinkVoteCascade(
      link,
      action.userId,
      direction,
      state.nodes,
    );

    if (!plan.allowed) {
      return {
        allowed: false,
        nextState: state,
        logMessage: plan.reason,
      };
    }

    const nextState = applyPlan(state, plan);
    const validatedState = revalidateGraph(nextState);

    return {
      allowed: true,
      nextState: validatedState,
      logMessage: "action applied and graph revalidated",
    };
  }

  return {
    allowed: false,
    nextState: state,
    logMessage: `Unknown action type: ${action.type}`,
  };
}
