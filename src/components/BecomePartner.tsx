import { motion } from "motion/react";
import { useState, useRef } from "react";
import { Send, Loader2, CheckCircle2, User, Phone, Mail, MapPin, Building, Briefcase, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const PHONE_REGEX = /^(\+?91)?[6-9]\d{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const benefits = [
  { icon: Briefcase, text: "Full product suite - Equity, F&O, MF, Insurance" },
  { icon: Users, text: "Marketing & client acquisition support" },
  { icon: Building, text: "Technology platform & back-office" },
  { icon: MapPin, text: "Pan India presence - 50+ years brand trust" },
];

const BecomePartner = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", city: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formRenderTime = useRef(Date.now());

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    const trimName = form.name.trim();
    const trimPhone = form.phone.trim().replace(/[\s-]/g, "");

    if (!trimName || trimName.length < 2) newErrors.name = "Name required";
    if (!trimPhone || !PHONE_REGEX.test(trimPhone)) newErrors.phone = "Valid Indian phone required";
    if (form.email.trim() && !EMAIL_REGEX.test(form.email.trim())) newErrors.email = "Invalid email";
    if (!form.city.trim()) newErrors.city = "City required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const honeypot = (e.target as HTMLFormElement).querySelector<HTMLInputElement>('[name="_website"]');
    if (honeypot && honeypot.value) return;
    if (!validate()) return;

    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("submit-lead", {
        body: {
          name: form.name.trim().slice(0, 100),
          phone: form.phone.trim().slice(0, 20),
          email: form.email.trim().slice(0, 255) || undefined,
          city: `Partner Inquiry - ${form.city.trim().slice(0, 100)}`,
          message: "Business Partner / Associate Inquiry",
          _website: "",
          _ts: formRenderTime.current,
        },
      });
      if (error) throw error;
      setSubmitted(true);
      toast({ title: "Application received! ✅", description: "Our team will reach out within 24 hours." });
    } catch {
      toast({ title: "Something went wrong", description: "Please call us directly at +91 9416400314.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="py-12 md:py-20 bg-hero overflow-hidden relative">
      {/* Background accents */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-20 right-20 w-80 h-80 bg-secondary/10 rounded-full blur-3xl"
        />
        <div
          className="absolute bottom-10 left-10 w-64 h-64 bg-brand-gold/10 rounded-full blur-3xl"
        />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          {/* Left - Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <motion.span
              className="inline-block text-secondary font-semibold text-sm uppercase tracking-wider mb-3"
              initial={{ opacity: 0, letterSpacing: "0em" }}
              whileInView={{ opacity: 1, letterSpacing: "0.15em" }}
              viewport={{ once: true }}
              transition={{ delay: 0.2, duration: 0.8 }}
            >
              Partner With Us
            </motion.span>
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
              Become a{" "}
              <span className="text-shimmer text-transparent bg-clip-text bg-gradient-to-r from-secondary via-brand-gold to-secondary">
                Business Associate
              </span>
            </h2>
            <p className="text-primary-foreground/80 text-lg mb-8 max-w-lg">
              Join Parasram India's growing network of authorized business partners. Earn attractive commissions while helping investors in your city grow their wealth.
            </p>

            <div className="grid sm:grid-cols-2 gap-4 mb-6">
              {benefits.map((b, i) => (
                <motion.div
                  key={b.text}
                  className="flex items-start gap-3"
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                >
                  <div className="w-9 h-9 bg-secondary/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <b.icon className="w-4 h-4 text-secondary" />
                  </div>
                  <span className="text-primary-foreground/80 text-sm">{b.text}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right - Form */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {submitted ? (
              <motion.div
                className="bg-card/10 backdrop-blur-md border border-secondary/30 rounded-2xl p-8 text-center"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <motion.div
                  className="w-16 h-16 bg-secondary/20 rounded-full flex items-center justify-center mx-auto mb-4"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <CheckCircle2 className="w-8 h-8 text-secondary" />
                </motion.div>
                <h3 className="font-heading text-xl font-bold text-primary-foreground mb-2">Application Received!</h3>
                <p className="text-primary-foreground/70 text-sm">Our partnership team will contact you within 24 hours.</p>
              </motion.div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="border-beam bg-card/10 backdrop-blur-md border border-white/10 rounded-2xl p-6 md:p-8 space-y-4"
              >
                <h3 className="font-heading text-lg font-bold text-primary-foreground mb-1">Apply to Become a Partner</h3>
                <p className="text-primary-foreground/60 text-sm mb-4">Fill in your details and our team will get in touch.</p>

                {/* Honeypot */}
                <div className="absolute opacity-0 -z-10" style={{ position: "absolute", left: "-9999px" }} aria-hidden="true">
                  <Input name="_website" tabIndex={-1} autoComplete="off" />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-foreground/40" />
                      <Input
                        name="name"
                        aria-label="Your Name"
                        placeholder="Your Name *"
                        value={form.name}
                        onChange={handleChange}
                        className="pl-10 bg-white/10 border-white/20 text-primary-foreground placeholder:text-primary-foreground/40"
                        maxLength={100}
                        required
                      />
                    </div>
                    {errors.name && <p className="text-destructive text-xs mt-1">{errors.name}</p>}
                  </div>
                  <div>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-foreground/40" />
                      <Input
                        name="phone"
                        aria-label="Phone Number"
                        placeholder="Phone *"
                        value={form.phone}
                        onChange={handleChange}
                        className="pl-10 bg-white/10 border-white/20 text-primary-foreground placeholder:text-primary-foreground/40"
                        maxLength={15}
                        required
                      />
                    </div>
                    {errors.phone && <p className="text-destructive text-xs mt-1">{errors.phone}</p>}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-foreground/40" />
                      <Input
                        name="email"
                        type="email"
                        aria-label="Email Address"
                        placeholder="Email"
                        value={form.email}
                        onChange={handleChange}
                        className="pl-10 bg-white/10 border-white/20 text-primary-foreground placeholder:text-primary-foreground/40"
                        maxLength={255}
                      />
                    </div>
                    {errors.email && <p className="text-destructive text-xs mt-1">{errors.email}</p>}
                  </div>
                  <div>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-foreground/40" />
                      <Input
                        name="city"
                        aria-label="City or District"
                        placeholder="City / District *"
                        value={form.city}
                        onChange={handleChange}
                        className="pl-10 bg-white/10 border-white/20 text-primary-foreground placeholder:text-primary-foreground/40"
                        maxLength={100}
                        required
                      />
                    </div>
                    {errors.city && <p className="text-destructive text-xs mt-1">{errors.city}</p>}
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold transition-colors"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  {loading ? "Submitting..." : "Submit Application"}
                </Button>
              </form>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default BecomePartner;
