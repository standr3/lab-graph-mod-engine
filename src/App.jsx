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

const ui = {
  page: {
    minHeight: "100vh",
    background: "#f5f7fb",
    padding: 20,
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    color: "#1f2937",
  },

  pageTitle: {
    marginTop: 0,
    marginBottom: 16,
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: "-0.02em",
  },

  layout: {
    display: "grid",
    gridTemplateColumns: "1.08fr 1fr",
    gap: 16,
    minHeight: "85vh",
  },

  rightColumn: {
    display: "grid",
    gridTemplateRows: "1fr 1fr",
    gap: 16,
  },

  rightBottom: {
    display: "grid",
    gridTemplateRows: "1fr 220px",
    gap: 16,
  },

  panel: {
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    padding: 18,
    background: "#ffffff",
    height: "100%",
    overflow: "auto",
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.04)",
  },

  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },

  panelTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: "-0.01em",
  },

  primaryButton: {
    border: "1px solid #d1d5db",
    background: "#111827",
    color: "#ffffff",
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },

  secondaryButton: {
    border: "1px solid #d1d5db",
    background: "#ffffff",
    color: "#111827",
    borderRadius: 10,
    padding: "8px 12px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },

  dangerButton: {
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#b91c1c",
    borderRadius: 10,
    padding: "8px 12px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },

  disabledButton: {
    opacity: 0.55,
    cursor: "not-allowed",
  },

  sectionList: {
    display: "grid",
    gap: 12,
  },

  nodeCard: {
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 14,
    background: "#ffffff",
  },

  codeBox: {
    marginBottom: 10,
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    fontSize: 13,
    lineHeight: 1.45,
    color: "#111827",
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 10,
    overflowX: "auto",
  },

  row: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },

  infoText: {
    fontSize: 12,
    color: "#6b7280",
    lineHeight: 1.45,
  },

  subtleText: {
    fontSize: 12,
    color: "#9ca3af",
    lineHeight: 1.45,
  },

  badgeRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: 10,
  },

  badge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "4px 9px",
    fontSize: 11,
    fontWeight: 700,
    border: "1px solid transparent",
    letterSpacing: "0.01em",
  },

  controlBlock: {
    marginTop: 10,
    display: "grid",
    gap: 8,
  },

  select: {
    border: "1px solid #d1d5db",
    background: "#ffffff",
    color: "#111827",
    borderRadius: 10,
    padding: "9px 10px",
    fontSize: 13,
    minWidth: 190,
  },

  linksWrap: {
    marginTop: 12,
    display: "grid",
    gap: 10,
  },

  linkCard: {
    padding: 12,
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    background: "#fbfdff",
  },

  verticalEntity: {
    padding: 10,
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    background: "#ffffff",
  },

  verticalLink: {
    margin: "8px 0",
    padding: 10,
    border: "1px dashed #cbd5e1",
    borderRadius: 10,
    background: "#f8fafc",
  },

  dividerInfo: {
    marginTop: 8,
    marginBottom: 4,
    display: "grid",
    gap: 8,
  },

  eventItem: {
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: 10,
    background: "#fafafa",
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    fontSize: 12,
    lineHeight: 1.45,
    color: "#374151",
  },
};

function getStatusBadge(status, byOrigin) {
  if (byOrigin) {
    return {
      label: "AUTHORITATIVE",
      style: {
        ...ui.badge,
        background: "#eef2ff",
        color: "#4338ca",
        borderColor: "#c7d2fe",
      },
    };
  }

  if (status === "canonical_true") {
    return {
      label: "CANONICAL TRUE",
      style: {
        ...ui.badge,
        background: "#ecfdf5",
        color: "#047857",
        borderColor: "#a7f3d0",
      },
    };
  }

  if (status === "canonical_false") {
    return {
      label: "CANONICAL FALSE",
      style: {
        ...ui.badge,
        background: "#fef2f2",
        color: "#b91c1c",
        borderColor: "#fecaca",
      },
    };
  }

  return {
    label: "COMMUNITY",
    style: {
      ...ui.badge,
      background: "#f3f4f6",
      color: "#4b5563",
      borderColor: "#e5e7eb",
    },
  };
}

function getVoteBadge(myVote, controlsMode) {
  const map = {
    [VOTE_UP]: {
      label: "MY VOTE: UP",
      style: {
        ...ui.badge,
        background: "#ecfdf5",
        color: "#047857",
        borderColor: "#a7f3d0",
      },
    },
    [VOTE_DOWN]: {
      label: "MY VOTE: DOWN",
      style: {
        ...ui.badge,
        background: "#fef2f2",
        color: "#b91c1c",
        borderColor: "#fecaca",
      },
    },
    default: {
      label: "MY VOTE: NONE",
      style: {
        ...ui.badge,
        background: "#f9fafb",
        color: "#6b7280",
        borderColor: "#e5e7eb",
      },
    },
  };

  const base = map[myVote] || map.default;

  if (controlsMode === "disabled") {
    return {
      label: `${base.label} • LOCKED`,
      style: {
        ...base.style,
        boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.02)",
      },
    };
  }

  return base;
}

