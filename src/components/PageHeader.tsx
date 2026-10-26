import { cn } from "@/lib/utils";

interface Props {
  title: string;
  label: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
  isCompact?: boolean;
}

export default function PageHeader({ title, label, left, right, className, isCompact = false }: Props) {
  return (
    <header className={cn("relative sticky top-0 z-10 px-4 pt-5 pb-4 bg-[#0b0d12]/90 backdrop-blur-md", className)}>
      <div className={cn("flex items-center", isCompact ? "gap-2" : "gap-3")}>
        {left}
        <div className="min-w-0 mr-auto">
          <h1 className={cn("font-bold tracking-tight text-white truncate", isCompact ? "text-[22px]" : "text-2xl")}>{title}</h1>
          <p className={cn("font-semibold uppercase tracking-widest text-[#9aa3b2] mt-1", isCompact ? "text-[10px]" : "text-[11px]")}>{label}</p>
        </div>
        {right}
      </div>
      <div className={cn("h-px bg-gradient-to-r from-blue-500/40 via-transparent to-transparent", isCompact ? "mt-3" : "mt-4")} />
    </header>
  );
}
