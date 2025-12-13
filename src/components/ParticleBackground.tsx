import { useEffect, useRef } from "react";

const ParticleBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    const particles: Particle[] = [];
    const colors = ["#38bdf8", "#22d3ee", "#ffffff"];
    const particleCount = width < 768 ? 20 : 50;

    class Particle {
      x: number;
      y: number;
      size: number;
      vx: number;
      vy: number;
      life: number;
      alpha: number;
      color: string;

      constructor() {
        this.reset();
      }

      reset() {
        this.x = Math.random() * width;
        this.y = height - Math.random() * (height * 0.2);
        this.size = Math.random() * 0.5 + 0.1;
        this.vx = (Math.random() - 0.5) * 0.2;
        this.vy = -(Math.random() * 0.3 + 0.1);
        this.life = Math.random() * 100;
        this.alpha = Math.random() * 0.5 + 0.2;
        this.color = colors[Math.floor(Math.random() * colors.length)];
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life += 0.5;
        this.vx += Math.sin(this.life * 0.02) * 0.001;

        if (this.y < height * 0.6) {
          this.reset();
          this.y = height + 10;
        }

        if (this.x < 0) this.x = width;
        if (this.x > width) this.x = 0;
      }

      draw() {
        if (!ctx) return;
        ctx.beginPath();
        const gradient = ctx.createRadialGradient(
          this.x,
          this.y,
          0,
          this.x,
          this.y,
          this.size * 6
        );
        gradient.addColorStop(0, this.color);
        gradient.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = gradient;
        ctx.globalAlpha = this.alpha;
        ctx.arc(this.x, this.y, this.size * 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }

    const animate = () => {
      if (window.scrollY > height) {
        requestAnimationFrame(animate);
        return;
      }

      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter";

      particles.forEach((p) => {
        p.update();
        p.draw();
      });

      requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return <canvas ref={canvasRef} id="particle-canvas" />;
};

export default ParticleBackground;
