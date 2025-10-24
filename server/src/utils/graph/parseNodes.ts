// buildGraphFromFile.ts
import fs from "fs";
import { parse } from "@babel/parser";
import _traverse from '@babel/traverse';
import _generate from '@babel/generator';
import * as t from "@babel/types";
import { graphStore } from "./graphStore.ts";
import generateFingerprintId from "../fingerprints/generateFingerprintId.ts";

const traverse = (_traverse as any).default || _traverse;
const generate = (_generate as any).default || _generate;

/**
 * Extract original source code from file based on location
 */
function getOriginalCode(code: string, startLine: number, startColumn: number, endLine: number, endColumn: number): string {
  const lines = code.split('\n');
  
  if (startLine === endLine) {
    // Single line
    return lines[startLine - 1].substring(startColumn, endColumn);
  } else {
    // Multiple lines
    const firstLine = lines[startLine - 1].substring(startColumn);
    const middleLines = lines.slice(startLine, endLine - 1);
    const lastLine = lines[endLine - 1].substring(0, endColumn);
    
    return [firstLine, ...middleLines, lastLine].join('\n');
  }
}

function createNodeFromFunction(path: any, filePath: string, fileCode: string) {
  const name = path.node.id?.name;
  if (name) {
    const line = path.node.loc?.start.line;
    const col = path.node.loc?.start.column;
    const endLine = path.node.loc?.end.line;
    const endCol = path.node.loc?.end.column;
    
    // Generate fingerprint ID if location is available, otherwise use name
    const nodeId = (line !== undefined && col !== undefined)
      ? generateFingerprintId(filePath, line, col)
      : name;

    // Get original code snippet from source
    const codeSnippet = (line !== undefined && col !== undefined && endLine !== undefined && endCol !== undefined)
      ? getOriginalCode(fileCode, line, col, endLine, endCol)
      : generate(path.node).code;
    
    graphStore.addNode(nodeId, {
      name,
      type: 'function',
      filePath,
      location: {
        start: {
          line: line || 0,
          column: col || 0,
        },
        end: {
          line: endLine || 0,
          column: endCol || 0,
        },
      },
      codeSnippet,
    });
    return nodeId;
  }

  return null;
}

export function parseNodes(filePath: string) {
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
    // --- FUNCTION NODES ---
    FunctionDeclaration(path: any) {
      const nodeId = createNodeFromFunction(path, filePath, code);
      if (nodeId) currentFunction = nodeId;
    },

    // --- COMPONENT FUNCTION NODES ---
    VariableDeclarator(path: any) {
      if (
        t.isIdentifier(path.node.id) &&
        (t.isArrowFunctionExpression(path.node.init) ||
          t.isFunctionExpression(path.node.init))
      ) {
        const nodeId = createNodeFromFunction(path, filePath, code);
        if (nodeId) currentFunction = nodeId;
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

        // Create unique ID using fingerprint
        const line = path.node.loc?.start.line;
        const col = path.node.loc?.start.column;
        const elementId = (line !== undefined && col !== undefined)
          ? generateFingerprintId(filePath, line, col)
          : `${fileName}_${Math.random().toString(36).substr(2, 9)}`;

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

        // Get original code snippet from source
        const endLine = path.node.loc?.end.line;
        const endCol = path.node.loc?.end.column;
        const codeSnippet = (line !== undefined && col !== undefined && endLine !== undefined && endCol !== undefined)
          ? getOriginalCode(code, line, col, endLine, endCol)
          : generate(path.node).code;

        // Add node for this JSX element instance
        graphStore.addNode(elementId, {
          name: tagName,
          type: 'element',
          filePath,
          location: {
            start: {
              line: line || 0,
              column: col || 0,
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
        let parentComponentId: string | null = null;

        if (parentFunc) {
          const parentLine = parentFunc.node.loc?.start.line;
          const parentCol = parentFunc.node.loc?.start.column;

          // Generate parent function ID using fingerprint
          if (parentLine !== undefined && parentCol !== undefined) {
            parentComponentId = generateFingerprintId(filePath, parentLine, parentCol);
          }
          // Fallback to name if location not available
          else if (t.isFunctionDeclaration(parentFunc.node) && parentFunc.node.id) {
            parentComponentId = parentFunc.node.id.name;
          }
          else if (parentFunc.parentPath?.isVariableDeclarator()) {
            const declarator = parentFunc.parentPath.node;
            if (t.isIdentifier(declarator.id)) {
              parentComponentId = declarator.id.name;
            }
          }
        }

        // If this JSX is directly inside a component/function, create "contains" edge
        if (parentComponentId) {
          // Find the immediate parent JSX element (if any)
          const parentJSX = path.findParent((p: any) => p.isJSXElement());
          
          if (parentJSX) {
            // This JSX has a parent JSX element - create contains edge from parent to this
            const parentLine = parentJSX.node.loc?.start.line;
            const parentCol = parentJSX.node.loc?.start.column;
            const parentElementId = (parentLine !== undefined && parentCol !== undefined)
              ? generateFingerprintId(filePath, parentLine, parentCol)
              : `${fileName}_${Math.random().toString(36).substr(2, 9)}`;
            
            graphStore.addEdge("contains", parentElementId, elementId);
          } else {
            // This is a top-level JSX element in the component - directly contained by the component
            graphStore.addEdge("contains", parentComponentId, elementId);
          }
        }

        // Create "renders" edge for React components (capitalized)
        if (parentComponentId && /^[A-Z]/.test(tagName)) {
          graphStore.addEdge("renders", parentComponentId, tagName);
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

  graphStore.visualize();
}
