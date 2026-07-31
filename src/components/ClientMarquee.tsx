import { Star, Quote } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Testimonials come from the live Google Business Profile via the
// google-reviews edge function. This strip previously carried six invented
// testimonials - one of which advertised "my portfolio grew 40% in 2 years",
// a performance claim a SEBI-registered intermediary must not publish - plus a
// hardcoded "5.0 on Google" badge unconnected to the real profile. Nothing here
// falls back to sample content: with no live data the section renders nothing.
type Testimonial = { name: string; text: string; rating: number };

const ReviewCard = ({ t }: { t: Testimonial }) => (
  <div className="inline-flex items-start gap-3 bg-card border border-border/50 rounded-xl px-5 py-4 min-w-[300px] max-w-[340px] shadow-sm flex-shrink-0 mr-6 transition-[transform,box-shadow,color,background-color,border-color] ease-out duration-base hover:-translate-y-1 hover:shadow-lg hover:border-secondary/40">
    <Quote className="w-5 h-5 text-secondary/40 flex-shrink-0 mt-0.5" />
    <div className="whitespace-normal">
      <p className="text-sm text-foreground leading-snug mb-2">"{t.text}"</p>
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-secondary/20 flex items-center justify-center text-[10px] font-bold text-secondary">
          {t.name[0]}
        </div>
        <span className="text-xs text-muted-foreground font-medium">{t.name}</span>
        <div className="flex items-center gap-0.5 ml-auto">
          {[...Array(t.rating)].map((_, j) => (
            <Star key={j} className="w-2.5 h-2.5 fill-brand-gold text-brand-gold" />
          ))}
        </div>
      </div>
    </div>
  </div>
);

const ClientMarquee = () => {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [rating, setRating] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    supabase.functions
      .invoke("google-reviews")
      .then(({ data, error }) => {
        if (!active || error || !data) return;
        const feed = data as {
          rating: number | null;
          reviews: { name: string; rating: number; content: string }[];
        };
        setRating(feed.rating);
        setTestimonials(
          (feed.reviews ?? []).map((r) => ({ name: r.name, text: r.content, rating: r.rating })),
        );
      })
      .catch(() => {
        /* leave the section hidden - never substitute sample testimonials */
      });
    return () => {
      active = false;
    };
  }, []);

  // Nothing real to show yet: render nothing rather than an empty shell.
  if (testimonials.length === 0) return null;

  // Duplicate enough items so one set is wider than any screen
  const items = [...testimonials, ...testimonials, ...testimonials];

  return (
    <section className="py-8 md:py-12 bg-muted/30 border-y border-border/30 overflow-hidden">
      <div className="container mx-auto px-4 mb-4">
        <div className="flex items-center justify-center gap-2">
          {rating !== null && (
            <>
              <div className="flex items-center gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${i < Math.round(rating) ? "fill-brand-gold text-brand-gold" : "text-muted-foreground/40"}`}
                  />
                ))}
              </div>
              <span className="text-sm font-semibold text-foreground">
                {rating.toFixed(1)} on Google
              </span>
            </>
          )}
          <span className="text-muted-foreground text-sm">• What our clients say</span>
        </div>
      </div>

      <div className="marquee-pause relative overflow-hidden py-2 flex" style={{ maskImage: 'linear-gradient(to right, transparent, black 5%, black 95%, transparent)' }}>
        <div
          className="flex shrink-0 animate-marquee-scroll"
          style={{ willChange: "transform", animationDuration: "50s" }}
        >
          {items.map((t, i) => (
            <div key={`primary-${i}`} aria-hidden={i >= testimonials.length ? "true" : "false"}>
              <ReviewCard t={t} />
            </div>
          ))}
        </div>
        <div
          className="flex shrink-0 animate-marquee-scroll"
          style={{ willChange: "transform", animationDuration: "50s" }}
          aria-hidden="true"
        >
          {items.map((t, i) => (
            <ReviewCard key={`secondary-${i}`} t={t} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default ClientMarquee;
