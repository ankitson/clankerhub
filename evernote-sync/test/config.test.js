import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

describe('Config', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore environment
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  it('should throw if EVERNOTE_AUTH_TOKEN is missing', async () => {
    delete process.env.EVERNOTE_AUTH_TOKEN;
    // Dynamic import to get fresh module state
    const { loadConfig } = await import('../src/config.js');
    assert.throws(() => loadConfig('/dev/null'), /EVERNOTE_AUTH_TOKEN/);
  });

  it('should extract shard from auth token', async () => {
    process.env.EVERNOTE_AUTH_TOKEN = 'S=s123:U=abc:E=def:C=ghi:P=jkl:A=mno:V=2:H=pqr';
    const { loadConfig } = await import('../src/config.js');
    const config = loadConfig('/dev/null');
    assert.ok(config.noteStoreUrl.includes('s123'));
  });

  it('should parse include/exclude notebooks', async () => {
    process.env.EVERNOTE_AUTH_TOKEN = 'S=s1:U=a:E=b:C=c:P=d:A=e:V=2:H=f';
    process.env.SYNC_INCLUDE_NOTEBOOKS = 'Work,Personal';
    process.env.SYNC_EXCLUDE_NOTEBOOKS = 'Trash,Archive';
    const { loadConfig } = await import('../src/config.js');
    const config = loadConfig('/dev/null');
    assert.deepEqual(config.includeNotebooks, ['Work', 'Personal']);
    assert.deepEqual(config.excludeNotebooks, ['Trash', 'Archive']);
  });

  it('should default to production when EVERNOTE_SANDBOX is not set', async () => {
    process.env.EVERNOTE_AUTH_TOKEN = 'S=s1:U=a:E=b:C=c:P=d:A=e:V=2:H=f';
    delete process.env.EVERNOTE_SANDBOX;
    const { loadConfig } = await import('../src/config.js');
    const config = loadConfig('/dev/null');
    assert.equal(config.sandbox, false);
    assert.equal(config.serviceHost, 'www.evernote.com');
  });

  it('should use sandbox when EVERNOTE_SANDBOX=true', async () => {
    process.env.EVERNOTE_AUTH_TOKEN = 'S=s1:U=a:E=b:C=c:P=d:A=e:V=2:H=f';
    process.env.EVERNOTE_SANDBOX = 'true';
    const { loadConfig } = await import('../src/config.js');
    const config = loadConfig('/dev/null');
    assert.equal(config.sandbox, true);
    assert.equal(config.serviceHost, 'sandbox.evernote.com');
  });
});
