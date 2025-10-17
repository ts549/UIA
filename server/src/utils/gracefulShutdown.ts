import type { ChildProcess } from "child_process";
import { stopFrontend } from "./frontend.ts";

// Graceful shutdown handler
async function gracefulShutdown(signal: string, frontendProcess: ChildProcess | null, server: any) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  
  // Stop the frontend process
  if (frontendProcess) {
    console.log('Stopping frontend...');
    await stopFrontend(frontendProcess);
  }
  
  // Close the Express server
  console.log('Stopping Express server...');
  server.close(() => {
    console.log('Express server closed');
    console.log('Goodbye!');
    process.exit(0);
  });
}

export default gracefulShutdown;