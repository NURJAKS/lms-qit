"use client";

import { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/context/LanguageContext";

const PHRASE_KEYS = ["heroTyping1", "heroTyping2", "heroTyping3", "heroTyping4"] as const;

const TYPING_SPEED = 100;
const DELETING_SPEED = 60;
const PAUSE_AFTER_TYPE = 2500;
const PAUSE_AFTER_DELETE = 800;

export function TypingHeroText() {
  const { t, lang } = useLanguage();
  const [charIndex, setCharIndex] = useState(0);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const mountedRef = useRef(true);

  const phrases = PHRASE_KEYS.map((k) => t(k)).filter(Boolean);
  const currentPhrase = phrases[phraseIndex % phrases.length] ?? "";
  const displayedText = currentPhrase.slice(0, charIndex);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setPhraseIndex(0);
    setCharIndex(0);
    setIsDeleting(false);
  }, [lang]);

  useEffect(() => {
    if (phrases.length === 0) return;

    const timer = setTimeout(
      () => {
        if (!mountedRef.current) return;

        if (isDeleting) {
          if (charIndex > 0) {
            setCharIndex((c) => c - 1);
          } else {
            setIsDeleting(false);
            setPhraseIndex((p) => (p + 1) % phrases.length);
          }
        } else {
          if (charIndex < currentPhrase.length) {
            setCharIndex((c) => c + 1);
          } else {
            setIsDeleting(true);
          }
        }
      },
      isDeleting
        ? charIndex > 0
          ? DELETING_SPEED
          : PAUSE_AFTER_DELETE
        : charIndex < currentPhrase.length
          ? TYPING_SPEED
          : PAUSE_AFTER_TYPE
    );

    return () => clearTimeout(timer);
  }, [charIndex, isDeleting, currentPhrase, phraseIndex, phrases.length]);

  if (phrases.length === 0) {
    return <>{t("heroHighlight")}</>;
  }

  return (
    <>
      {displayedText}
      <span className="animate-pulse inline-block ml-0.5" style={{ opacity: 0.95 }}>
        |
      </span>
    </>
  );
}
