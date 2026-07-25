import { motion } from "motion/react";
import { useState, useRef } from "react";
import { Send, Loader2, CheckCircle2, User, Phone, Mail, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { RippleButton } from "@/components/ui/ripple-button";

import { revealSection } from "@/lib/motion";
const PHONE_REGEX = /^(\+?91)?[6-9]\d{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ContactForm = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formRenderTime = useRef(Date.now());

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    const trimName = form.name.trim();
    const trimPhone = form.phone.trim().replace(/[\s-]/g, '');

    if (!trimName || trimName.length < 2) newErrors.name = "Name is required (min 2 chars)";
    if (trimName.length > 100) newErrors.name = "Name is too long (max 100 chars)";
    if (!trimPhone || !PHONE_REGEX.test(trimPhone)) newErrors.phone = "Valid Indian phone number required";
    if (form.email.trim() && !EMAIL_REGEX.test(form.email.trim())) newErrors.email = "Invalid email address";
    if (form.email.trim().length > 255) newErrors.email = "Email is too long";
    if (form.message.trim().length > 1000) newErrors.message = "Message too long (max 1000 chars)";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check honeypot
    const honeypot = (e.target as HTMLFormElement).querySelector<HTMLInputElement>('[name="_website"]');
    if (honeypot && honeypot.value) return;

    if (!validate()) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("submit-lead", {
        body: {
          name: form.name.trim().slice(0, 100),
          phone: form.phone.trim().slice(0, 20),
          email: form.email.trim().slice(0, 255) || undefined,
          message: form.message.trim().slice(0, 1000) || undefined,
          city: "Contact Page Inquiry",
          _website: "", // honeypot should be empty
          _ts: formRenderTime.current, // timestamp for CSRF
        },
      });
      if (error) throw error;
      setSubmitted(true);
      toast({ title: "Message sent! ✅", description: "We'll get back to you shortly." });
      if (data?.whatsappUrl) {
        window.open(data.whatsappUrl, "_blank");
      }
    } catch {
      toast({ title: "Something went wrong", description: "Please call us directly.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <motion.div
        className="bg-card border border-secondary/30 rounded-2xl p-8 text-center shadow-lg"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <motion.div
          className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-4"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <CheckCircle2 className="w-8 h-8 text-secondary" />
        </motion.div>
        <h3 className="font-heading text-xl font-bold text-foreground mb-2">Message Sent!</h3>
        <p className="text-muted-foreground text-sm">Our team will contact you within 24 hours.</p>
      </motion.div>
    );
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      className="bg-card border border-border/50 rounded-2xl p-6 md:p-8 shadow-lg space-y-4"
      {...revealSection}
    >
      <h3 className="font-heading text-xl font-bold text-foreground mb-1">Send Us a Message</h3>
      <p className="text-muted-foreground text-sm mb-4">Fill out the form and we'll get back to you within a business day.</p>

      {/* Honeypot field - hidden from humans, visible to bots */}
      <div className="absolute opacity-0 -z-10" style={{ position: 'absolute', left: '-9999px' }} aria-hidden="true">
        <Input name="_website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input name="name" aria-label="Your Name" placeholder="Your Name *" value={form.name} onChange={handleChange} className="pl-10" maxLength={100} required />
          </div>
          {errors.name && <p className="text-destructive text-xs mt-1">{errors.name}</p>}
        </div>
        <div>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input name="phone" aria-label="Phone Number" placeholder="Phone Number *" value={form.phone} onChange={handleChange} className="pl-10" maxLength={15} required />
          </div>
          {errors.phone && <p className="text-destructive text-xs mt-1">{errors.phone}</p>}
        </div>
      </div>

      <div>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input name="email" aria-label="Email Address" type="email" placeholder="Email (optional)" value={form.email} onChange={handleChange} className="pl-10" maxLength={255} />
        </div>
        {errors.email && <p className="text-destructive text-xs mt-1">{errors.email}</p>}
      </div>

      <div>
        <div className="relative">
          <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
          <Textarea name="message" aria-label="Your Message" placeholder="Your message..." value={form.message} onChange={handleChange} className="pl-10 min-h-[100px]" maxLength={1000} />
        </div>
        {errors.message && <p className="text-destructive text-xs mt-1">{errors.message}</p>}
        <p className="text-muted-foreground text-[10px] mt-1 text-right">{form.message.length}/1000</p>
      </div>

      <RippleButton type="submit" disabled={loading} className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold">
        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
        {loading ? "Sending..." : "Send Message"}
      </RippleButton>
    </motion.form>
  );
};

export default ContactForm;
