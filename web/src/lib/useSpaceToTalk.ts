"use client";

import { useEffect } from "react";

// things where Space already means something, so we leave it alone there
const OWNS_SPACE =
  "input, textarea, select, button:not([data-talk]), a, [role=tab], [contenteditable]";

// hold Space anywhere on the page to talk, like push-to-talk in a call
export function useSpaceToTalk(setHolding: (holding: boolean) => void) {
  useEffect(() => {
    let down = false;
    function owns(e: KeyboardEvent) {
      return e.target instanceof Element && e.target.closest(OWNS_SPACE) !== null;
    }
    function onDown(e: KeyboardEvent) {
      if (e.code !== "Space" || owns(e)) return;
      e.preventDefault(); // no page scroll, no button click
      if (e.repeat || down) return;
      down = true;
      setHolding(true);
    }
    function onUp(e: KeyboardEvent) {
      if (e.code !== "Space" || !down) return;
      e.preventDefault();
      down = false;
      setHolding(false);
    }
    // switching windows mid-hold never delivers the keyup, which would leave the mic open
    function onBlur() {
      if (!down) return;
      down = false;
      setHolding(false);
    }
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [setHolding]);
}
