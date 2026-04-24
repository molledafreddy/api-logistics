/**
 * Custom require hook that strips .js extensions when resolving .ts files.
 * This solves the issue with TypeORM CLI + ts-node + nodenext module resolution,
 * where source files import with .js extension but only .ts files exist.
 */
const Module = require('module');
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function (request, parent, isMain, options) {
  // If the request ends with .js, try .ts first
  if (request.endsWith('.js')) {
    try {
      return originalResolveFilename.call(this, request.replace(/\.js$/, '.ts'), parent, isMain, options);
    } catch {
      // Fallback to original .js resolution
    }
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};
