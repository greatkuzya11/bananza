const test = require('node:test');
const assert = require('node:assert/strict');
const { createAppDom, loadBrowserScript } = require('../support/domHarness');

function setup(t) {
  const dom = createAppDom();
  t.after(() => dom.window.close());
  loadBrowserScript(dom, 'public/js/app/markdown.js');
  return { document: dom.window.document, markdown: dom.window.BananzaApp.markdown };
}

test('Markdown renders file paths and uses their labels in previews', (t) => {
  const { document, markdown } = setup(t);
  const cases = [
    ['TypeScript-сценарий', '/Users/d.kuzovlev/Documents/AIDD/modules-aqua-services-smoke/catalog/tests/chef/e2e/service-smoke.spec.ts:523'],
    ['E2E-контроллер', '/Users/d.kuzovlev/Documents/AIDD/modules-aqua-services-smoke/catalog/dev/e2e/servicesmoke.php:370'],
    ['Relative', './src/app.js:12'],
    ['Parent', '../README.md'],
    ['Section', '#details'],
    ['Spaced path', '</Users/example/My Project/test (copy).js:12>'],
    ['Parentheses', '/Users/example/test(copy).js:12'],
    ['Website', 'https://example.com/page_(detail)?a=1&b=2'],
    ['Escaping', '</Users/example/a" onmouseover="alert(1).js>'],
  ];
  for (const [label, destination] of cases) {
    const source = `- [${label}](${destination})`;
    const container = document.createElement('div');
    container.innerHTML = markdown.render(source).html;
    const link = container.querySelector('li a');
    assert.ok(link, source);
    assert.equal(link.textContent, label);
    assert.equal(link.getAttribute('href'), destination.replace(/^<|>$/g, ''));
    assert.equal(link.hasAttribute('onmouseover'), false);
    assert.equal(container.textContent, label);
    assert.equal(markdown.toPlainText(source), label);
  }
});

test('Markdown rejects dangerous schemes and leaves code and malformed links literal', (t) => {
  const { document, markdown } = setup(t);
  const cases = [
    '[bad](javascript:alert(1))',
    '[bad](JaVaScRiPt:alert(1))',
    '[bad](<java\tscript:alert(1)>)',
    '[bad](data:text/html,test)',
    '[bad](vbscript:msgbox(1))',
    '[bad](file:///etc/passwd)',
    '[broken](/Users/example/test.js',
    '[broken](</Users/example/test.js)',
    '[broken](/Users/example/My Project/test.js)',
  ];
  for (const source of cases) {
    const container = document.createElement('div');
    container.innerHTML = markdown.render(source).html;
    assert.equal(container.querySelector('a'), null, source);
    assert.equal(container.textContent, source);
  }
  const source = '[file](/Users/example/test.js:12)';
  const container = document.createElement('div');
  container.innerHTML = markdown.render('`' + source + '`\n```\n' + source + '\n```').html;
  assert.equal(container.querySelector('a'), null);
  assert.equal(container.querySelector('code').textContent, source);
  assert.equal(container.querySelector('pre code').textContent, source);
});
