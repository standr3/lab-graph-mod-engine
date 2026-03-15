import { create } from "zustand";
import {
  ACTION_ADD_LINK,
  ACTION_ADD_NODE,
  ACTION_DELETE_LINK,
  ACTION_TOGGLE_DOWN,
  ACTION_TOGGLE_LINK_DOWN,
  ACTION_TOGGLE_LINK_UP,
  ACTION_TOGGLE_UP,
  USERS,
} from "../graph/constants";
import { applyAction } from "../graph/engine";
import { makeInitialNodes } from "../graph/seed";

export const useGraphStore = create((set, get) => ({
  users: USERS,
  nodes: makeInitialNodes(),
  links: [],
  eventLog: [],

  dispatch(action) {
    const state = {
      nodes: get().nodes,
      links: get().links,
    };

    const result = applyAction(state, action);

    set((current) => ({
      nodes: result.nextState.nodes,
      links: result.nextState.links ?? current.links,
      eventLog: [result.logMessage, ...current.eventLog],
    }));

    return result;
  },

  addNode(userId) {
    return get().dispatch({
      type: ACTION_ADD_NODE,
      userId,
    });
  },

  addLink(userId, sourceId, targetId) {
    return get().dispatch({
      type: ACTION_ADD_LINK,
      userId,
      sourceId,
      targetId,
    });
  },

  deleteLink(userId, linkId) {
    return get().dispatch({
      type: ACTION_DELETE_LINK,
      userId,
      linkId,
    });
  },

  toggleUp(userId, nodeId) {
    return get().dispatch({
      type: ACTION_TOGGLE_UP,
      userId,
      nodeId,
    });
  },

  toggleDown(userId, nodeId) {
    return get().dispatch({
      type: ACTION_TOGGLE_DOWN,
      userId,
      nodeId,
    });
  },

  toggleLinkUp(userId, linkId) {
    return get().dispatch({
      type: ACTION_TOGGLE_LINK_UP,
      userId,
      linkId,
    });
  },

  toggleLinkDown(userId, linkId) {
    return get().dispatch({
      type: ACTION_TOGGLE_LINK_DOWN,
      userId,
      linkId,
    });
  },
}));