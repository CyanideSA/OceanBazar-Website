import { useEffect, useState } from "react";

const OCEAN_POSTER =
  "https://images.pexels.com/videos/1409899/free-video-1409899.jpg?auto=compress&cs=tinysrgb&w=1920";
const OCEAN_MP4 =
  "https://videos.pexels.com/video-files/1409899/1409899-uhd_2560_1440_25fps.mp4";

export default function OceanBackground({ children }) {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const handler = (e) => setReduceMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div aria-hidden className="absolute inset-0">
        {reduceMotion ? (
          <img src={OCEAN_POSTER} alt="" className="h-full w-full object-cover" />
        ) : (
          <video
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            className="h-full w-full object-cover"
            poster={OCEAN_POSTER}
          >
            <source src={OCEAN_MP4} type="video/mp4" />
          </video>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-blue-950/60 via-blue-900/55 to-indigo-950/65" />
        <div className="absolute inset-0 bg-[url('/pattern.svg')] opacity-[0.07]" />
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-400/50 to-transparent" />
      </div>
      <div className="relative z-10 min-h-screen">{children}</div>
    </div>
  );
}
