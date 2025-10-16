import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { startDomObservation } from "../indexer/observe";

interface InspectorProps {
  children: React.ReactNode;
}

export default function Inspector({ children }: InspectorProps) {
  const [hoverEl, setHoverEl] = useState<HTMLElement | null>(null);
  const [clickEl, setClickEl] = useState<HTMLElement | null>(null);
  const [question, setQuestion] = useState<string>("");
  const [fingerprintData, setFingerprintData] = useState<any>(null);
  const lockRef = React.useRef(false);
  const popupRef = React.useRef<HTMLElement | null>(null);
  const [enabled, setEnabled] = useState<boolean>(false);

  // Start observing the DOM tree for fingerprinting
  // useEffect(() => {
  //   startDomObservation((el, fp) => {
  //     console.log("Observed element:", el.tagName, fp);
  //   });
  // }, []);

  // Keep lockRef in sync with clickEl without re-registering listeners
  useEffect(() => {
    lockRef.current = !!clickEl;
  }, [clickEl]);

  useEffect(() => {
    const handleMouseOver = (e: MouseEvent) => {
      // if an element is clicked (locked), ignore hover changes
      if (lockRef.current) return;
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;

      // ignore hovering over inspector UI elements (buttons, popup)
      if (target.closest('[data-inspector-ui="true"]')) return;

      e.stopPropagation();
      setHoverEl(target);
    };

    const handleClick = async (e: MouseEvent) => {
      const target = e.target;
      // prefer not to change behaviour for non-HTMLElements
      if (!(target instanceof HTMLElement)) return;

      // ignore clicks on inspector UI so buttons keep working
      if (target.closest('[data-inspector-ui="true"]')) return;

      // Get fingerprint from data-fingerprint attribute
      const fp = target.getAttribute('data-fingerprint');
      if (fp) console.log("Clicked element fingerprint:", fp);

      e.preventDefault();
      e.stopPropagation();

      // if nothing is locked, lock the clicked element
      if (!lockRef.current) {
        setClickEl(target);
        lockRef.current = true;

        // Fetch fingerprint data from backend
        if (fp) {
          try {
            const response = await fetch(`http://localhost:3001/api/fingerprint/${fp}`);
            if (response.ok) {
              const data = await response.json();
              setFingerprintData(data);
              console.log("Fingerprint data:", data);
            } else {
              console.error("Failed to fetch fingerprint data");
              setFingerprintData(null);
            }
          } catch (error) {
            console.error("Error fetching fingerprint data:", error);
            setFingerprintData(null);
          }
        } else {
          setFingerprintData(null);
        }

        return;
      }

      // If a popup is present, only clear the lock when clicking outside the popup.
      const popupNode = popupRef.current;
      if (popupNode) {
        if (!popupNode.contains(target)) {
          setClickEl(null);
          lockRef.current = false;
          setFingerprintData(null);
        }
        return;
      }

      // Fallback: if no popup node, clear when clicking outside the clicked element
      if (clickEl && !clickEl.contains(target)) {
        setClickEl(null);
        lockRef.current = false;
        setFingerprintData(null);
      }
    };

    if (enabled) {
      document.addEventListener("mouseover", handleMouseOver, true);
      document.addEventListener("click", handleClick, true);
    }

    return () => {
      if (enabled) {
        document.removeEventListener("mouseover", handleMouseOver, true);
        document.removeEventListener("click", handleClick, true);
      }
    };
  }, [clickEl, enabled]);

  // compute highlight from the clicked element (if locked) or the hovered element
  const getRect = (el: HTMLElement | null) =>
  el && typeof el.getBoundingClientRect === "function" ?
  el.getBoundingClientRect() :
  null;

  const highlight = getRect(clickEl ?? hoverEl);
  const clickRect = getRect(clickEl);

  // When disabled, clear any hover/click state and lock
  useEffect(() => {
    if (!enabled) {
      setHoverEl(null);
      setClickEl(null);
      lockRef.current = false;
    }
  }, [enabled]);


  return (
    <>
      {children}

      {/* Absolute button inside the component that activates the inspector's highlight/popup */}
      <button
        data-inspector-ui="true"
        onClick={() => setEnabled(!enabled)}
        style={{
          position: "absolute",
          bottom: 12,
          right: 12,
          zIndex: 20000,
          padding: "6px 10px",
          borderRadius: 6,
          border: "none",
          background: enabled ? "#0b8" : "#08f",
          color: "white",
          cursor: "pointer"
        }}>
        
        Activate Inspector
      </button>

      {/* Highlight overlay */}
      {enabled && highlight &&
      ReactDOM.createPortal(
        <div
          id="overlay"
          style={{
            position: "fixed",
            top: highlight.top + window.scrollY,
            left: highlight.left + window.scrollX,
            width: highlight.width,
            height: highlight.height,
            border: "2px solid red",
            background: "rgba(255, 0, 0, 0.1)",
            pointerEvents: "none",
            zIndex: 9999
          }} />,

        document.body
      )}

      {/* Click popup */}
      {enabled && clickEl &&
      ReactDOM.createPortal(
        <div
          id="popup"
          data-inspector-ui="true"
          ref={(el: HTMLDivElement | null): void => {
            popupRef.current = el;
            return;
          }}
          style={{
            position: "fixed",
            top: ((clickRect && clickRect.bottom) ?? 0) + window.scrollY + 5,
            left: ((clickRect && clickRect.left) ?? 0) + window.scrollX,
            background: "white",
            border: "1px solid #ccc",
            borderRadius: "8px",
            padding: "8px",
            zIndex: 10000,
            boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
            minWidth: "250px"
          }}>
          
            {fingerprintData &&
          <div style={{ marginBottom: "8px", fontSize: "12px", color: "#666" }}>
                <div><strong>File:</strong> {fingerprintData.file}</div>
                <div><strong>Element:</strong> {fingerprintData.elementName}</div>
                <div><strong>Line:</strong> {fingerprintData.line}, <strong>Column:</strong> {fingerprintData.column}</div>
              </div>
          }
          
            <textarea
            placeholder="Ask a question about this element..."
            value={question || (fingerprintData ? `Element: ${fingerprintData.elementName}\nFile: ${fingerprintData.file}\nLine: ${fingerprintData.line}, Column: ${fingerprintData.column}` : "")}
            onChange={(e) => setQuestion(e.target.value)}
            style={{ width: "100%", height: "80px", fontSize: "12px" }} />
          
            <button
            onClick={() => {
              console.log("Submit:", question, clickEl, fingerprintData);
              setClickEl(null);
              setQuestion("");
              setFingerprintData(null);
            }}
            style={{
              display: "block",
              marginTop: "4px",
              padding: "4px 8px",
              borderRadius: "4px",
              border: "none",
              background: "#007bff",
              color: "white",
              cursor: "pointer"
            }}>
            
              Submit
            </button>
          </div>,
        document.body
      )}
    </>);

}