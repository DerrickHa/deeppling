"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Copy, Check } from "lucide-react";

interface HashDisplayProps {
  hash: string;
  truncate?: number;
  className?: string;
}

export function HashDisplay({ hash, truncate = 24, className }: HashDisplayProps) {
  const [copied, setCopied] = useState(false);

  const displayHash = hash.length > truncate ? `${hash.slice(0, truncate)}...` : hash;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-flex items-center gap-1.5 ${className ?? ""}`}>
          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
            {displayHash}
          </code>
          <Button variant="ghost" size="icon-xs" onClick={handleCopy}>
            {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-mono text-xs max-w-xs break-all">{hash}</p>
      </TooltipContent>
    </Tooltip>
  );
}
