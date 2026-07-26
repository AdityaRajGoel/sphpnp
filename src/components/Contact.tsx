import { MapPin, Phone, Mail, Clock, ExternalLink, Instagram, Facebook, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import brandImage from "@/assets/parasram-brand.jpeg";
import { EASE_OUT, revealFade, revealItem, revealItemX, revealPop, revealSection } from "@/lib/motion";

const contactItems = [
  {
    icon: MapPin,
    title: "Office Address",
    content: (
      <>
        Shri Parasram Holdings<br />
        Shakuntala Complex, Palika Bazaar<br />
        Panipat, Haryana - 132103
      </>
    ),
  },
  {
    icon: Phone,
    title: "Phone",
    content: (
      <>
        <a href="tel:+919416400314" className="hover:text-secondary transition-colors">+91 9416400314</a><br />
        <a href="tel:+919999790011" className="hover:text-secondary transition-colors">+91 9999790011</a><br />
        <a href="tel:+919416400277" className="hover:text-secondary transition-colors">+91 9416400277</a>
      </>
    ),
  },
  {
    icon: Mail,
    title: "Email",
    content: (
      <a href="mailto:parasrampnp@gmail.com" className="hover:text-secondary transition-colors">
        parasrampnp@gmail.com
      </a>
    ),
  },
  {
    icon: Instagram,
    title: "Social Media",
    content: (
      <div className="flex flex-col gap-1">
        <a href="https://www.instagram.com/parasrampanipat/" target="_blank" rel="noopener noreferrer" className="hover:text-secondary transition-colors">
          Instagram: @parasrampanipat
        </a>
        <a href="https://www.facebook.com/share/18B5W5rZaT/" target="_blank" rel="noopener noreferrer" className="hover:text-secondary transition-colors flex items-center gap-1">
          <Facebook className="w-3.5 h-3.5" /> Facebook
        </a>
      </div>
    ),
  },
  {
    icon: Clock,
    title: "Working Hours",
    content: (
      <>
        Monday – Friday: 9:00 AM – 6:00 PM<br />
        Saturday: 9:00 AM – 2:00 PM<br />
        Sunday: Closed
      </>
    ),
  },
];

const Contact = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const mapY = useTransform(scrollYProgress, [0, 1], [30, -30]);

  return (
    <section ref={sectionRef} id="contact" className="py-10 md:py-20 bg-muted/50 relative overflow-hidden">
      {/* Ambient background orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-10 left-20 w-72 h-72 bg-secondary/5 rounded-full blur-3xl"
        />
        <div
          className="absolute bottom-10 right-20 w-80 h-80 bg-brand-gold/5 rounded-full blur-3xl"
        />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          className="text-center mb-12"
          {...revealSection}
        >
          <motion.span
            className="inline-block text-secondary font-semibold text-sm uppercase tracking-wider mb-3"
            {...revealFade}
            transition={{ delay: 0.2 }}
          >
            Get In Touch
          </motion.span>
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-4">
            Contact Us
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Reach out to us for personalized investment guidance
          </p>
        </motion.div>

        {/* Brand Banner */}
        <motion.div
          className="mb-12 flex justify-center"
          {...revealSection}
          transition={{ duration: 0.7, ease: EASE_OUT }}
        >
          <motion.div
            className="bg-card rounded-3xl shadow-2xl border border-border/50 overflow-hidden max-w-2xl w-full"
            whileHover={{ scale: 1.01, boxShadow: "0 30px 60px -15px hsl(213 80% 25% / 0.25)" }}
            transition={{ duration: 0.4 }}
          >
            <img
              src={brandImage}
              alt="Parasram - Science of Investment"
              loading="lazy"
              width={1536}
              height={1024}
              className="w-full h-auto"
            />
          </motion.div>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Contact cards */}
          <div className="space-y-4">
            {contactItems.map((item, index) => (
              <motion.div
                key={item.title}
                {...revealItemX("left")}
                whileHover={{ x: 6 }}
              >
                <Card className="bg-card border-border/50 hover:shadow-xl hover:border-secondary/40 transition-[box-shadow,color,background-color,border-color] duration-base group">
                  <CardContent className="p-5">
                    <div className="flex gap-4 items-start">
                      <motion.div
                        className="w-11 h-11 bg-primary/10 group-hover:bg-secondary/20 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors duration-base"
                        whileHover={{ rotate: [0, -12, 12, 0] }}
                        transition={{ duration: 0.5 }}
                      >
                        <item.icon className="w-5 h-5 text-primary group-hover:text-secondary transition-colors duration-base" />
                      </motion.div>
                      <div>
                        <h3 className="font-heading font-semibold text-foreground mb-1 group-hover:text-secondary transition-colors duration-base">
                          {item.title}
                        </h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">{item.content}</p>
                      </div>
                    </div>
                    {/* animated bottom line */}
                    <motion.div
                      className="h-0.5 bg-gradient-to-r from-secondary to-brand-gold mt-4 rounded-full"
                      initial={{ width: 0 }}
                      whileHover={{ width: "100%" }}
                      transition={{ duration: 0.3 }}
                    />
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Map & CTA */}
          <motion.div className="space-y-6" style={{ y: mapY }}>
            <motion.div
              className="rounded-2xl overflow-hidden border border-border/50 shadow-lg"
              {...revealPop()}
              whileHover={{ scale: 1.01, boxShadow: "0 20px 40px -10px hsl(145 70% 40% / 0.2)" }}
            >
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3469.037453247!2d76.96786!3d29.38917!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x390dda2a2b0e82e1%3A0x8a8a8a8a8a8a8a8a!2sShakuntala%20Complex%2C%20Palika%20Bazaar%2C%20Panipat%2C%20Haryana%20132103!5e0!3m2!1sen!2sin!4v1700000000000!5m2!1sen!2sin"
                width="100%"
                height="300"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Parasram Panipat Office Location"
                className="w-full"
              />
              <div className="bg-card p-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Shakuntala Complex, Palika Bazaar, Panipat</p>
                <Button asChild variant="outline" size="sm" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-colors duration-base">
                  <a href="https://maps.app.goo.gl/g9hDv9cKfdz28Hhx6" target="_blank" rel="noopener noreferrer">
                    Open in Maps
                    <ExternalLink className="ml-2 w-4 h-4" />
                  </a>
                </Button>
              </div>
            </motion.div>

            <motion.div
              {...revealSection}
              transition={{ delay: 0.2, duration: 0.6 }}
              whileHover={{ scale: 1.02 }}
            >
              <Card className="bg-hero text-primary-foreground overflow-hidden relative">
                {/* animated dot pattern */}
                <motion.div
                  className="absolute inset-0 opacity-10 pointer-events-none"
                  animate={{ backgroundPosition: ["0% 0%", "100% 100%"] }}
                  transition={{ duration: 20, repeat: Infinity, repeatType: "reverse" }}
                  style={{
                    backgroundImage: "radial-gradient(circle, hsl(145 70% 40%) 1px, transparent 1px)",
                    backgroundSize: "24px 24px",
                  }}
                />
                <CardContent className="p-8 text-center relative z-10">
                  <motion.h3
                    className="font-heading text-2xl font-bold mb-3"
                    {...revealItem()}
                    transition={{ delay: 0.3 }}
                  >
                    Ready to Start Investing?
                  </motion.h3>
                  <p className="text-primary-foreground/80 mb-6">
                    Open your Demat account today and get access to all our trading platforms
                  </p>
                  <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                    <Button
                      asChild
                      size="lg"
                      className="bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold w-full transition-colors duration-base group"
                    >
                      <a href="https://parasramindia.com" target="_blank" rel="noopener noreferrer">
                        Open Account Now
                        <motion.span
                          className="ml-2"
                          animate={{ x: [0, 4, 0] }}
                          transition={{ duration: 1.2, repeat: Infinity }}
                        >
                          <ArrowRight className="w-5 h-5 inline" />
                        </motion.span>
                      </a>
                    </Button>
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Contact;
