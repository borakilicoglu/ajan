import { ssrRenderAttrs } from "vue/server-renderer";
import { useSSRContext } from "vue";
import { _ as _export_sfc } from "./plugin-vue_export-helper.1tPrXgE0.js";
const __pageData = JSON.parse('{"title":"Tools","description":"","frontmatter":{},"headers":[],"relativePath":"tools.md","filePath":"tools.md"}');
const _sfc_main = { name: "tools.md" };
function _sfc_ssrRender(_ctx, _push, _parent, _attrs, $props, $setup, $data, $options) {
  _push(`<div${ssrRenderAttrs(_attrs)}><h1 id="tools" tabindex="-1">Tools <a class="header-anchor" href="#tools" aria-label="Permalink to &quot;Tools&quot;">​</a></h1><h2 id="list-tables" tabindex="-1"><code>list_tables</code> <a class="header-anchor" href="#list-tables" aria-label="Permalink to &quot;\`list_tables\`&quot;">​</a></h2><p>Returns all visible base tables outside PostgreSQL system schemas.</p><h2 id="describe-table" tabindex="-1"><code>describe_table</code> <a class="header-anchor" href="#describe-table" aria-label="Permalink to &quot;\`describe_table\`&quot;">​</a></h2><p>Returns column names, types, nullability, and default values for a table.</p><p>Inputs:</p><ul><li><code>name</code></li><li><code>schema</code> optional, defaults to <code>public</code></li></ul><h2 id="list-relationships" tabindex="-1"><code>list_relationships</code> <a class="header-anchor" href="#list-relationships" aria-label="Permalink to &quot;\`list_relationships\`&quot;">​</a></h2><p>Returns foreign key relationships across the database schema.</p><h2 id="run-readonly-query" tabindex="-1"><code>run_readonly_query</code> <a class="header-anchor" href="#run-readonly-query" aria-label="Permalink to &quot;\`run_readonly_query\`&quot;">​</a></h2><p>Runs a guarded <code>SELECT</code> query and returns rows.</p><p>Inputs:</p><ul><li><code>sql</code></li></ul><h2 id="explain-query" tabindex="-1"><code>explain_query</code> <a class="header-anchor" href="#explain-query" aria-label="Permalink to &quot;\`explain_query\`&quot;">​</a></h2><p>Runs <code>EXPLAIN (FORMAT JSON)</code> for a guarded readonly query.</p><p>Inputs:</p><ul><li><code>sql</code></li></ul><h2 id="sample-rows" tabindex="-1"><code>sample_rows</code> <a class="header-anchor" href="#sample-rows" aria-label="Permalink to &quot;\`sample_rows\`&quot;">​</a></h2><p>Returns a limited sample from a table without exposing unrestricted reads.</p><p>Inputs:</p><ul><li><code>name</code></li><li><code>schema</code> optional, defaults to <code>public</code></li><li><code>limit</code> optional, max <code>100</code></li></ul></div>`);
}
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("tools.md");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const tools = /* @__PURE__ */ _export_sfc(_sfc_main, [["ssrRender", _sfc_ssrRender]]);
export {
  __pageData,
  tools as default
};
