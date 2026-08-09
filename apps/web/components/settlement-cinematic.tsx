"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const POSTER = "/cinematic/settlement-register-desktop-poster.webp";

type NetworkInformation = { saveData?: boolean };

function posterOnlyRequested() {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const narrowScreen = window.matchMedia("(max-width: 430px)").matches;
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  return reducedMotion || narrowScreen || connection?.saveData === true;
}

export function SettlementCinematic() {
  const frameRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const userPausedRef = useRef(false);
  const failedRef = useRef(false);
  const [videoEnabled, setVideoEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    return !posterOnlyRequested();
  });
  const [videoReady, setVideoReady] = useState(false);
  const [paused, setPaused] = useState(false);

  const retainPoster = useCallback(() => {
    failedRef.current = true;
    setVideoReady(false);
    setVideoEnabled(false);
  }, []);

  useEffect(() => {
    if (!videoEnabled) return;
    const video = videoRef.current;
    if (!video) return;

    const attemptPlayback = async () => {
      try {
        await video.play();
      } catch {
        retainPoster();
      }
    };
    void attemptPlayback();
  }, [retainPoster, videoEnabled]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || !videoEnabled || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(([entry]) => {
      const video = videoRef.current;
      if (!video || failedRef.current) return;
      if (!entry?.isIntersecting) {
        video.pause();
        return;
      }
      if (!userPausedRef.current) void video.play().catch(retainPoster);
    }, { threshold: 0.08 });
    observer.observe(frame);
    return () => observer.disconnect();
  }, [retainPoster, videoEnabled]);

  const togglePlayback = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      try {
        await video.play();
        userPausedRef.current = false;
        setPaused(false);
      } catch {
        retainPoster();
      }
    } else {
      video.pause();
      userPausedRef.current = true;
      setPaused(true);
    }
  };

  return (
    <figure ref={frameRef} className="settlement-cinematic" aria-label="Explanatory animation of a payment intent held in escrow and resolved into aligned recipient rails">
      {/* The resolved image is always first in the DOM and remains beneath media for zero-gap fallback. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- fixed intrinsic media poster, intentionally not transformed */}
      <img className="settlement-cinematic__poster" src={POSTER} width="1440" height="900" alt="Resolved Settlement Register with escrow, programmed distribution rails, and the canonical register aligned" decoding="async" fetchPriority="high" />
      {videoEnabled ? (
        <video
          ref={videoRef}
          className={`settlement-cinematic__video${videoReady ? " is-ready" : ""}`}
          muted
          playsInline
          preload="metadata"
          poster={POSTER}
          loop
          aria-hidden="true"
          tabIndex={-1}
          onCanPlay={() => setVideoReady(true)}
          onError={retainPoster}
          onPause={() => setPaused(true)}
          onPlay={() => setPaused(false)}
        >
          <source src="/cinematic/settlement-register-desktop.webm" type="video/webm; codecs=vp9" />
          <source src="/cinematic/settlement-register-desktop.mp4" type="video/mp4; codecs=avc1.640028" />
        </video>
      ) : null}
      {videoReady ? (
        <button type="button" className="settlement-cinematic__control" onClick={() => void togglePlayback()} aria-pressed={paused}>
          <span className="settlement-cinematic__control-mark" aria-hidden="true">{paused ? "▶" : "Ⅱ"}</span>
          {paused ? "Resume motion" : "Pause motion"}
        </button>
      ) : null}
      <figcaption className="sr-only">An explanatory sequence only. Canonical application state remains authoritative.</figcaption>
    </figure>
  );
}