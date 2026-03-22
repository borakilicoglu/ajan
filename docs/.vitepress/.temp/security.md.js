import { ssrRenderAttrs } from "vue/server-renderer";
import { useSSRContext } from "vue";
import { _ as _export_sfc } from "./plugin-vue_export-helper.1tPrXgE0.js";
const __pageData = JSON.parse('{"title":"Security","description":"","frontmatter":{},"headers":[],"relativePath":"security.md","filePath":"security.md"}');
const _sfc_main = { name: "security.md" };
function _sfc_ssrRender(_ctx, _push, _parent, _attrs, $props, $setup, $data, $options) {
  _push(`<div${ssrRenderAttrs(_attrs)}><h1 id="security" tabindex="-1">Security <a class="header-anchor" href="#security" aria-label="Permalink to &quot;Security&quot;">​</a></h1><h2 id="guard-rules" tabindex="-1">Guard Rules <a class="header-anchor" href="#guard-rules" aria-label="Permalink to &quot;Guard Rules&quot;">​</a></h2><p>All executed queries must obey these rules:</p><ul><li><code>SELECT</code> only</li><li>reject <code>INSERT</code></li><li>reject <code>UPDATE</code></li><li>reject <code>DELETE</code></li><li>reject <code>DROP</code></li><li>reject <code>ALTER</code></li><li>reject <code>TRUNCATE</code></li><li>reject multi-statement SQL</li><li>reject SQL comments</li><li>enforce default <code>LIMIT 100</code></li><li>reject <code>LIMIT</code> values above <code>100</code></li><li>cap statement timeout at <code>5</code> seconds</li><li>cap maximum result size</li></ul><h2 id="design-intent" tabindex="-1">Design Intent <a class="header-anchor" href="#design-intent" aria-label="Permalink to &quot;Design Intent&quot;">​</a></h2><p>The project is built as:</p><blockquote><p>psql + schema awareness + AI-safe guard layer</p></blockquote><p>All database logic flows through:</p><ul><li><code>db/</code></li><li><code>guard/</code></li><li><code>query-runner/</code></li></ul></div>`);
}
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("security.md");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const security = /* @__PURE__ */ _export_sfc(_sfc_main, [["ssrRender", _sfc_ssrRender]]);
export {
  __pageData,
  security as default
};
