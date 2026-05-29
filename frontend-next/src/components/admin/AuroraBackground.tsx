"use client";

import { useEffect, useRef, useState } from "react";

export function AuroraBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const checkTheme = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };
    checkTheme();
    
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    let animationFrameId: number;
    let time = 0;

    const animate = () => {
      time += 0.005;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (isDark) {
        // Темная тема - яркие цвета
        const gradient1 = ctx.createRadialGradient(
          canvas.width * 0.3 + Math.sin(time) * 100,
          canvas.height * 0.4 + Math.cos(time * 0.7) * 80,
          0,
          canvas.width * 0.3 + Math.sin(time) * 100,
          canvas.height * 0.4 + Math.cos(time * 0.7) * 80,
          canvas.width * 0.8
        );
        gradient1.addColorStop(0, "rgba(59, 130, 246, 0.15)");
        gradient1.addColorStop(0.5, "rgba(59, 130, 246, 0.08)");
        gradient1.addColorStop(1, "rgba(59, 130, 246, 0)");
        ctx.fillStyle = gradient1;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const gradient2 = ctx.createRadialGradient(
          canvas.width * 0.7 + Math.cos(time * 0.8) * 120,
          canvas.height * 0.6 + Math.sin(time * 0.6) * 100,
          0,
          canvas.width * 0.7 + Math.cos(time * 0.8) * 120,
          canvas.height * 0.6 + Math.sin(time * 0.6) * 100,
          canvas.width * 0.9
        );
        gradient2.addColorStop(0, "rgba(139, 92, 246, 0.12)");
        gradient2.addColorStop(0.5, "rgba(139, 92, 246, 0.06)");
        gradient2.addColorStop(1, "rgba(139, 92, 246, 0)");
        ctx.fillStyle = gradient2;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const gradient3 = ctx.createRadialGradient(
          canvas.width * 0.5 + Math.sin(time * 1.2) * 80,
          canvas.height * 0.3 + Math.cos(time * 0.9) * 60,
          0,
          canvas.width * 0.5 + Math.sin(time * 1.2) * 80,
          canvas.height * 0.3 + Math.cos(time * 0.9) * 60,
          canvas.width * 0.6
        );
        gradient3.addColorStop(0, "rgba(30, 58, 138, 0.1)");
        gradient3.addColorStop(0.5, "rgba(30, 58, 138, 0.05)");
        gradient3.addColorStop(1, "rgba(30, 58, 138, 0)");
        ctx.fillStyle = gradient3;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else {
        // Светлая тема - мягкие пастельные цвета
        const gradient1 = ctx.createRadialGradient(
          canvas.width * 0.3 + Math.sin(time) * 100,
          canvas.height * 0.4 + Math.cos(time * 0.7) * 80,
          0,
          canvas.width * 0.3 + Math.sin(time) * 100,
          canvas.height * 0.4 + Math.cos(time * 0.7) * 80,
          canvas.width * 0.8
        );
        gradient1.addColorStop(0, "rgba(147, 197, 253, 0.08)");
        gradient1.addColorStop(0.5, "rgba(147, 197, 253, 0.04)");
        gradient1.addColorStop(1, "rgba(147, 197, 253, 0)");
        ctx.fillStyle = gradient1;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const gradient2 = ctx.createRadialGradient(
          canvas.width * 0.7 + Math.cos(time * 0.8) * 120,
          canvas.height * 0.6 + Math.sin(time * 0.6) * 100,
          0,
          canvas.width * 0.7 + Math.cos(time * 0.8) * 120,
          canvas.height * 0.6 + Math.sin(time * 0.6) * 100,
          canvas.width * 0.9
        );
        gradient2.addColorStop(0, "rgba(196, 181, 253, 0.06)");
        gradient2.addColorStop(0.5, "rgba(196, 181, 253, 0.03)");
        gradient2.addColorStop(1, "rgba(196, 181, 253, 0)");
        ctx.fillStyle = gradient2;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const gradient3 = ctx.createRadialGradient(
          canvas.width * 0.5 + Math.sin(time * 1.2) * 80,
          canvas.height * 0.3 + Math.cos(time * 0.9) * 60,
          0,
          canvas.width * 0.5 + Math.sin(time * 1.2) * 80,
          canvas.height * 0.3 + Math.cos(time * 0.9) * 60,
          canvas.width * 0.6
        );
        gradient3.addColorStop(0, "rgba(191, 219, 254, 0.05)");
        gradient3.addColorStop(0.5, "rgba(191, 219, 254, 0.025)");
        gradient3.addColorStop(1, "rgba(191, 219, 254, 0)");
        ctx.fillStyle = gradient3;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isDark]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0 bg-transparent"
    />
  );
}
