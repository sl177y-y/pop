import Image from 'next/image';

interface MascotContainerProps {
  frame: {
    src: string;
    width: number;
    height: number;
  };
  isMobile: boolean;
}

const MascotContainer = ({ frame, isMobile }: MascotContainerProps) => (
  <div className="w-full xs:w-1/3 md:w-1/2 lg:w-[52%] flex justify-center items-center -mt-18 relative ipad-mini-mascot">
    {/* Background glow behind mascot */}
    <Image
      src="/mascotbghalo.png"
      alt="Background Glow"
      width={1200}
      height={1200}
      className="absolute z-0 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 scale-125"
      priority={false}
      loading="lazy"
      placeholder="blur"
      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkbHB0eH/xAAVAQEBAAAAAAAAAAAAAAAAAAAAAf/EABUTAQEAAAAAAAAAAAAAAAAAAAAAAAAB/9oADAMBAAIRAxEAPwCdMwU2sQ4D9rAOFAAAAB//Z"
    />

    {/* Portal image under Zura with golden glow - only on desktop */}
    {!isMobile && (
      <Image
        src="/portal.webp"
        alt="Portal effect"
        width={200}
        height={200}
        className="absolute bottom-[-40px] left-1/2 -translate-x-1/2 z-100 pointer-events-none"
        style={{
          filter:
            'drop-shadow(0 0 20px rgba(255,215,0,0.9)) drop-shadow(0 0 40px rgba(255,165,0,0.8))',
          mixBlendMode: 'lighten',
          animation: 'portal-pulse 5s ease-in-out infinite',
        }}
        priority={false}
        loading="lazy"
      />
    )}

    {/* Zura head graphic */}
    <Image
      src={frame.src}
      alt="Zura Head"
      width={isMobile ? frame.width * 1.2 : frame.width}
      height={isMobile ? frame.height * 1.2 : frame.height}
      className="relative z-10 animate-float"
      priority={true}
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
    />
  </div>
);

export default MascotContainer; 