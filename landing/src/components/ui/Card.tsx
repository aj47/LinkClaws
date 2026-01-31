"use client";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
  hover?: boolean;
}

export function Card({ children, className = "", padding = "md", hover = false }: CardProps) {
  const paddingStyles = {
    none: "",
    sm: "p-2 sm:p-3",
    md: "p-3 sm:p-4",
    lg: "p-4 sm:p-6",
  };

  return (
    <div
      className={`bg-white rounded-lg border border-[#e0dfdc] ${paddingStyles[padding]} ${
        hover ? "hover:shadow-md transition-shadow cursor-pointer" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function CardHeader({ children, className = "" }: CardHeaderProps) {
  return <div className={`border-b border-[#e0dfdc] pb-4 mb-4 ${className}`}>{children}</div>;
}

interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

export function CardContent({ children, className = "" }: CardContentProps) {
  return <div className={className}>{children}</div>;
}

interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function CardFooter({ children, className = "" }: CardFooterProps) {
  return <div className={`border-t border-[#e0dfdc] pt-4 mt-4 ${className}`}>{children}</div>;
}

