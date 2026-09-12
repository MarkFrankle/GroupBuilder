import React from "react";
import { Lightbulb, AlertTriangle, Info } from "lucide-react";

// Screenshots carry small UI text (buttons, checklist items) that gets
// illegible if squeezed into the page's ~700px reading column. This bleeds
// the figure wider than the surrounding prose while keeping paragraphs at
// their comfortable line length. `wide` raises the cap for screenshots
// (like the Assignments header) that are themselves too dense to read at
// the default cap — most screenshots should leave it unset.
export function Screenshot({
  src,
  alt,
  caption,
  wide,
}: {
  src: string;
  alt: string;
  caption: string;
  wide?: boolean;
}) {
  return (
    <figure className="my-6 relative left-1/2 right-1/2 -mx-[50vw] w-screen px-4">
      <div className={wide ? "max-w-[960px] mx-auto" : "max-w-2xl mx-auto"}>
        <img
          src={src}
          alt={alt}
          className="rounded border border-slate-200 shadow-sm mx-auto max-w-full h-auto block"
        />
        <figcaption className="text-sm text-slate-500 text-center mt-3 italic">
          {caption}
        </figcaption>
      </div>
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
