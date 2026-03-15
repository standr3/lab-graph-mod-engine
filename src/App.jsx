import { useMemo, useState } from "react";
import { useGraphStore } from "./store/graphStore";
import {
  formatLinkText,
  formatNodeText,
  getLinkCanonicalStatus,
  getLinkCreationMode,
  getLinkCreationReason,
  getLinkDeleteMode,
  getLinkDeleteReason,
  getLinkDownActionMode,
  getLinkUpActionMode,
  getLinkVoteControlsMode,
  getLinkVoteForUser,
  getNodeById,
  getNodeCanonicalStatus,
  getNodeVoteForUser,
  getOutgoingLinks,
  getVoteControlsMode,
  isLinkAuthoritativeByOrigin,
  isNodeAuthoritativeByOrigin,
  isNodeReviewLockedByReviewedUserLink,
} from "./graph/selectors";
import { VOTE_DOWN, VOTE_UP } from "./graph/constants";

function LinkBlock({
  link,
  nodes,
  links,
  userId,
  deleteLink,
  toggleLinkUp,
  toggleLinkDown,
}) {
  const sourceNode = getNodeById(nodes, link.sourceId);
  const targetNode = getNodeById(nodes, link.targetId);

  const linkMyVote = getLinkVoteForUser(link, userId);
  const linkVoteControlsMode = getLinkVoteControlsMode(link, userId);
  const linkUpActionMode = getLinkUpActionMode(link, userId, nodes);
  const linkDownActionMode = getLinkDownActionMode(link, userId, nodes);
  const linkAuthoritativeByOrigin = isLinkAuthoritativeByOrigin(link);
  const linkCanonicalStatus = getLinkCanonicalStatus(link);
  const isOwnLink = link.creatorId === userId;
  const linkDeleteMode = getLinkDeleteMode(link, userId);
  const linkDeleteReason = getLinkDeleteReason(link, userId);

  return (
    <div
      style={{
        marginTop: 12,
        padding: 12,
        border: "1px solid #ececec",
        borderRadius: 10,
        background: "#fafafa",
      }}
    >
      <div
        style={{
          padding: 8,
          border: "1px solid #e5e5e5",
          borderRadius: 8,
          fontFamily: "monospace",
          background: "white",
        }}
      >
        {sourceNode ? formatNodeText(sourceNode) : "[missing source node]"}
      </div>

      <div
        style={{
          margin: "8px 0",
          padding: 8,
          border: "1px dashed #cfcfcf",
          borderRadius: 8,
          fontFamily: "monospace",
          background: "#f3f3f3",
        }}
      >
        {formatLinkText(link)}
      </div>

      <div
        style={{
          padding: 8,
          border: "1px solid #e5e5e5",
          borderRadius: 8,
          fontFamily: "monospace",
          background: "white",
        }}
      >
        {targetNode ? formatNodeText(targetNode) : "[missing target node]"}
      </div>

      {linkVoteControlsMode !== "hidden" ? (
        <div
          style={{
            marginTop: 8,
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <button
            onClick={() => toggleLinkUp(userId, link.id)}
            disabled={
              linkVoteControlsMode === "disabled" ||
              linkUpActionMode === "disabled"
            }
            style={{ fontWeight: linkMyVote === VOTE_UP ? "bold" : "normal" }}
          >
            up
          </button>

          <button
            onClick={() => toggleLinkDown(userId, link.id)}
            disabled={
              linkVoteControlsMode === "disabled" ||
              linkDownActionMode === "disabled"
            }
            style={{ fontWeight: linkMyVote === VOTE_DOWN ? "bold" : "normal" }}
          >
            down
          </button>

          <span style={{ fontSize: 12, color: "#666" }}>
            last decision: {linkMyVote}
            {linkVoteControlsMode === "disabled" ? " • locked" : ""}
          </span>
        </div>
      ) : null}

      <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
        {linkAuthoritativeByOrigin
          ? "authoritative link by origin: voting unavailable"
          : linkCanonicalStatus === "canonical_true"
          ? userId === "O"
            ? "you marked this link as canonical truth"
            : "canonical truth decided by owner • voting locked"
          : linkCanonicalStatus === "canonical_false"
          ? userId === "O"
            ? "you marked this link as canonical falsehood"
            : "canonical falsehood decided by owner • voting locked"
          : isOwnLink
          ? "own link: you cannot vote on it"
          : "community link"}
      </div>

      {isOwnLink ? (
        <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
          <button
            onClick={() => deleteLink(userId, link.id)}
            disabled={linkDeleteMode === "disabled"}
          >
            Delete link
          </button>

          <span style={{ fontSize: 12, color: "#666" }}>
            {linkDeleteReason}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function UserView({ userId, title }) {
  const nodes = useGraphStore((s) => s.nodes);
  const links = useGraphStore((s) => s.links);
  const addNode = useGraphStore((s) => s.addNode);
  const addLink = useGraphStore((s) => s.addLink);
  const deleteLink = useGraphStore((s) => s.deleteLink);
  const toggleUp = useGraphStore((s) => s.toggleUp);
  const toggleDown = useGraphStore((s) => s.toggleDown);
  const toggleLinkUp = useGraphStore((s) => s.toggleLinkUp);
  const toggleLinkDown = useGraphStore((s) => s.toggleLinkDown);

  const [selectedTargets, setSelectedTargets] = useState({});

  const targetOptionsBySource = useMemo(() => {
    const map = {};

    for (const node of nodes) {
      const usedTargets = new Set(
        links
          .filter((link) => link.sourceId === node.id)
          .map((link) => link.targetId)
      );

      map[node.id] = nodes.filter(
        (candidate) =>
          candidate.id !== node.id && !usedTargets.has(candidate.id)
      );
    }

    return map;
  }, [nodes, links]);

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
          const voteControlsMode = getVoteControlsMode(node, userId, links);
          const authoritativeByOrigin = isNodeAuthoritativeByOrigin(node);
          const canonicalStatus = getNodeCanonicalStatus(node);
          const isOwnNode = node.creatorId === userId;
          const outgoingLinks = getOutgoingLinks(links, node.id);
          const targetOptions = targetOptionsBySource[node.id] || [];

          const selectedTargetId =
            selectedTargets[node.id] || targetOptions[0]?.id || "";
          const selectedTargetNode = selectedTargetId
            ? getNodeById(nodes, selectedTargetId)
            : null;

          const linkCreationMode = getLinkCreationMode(
            node,
            selectedTargetNode,
            userId
          );
          const linkReason = getLinkCreationReason(
            node,
            selectedTargetNode,
            userId
          );

          const nodeLockedByReviewedLink = isNodeReviewLockedByReviewedUserLink(
            node.id,
            links,
            userId
          );

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
                  : nodeLockedByReviewedLink
                  ? "review locked: one of your guest-created links on this node has external reviews"
                  : "community node"}
              </div>

              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <select
                  value={selectedTargetId}
                  onChange={(e) =>
                    setSelectedTargets((prev) => ({
                      ...prev,
                      [node.id]: e.target.value,
                    }))
                  }
                  disabled={targetOptions.length === 0}
                >
                  {targetOptions.length === 0 ? (
                    <option value="">No target available</option>
                  ) : (
                    targetOptions.map((target) => (
                      <option key={target.id} value={target.id}>
                        {target.label} ({target.id})
                      </option>
                    ))
                  )}
                </select>

                <button
                  disabled={
                    linkCreationMode === "disabled" ||
                    !selectedTargetId ||
                    targetOptions.length === 0
                  }
                  onClick={() => {
                    addLink(userId, node.id, selectedTargetId);
                    setSelectedTargets((prev) => {
                      const next = { ...prev };
                      delete next[node.id];
                      return next;
                    });
                  }}
                >
                  Add link
                </button>

                <span style={{ fontSize: 12, color: "#666" }}>
                  {linkReason}
                </span>
              </div>

              {outgoingLinks.length > 0 ? (
                <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                  {outgoingLinks.map((link) => (
                    <LinkBlock
                      key={link.id}
                      link={link}
                      nodes={nodes}
                      links={links}
                      userId={userId}
                      deleteLink={deleteLink}
                      toggleLinkUp={toggleLinkUp}
                      toggleLinkDown={toggleLinkDown}
                    />
                  ))}
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