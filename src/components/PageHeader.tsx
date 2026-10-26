import { cn } from "@/lib/utils";

interface Props {
  title: string;
  label: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}

export default function PageHeader({ title, label, left, right, className }: Props) {
  return (
    <header className={cn("relative sticky top-0 z-10 px-4 pt-5 pb-4 bg-[#0b0d12]/90 backdrop-blur-md", className)}>
      <div className="flex items-center gap-3">
        {left}
        <div className="min-w-0 mr-auto">
          <h1 className="text-2xl font-bold tracking-tight text-white truncate">{title}</h1>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9aa3b2] mt-1">{label}</p>
        </div>
        {right}
      </div>
      <div className="mt-4 h-px bg-gradient-to-r from-blue-500/40 via-transparent to-transparent" />
    </header>
  );
}
