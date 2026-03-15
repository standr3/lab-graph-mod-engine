import { getNodeById, canAddLink } from "./selectors";

export function revalidateGraph(state) {
  let nodes = state.nodes;
  let links = state.links;

  const deletions = [];

  for (const link of links) {
    const source = getNodeById(nodes, link.sourceId);
    const target = getNodeById(nodes, link.targetId);

    if (!source || !target) {
      deletions.push(link.id);
      continue;
    }

    const stillValid = canAddLink(source, target, link.creatorId);

    if (!stillValid) {
      deletions.push(link.id);
    }
  }

  if (deletions.length === 0) {
    return state;
  }

  const nextLinks = links.filter((l) => !deletions.includes(l.id));

  return {
    ...state,
    links: nextLinks,
  };
}