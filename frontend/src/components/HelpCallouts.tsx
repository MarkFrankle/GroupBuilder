import React from "react";
import { Lightbulb, AlertTriangle, Info } from "lucide-react";

export function Screenshot({ src, alt, caption }: { src: string; alt: string; caption: string }) {
  return (
    <figure className="my-6 bg-slate-50 rounded-lg p-4 border border-slate-200">
      <img
        src={src}
        alt={alt}
        className="rounded border border-slate-200 shadow-sm mx-auto max-w-2xl w-full"
      />
      <figcaption className="text-sm text-slate-500 text-center mt-3 italic">
        {caption}
      </figcaption>
    </figure>
  );
}

export function TipCallout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-blue-50 border-l-4 border-blue-200 rounded p-4 my-4 flex gap-3">
      <Lightbulb className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
      <div className="text-sm text-blue-900">{children}</div>
    </div>
  );
}

export function WarningCallout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-amber-50 border-l-4 border-amber-200 rounded p-4 my-4 flex gap-3">
      <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
      <div className="text-sm text-amber-900">{children}</div>
    </div>
  );
}

export function InfoCallout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-slate-50 border-l-4 border-slate-200 rounded p-4 my-4 flex gap-3">
      <Info className="h-5 w-5 text-slate-500 flex-shrink-0 mt-0.5" />
      <div className="text-sm text-slate-700">{children}</div>
    </div>
  );
}
