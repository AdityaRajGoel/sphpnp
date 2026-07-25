import { Star, Quote } from "lucide-react";

const quickTestimonials = [
  { name: "Ravi K.", text: "Best advisory service in Panipat. My portfolio grew 40% in 2 years.", rating: 5 },
  { name: "Sunita M.", text: "Anil ji's guidance on long-term SIPs has been life-changing.", rating: 5 },
  { name: "Deepak S.", text: "Very professional team. Quick KYC and account opening.", rating: 5 },
  { name: "Priya G.", text: "Trusted family advisor for over 15 years. Highly recommend!", rating: 5 },
  { name: "Ankit T.", text: "Excellent research calls. Consistently good returns.", rating: 5 },
  { name: "Meena D.", text: "Rajat bhai handles all my mutual fund paperwork seamlessly.", rating: 5 },
];

const ReviewCard = ({ t }: { t: typeof quickTestimonials[0] }) => (
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
  // Duplicate enough items so one set is wider than any screen
  const items = [...quickTestimonials, ...quickTestimonials, ...quickTestimonials];

  return (
    <section className="py-8 md:py-12 bg-muted/30 border-y border-border/30 overflow-hidden">
      <div className="container mx-auto px-4 mb-4">
        <div className="flex items-center justify-center gap-2">
          <div className="flex items-center gap-0.5">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-4 h-4 fill-brand-gold text-brand-gold" />
            ))}
          </div>
          <span className="text-sm font-semibold text-foreground">5.0 on Google</span>
          <span className="text-muted-foreground text-sm">• What our clients say</span>
        </div>
      </div>

      <div className="marquee-pause relative overflow-hidden py-2 flex" style={{ maskImage: 'linear-gradient(to right, transparent, black 5%, black 95%, transparent)' }}>
        <div
          className="flex shrink-0 animate-marquee-scroll"
          style={{ willChange: "transform", animationDuration: "50s" }}
        >
          {items.map((t, i) => (
            <div key={`primary-${i}`} aria-hidden={i >= quickTestimonials.length ? "true" : "false"}>
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
