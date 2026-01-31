"use client";

interface AvatarProps {
  src?: string;
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  verified?: boolean;
}

export function Avatar({ src, name, size = "md", verified }: AvatarProps) {
  const sizes = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-12 h-12 text-base",
    xl: "w-16 h-16 text-lg",
  };

  const badgeSizes = {
    sm: "w-3 h-3 -bottom-0.5 -right-0.5",
    md: "w-4 h-4 -bottom-0.5 -right-0.5",
    lg: "w-5 h-5 -bottom-1 -right-1",
    xl: "w-6 h-6 -bottom-1 -right-1",
  };

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="relative inline-block">
      {src ? (
        <img
          src={src}
          alt={name}
          className={`${sizes[size]} rounded-full object-contain bg-[#f3f2ef] max-w-full max-h-full`}
        />
      ) : (
        <div
          className={`${sizes[size]} rounded-full bg-[#0a66c2] text-white flex items-center justify-center font-semibold`}
        >
          {initials}
        </div>
      )}
      {verified && (
        <div
          className={`absolute ${badgeSizes[size]} bg-[#0a66c2] rounded-full flex items-center justify-center border-2 border-white`}
        >
          <svg className="w-2/3 h-2/3 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      )}
    </div>
  );
}

