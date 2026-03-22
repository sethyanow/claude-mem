/**
 * Tests that SessionStore delegates CRUD and query operations to extracted sub-modules
 * rather than implementing them inline with raw SQL.
 *
 * RED: SessionStore currently has ~35 methods with inline SQL.
 * GREEN: SessionStore will delegate to observations/, summaries/, sessions/, timeline/, prompts/.
 */

import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('SessionStore CRUD delegation', () => {
  // Read SessionStore source to check structural properties
  const sessionStorePath = join(__dirname, '../../src/services/sqlite/SessionStore.ts');
  const source = readFileSync(sessionStorePath, 'utf-8');

  it('should have no .prepare() calls outside constructor and close', () => {
    const lines = source.split('\n');
    const violations: string[] = [];

    let inConstructor = false;
    let braceDepth = 0;
    let constructorBraceDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Track constructor boundaries
      if (line.includes('constructor(')) {
        inConstructor = true;
        constructorBraceDepth = braceDepth;
      }

      // Count braces for scope tracking
      for (const ch of line) {
        if (ch === '{') braceDepth++;
        if (ch === '}') {
          braceDepth--;
          if (inConstructor && braceDepth === constructorBraceDepth) {
            inConstructor = false;
          }
        }
      }

      // Skip constructor body, close() method, and import lines
      if (inConstructor) continue;
      if (line.trim().startsWith('import ')) continue;
      if (line.trim().startsWith('//')) continue;

      // Check for inline SQL patterns
      if (line.includes('.prepare(') || line.includes('.query(')) {
        // Allow the close() method (single db.close() call)
        if (line.includes('.close()')) continue;
        violations.push(`Line ${lineNum}: ${line.trim()}`);
      }
    }

    expect(violations).toEqual([]);
  });

  it('should import from all extracted sub-modules', () => {
    // After delegation, SessionStore should import from these modules
    const expectedImports = [
      './observations/store.js',
      './observations/get.js',
      './observations/recent.js',
      './observations/files.js',
      './sessions/create.js',
      './sessions/get.js',
      './summaries/store.js',
      './summaries/get.js',
      './summaries/recent.js',
      './timeline/queries.js',
      './prompts/get.js',
      './prompts/store.js',
    ];

    const missingImports = expectedImports.filter(mod => !source.includes(mod));
    expect(missingImports).toEqual([]);
  });
});
