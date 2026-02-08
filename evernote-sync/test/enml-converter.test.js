import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createConverter, buildFrontmatter } from '../src/enml-converter.js';

describe('ENML Converter', () => {
  it('should strip XML declaration and DOCTYPE', () => {
    const { convert } = createConverter();
    const enml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE en-note SYSTEM "http://xml.evernote.com/pub/enml2.dtd">
<en-note><p>Hello world</p></en-note>`;
    const md = convert(enml);
    assert.ok(!md.includes('<?xml'));
    assert.ok(!md.includes('DOCTYPE'));
    assert.ok(md.includes('Hello world'));
  });

  it('should unwrap en-note root element', () => {
    const { convert } = createConverter();
    const enml = '<en-note><p>Content here</p></en-note>';
    const md = convert(enml);
    assert.ok(!md.includes('en-note'));
    assert.ok(md.includes('Content here'));
  });

  it('should convert headings', () => {
    const { convert } = createConverter();
    const enml = '<en-note><h1>Title</h1><h2>Subtitle</h2><p>Text</p></en-note>';
    const md = convert(enml);
    assert.ok(md.includes('# Title'));
    assert.ok(md.includes('## Subtitle'));
    assert.ok(md.includes('Text'));
  });

  it('should convert bold and italic', () => {
    const { convert } = createConverter();
    const enml = '<en-note><p><b>bold</b> and <i>italic</i></p></en-note>';
    const md = convert(enml);
    assert.ok(md.includes('**bold**'));
    assert.ok(md.includes('*italic*'));
  });

  it('should convert links', () => {
    const { convert } = createConverter();
    const enml = '<en-note><p><a href="https://example.com">Click here</a></p></en-note>';
    const md = convert(enml);
    assert.ok(md.includes('[Click here](https://example.com)'));
  });

  it('should convert unordered lists', () => {
    const { convert } = createConverter();
    const enml = '<en-note><ul><li>one</li><li>two</li><li>three</li></ul></en-note>';
    const md = convert(enml);
    // Turndown may use variable spacing; just check for marker and content
    assert.ok(md.includes('one'));
    assert.ok(md.includes('two'));
    assert.ok(md.includes('three'));
    // Verify it uses - as bullet marker
    assert.ok(/^-\s+one/m.test(md));
  });

  it('should convert ordered lists', () => {
    const { convert } = createConverter();
    const enml = '<en-note><ol><li>first</li><li>second</li></ol></en-note>';
    const md = convert(enml);
    assert.ok(md.includes('1.'));
    assert.ok(md.includes('first'));
    assert.ok(md.includes('second'));
  });

  it('should convert horizontal rules', () => {
    const { convert } = createConverter();
    const enml = '<en-note><p>above</p><hr/><p>below</p></en-note>';
    const md = convert(enml);
    assert.ok(md.includes('---'));
  });

  it('should convert en-todo unchecked', () => {
    const { convert } = createConverter();
    const enml = '<en-note><div><en-todo checked="false"/>Task one</div></en-note>';
    const md = convert(enml);
    assert.ok(md.includes('- [ ]'), `Expected "- [ ]" in: ${md}`);
    assert.ok(md.includes('Task one'));
  });

  it('should convert en-todo checked', () => {
    const { convert } = createConverter();
    const enml = '<en-note><div><en-todo checked="true"/>Done task</div></en-note>';
    const md = convert(enml);
    assert.ok(md.includes('- [x]'), `Expected "- [x]" in: ${md}`);
    assert.ok(md.includes('Done task'));
  });

  it('should handle self-closing en-todo tags', () => {
    const { convert } = createConverter();
    const enml = '<en-note><div><en-todo checked="false"/>Item</div></en-note>';
    const md = convert(enml);
    assert.ok(md.includes('- [ ]'), `Expected "- [ ]" in: ${md}`);
  });

  it('should convert en-crypt to placeholder', () => {
    const { convert } = createConverter();
    const enml = '<en-note><p>Before</p><en-crypt>secret data</en-crypt><p>After</p></en-note>';
    const md = convert(enml);
    assert.ok(md.includes('[encrypted content]'));
    assert.ok(!md.includes('secret data'));
  });

  it('should resolve en-media as image for image types', () => {
    const resourceMap = new Map([
      ['abc123', { filename: 'photo.png', mime: 'image/png' }],
    ]);
    const { convert } = createConverter({ resourceMap });
    const enml = '<en-note><en-media hash="abc123" type="image/png"/></en-note>';
    const md = convert(enml);
    assert.ok(md.includes('![photo.png](attachments/photo.png)'), `Expected image link in: ${md}`);
  });

  it('should resolve en-media as link for non-image types', () => {
    const resourceMap = new Map([
      ['def456', { filename: 'report.pdf', mime: 'application/pdf' }],
    ]);
    const { convert } = createConverter({ resourceMap });
    const enml = '<en-note><en-media hash="def456" type="application/pdf"/></en-note>';
    const md = convert(enml);
    assert.ok(md.includes('[report.pdf](attachments/report.pdf)'), `Expected link in: ${md}`);
  });

  it('should render audio resources as voice notes', () => {
    const resourceMap = new Map([
      ['audio1', { filename: 'recording.m4a', mime: 'audio/x-m4a' }],
    ]);
    const { convert } = createConverter({ resourceMap });
    const enml = '<en-note><en-media hash="audio1" type="audio/x-m4a"/></en-note>';
    const md = convert(enml);
    assert.ok(md.includes('Voice Note'), `Expected voice note label in: ${md}`);
    assert.ok(md.includes('[recording.m4a](attachments/recording.m4a)'), `Expected audio link in: ${md}`);
  });

  it('should include transcript for audio resources when available', () => {
    const resourceMap = new Map([
      ['audio2', { filename: 'memo.mp3', mime: 'audio/mpeg', transcript: 'Hello this is a test recording' }],
    ]);
    const { convert } = createConverter({ resourceMap });
    const enml = '<en-note><en-media hash="audio2" type="audio/mpeg"/></en-note>';
    const md = convert(enml);
    assert.ok(md.includes('Voice Note'), 'has voice note label');
    assert.ok(md.includes('memo.mp3'), 'has audio filename');
    assert.ok(md.includes('Transcript'), 'has transcript label');
    assert.ok(md.includes('Hello this is a test recording'), 'has transcript text');
  });

  it('should handle missing resource gracefully', () => {
    const { convert } = createConverter();
    const enml = '<en-note><en-media hash="unknown" type="image/jpeg"/></en-note>';
    const md = convert(enml);
    assert.ok(md.includes('missing attachment'));
  });

  it('should collapse excessive blank lines', () => {
    const { convert } = createConverter();
    const enml = '<en-note><p>One</p><div></div><div></div><div></div><p>Two</p></en-note>';
    const md = convert(enml);
    // Should not have 3+ consecutive newlines
    assert.ok(!md.match(/\n{3,}/));
  });

  it('should handle complex mixed content', () => {
    const resourceMap = new Map([
      ['img1', { filename: 'diagram.png', mime: 'image/png' }],
    ]);
    const { convert } = createConverter({ resourceMap });
    const enml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE en-note SYSTEM "http://xml.evernote.com/pub/enml2.dtd">
<en-note>
  <h1>Meeting Notes</h1>
  <p>Date: 2024-03-15</p>
  <h2>Agenda</h2>
  <ul>
    <li>Review Q1 results</li>
    <li>Plan Q2 goals</li>
  </ul>
  <h2>Action Items</h2>
  <div><en-todo checked="false"/>Send follow-up email</div>
  <div><en-todo checked="true"/>Update spreadsheet</div>
  <p>See the attached diagram:</p>
  <en-media hash="img1" type="image/png"/>
  <hr/>
  <p><b>Next meeting:</b> <i>March 22</i></p>
</en-note>`;
    const md = convert(enml);
    assert.ok(md.includes('# Meeting Notes'), 'has heading');
    assert.ok(md.includes('## Agenda'), 'has subheading');
    assert.ok(md.includes('Review Q1 results'), 'has list item');
    assert.ok(md.includes('- [ ]'), 'has unchecked todo');
    assert.ok(md.includes('Send follow-up email'), 'has todo text');
    assert.ok(md.includes('- [x]'), 'has checked todo');
    assert.ok(md.includes('Update spreadsheet'), 'has checked todo text');
    assert.ok(md.includes('![diagram.png](attachments/diagram.png)'), 'has image');
    assert.ok(md.includes('---'), 'has hr');
    assert.ok(md.includes('**Next meeting:**'), 'has bold');
    assert.ok(md.includes('*March 22*'), 'has italic');
  });
});

