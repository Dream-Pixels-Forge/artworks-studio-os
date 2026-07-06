/**
 * LayoutNodeView — recursive renderer for the layout tree.
 *
 * A {@link SplitNode} renders as a {@link SplitView} of its children; a
 * {@link TabNode} renders as a {@link TabGroup}. This is the bridge between
 * the pure layout model and React.
 */
import type { ReactNode } from "react";
import { SplitView } from "./split-view.js";
import { TabGroup } from "./tab-group.js";
import type { DockEdge, LayoutAction } from "./layout-reducer.js";
import type { LayoutNode, PanelDefinition } from "./types.js";
import { isSplitNode } from "./types.js";

export interface LayoutNodeViewProps {
  node: LayoutNode;
  panelDef: (id: string) => PanelDefinition | undefined;
  onAction: (action: LayoutAction) => void;
  onDragStartPanel: (panelId: string) => void;
  onDragEndPanel: () => void;
  onDetach: (panelId: string) => void;
}

export function LayoutNodeView(props: LayoutNodeViewProps): ReactNode {
  const { node } = props;
  if (isSplitNode(node)) {
    return (
      <SplitView
        direction={node.direction}
        sizes={node.sizes}
        onResize={(sizes) => props.onAction({ type: "RESIZE", nodeId: node.id, sizes })}
      >
        {node.children.map((child) => (
          <LayoutNodeView key={child.id} {...props} node={child} />
        ))}
      </SplitView>
    );
  }
  return (
    <TabGroup
      node={node}
      panelDef={props.panelDef}
      onAction={props.onAction}
      onDragStartPanel={props.onDragStartPanel}
      onDragEndPanel={props.onDragEndPanel}
      onDetach={props.onDetach}
    />
  );
}

// Re-export so consumers can import edge typing from one place.
export type { DockEdge };