function buttonStyle(base, disabled) {
  return disabled ? { ...base, ...ui.disabledButton } : base;
}

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

  const statusBadge = getStatusBadge(
    linkCanonicalStatus,
    linkAuthoritativeByOrigin
  );
  const voteBadge = getVoteBadge(linkMyVote, linkVoteControlsMode);

  return (
    <div style={ui.linkCard}>
      <div style={ui.badgeRow}>
        <span style={statusBadge.style}>{statusBadge.label}</span>
        <span style={voteBadge.style}>{voteBadge.label}</span>
      </div>

      <div style={ui.verticalEntity}>
        {sourceNode ? formatNodeText(sourceNode) : "[missing source node]"}
      </div>

      <div style={ui.verticalLink}>{formatLinkText(link)}</div>

      <div style={ui.verticalEntity}>
        {targetNode ? formatNodeText(targetNode) : "[missing target node]"}
      </div>

      {linkVoteControlsMode !== "hidden" ? (
        <div style={{ ...ui.row, marginTop: 10 }}>
          <button
            onClick={() => toggleLinkUp(userId, link.id)}
            disabled={
              linkVoteControlsMode === "disabled" ||
              linkUpActionMode === "disabled"
            }
            style={buttonStyle(
              {
                ...ui.secondaryButton,
                fontWeight: linkMyVote === VOTE_UP ? 800 : 600,
              },
              linkVoteControlsMode === "disabled" ||
                linkUpActionMode === "disabled"
            )}
          >
            up
          </button>

          <button
            onClick={() => toggleLinkDown(userId, link.id)}
            disabled={
              linkVoteControlsMode === "disabled" ||
              linkDownActionMode === "disabled"
            }
            style={buttonStyle(
              {
                ...ui.secondaryButton,
                fontWeight: linkMyVote === VOTE_DOWN ? 800 : 600,
              },
              linkVoteControlsMode === "disabled" ||
                linkDownActionMode === "disabled"
            )}
          >
            down
          </button>

          <span style={ui.infoText}>
            last decision: {linkMyVote}
            {linkVoteControlsMode === "disabled" ? " • locked" : ""}
          </span>
        </div>
      ) : null}

      <div style={ui.dividerInfo}>
        <span style={ui.infoText}>
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
        </span>
      </div>

      {isOwnLink ? (
        <div style={{ ...ui.controlBlock, marginTop: 10 }}>
          <button
            onClick={() => deleteLink(userId, link.id)}
            disabled={linkDeleteMode === "disabled"}
            style={buttonStyle(ui.dangerButton, linkDeleteMode === "disabled")}
          >
            Delete link
          </button>

          <span style={ui.infoText}>{linkDeleteReason}</span>
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
    <div style={ui.panel}>
      <div style={ui.panelHeader}>
        <h2 style={ui.panelTitle}>{title}</h2>
        <button onClick={() => addNode(userId)} style={ui.primaryButton}>
          Add node
        </button>
      </div>

      <div style={ui.sectionList}>
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

          const statusBadge = getStatusBadge(
            canonicalStatus,
            authoritativeByOrigin
          );
          const voteBadge = getVoteBadge(myVote, voteControlsMode);

          return (
            <div key={node.id} style={ui.nodeCard}>
              <div style={ui.badgeRow}>
                <span style={statusBadge.style}>{statusBadge.label}</span>
                <span style={voteBadge.style}>{voteBadge.label}</span>
              </div>

              <div style={ui.codeBox}>{formatNodeText(node)}</div>

              {voteControlsMode !== "hidden" ? (
                <div style={ui.row}>
                  <button
                    onClick={() => toggleUp(userId, node.id)}
                    disabled={voteControlsMode === "disabled"}
                    style={buttonStyle(
                      {
                        ...ui.secondaryButton,
                        fontWeight: myVote === VOTE_UP ? 800 : 600,
                      },
                      voteControlsMode === "disabled"
                    )}
                  >
                    up
                  </button>

                  <button
                    onClick={() => toggleDown(userId, node.id)}
                    disabled={voteControlsMode === "disabled"}
                    style={buttonStyle(
                      {
                        ...ui.secondaryButton,
                        fontWeight: myVote === VOTE_DOWN ? 800 : 600,
                      },
                      voteControlsMode === "disabled"
                    )}
                  >
                    down
                  </button>

                  <span style={ui.infoText}>
                    last decision: {myVote}
                    {voteControlsMode === "disabled" ? " • locked" : ""}
                  </span>
                </div>
              ) : null}

              <div style={{ ...ui.controlBlock, marginTop: 10 }}>
                <span style={ui.infoText}>
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
                </span>
              </div>

              <div style={{ ...ui.controlBlock, marginTop: 12 }}>
                <div style={ui.row}>
                  <select
                    value={selectedTargetId}
                    onChange={(e) =>
                      setSelectedTargets((prev) => ({
                        ...prev,
                        [node.id]: e.target.value,
                      }))
                    }
                    disabled={targetOptions.length === 0}
                    style={ui.select}
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
                    style={buttonStyle(
                      ui.secondaryButton,
                      linkCreationMode === "disabled" ||
                        !selectedTargetId ||
                        targetOptions.length === 0
                    )}
                  >
                    Add link
                  </button>
                </div>

                <span style={ui.infoText}>{linkReason}</span>
              </div>

              {outgoingLinks.length > 0 ? (
                <div style={ui.linksWrap}>
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
    <div style={ui.panel}>
      <h2 style={{ ...ui.panelTitle, marginBottom: 14 }}>Event log</h2>

      <div style={{ display: "grid", gap: 8 }}>
        {eventLog.length === 0 ? (
          <div style={ui.subtleText}>No events yet</div>
        ) : (
          eventLog.map((item, index) => (
            <div key={`${item}-${index}`} style={ui.eventItem}>
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
    <div style={ui.page}>
      <h1 style={ui.pageTitle}>Nodes sandbox</h1>

      <div style={ui.layout}>
        <div>
          <UserView userId="O" title="Owner view" />
        </div>

        <div style={ui.rightColumn}>
          <div>
            <UserView userId="G_1" title="Guest 1 view" />
          </div>

          <div style={ui.rightBottom}>
            <UserView userId="G_2" title="Guest 2 view" />
            <EventLog />
          </div>
        </div>
      </div>
    </div>
  );
}