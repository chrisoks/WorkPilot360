"use client";

import { useEffect } from "react";

const MODAL_SELECTOR = [
  '[aria-modal="true"]',
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[class*="modalOverlay"]',
  '[class*="_overlay_"]',
].join(",");

export function ModalScrollLock() {
  useEffect(() => {
    const body = document.body;
    let isLocked = false;
    let scrollY = 0;
    let previousStyles: Partial<Record<"overflow" | "position" | "top" | "left" | "right" | "width" | "paddingRight", string>> = {};

    const lock = () => {
      if (isLocked) return;
      isLocked = true;
      scrollY = window.scrollY;
      previousStyles = {
        overflow: body.style.overflow,
        position: body.style.position,
        top: body.style.top,
        left: body.style.left,
        right: body.style.right,
        width: body.style.width,
        paddingRight: body.style.paddingRight,
      };
      const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
      body.style.overflow = "hidden";
      body.style.position = "fixed";
      body.style.top = `-${scrollY}px`;
      body.style.left = "0";
      body.style.right = "0";
      body.style.width = "100%";
      if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
    };

    const unlock = () => {
      if (!isLocked) return;
      isLocked = false;
      body.style.overflow = previousStyles.overflow ?? "";
      body.style.position = previousStyles.position ?? "";
      body.style.top = previousStyles.top ?? "";
      body.style.left = previousStyles.left ?? "";
      body.style.right = previousStyles.right ?? "";
      body.style.width = previousStyles.width ?? "";
      body.style.paddingRight = previousStyles.paddingRight ?? "";
      window.scrollTo({ top: scrollY, left: 0, behavior: "instant" });
    };

    const sync = () => {
      if (document.querySelector(MODAL_SELECTOR)) lock();
      else unlock();
    };

    const observer = new MutationObserver(sync);
    observer.observe(body, { childList: true, subtree: true });
    sync();

    return () => {
      observer.disconnect();
      unlock();
    };
  }, []);

  return null;
}
