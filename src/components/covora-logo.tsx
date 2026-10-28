import Image from "next/image";

export function CovoraLogo() {
  return (
    <Image
      src="/covora-logo.webp"
      alt=""
      width={144}
      height={125}
      className="covora-logo"
      loading="eager"
      unoptimized
    />
  );
}
