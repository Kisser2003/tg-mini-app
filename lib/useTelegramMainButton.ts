import { useEffect } from "react";
import { getTelegramWebApp, isTelegramMiniApp } from "./telegram";

type UseTelegramMainButtonArgs = {
  text: string;
  enabled: boolean;
  loading: boolean;
  onClick: () => void | Promise<void>;
};

export function useTelegramMainButton({
  text,
  enabled,
  loading,
  onClick
}: UseTelegramMainButtonArgs) {
  useEffect(() => {
    if (!isTelegramMiniApp()) return;
    const webApp = getTelegramWebApp();
    const mainButton = webApp?.MainButton;
    if (!mainButton) return;

    let isMounted = true;

    const handleClick = async () => {
      if (!isMounted) return;
      await onClick();
    };

    try {
      mainButton.setText(text);
      mainButton.show();

      if (enabled) {
        mainButton.enable();
      } else {
        mainButton.disable();
      }

      if (loading) {
        mainButton.showProgress(true);
        mainButton.disable();
      } else {
        mainButton.hideProgress();
      }

      mainButton.onClick(handleClick);
    } catch {
      // ignore WebApp API errors
    }

    return () => {
      isMounted = false;
      try {
        mainButton?.offClick(handleClick);
        mainButton?.hide();
        mainButton?.hideProgress();
      } catch {
        // ignore
      }
    };
  }, [text, enabled, loading, onClick]);
}

