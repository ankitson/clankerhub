/**
 * TO-DONE: AI-Powered Task Manager
 *
 * Main entry point - exports all public APIs
 */

// Core types
export * from './types/index.js';

// Agent
export * from './agent/index.js';

// Skills
export * from './skills/index.js';

// Store
export * from './store/index.js';

// CLI
export { ToDoneCLI, main } from './cli/index.js';

// Run CLI if executed directly
import { main } from './cli/index.js';

// Check if this is the main module
const isMain = process.argv[1]?.includes('index') ||
               process.argv[1]?.endsWith('todone');

if (isMain) {
  main();
}
