'use strict';

// Repro for autoescape-safe concatenation (Jinja2 3.1.6 semantics).
// Run with: ROOT=<repo root> node repro/903.cjs
const ROOT = process.env.ROOT || require('path').resolve(__dirname, '..');
const nunjucks = require(ROOT + '/nunjucks/index.js');

const SafeString = nunjucks.runtime.SafeString;

function render(src, ctx) {
  const env = new nunjucks.Environment([], { autoescape: true });
  return env.renderString(src, ctx || {});
}

const ctx = {
  user: { name: 'Tom' },
  badge: new SafeString('<b>VIP</b>')
};

const cases = [
  // macro output concatenated with plain text: safe part kept, plain part escaped
  [
    '{% macro icon(n) %}<i class="{{ n }}"></i>{% endmacro %}' +
      '{{ icon("ok") ~ " 已完成" }}',
    {},
    '<i class="ok"></i> 已完成'
  ],
  // SafeString from the context concatenated with a plain string
  ['{{ badge ~ user.name }}', ctx, '<b>VIP</b>Tom'],
  // same with the + operator, the & must be escaped
  ['{{ badge + " & co" }}', ctx, '<b>VIP</b> &amp; co'],
  // set captures the safe concatenation and keeps it safe on output
  [
    '{% set label = badge ~ " " ~ user.name %}{{ label }}',
    ctx,
    '<b>VIP</b> Tom'
  ],
  // caller() inside a macro is safe markup; the literal "<" is escaped
  [
    '{% macro box() %}[{{ caller() ~ "<" }}]{% endmacro %}' +
      '{% call box() %}<em>x</em>{% endcall %}',
    {},
    '[<em>x</em>&lt;]'
  ],
  // join: safe items keep their markup, unsafe items are escaped
  ['{{ [badge, "<x>"] | join(" ") }}', ctx, '<b>VIP</b> &lt;x&gt;'],
  // join: a plain-string separator is escaped while the badges survive
  [
    '{{ [badge, badge] | join("<br>") }}',
    ctx,
    '<b>VIP</b>&lt;br&gt;<b>VIP</b>'
  ],
  // undefined values participate in concatenation as empty strings
  ['{{ "Hi " ~ user.nickname ~ "!" }}', ctx, 'Hi !'],
  ['{{ (user.nickname ~ "") | length }}', ctx, '0'],

  // controls: numeric addition and ordinary joins must be unchanged
  ['{{ 1 + 2 }}', {}, '3'],
  ['{{ [1, 2, 3] | join("-") }}', {}, '1-2-3'],
  ['{{ "a" ~ "b" ~ 5 }}', {}, 'ab5']
];

let failures = 0;

cases.forEach(([src, data, expected], i) => {
  let actual;
  try {
    actual = render(src, data);
  } catch (e) {
    actual = 'THREW: ' + e.message;
  }
  const ok = actual === expected;
  if (!ok) {
    failures++;
  }
  console.log(
    (ok ? 'ok  ' : 'BAD ') + '#' + (i + 1) + ' ' + JSON.stringify(src)
  );
  if (!ok) {
    console.log('       expected: ' + JSON.stringify(expected));
    console.log('       actual:   ' + JSON.stringify(actual));
  }
});

console.log('\n' + (failures === 0 ? 'ALL OK' : failures + ' BAD'));
process.exit(failures === 0 ? 0 : 1);
