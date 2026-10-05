'use strict';

// Repro: with autoescape on, concatenating SafeString values (macro output,
// | safe results) with plain strings escapes the whole result, and undefined
// values leak the word "undefined" into concatenations. Expected behavior
// verified against Jinja2 3.1.6: safe parts stay raw, plain parts get
// escaped, the combined result is treated as safe; undefined concats as ''.

const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const nunjucks = require(path.join(ROOT, 'nunjucks'));

const env = new nunjucks.Environment(null, { autoescape: true });

const badge = new nunjucks.runtime.SafeString('<b>VIP</b>');
const ctx = {
  badge: badge,
  user: { name: 'Tom' } // note: no nickname
};

const iconMacro = '{% macro icon(n) %}<i class="{{ n }}"></i>{% endmacro %}';

const cases = [
  ['macro output alone',
    iconMacro + '{{ icon("ok") }}',
    '<i class="ok"></i>'],
  ['macro output ~ string',
    iconMacro + '{{ icon("ok") ~ " 已完成" }}',
    '<i class="ok"></i> 已完成'],
  ['SafeString ~ name',
    '{{ badge ~ user.name }}',
    '<b>VIP</b>Tom'],
  ['SafeString + string',
    '{{ badge + " & co" }}',
    '<b>VIP</b> &amp; co'],
  ['set of concat, then output',
    '{% set label = badge ~ " " ~ user.name %}{{ label }}',
    '<b>VIP</b> Tom'],
  ['caller() ~ string in call block',
    '{% macro wrap() %}[{{ caller() ~ "<" }}]{% endmacro %}' +
    '{% call wrap() %}<em>x</em>{% endcall %}',
    '[<em>x</em>&lt;]'],
  ['join mixed safe/plain',
    '{{ [badge, "<x>"] | join(" ") }}',
    '<b>VIP</b> &lt;x&gt;'],
  ['join with plain delimiter',
    '{{ [badge, badge] | join("<br>") }}',
    '<b>VIP</b>&lt;br&gt;<b>VIP</b>'],
  ['undefined in concat',
    '{{ "Hi " ~ user.nickname ~ "!" }}',
    'Hi !'],
  ['length of concat with undefined',
    '{{ ("" ~ user.nickname) | length }}',
    '0'],
  // controls: these are correct today and must stay correct
  ['number addition',
    '{{ 1 + 2 }}',
    '3'],
  ['plain join',
    '{{ [1, 2, 3] | join(",") }}',
    '1,2,3']
];

let failures = 0;

cases.forEach(([name, tpl, expected]) => {
  let actual;
  try {
    actual = env.renderString(tpl, ctx);
  } catch (e) {
    actual = 'ERROR: ' + e.message;
  }
  const ok = actual === expected;
  if (!ok) {
    failures++;
  }
  console.log((ok ? 'ok  ' : 'BAD ') + name + ': ' + JSON.stringify(actual) +
    (ok ? '' : ' (expected ' + JSON.stringify(expected) + ')'));
});

console.log(failures === 0 ? 'all ok' : failures + ' failing');
process.exit(failures === 0 ? 0 : 1);
