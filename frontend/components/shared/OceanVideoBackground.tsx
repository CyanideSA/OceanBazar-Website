'use client';

import { useEffect, useRef } from 'react';

const OCEAN_POSTER =
  'https://images.pexels.com/videos/1409899/free-video-1409899.jpg?auto=compress&cs=tinysrgb&w=1920';
const OCEAN_MP4 =
  'https://videos.pexels.com/video-files/1409899/1409899-uhd_2560_1440_25fps.mp4';

type Props = {
  className?: string;
  overlayClassName?: string;
};

/** Same ocean footage as storefront footer — shared for maintenance / status pages. */
export default function OceanVideoBackground({
  className = 'absolute inset-0',
  overlayClassName = 'absolute inset-0 bg-gradient-to-b from-slate-950/88 via-blue-950/82 to-slate-950/92',
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.playbackRate = 0.75;
  }, []);

  return (
    <div aria-hidden className={className}>
      <video
        ref={videoRef}
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
      <div className={overlayClassName} />
    </div>
  );
}
