/**
 * Keep React from crashing when something outside it has moved its DOM nodes.
 *
 * Browser page translation (Chrome's "Translate this page") and some extensions
 * wrap text nodes in <font> elements. React still holds the original node and
 * later calls parent.removeChild(node) / parent.insertBefore(new, node) on a
 * parent that no longer contains it, which throws "The node to be removed is not a
 * child of this node" and unmounts the page into the error boundary. Visitors
 * reported exactly that on /learn and /52-week-tracker.
 *
 * The widely used mitigation (facebook/react#11538): when the node has already
 * left that parent, skip the call instead of throwing. Nothing else changes.
 */
export function installDomMutationGuard(): void {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) return child;
    return originalRemoveChild.call(this, child) as T;
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(this: Node, node: T, ref: Node | null): T {
    if (ref && ref.parentNode !== this) return originalInsertBefore.call(this, node, null) as T;
    return originalInsertBefore.call(this, node, ref) as T;
  };
}
