// buildGraphFromFile.ts
import fs from "fs";
import { parse } from "@babel/parser";
import _traverse from '@babel/traverse';
import _generate from '@babel/generator';
import * as t from "@babel/types";
import { graphStore } from "./graphStore.ts";
import { visualizeGraph } from "./visualizeGraph.ts";

const traverse = (_traverse as any).default || _traverse;
const generate = (_generate as any).default || _generate;

export function buildGraphFromFile(filePath: string) {
  const code = fs.readFileSync(filePath, "utf-8");

  const ast = parse(code, {
    sourceType: "module",
    plugins: ["jsx", "typescript"],
  });

  // Extract just the filename from the full path
  const fileName = filePath.split(/[\\/]/).pop() || filePath;

  // Track the current function or component context
  let currentFunction: string | null = null;
  // Track the current JSX element context for calls
  let currentJSXElement: string | null = null;

  traverse(ast, {
    // --- COMPONENT / FUNCTION NODES ---
    FunctionDeclaration(path: any) {
      const name = path.node.id?.name;
      if (name) {
        const codeSnippet = generate(path.node).code;
        graphStore.addNode(name, {
          name,
          type: 'function',
          filePath,
          location: {
            start: {
              line: path.node.loc?.start.line || 0,
              column: path.node.loc?.start.column || 0,
            },
            end: {
              line: path.node.loc?.end.line || 0,
              column: path.node.loc?.end.column || 0,
            },
          },
          codeSnippet,
        });
        currentFunction = name;
      }
    },
    VariableDeclarator(path: any) {
      if (
        t.isIdentifier(path.node.id) &&
        (t.isArrowFunctionExpression(path.node.init) ||
          t.isFunctionExpression(path.node.init))
      ) {
        const name = path.node.id.name;
        const codeSnippet = generate(path.node).code;
        graphStore.addNode(name, {
          name,
          type: 'function',
          filePath,
          location: {
            start: {
              line: path.node.loc?.start.line || 0,
              column: path.node.loc?.start.column || 0,
            },
            end: {
              line: path.node.loc?.end.line || 0,
              column: path.node.loc?.end.column || 0,
            },
          },
          codeSnippet,
        });
        currentFunction = name;
      }
    },

    // --- JSX ELEMENTS ---
    JSXElement: {
      enter(path: any) {
        const opening = path.node.openingElement;
        const tagName = t.isJSXIdentifier(opening.name)
          ? opening.name.name
          : null;
        if (!tagName) return;

        // Create unique ID: fileName_line_col
        const line = path.node.loc?.start.line || 0;
        const col = path.node.loc?.start.column || 0;
        const elementId = `${fileName}_${line}_${col}`;

        // Extract props from JSX attributes
        const props: Record<string, any> = {};
        for (const attr of opening.attributes) {
          if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name)) {
            const propName = attr.name.name;
            if (t.isStringLiteral(attr.value)) {
              props[propName] = attr.value.value;
            } else if (t.isJSXExpressionContainer(attr.value)) {
              const expr = attr.value.expression;
              if (t.isIdentifier(expr)) {
                props[propName] = `{${expr.name}}`;
              } else {
                props[propName] = generate(expr).code;
              }
            }
          }
        }

        // Generate code snippet for this JSX element
        const codeSnippet = generate(path.node).code;

        // Add node for this JSX element instance
        graphStore.addNode(elementId, {
          name: tagName,
          type: 'element',
          filePath,
          location: {
            start: {
              line: path.node.loc?.start.line || 0,
              column: path.node.loc?.start.column || 0,
            },
            end: {
              line: path.node.loc?.end.line || 0,
              column: path.node.loc?.end.column || 0,
            },
          },
          codeSnippet,
          props,
        });

        // Set current JSX element context
        currentJSXElement = elementId;

        // Find the parent component/function that contains this JSX
        const parentFunc = path.getFunctionParent();
        let parentComponentName: string | null = null;

        if (parentFunc) {
          // Check if it's a function declaration with an id
          if (t.isFunctionDeclaration(parentFunc.node) && parentFunc.node.id) {
            parentComponentName = parentFunc.node.id.name;
          }
          // Check if it's a variable declarator (arrow function or function expression)
          else if (parentFunc.parentPath?.isVariableDeclarator()) {
            const declarator = parentFunc.parentPath.node;
            if (t.isIdentifier(declarator.id)) {
              parentComponentName = declarator.id.name;
            }
          }
        }

        // If this JSX is directly inside a component/function, create "contains" edge
        if (parentComponentName) {
          // Find the immediate parent JSX element (if any)
          const parentJSX = path.findParent((p: any) => p.isJSXElement());
          
          if (parentJSX) {
            // This JSX has a parent JSX element - create contains edge from parent to this
            const parentLine = parentJSX.node.loc?.start.line || 0;
            const parentCol = parentJSX.node.loc?.start.column || 0;
            const parentElementId = `${fileName}_${parentLine}_${parentCol}`;
            
            graphStore.addEdge("contains", parentElementId, elementId);
          } else {
            // This is a top-level JSX element in the component - directly contained by the component
            graphStore.addEdge("contains", parentComponentName, elementId);
          }
        }

        // Create "renders" edge for React components (capitalized)
        if (parentComponentName && /^[A-Z]/.test(tagName)) {
          graphStore.addEdge("renders", parentComponentName, tagName);
        }

        // --- JSX props like onClick={handleClick} (binds_event edge) ---
        // --- JSX props like src={logo} (uses edge) ---
        for (const attr of opening.attributes) {
          if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name)) {
            const attrName = attr.name.name;
            
            // Event handlers (onClick, onChange, etc.)
            if (attrName.startsWith("on") && t.isJSXExpressionContainer(attr.value)) {
              const expr = attr.value.expression;
              if (t.isIdentifier(expr)) {
                const handler = expr.name;
                graphStore.addEdge("binds_event", elementId, handler);
              }
            }
            
            // Resource dependencies (src, href, etc.)
            else if (["src", "href", "poster", "data"].includes(attrName)) {
              // Handle string literals: src="./image.png"
              if (t.isStringLiteral(attr.value)) {
                const resource = attr.value.value;
                graphStore.addEdge("references", elementId, resource);
              }
              // Handle expressions: src={logo}
              else if (t.isJSXExpressionContainer(attr.value)) {
                const expr = attr.value.expression;
                if (t.isIdentifier(expr)) {
                  const resource = expr.name;
                  graphStore.addEdge("references", elementId, resource);
                }
              }
            }
          }
        }
      },
      exit() {
        // Reset current JSX element when exiting
        currentJSXElement = null;
      }
    },

    // --- CALL EXPRESSIONS (calls edge) ---
    CallExpression(path: any) {
      const callee = path.node.callee;
      if (t.isIdentifier(callee)) {
        const calledName = callee.name;
        
        // Determine the caller: prefer JSX element context, fall back to function context
        const caller = currentJSXElement || currentFunction;
        
        if (caller) {
          graphStore.addEdge("calls", caller, calledName);
        }
      }
    },
  });

  visualizeGraph(graphStore.graph);
}
