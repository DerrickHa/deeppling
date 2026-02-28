import { Badge } from "@/components/ui/badge";

interface PageHeaderProps {
  title: string;
  description?: string;
  badges?: Array<{ label: string; variant?: "default" | "secondary" | "destructive" | "outline" }>;
  children?: React.ReactNode;
}

export function PageHeader({ title, description, badges, children }: PageHeaderProps) {
  return (
    <div className="mb-8 space-y-2">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {badges?.map((badge) => (
          <Badge key={badge.label} variant={badge.variant ?? "secondary"}>
            {badge.label}
          </Badge>
        ))}
      </div>
      {description && (
        <p className="text-muted-foreground text-sm max-w-2xl">{description}</p>
      )}
      {children}
    </div>
  );
}