describe('buildFrontmatter', () => {
  it('should produce valid YAML frontmatter', () => {
    const fm = buildFrontmatter({
      title: 'My Note',
      created: '2023-06-15T10:30:00Z',
      updated: '2024-01-20T14:22:00Z',
      tags: ['project-x', 'meeting'],
      sourceUrl: 'https://evernote.com/shard/s1/note/abc',
      guid: 'abc123-def456',
    });

    assert.ok(fm.startsWith('---'));
    assert.ok(fm.endsWith('---'));
    assert.ok(fm.includes('title: "My Note"'));
    assert.ok(fm.includes('date-created: 2023-06-15T10:30:00Z'));
    assert.ok(fm.includes('date-modified: 2024-01-20T14:22:00Z'));
    assert.ok(fm.includes('tags: ["project-x", "meeting"]'));
    assert.ok(fm.includes('source_url: "https://evernote.com/shard/s1/note/abc"'));
    assert.ok(fm.includes('evernote_guid: "abc123-def456"'));
  });

  it('should omit tags if empty', () => {
    const fm = buildFrontmatter({
      title: 'No Tags',
      created: '2023-01-01T00:00:00Z',
      updated: '2023-01-01T00:00:00Z',
      tags: [],
      guid: 'guid-1',
    });
    assert.ok(!fm.includes('tags:'));
  });

  it('should omit source_url if empty', () => {
    const fm = buildFrontmatter({
      title: 'No URL',
      created: '2023-01-01T00:00:00Z',
      updated: '2023-01-01T00:00:00Z',
      tags: [],
      sourceUrl: '',
      guid: 'guid-2',
    });
    assert.ok(!fm.includes('source_url:'));
  });

  it('should escape special characters in title', () => {
    const fm = buildFrontmatter({
      title: 'Note with "quotes" and: colons',
      created: '2023-01-01T00:00:00Z',
      updated: '2023-01-01T00:00:00Z',
      tags: [],
      guid: 'guid-3',
    });
    assert.ok(fm.includes('title:'));
    assert.ok(fm.includes('\\"quotes\\"'));
  });
});
