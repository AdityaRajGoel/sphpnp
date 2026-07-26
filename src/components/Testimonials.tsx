import { motion, Variants, useScroll, useTransform } from "motion/react";
import { Star, Quote, ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { EASE_OUT, revealFade, revealSection } from "@/lib/motion";

const testimonials = [
  {
    name: "Mohit Bansal",
    role: "Business Owner",
    location: "Panipat",
    content: "I have been with Parasram for over 8 years. Their team in Panipat genuinely cares about your portfolio. They helped me diversify from just FDs to equity and mutual funds - my returns have grown significantly since then.",
    rating: 5,
  },
  {
    name: "Neha Yadav",
    role: "School Principal",
    location: "Panipat",
    content: "As a woman investor, I was initially hesitant. The staff at Parasram Panipat were extremely patient and explained every aspect of investing. Today I manage my own SIPs and equity portfolio confidently.",
    rating: 5,
  },
  {
    name: "Rajeev Mittal",
    role: "Textile Manufacturer",
    location: "Panipat",
    content: "Panipat's textile industry is volatile - I needed stable returns outside my business. Parasram's research team recommended the right mix of blue-chip stocks and mutual funds. Very happy with the results over 5 years.",
    rating: 5,
  },
  {
    name: "Dr. Sandeep Garg",
    role: "Surgeon",
    location: "Panipat",
    content: "I don't have time to track markets daily. Parasram's advisory calls and the Trade app keep me updated without any hassle. Their IPO alerts alone have helped me earn substantial listing gains.",
    rating: 5,
  },
  {
    name: "Pooja Khatri",
    role: "CA Professional",
    location: "Panipat",
    content: "Being from a finance background, I know what good advice looks like. Parasram's research is solid - their derivative strategies are well-thought-out. The Panipat team is responsive even on weekends.",
    rating: 5,
  },
  {
    name: "Harish Aggarwal",
    role: "Retired Govt. Officer",
    location: "Panipat",
    content: "After retirement I wanted safe but growing investments. The team suggested a perfect mix of dividend stocks and debt funds. I get regular income now without worrying about market crashes. Trusted them for 12 years.",
    rating: 5,
  },
];

const Testimonials = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const bgY = useTransform(scrollYProgress, [0, 1], [40, -40]);

  // Auto-rotate testimonials
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15 },
    },
  };

  const cardVariants: Variants = {
    hidden: { opacity: 0, y: 50, scale: 0.9 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.6, ease: EASE_OUT },
    },
  };

  const visibleTestimonials = [
    testimonials[activeIndex],
    testimonials[(activeIndex + 1) % testimonials.length],
    testimonials[(activeIndex + 2) % testimonials.length],
  ];

  return (
    <section ref={sectionRef} id="testimonials" className="py-12 md:py-24 bg-gradient-to-b from-muted/50 to-background relative overflow-hidden">
      {/* Background decoration with parallax */}
      <motion.div className="absolute inset-0 pointer-events-none" style={{ y: bgY }}>
        <div
          className="absolute top-20 left-10 w-64 h-64 bg-secondary/5 rounded-full blur-3xl"
        />
        <div
          className="absolute bottom-20 right-10 w-80 h-80 bg-brand-gold/5 rounded-full blur-3xl"
        />
        {/* Floating quote marks */}
        <motion.div
          className="absolute top-1/4 right-1/4 text-secondary/10 text-[120px] font-serif leading-none select-none"
          animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }}
          transition={{ duration: 6, repeat: Infinity }}
        >
          "
        </motion.div>
        <motion.div
          className="absolute bottom-1/4 left-1/6 text-brand-gold/10 text-[80px] font-serif leading-none select-none"
          animate={{ y: [0, 15, 0], rotate: [0, -5, 0] }}
          transition={{ duration: 8, repeat: Infinity, delay: 2 }}
        >
          "
        </motion.div>
      </motion.div>

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          className="text-center mb-16"
          {...revealSection}
        >
          <motion.span
            className="inline-block text-secondary font-semibold text-sm uppercase tracking-wider mb-4"
            {...revealFade}
          >
            Client Stories
          </motion.span>
          <h2 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
            Trusted by <motion.span className="text-secondary" animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 2, repeat: Infinity }}>Panipat's</motion.span> Investors
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Real stories from real investors who trust Parasram with their financial journey.
          </p>
        </motion.div>

        {/* Featured testimonial */}
        <motion.div
          className="max-w-3xl mx-auto mb-16"
          {...revealSection}
        >
          <motion.div
            key={activeIndex}
            className="bg-card rounded-3xl p-8 md:p-12 shadow-2xl border border-border/50 relative overflow-hidden"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.5 }}
          >
            <motion.div
              className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-secondary via-brand-gold to-secondary"
              animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
              transition={{ duration: 4, repeat: Infinity }}
              style={{ backgroundSize: "200% 100%" }}
            />
            <Quote className="w-10 h-10 text-secondary/20 mb-4" />
            <p className="text-foreground text-lg md:text-xl leading-relaxed mb-6 italic">
              "{testimonials[activeIndex].content}"
            </p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <motion.div
                  className="w-14 h-14 rounded-full bg-gradient-to-br from-secondary to-brand-green flex items-center justify-center text-white font-bold text-lg shadow-lg"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  {testimonials[activeIndex].name.charAt(0)}
                </motion.div>
                <div>
                  <div className="font-heading font-bold text-foreground text-lg">{testimonials[activeIndex].name}</div>
                  <div className="text-muted-foreground text-sm">{testimonials[activeIndex].role} • {testimonials[activeIndex].location}</div>
                </div>
              </div>
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-brand-gold text-brand-gold" />
                ))}
              </div>
            </div>

            {/* Navigation dots */}
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                aria-label="Previous testimonial"
                onClick={() => setActiveIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length)}
                className="p-1 rounded-full hover:bg-muted transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-muted-foreground" />
              </button>
              {testimonials.map((_, i) => (
                <motion.button
                  key={i}
                  aria-label={`Show testimonial ${i + 1} of ${testimonials.length}`}
                  aria-current={i === activeIndex}
                  onClick={() => setActiveIndex(i)}
                  className={`tap-area rounded-full transition-colors duration-base ${i === activeIndex ? "w-8 h-2 bg-secondary" : "w-2 h-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"}`}
                  whileHover={{ scale: 1.2 }}
                />
              ))}
              <button
                aria-label="Next testimonial"
                onClick={() => setActiveIndex((prev) => (prev + 1) % testimonials.length)}
                className="p-1 rounded-full hover:bg-muted transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          </motion.div>
        </motion.div>

        {/* Testimonial cards grid */}
        <motion.div
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {visibleTestimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.name}
              className="group relative bg-card rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-shadow duration-slow border border-border/50"
              variants={cardVariants}
              whileHover={{ y: -10, scale: 1.02 }}
            >
              {/* Quote icon */}
              <motion.div
                className="absolute -top-3 -right-3 w-10 h-10 bg-gradient-to-br from-secondary to-brand-green rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-base"
                initial={{ rotate: 0 }}
                whileHover={{ rotate: 180 }}
              >
                <Quote className="w-4 h-4 text-white" />
              </motion.div>

              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 * i }}
                  >
                    <Star className="w-4 h-4 fill-brand-gold text-brand-gold" />
                  </motion.div>
                ))}
              </div>

              {/* Content */}
              <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                "{testimonial.content}"
              </p>

              {/* Author */}
              <div className="flex items-center gap-3">
                <motion.div
                  className="w-12 h-12 rounded-full bg-gradient-to-br from-secondary to-brand-green flex items-center justify-center text-white font-bold"
                  whileHover={{ scale: 1.1 }}
                >
                  {testimonial.name.charAt(0)}
                </motion.div>
                <div>
                  <div className="font-semibold text-foreground">{testimonial.name}</div>
                  <div className="text-xs text-muted-foreground">{testimonial.role} • {testimonial.location}</div>
                </div>
              </div>

              {/* Hover gradient effect */}
              <motion.div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-secondary/5 to-brand-gold/5 opacity-0 group-hover:opacity-100 transition-opacity duration-slow pointer-events-none" />
            </motion.div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          className="text-center mt-16"
          {...revealSection}
          transition={{ delay: 0.5 }}
        >
          <p className="text-muted-foreground mb-4">Ready to start your investment journey?</p>
          <Link
            to="/contact"
            className="group inline-flex items-center gap-2 text-secondary font-semibold"
          >
            Get in touch with us today
            <motion.span
              animate={{ x: [0, 5, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              →
            </motion.span>
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default Testimonials;
