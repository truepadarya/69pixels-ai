import { clickToSource } from "astro-click-to-source";

export function clickToSourceWithHmr() {
  const integration = clickToSource();
  const setup = integration.hooks["astro:config:setup"];

  return {
    ...integration,
    hooks: {
      ...integration.hooks,
      "astro:config:setup": (context) =>
        setup({
          ...context,
          updateConfig(config) {
            for (const plugin of config.vite?.plugins ?? []) {
              if (plugin.name !== "vite-plugin-click-to-source-annotate")
                continue;

              // Astro compares HMR input with annotated compile input; both must match.
              plugin.handleHotUpdate = {
                order: "pre",
                async handler(ctx) {
                  if (!ctx.file.endsWith(".astro")) return;
                  const result = await plugin.load.call(this, ctx.file);
                  if (result) ctx.read = async () => result.code;
                },
              };
            }
            return context.updateConfig(config);
          },
        }),
    },
  };
}
