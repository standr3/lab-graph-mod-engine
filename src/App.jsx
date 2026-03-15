import { useGraphStore } from "./store/graphStore";
import {
  formatNodeText,
  formatReplyText,
  getNodeCanonicalStatus,
  getNodeVoteForUser,
  getRepliesForNode,
  getReplyBlockReason,
  getReplyControlsMode,
  getVoteControlsMode,
  isNodeAuthoritativeByOrigin,
} from "./graph/selectors";
import { VOTE_DOWN, VOTE_UP } from "./graph/constants";

function UserView({ userId, title }) {
  const nodes = useGraphStore((s) => s.nodes);
  const replies = useGraphStore((s) => s.replies);
  const addNode = useGraphStore((s) => s.addNode);
  const addReply = useGraphStore((s) => s.addReply);
  const deleteReply = useGraphStore((s) => s.deleteReply);
  const toggleUp = useGraphStore((s) => s.toggleUp);
  const toggleDown = useGraphStore((s) => s.toggleDown);

  return (
    <div
      style={{
        border: "1px solid #d9d9d9",
        borderRadius: 12,
        padding: 16,
        background: "white",
        height: "100%",
        overflow: "auto",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h2 style={{ margin: 0 }}>{title}</h2>
        <button onClick={() => addNode(userId)}>Add node</button>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {nodes.map((node) => {
          const myVote = getNodeVoteForUser(node, userId);
          const voteControlsMode = getVoteControlsMode(node, userId);
          const replyControlsMode = getReplyControlsMode(node, userId);
          const replyReason = getReplyBlockReason(node, userId);
          const authoritativeByOrigin = isNodeAuthoritativeByOrigin(node);
          const canonicalStatus = getNodeCanonicalStatus(node);
          const isOwnNode = node.creatorId === userId;
          const nodeReplies = getRepliesForNode(replies, node.id);

          return (
            <div
              key={node.id}
              style={{
                border: "1px solid #ececec",
                borderRadius: 10,
                padding: 12,
              }}
            >
              <div style={{ marginBottom: 10, fontFamily: "monospace" }}>
                {formatNodeText(node)}
              </div>

              {voteControlsMode !== "hidden" ? (
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <button
                    onClick={() => toggleUp(userId, node.id)}
                    disabled={voteControlsMode === "disabled"}
                    style={{ fontWeight: myVote === VOTE_UP ? "bold" : "normal" }}
                  >
                    up
                  </button>

                  <button
                    onClick={() => toggleDown(userId, node.id)}
                    disabled={voteControlsMode === "disabled"}
                    style={{ fontWeight: myVote === VOTE_DOWN ? "bold" : "normal" }}
                  >
                    down
                  </button>

                  <span style={{ fontSize: 12, color: "#666" }}>
                    last decision: {myVote}
                    {voteControlsMode === "disabled" ? " • locked" : ""}
                  </span>
                </div>
              ) : null}

              <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
                {authoritativeByOrigin
                  ? "authoritative node by origin: voting unavailable"
                  : canonicalStatus === "canonical_true"
                  ? userId === "O"
                    ? "you marked this node as canonical truth"
                    : "canonical truth decided by owner • voting locked"
                  : canonicalStatus === "canonical_false"
                  ? userId === "O"
                    ? "you marked this node as canonical falsehood"
                    : "canonical falsehood decided by owner • voting locked"
                  : isOwnNode
                  ? "own node: you cannot vote on it"
                  : "community node"}
              </div>

              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <button
                  onClick={() => addReply(userId, node.id)}
                  disabled={replyControlsMode === "disabled"}
                >
                  Add reply
                </button>

                <span style={{ fontSize: 12, color: "#666" }}>
                  {replyReason}
                </span>
              </div>

              {nodeReplies.length > 0 ? (
                <div
                  style={{
                    marginTop: 12,
                    paddingLeft: 12,
                    borderLeft: "2px solid #ececec",
                    display: "grid",
                    gap: 8,
                  }}
                >
                  {nodeReplies.map((reply) => {
                    const isOwnReply = reply.creatorId === userId;

                    return (
                      <div
                        key={reply.id}
                        style={{
                          border: "1px solid #f0f0f0",
                          borderRadius: 8,
                          padding: 8,
                          background: "#fafafa",
                        }}
                      >
                        <div style={{ fontFamily: "monospace" }}>
                          {formatReplyText(reply)}
                        </div>

                        {isOwnReply ? (
                          <div style={{ marginTop: 8 }}>
                            <button onClick={() => deleteReply(userId, reply.id)}>
                              Delete reply
                            </button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventLog() {
  const eventLog = useGraphStore((s) => s.eventLog);

  return (
    <div
      style={{
        border: "1px solid #d9d9d9",
        borderRadius: 12,
        padding: 16,
        background: "white",
        height: "100%",
        overflow: "auto",
      }}
    >
      <h2 style={{ marginTop: 0 }}>Event log</h2>

      <div style={{ display: "grid", gap: 8 }}>
        {eventLog.length === 0 ? (
          <div>No events yet</div>
        ) : (
          eventLog.map((item, index) => (
            <div
              key={`${item}-${index}`}
              style={{
                border: "1px solid #ececec",
                borderRadius: 8,
                padding: 8,
                fontFamily: "monospace",
              }}
            >
              {item}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f5f5",
        padding: 16,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1 style={{ marginTop: 0 }}>Nodes sandbox</h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.1fr 1fr",
          gap: 16,
          minHeight: "85vh",
        }}
      >
        <div>
          <UserView userId="O" title="Owner view" />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateRows: "1fr 1fr",
            gap: 16,
          }}
        >
          <div>
            <UserView userId="G_1" title="Guest 1 view" />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateRows: "1fr 220px",
              gap: 16,
            }}
          >
            <UserView userId="G_2" title="Guest 2 view" />
            <EventLog />
          </div>
        </div>
      </div>
    </div>
  );
}