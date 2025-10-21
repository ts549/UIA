{ \
  "plan": [ \
    { \
      "file": "src/components/Card.tsx", \
      "action": "modify", \
      "reason": "To add hover color change behavior", \
      "target_range": { "start": 10, "end": 20 }, \
      "changes": [ \
        { \
          "old": "<div className='card'>", \
          "new": "<div className='card hover:bg-blue-500'>" \
        } \
      ] \
    } \
  ], \
  "confidence": 0.92, \
  "explanation": "The main element is a div that represents a card. The user wants hover behavior; this can be added via a CSS hover class." \
}
