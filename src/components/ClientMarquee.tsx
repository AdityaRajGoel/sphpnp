import { Star, Quote } from "lucide-react";
import { GOOGLE_REVIEWS_SNAPSHOT } from "@/data/googleReviewsSnapshot";

// Testimonials come from the committed capture of the Google Business Profile
// (googleReviewsSnapshot.ts). This strip previously carried six invented
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
  // Sourced from the committed Google capture rather than the live Places API,
  // which was removed after it started failing closed. Never sample content:
  // this strip once carried six invented testimonials, and real names attached
  // to words they did not write is not a styling problem but a false claim.
  const testimonials: Testimonial[] = GOOGLE_REVIEWS_SNAPSHOT.reviews.map((r) => ({
    name: r.name,
    text: r.content,
    rating: r.rating,
  }));
  const rating = GOOGLE_REVIEWS_SNAPSHOT.rating;

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
