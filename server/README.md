# UIA Server

Express server for the UIA (UI Automation) system.

## Setup

```bash
npm install
```

## Run

Development mode (with auto-restart):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

Server runs on http://localhost:3001 by default.

## API Endpoints

- `GET /api/health` - Health check endpoint
- `GET /api/elements` - Get all elements
- `POST /api/elements` - Add new element
