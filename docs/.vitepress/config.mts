import { defineConfig } from "vitepress";

const isGitHubActions = process.env.GITHUB_ACTIONS === "true";

export default defineConfig({
  title: "ajan-sql",
  description: "AI-safe MCP server for schema-aware, read-only SQL access.",
  base: isGitHubActions ? "/ajan/" : "/",
  themeConfig: {
    nav: [
      { text: "Guide", link: "/" },
      { text: "Tools", link: "/tools" },
      { text: "Security", link: "/security" },
    ],
    sidebar: [
      {
        text: "Documentation",
        items: [
          { text: "Overview", link: "/" },
          { text: "Tools", link: "/tools" },
          { text: "Security", link: "/security" },
        ],
      },
    ],
    socialLinks: [
      { icon: "github", link: "https://github.com/borakilicoglu/ajan" },
    ],
  },
});
