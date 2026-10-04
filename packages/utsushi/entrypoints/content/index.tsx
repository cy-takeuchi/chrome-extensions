import ReactDOM from "react-dom/client";
import { App, type CommandSource } from "@/components/App";
import type { Command, CommandMessage } from "@/lib/messages";
import "./style.css";

export default defineContentScript({
  matches: ["https://*.cybozu.com/k/*", "https://*.kintone.com/k/*"],
  cssInjectionMode: "ui",
  async main(ctx) {
    const listeners = new Set<(c: Command) => void>();
    const commands: CommandSource = {
      subscribe: (fn) => {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
    };
    browser.runtime.onMessage.addListener((message: CommandMessage) => {
      if (message?.type === "command") listeners.forEach((l) => l(message.command));
    });

    const ui = await createShadowRootUi(ctx, {
      name: "utsushi-root",
      position: "overlay",
      zIndex: 2147483000,
      onMount: (container, _shadow, host) => {
        // オーバーレイ内のキー操作を kintone 側のショートカットに渡さない
        for (const type of ["keydown", "keyup", "keypress"])
          host.addEventListener(type, (e) => e.stopPropagation());
        const root = ReactDOM.createRoot(container);
        root.render(<App commands={commands} />);
        return root;
      },
      onRemove: (root) => root?.unmount(),
    });
    ui.mount();
  },
});
