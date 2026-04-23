/**
 * agentsys runtime resolver.
 *
 * Locates the canonical `agentsys/lib` install on the user's machine and
 * exposes its `binary` and `repoIntel` modules. Replaces the per-plugin
 * vendored copies of `lib/binary/` and `lib/repo-map/` that were
 * previously synced from agentsys via agent-core.
 *
 * Why this file exists
 * ====================
 * Every user of this plugin is also a user of agentsys (it's the
 * marketplace + npm distribution entry point). So instead of duplicating
 * the binary downloader and the typed repo-intel query API in every
 * plugin and keeping the copies in sync, each plugin ships this thin
 * resolver and reads from the single agentsys install.
 *
 * Lookup order
 * ============
 * 1. Claude Code marketplace clone:
 *    ~/.claude/plugins/marketplaces/agentsys/lib
 * 2. npm global install (works for OpenCode + Codex CLI users who ran
 *    `npm install -g agentsys` and any Node project that depends on it):
 *    require.resolve('agentsys/lib')
 * 3. Dev fallback for working inside the agent-sh monorepo:
 *    ../../agentsys/lib relative to this file
 *
 * If none resolve, throws an actionable error directing the user to
 * install agentsys via the marketplace or npm.
 *
 * @module lib/agentsys
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

let cachedLibRoot = null;
let cachedModules = null;

/**
 * Resolve the npm global root (`npm root -g` equivalent) without spawning
 * npm. Node exposes it indirectly: `process.execPath` is the node binary,
 * and on most installs `<exec dir>/node_modules` is the global root on
 * Windows, while on Unix it's `<exec prefix>/lib/node_modules`. We check
 * both shapes; whichever exists wins.
 *
 * @returns {string|null}
 */
function npmGlobalRoot() {
  const execDir = path.dirname(process.execPath);
  const candidates = [
    // Windows nvm/standalone layout: node.exe sits next to node_modules/
    path.join(execDir, 'node_modules'),
    // Unix prefix layout: <prefix>/bin/node + <prefix>/lib/node_modules
    path.join(execDir, '..', 'lib', 'node_modules'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'agentsys'))) return c;
  }
  return null;
}

/**
 * Build the platform-specific list of candidate paths to check.
 * Order matters: most-specific first, dev-fallback last.
 *
 * @returns {string[]}
 */
function candidatePaths() {
  const home = os.homedir();
  const candidates = [
    // 1. Claude Code marketplace clone (the most common path for CC users).
    path.join(home, '.claude', 'plugins', 'marketplaces', 'agentsys', 'lib'),
  ];

  // 2. npm global install. Used by OpenCode/Codex CLI users who installed
  // agentsys via `npm install -g agentsys`.
  const globalRoot = npmGlobalRoot();
  if (globalRoot) {
    candidates.push(path.join(globalRoot, 'agentsys', 'lib'));
  }

  // 3. require.resolve - covers project-local installs (agentsys as a
  // direct dep). Falls back gracefully if not resolvable.
  try {
    const pkgPath = require.resolve('agentsys/lib/package.json');
    candidates.push(path.dirname(pkgPath));
  } catch {
    // Not resolvable from here - fine.
  }

  // 4. Dev fallback: this file is at <repo>/lib/agentsys.js, the agentsys
  // sibling repo would be at <parent>/agentsys/lib (when working in the
  // agent-sh monorepo).
  candidates.push(path.resolve(__dirname, '..', '..', 'agentsys', 'lib'));

  return candidates;
}

/**
 * Find the first candidate path that contains a usable agentsys lib.
 * "Usable" means the binary submodule exists - that's the contract this
 * resolver depends on.
 *
 * @returns {string} Absolute path to agentsys/lib
 * @throws {Error} If no candidate path resolves
 */
function findAgentsysLib() {
  if (cachedLibRoot) return cachedLibRoot;

  const tried = candidatePaths();
  for (const candidate of tried) {
    if (fs.existsSync(path.join(candidate, 'binary', 'index.js'))) {
      cachedLibRoot = candidate;
      return candidate;
    }
  }

  throw new Error(
    'agentsys/lib not found. Install agentsys via the marketplace ' +
      '(/plugin marketplace add agent-sh/agentsys) or npm ' +
      '(npm install -g agentsys). Tried:\n  ' +
      tried.join('\n  ')
  );
}

/**
 * Load and return the agentsys lib modules this plugin uses. Cached
 * after first call - require itself caches at the Node level too, but
 * we hold the wrapper object so callers don't pay the path lookup
 * repeatedly.
 *
 * @returns {{libRoot: string, binary: Object, repoIntel: Object}}
 */
function get() {
  if (cachedModules) return cachedModules;

  const libRoot = findAgentsysLib();

  // Defer loading repo-intel - older agentsys installs (< v5.8.6) won't
  // have it, and the resolver should still produce a usable binary in
  // that case so legacy code paths keep working during the migration.
  let repoIntel = null;
  try {
    repoIntel = require(path.join(libRoot, 'repo-intel'));
  } catch (err) {
    if (err.code !== 'MODULE_NOT_FOUND') throw err;
    // Older agentsys without repo-intel module - leave as null. Callers
    // that need typed queries will surface a clearer "upgrade agentsys"
    // error than a deep require failure.
  }

  // Legacy repo-map module (still present in agentsys for now). Provides
  // the file-loading API: exists / load / init / update / checkAstGrepInstalled.
  // Once agentsys collapses repo-map into repo-intel, this slot can go.
  let repoMap = null;
  try {
    repoMap = require(path.join(libRoot, 'repo-map'));
  } catch (err) {
    if (err.code !== 'MODULE_NOT_FOUND') throw err;
  }

  cachedModules = {
    libRoot,
    binary: require(path.join(libRoot, 'binary')),
    repoIntel,
    repoMap,
  };
  return cachedModules;
}

module.exports = {
  get,
  findAgentsysLib,
  // Exposed for tests
  candidatePaths,
};
