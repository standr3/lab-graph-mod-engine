import { create } from "zustand";
import {
  ACTION_ADD_NODE,
  ACTION_ADD_REPLY,
  ACTION_DELETE_REPLY,
  ACTION_TOGGLE_DOWN,
  ACTION_TOGGLE_REPLY_DOWN,
  ACTION_TOGGLE_REPLY_UP,
  ACTION_TOGGLE_UP,
  USERS,
} from "../graph/constants";
import { makeInitialNodes } from "../graph/seed";
import { applyAction } from "../graph/engine";

export const useGraphStore = create((set, get) => ({
  users: USERS,
  nodes: makeInitialNodes(),
  replies: [],
  eventLog: [],

  dispatch(action) {
    console.log("[STORE] dispatch:start", action);

    const state = {
      nodes: get().nodes,
      replies: get().replies,
    };

    const result = applyAction(state, action);

    console.log("[STORE] dispatch:result", result);

    set((current) => ({
      nodes: result.nextState.nodes,
      replies: result.nextState.replies ?? current.replies,
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

  addReply(userId, nodeId) {
    return get().dispatch({
      type: ACTION_ADD_REPLY,
      userId,
      nodeId,
    });
  },

  deleteReply(userId, replyId) {
    return get().dispatch({
      type: ACTION_DELETE_REPLY,
      userId,
      replyId,
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

  toggleReplyUp(userId, replyId) {
    return get().dispatch({
      type: ACTION_TOGGLE_REPLY_UP,
      userId,
      replyId,
    });
  },

  toggleReplyDown(userId, replyId) {
    return get().dispatch({
      type: ACTION_TOGGLE_REPLY_DOWN,
      userId,
      replyId,
    });
  },
}));