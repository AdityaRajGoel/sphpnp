import { Star, ExternalLink, MessageSquare } from "lucide-react";
import { motion, Variants, useScroll, useTransform } from "motion/react";
import { Button } from "@/components/ui/button";
import { useRef } from "react";
import { EASE_OUT } from "@/lib/motion";

const googleReviews = [
  {
    name: "Mohit Sharma",
    rating: 5,
    time: "2 months ago",
    content: "Excellent service and very professional team. They guided me through the entire trading process. Highly recommended for anyone looking to invest in the stock market.",
    avatar: "M",
  },
  {
    name: "Ankit Gupta",
    rating: 5,
    time: "3 months ago",
    content: "Best stock broker in Panipat. Very knowledgeable staff and they provide great research tips. Been trading with them for 2 years now.",
    avatar: "A",
  },
  {
    name: "Rakesh Verma",
    rating: 5,
    time: "4 months ago",
    content: "Very trustworthy and reliable. The Parasram team is always available to help with any queries. Great brokerage rates too!",
    avatar: "R",
  },
  {
    name: "Pradeep Kumar",
    rating: 5,
    time: "5 months ago",
    content: "Outstanding experience! They offer both online and offline trading options. The staff is very helpful and explains everything clearly.",
    avatar: "P",
  },
  {
    name: "Sunil Jain",
    rating: 5,
    time: "6 months ago",
    content: "Legacy brokers with modern facilities. Very happy with their service. They have been in the business for decades and it shows in their expertise.",
    avatar: "S",
  },
];

const GoogleReviews = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const bgY = useTransform(scrollYProgress, [0, 1], [30, -30]);

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const cardVariants: Variants = {
    hidden: { opacity: 0, y: 40, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.5, ease: EASE_OUT },
    },
  };

  return (
    <section ref={sectionRef} id="google-reviews" className="py-10 md:py-20 bg-gradient-to-b from-background to-muted/30 relative overflow-hidden">
      {/* Background decorations */}
      <motion.div className="absolute inset-0 pointer-events-none" style={{ y: bgY }}>
        <div
          className="absolute top-10 right-20 w-72 h-72 bg-brand-gold/5 rounded-full blur-3xl"
        />
        <div
          className="absolute bottom-10 left-10 w-80 h-80 bg-secondary/5 rounded-full blur-3xl"
        />
      </motion.div>

      {/* Floating stars background */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute text-brand-gold/10"
            style={{ top: `${15 + i * 18}%`, left: `${5 + i * 20}%` }}
            animate={{ y: [0, -10, 0], rotate: [0, 15, 0], opacity: [0.1, 0.3, 0.1] }}
            transition={{ duration: 4 + i, repeat: Infinity, delay: i * 0.5 }}
          >
            <Star className="w-6 h-6 fill-current" />
          </motion.div>
        ))}
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <motion.span
            className="inline-block text-secondary font-semibold text-sm uppercase tracking-wider mb-4"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            Google Reviews
          </motion.span>
          <h2 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
            What People Say on Google
          </h2>
          <motion.div
            className="w-20 h-1 bg-gradient-to-r from-brand-gold to-secondary mx-auto rounded-full mb-6"
            initial={{ width: 0 }}
            whileInView={{ width: 80 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.6 }}
          />

          {/* Rating summary */}
          <motion.div
            className="inline-flex items-center gap-4 bg-card border border-border rounded-2xl px-8 py-4 shadow-lg"
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            whileHover={{ scale: 1.03, boxShadow: "0 20px 40px -10px hsl(45 90% 50% / 0.15)" }}
          >
            <motion.div
              className="text-5xl font-bold text-foreground"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              5.0
            </motion.div>
            <div className="text-left">
              <div className="flex gap-0.5 mb-1">
                {[...Array(5)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0, rotate: -180 }}
                    whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + i * 0.1 }}
                  >
                    <Star className="w-5 h-5 fill-brand-gold text-brand-gold" />
                  </motion.div>
                ))}
              </div>
              <div className="text-sm text-muted-foreground">Based on 5 Google Reviews</div>
            </div>
            <img
              src="https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_92x30dp.png"
              alt="Google Reviews logo"
              loading="lazy"
              width={92}
              height={30}
              className="h-6 ml-2 opacity-70"
            />
          </motion.div>
        </motion.div>

        {/* Reviews grid */}
        <motion.div
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          {googleReviews.map((review, index) => (
            <motion.div
              key={review.name}
              className="group bg-card rounded-2xl p-6 shadow-md hover:shadow-xl transition-shadow duration-500 border border-border/50 relative"
              variants={cardVariants}
              whileHover={{ y: -8, scale: 1.02 }}
            >
              {/* Google icon badge */}
              <motion.div
                className="absolute -top-2 -right-2 w-8 h-8 bg-card rounded-full border border-border shadow-md flex items-center justify-center"
                initial={{ scale: 0, rotate: -180 }}
                whileInView={{ scale: 1, rotate: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 + index * 0.1, type: "spring" }}
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              </motion.div>

              {/* Author row */}
              <div className="flex items-center gap-3 mb-4">
                <motion.div
                  className="w-10 h-10 rounded-full bg-gradient-to-br from-secondary to-brand-green flex items-center justify-center text-white font-bold text-sm"
                  whileHover={{ scale: 1.15, rotate: 10 }}
                >
                  {review.avatar}
                </motion.div>
                <div>
                  <div className="font-semibold text-foreground text-sm">{review.name}</div>
                  <div className="text-xs text-muted-foreground">{review.time}</div>
                </div>
              </div>

              {/* Stars */}
              <div className="flex gap-0.5 mb-3">
                {[...Array(review.rating)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0, rotate: -180 }}
                    whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.05 * i + index * 0.05 }}
                  >
                    <Star className="w-4 h-4 fill-brand-gold text-brand-gold" />
                  </motion.div>
                ))}
              </div>

              {/* Review text */}
              <p className="text-muted-foreground text-sm leading-relaxed">
                "{review.content}"
              </p>

              {/* Hover gradient */}
              <motion.div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand-gold/5 to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            </motion.div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          className="text-center flex flex-col sm:flex-row items-center justify-center gap-4"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
        >
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
            <Button asChild className="btn-shine bg-gradient-to-r from-secondary to-brand-green hover:from-secondary/90 hover:to-brand-green/90 text-secondary-foreground font-semibold">
              <a
                href="https://search.google.com/local/writereview?placeid=ChIJ6zHm2Pzb0TkRJ_5hCPHVKaw"
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Write a Review
              </a>
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
            <Button asChild variant="outline" className="border-border">
              <a
                href="https://share.google/BzommM8rixb1emIzj"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                See All Reviews on Google
              </a>
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default GoogleReviews;
