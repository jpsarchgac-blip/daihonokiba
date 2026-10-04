"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SpeechRecognitionHandlers = {
  onFinalTranscript?: (text: string, sessionText: string) => void;
  onInterimTranscript?: (text: string, sessionText: string) => void;
};

export function useSpeechRecognition(enabled: boolean) {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interimText, setInterimText] = useState("");
  const [sessionText, setSessionText] = useState("");

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const sessionTextRef = useRef("");
  const shouldRunRef = useRef(false);
  const handlersRef = useRef<SpeechRecognitionHandlers>({});

  const setHandlers = useCallback((handlers: SpeechRecognitionHandlers) => {
    handlersRef.current = handlers;
  }, []);

  const resetSession = useCallback(() => {
    sessionTextRef.current = "";
    setSessionText("");
    setInterimText("");
  }, []);

  useEffect(() => {
    const Ctor =
      typeof window !== "undefined"
        ? window.SpeechRecognition ?? window.webkitSpeechRecognition
        : undefined;
    setIsSupported(Boolean(Ctor));
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "ja-JP";
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (shouldRunRef.current) {
        try {
          recognition.start();
        } catch {
          /* 連続再起動の競合は無視 */
        }
      }
    };

    recognition.onerror = (ev) => {
      if (ev.error === "aborted" || ev.error === "no-speech") return;
      setError(ev.error);
      setIsListening(false);
    };

    recognition.onresult = (ev) => {
      let interim = "";
      let finals = "";

      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const result = ev.results[i];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) {
          finals += transcript;
        } else {
          interim += transcript;
        }
      }

      if (finals) {
        sessionTextRef.current += finals;
        setSessionText(sessionTextRef.current);
        handlersRef.current.onFinalTranscript?.(
          finals,
          sessionTextRef.current,
        );
      }

      setInterimText(interim);
      const combined = sessionTextRef.current + interim;
      if (interim) {
        handlersRef.current.onInterimTranscript?.(interim, combined);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      shouldRunRef.current = false;
      recognition.onend = null;
      recognition.abort();
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    shouldRunRef.current = enabled;

    if (enabled) {
      try {
        recognition.start();
      } catch {
        /* 既に起動中 */
      }
    } else {
      recognition.stop();
      setIsListening(false);
    }
  }, [enabled]);

  return {
    isSupported,
    isListening,
    error,
    interimText,
    sessionText,
    setHandlers,
    resetSession,
  };
}
