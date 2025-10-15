import { parse } from "@babel/parser";
import traverseModule from "@babel/traverse";
import { createFingerprint } from "../../utils/createFingerprint.ts";

const traverse = (traverseModule as any).default;

export interface IndexedComponent {
  fingerprint: string;
  component: string;
  props: string[];
  file: string;
  line: number;
  column: number;
  framework: "react";
}

export function indexReactFile(filePath: string, code: string): IndexedComponent[] {
  const nodes: IndexedComponent[] = [];

  const ast = parse(code, {
    sourceType: "module",
    plugins: ["jsx", "typescript"],
  });

  traverse(ast, {
    JSXElement(path: any) {
      // console.log("\n=== Current JSXElement ===");
      // console.log(path.node);
      // console.log("=========================\n");

      const openingElement = path.node.openingElement;
      const startLine = openingElement.loc?.start.line;
      const type = openingElement.name.type;
      console.log(`Found JSX element at line ${startLine}`);

      // Get the element name
      let name: string;
      if (type === "JSXIdentifier") {
        name = openingElement.name.name;
      } else if (type === "JSXMemberExpression") {
        // Handle React.Fragment or similar
        const object = openingElement.name.object.type === "JSXMemberExpression"
          ? "Unknown" // For deeply nested expressions
          : openingElement.name.object.name;
        const property = openingElement.name.property.name;
        name = `${object}.${property}`;
      } else if (type === "JSXNamespacedName") {
        // Handle svg:path or similar namespaced elements
        name = `${openingElement.name.namespace.name}:${openingElement.name.name.name}`;
      } else {
        name = "Unknown";
      }

      const props = openingElement.attributes
        .map((attr: any) => attr.name?.name)
        .filter(Boolean);

      const loc = openingElement.loc?.start || { line: 0, column: 0 };

      // Get attribute values for key props that will be available in DOM
      const propValues: Record<string, string> = {};
      openingElement.attributes.forEach((attr: any) => {
        if (attr.type === "JSXAttribute") {
          const name = attr.name.name;
          // Only include attributes that will be present in DOM
          if (["href", "src", "id", "className", "alt", "data-testid"].includes(name)) {
            if (attr.value.type === "StringLiteral") {
              propValues[name] = attr.value.value;
            } else if (attr.value.type === "JSXExpressionContainer" &&
                      attr.value.expression.type === "StringLiteral") {
              propValues[name] = attr.value.expression.value;
            }
          }
        }
      });

      // Build a path of parent elements with nth-of-type indices
      const elementPath: string[] = [];
      let current = path;  // Start with current element instead of parent
      let reachedRoot = false;

      while (current) {
        if (current.node.type === "JSXElement") {
          const openingElement = current.node.openingElement;
          const elementName = openingElement.name.name;

          // Count position among siblings including those in fragments
          const parent = current.parentPath;
          if (parent?.node.type === "JSXElement" || parent?.node.type === "JSXFragment") {
            // Get siblings of the same type, including those in fragments
            const siblings = parent.node.children.filter((child: any) =>
              child.type === "JSXElement" &&
              child.openingElement.name.name === elementName
            );

            // Only add index if there are multiple elements of same type
            let pathSegment = elementName;
            if (siblings.length > 1) {
              const index = siblings.findIndex((sibling: any) => sibling === current.node) + 1;
              pathSegment = `${elementName}[${index}]`;
            }

            elementPath.unshift(pathSegment);
          } else {
            // Root level elements don't need indices if they're alone
            elementPath.unshift(elementName);
            reachedRoot = true;
          }
        } else if (current.node.type === "JSXFragment") {
          // Continue traversing through fragments to maintain element counts
          current = current.parentPath;
          continue;
        } else if (current.node.type === "Program") {
          reachedRoot = true;
        }
        current = current.parentPath;
      }

      // Add html and body to the path if we reached the root
      if (reachedRoot) {
        // Since there's only one body and html, no need for indices
        elementPath.unshift("body");
        elementPath.unshift("html");
      }

      // Find the index within parent's children
      let index = 0;
      const parent = path.parentPath;

      if (parent?.node.type === "JSXElement") {
        // Filter out text nodes and get only element nodes
        const jsxElements = parent.node.children.filter((child: any) =>
          child.type === "JSXElement"
        );

        // Find our position in the filtered list
        for (let i = 0; i < jsxElements.length; i++) {
          if (jsxElements[i] === path.node) {
            index = i;
            break;
          }
        }
      }

      const fingerprint = createFingerprint({
        tagName: name,
        attributes: propValues,
        parentPath: elementPath.join("/"),
        siblingIndex: index
      });

      console.log(fingerprint, loc.line, name, propValues, elementPath.join("/"), index);

      nodes.push({
        fingerprint,
        component: name,
        props,
        file: filePath,
        line: loc.line,
        column: loc.column,
        framework: "react",
      });
    },
  });

  return nodes;
}
