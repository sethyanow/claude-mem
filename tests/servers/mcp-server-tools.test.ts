import { describe, it, expect } from 'bun:test';
import { tools } from '../../src/servers/mcp-server.js';

const EXPECTED_TOOLS = [
  'search',
  'timeline',
  'get_observations',
  'smart_search',
  'smart_unfold',
  'smart_outline',
] as const;

describe('MCP tool listing', () => {
  it('does not include __IMPORTANT tool', () => {
    const names = tools.map(t => t.name);
    expect(names).not.toContain('__IMPORTANT');
  });

  it('has exactly 6 tools', () => {
    expect(tools).toHaveLength(6);
  });

  it('contains all expected tool names', () => {
    const names = tools.map(t => t.name);
    for (const expected of EXPECTED_TOOLS) {
      expect(names).toContain(expected);
    }
  });
});

const findTool = (name: string) => tools.find(t => t.name === name)!;

describe('search tool schema', () => {
  const SEARCH_PARAMS = [
    'query', 'limit', 'project', 'type', 'obs_type',
    'dateStart', 'dateEnd', 'offset', 'orderBy',
  ];

  it('has explicit properties for all 9 params', () => {
    const search = findTool('search');
    const props = Object.keys(search.inputSchema.properties || {});
    for (const param of SEARCH_PARAMS) {
      expect(props).toContain(param);
    }
  });

  it('each property has type and description', () => {
    const search = findTool('search');
    const props = search.inputSchema.properties || {};
    for (const param of SEARCH_PARAMS) {
      const prop = (props as any)[param];
      expect(prop).toBeDefined();
      expect(prop.type).toBeDefined();
      expect(prop.description).toBeDefined();
    }
  });

  it('does not have additionalProperties: true', () => {
    const search = findTool('search');
    expect(search.inputSchema.additionalProperties).not.toBe(true);
  });
});

describe('timeline tool schema', () => {
  const TIMELINE_PARAMS = [
    'anchor', 'query', 'depth_before', 'depth_after', 'project',
  ];

  it('has explicit properties for all 5 params', () => {
    const timeline = findTool('timeline');
    const props = Object.keys(timeline.inputSchema.properties || {});
    for (const param of TIMELINE_PARAMS) {
      expect(props).toContain(param);
    }
  });

  it('each property has type and description', () => {
    const timeline = findTool('timeline');
    const props = timeline.inputSchema.properties || {};
    for (const param of TIMELINE_PARAMS) {
      const prop = (props as any)[param];
      expect(prop).toBeDefined();
      expect(prop.type).toBeDefined();
      expect(prop.description).toBeDefined();
    }
  });

  it('does not have additionalProperties: true', () => {
    const timeline = findTool('timeline');
    expect(timeline.inputSchema.additionalProperties).not.toBe(true);
  });
});

describe('get_observations schema', () => {
  it('does not have additionalProperties: true', () => {
    const getObs = findTool('get_observations');
    expect(getObs.inputSchema.additionalProperties).not.toBe(true);
  });

  it('still requires ids array', () => {
    const getObs = findTool('get_observations');
    expect(getObs.inputSchema.required).toContain('ids');
    const ids = (getObs.inputSchema.properties as any)?.ids;
    expect(ids).toBeDefined();
    expect(ids.type).toBe('array');
  });

  it('has explicit orderBy property with enum values', () => {
    const getObs = findTool('get_observations');
    const orderBy = (getObs.inputSchema.properties as any)?.orderBy;
    expect(orderBy).toBeDefined();
    expect(orderBy.type).toBe('string');
    expect(orderBy.enum).toEqual(['date_desc', 'date_asc']);
  });

  it('has explicit limit property', () => {
    const getObs = findTool('get_observations');
    const limit = (getObs.inputSchema.properties as any)?.limit;
    expect(limit).toBeDefined();
    expect(limit.type).toBe('integer');
  });

  it('has explicit project property', () => {
    const getObs = findTool('get_observations');
    const project = (getObs.inputSchema.properties as any)?.project;
    expect(project).toBeDefined();
    expect(project.type).toBe('string');
  });
});

describe('smart_* tool descriptions', () => {
  it('smart_search positions as fallback, not primary', () => {
    const tool = findTool('smart_search');
    const desc = tool.description.toLowerCase();
    // Must explicitly mention fallback positioning — "structural" alone
    // is insufficient (current desc has "structural views" in different context)
    expect(desc).toContain('fallback');
  });

  it('smart_unfold does not position as primary code navigation', () => {
    const tool = findTool('smart_unfold');
    const desc = tool.description.toLowerCase();
    expect(desc).not.toContain('code navigation');
  });

  it('smart_outline frames as lightweight', () => {
    const tool = findTool('smart_outline');
    const desc = tool.description.toLowerCase();
    // Must explicitly say "lightweight" — "cheaper" alone already exists
    // in current desc but doesn't convey the fallback positioning
    expect(desc).toContain('lightweight');
  });
});
