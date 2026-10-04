"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type TimerState = {
  slideIndex: number;
  slideRemaining: number;
  totalRemaining: number;
  isRunning: boolean;
  isFinished: boolean;
};

export function usePresentationTimer(slideDurations: number[]) {
  const [state, setState] = useState<TimerState>(() => ({
    slideIndex: 0,
    slideRemaining: slideDurations[0] ?? 0,
    totalRemaining: slideDurations.reduce((a, b) => a + b, 0),
    isRunning: false,
    isFinished: false,
  }));

  const durationsRef = useRef(slideDurations);
  durationsRef.current = slideDurations;

  const resetToDurations = useCallback((durations: number[]) => {
    setState({
      slideIndex: 0,
      slideRemaining: durations[0] ?? 0,
      totalRemaining: durations.reduce((a, b) => a + b, 0),
      isRunning: false,
      isFinished: durations.length === 0,
    });
  }, []);

  useEffect(() => {
    resetToDurations(slideDurations);
  }, [slideDurations, resetToDurations]);

  useEffect(() => {
    if (!state.isRunning || state.isFinished) return;

    const id = window.setInterval(() => {
      setState((prev) => {
        const durations = durationsRef.current;
        if (durations.length === 0) {
          return { ...prev, isRunning: false, isFinished: true };
        }

        const nextSlideRemaining = prev.slideRemaining - 1;
        const nextTotalRemaining = Math.max(0, prev.totalRemaining - 1);

        if (nextSlideRemaining > 0) {
          return {
            ...prev,
            slideRemaining: nextSlideRemaining,
            totalRemaining: nextTotalRemaining,
          };
        }

        const nextIndex = prev.slideIndex + 1;
        if (nextIndex >= durations.length) {
          return {
            ...prev,
            slideRemaining: 0,
            totalRemaining: nextTotalRemaining,
            isRunning: false,
            isFinished: true,
          };
        }

        return {
          ...prev,
          slideIndex: nextIndex,
          slideRemaining: durations[nextIndex],
          totalRemaining: nextTotalRemaining,
        };
      });
    }, 1000);

    return () => window.clearInterval(id);
  }, [state.isRunning, state.isFinished]);

  const start = useCallback(() => {
    setState((prev) =>
      prev.isFinished
        ? prev
        : { ...prev, isRunning: true, isFinished: false },
    );
  }, []);

  const pause = useCallback(() => {
    setState((prev) => ({ ...prev, isRunning: false }));
  }, []);

  const toggle = useCallback(() => {
    setState((prev) => {
      if (prev.isFinished) return prev;
      return { ...prev, isRunning: !prev.isRunning };
    });
  }, []);

  const goToSlide = useCallback(
    (index: number) => {
      const durations = durationsRef.current;
      if (index < 0 || index >= durations.length) return;
      const spentBefore = durations
        .slice(0, index)
        .reduce((a, b) => a + b, 0);
      const total = durations.reduce((a, b) => a + b, 0);
      setState({
        slideIndex: index,
        slideRemaining: durations[index],
        totalRemaining: Math.max(0, total - spentBefore),
        isRunning: false,
        isFinished: false,
      });
    },
    [],
  );

  const nextSlide = useCallback(() => {
    goToSlide(state.slideIndex + 1);
  }, [goToSlide, state.slideIndex]);

  const prevSlide = useCallback(() => {
    goToSlide(state.slideIndex - 1);
  }, [goToSlide, state.slideIndex]);

  const restart = useCallback(() => {
    resetToDurations(durationsRef.current);
  }, [resetToDurations]);

  return {
    ...state,
    start,
    pause,
    toggle,
    goToSlide,
    nextSlide,
    prevSlide,
    restart,
  };
}
