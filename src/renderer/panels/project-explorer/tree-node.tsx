/**
 * Recursive tree node view.
 *
 * Expands/collapses directories. Capability dirs (docs, assets, ...) carry
 * a directoryType for their icon. Deeper levels load lazily via the
 * explorer.expand IPC channel — keeps large renders/ dirs snappy.
 */
import { useState, type ReactNode } from "react";
import type { TreeNode } from "@shared/production-explorer/types.js";
import { DirectoryIcon, FileIcon } from "./icons.js";

interface TreeNodeViewProps {
  node: TreeNode;
  depth: number;
  onSelect?: (node: TreeNode) => void;
  selectedPath?: string;
}

export function TreeNodeView({ node, depth, onSelect, selectedPath }: TreeNodeViewProps) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<TreeNode[] | undefined>(node.children);
  const [loading, setLoading] = useState(false);

  const isDir = node.kind === "production" || node.kind === "directory";
  const selected = selectedPath === node.path;

  const handleToggle = async () => {
    if (!isDir) {
      onSelect?.(node);
      return;
    }
    if (expanded) {
      setExpanded(false);
      return;
    }
    // Lazy-load children if not yet loaded (directories beyond depth 1).
    if (!children) {
      setLoading(true);
      try {
        const loaded = await window.artworks.explorer.expand(node.path);
        setChildren(loaded);
      } finally {
        setLoading(false);
      }
    }
    setExpanded(true);
  };

  return (
    <li className="project-explorer__tree-node" role="treeitem" aria-expanded={isDir ? expanded : undefined}>
      <div
        className={`project-explorer__row${selected ? " project-explorer__row--selected" : ""}`}
        style={{ paddingInlineStart: `${depth * 16 + 8}px` }}
        onClick={handleToggle}
      >
        {isDir ? (
          <span className="project-explorer__chevron" aria-hidden>
            {loading ? "…" : expanded ? "▾" : "▸"}
          </span>
        ) : (
          <span className="project-explorer__chevron project-explorer__chevron--blank" aria-hidden />
        )}
        {node.kind === "file" ? <FileIcon /> : <DirectoryIcon type={node.directoryType} />}
        <span className="project-explorer__name">{node.name}</span>
      </div>
      {isDir && expanded && children && (
        <ul className="project-explorer__children" role="group">
          {children.map((child) => (
            <TreeNodeView
              key={child.path}
              node={child}
              depth={depth + 1}
              onSelect={onSelect}
              selectedPath={selectedPath}
            />
          ))}
          {children.length === 0 && <EmptyNode label="empty" depth={depth + 1} />}
        </ul>
      )}
    </li>
  );
}

function EmptyNode({ label, depth }: { label: string; depth: number }) {
  return (
    <li style={{ paddingInlineStart: `${depth * 16 + 8}px` }} className="project-explorer__empty">
      {label}
    </li>
  );
}

export type { ReactNode };
