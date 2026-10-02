import { motion } from "motion/react";
import { useState, useRef } from "react";
import { Send, Loader2, CheckCircle2, User, Phone, Mail, MessageSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { RippleButton } from "@/components/ui/ripple-button";
import { FieldMessage, fieldStateClass } from "@/components/ui/form-field";
import { validateAll, validateEmail, validateName, validatePhone, type FieldCheck } from "@/lib/form-validation";

import { revealSection } from "@/lib/motion";

type Field = "name" | "phone" | "email" | "message";

// Same checks as the /open-account form, so a number accepted there is accepted here.
const CHECKS: Partial<Record<Field, FieldCheck>> = {
  name: validateName,
  phone: validatePhone,
  email: validateEmail({ optional: true }),
};

const RequiredMark = () => (
  <>
    <span className="text-destructive" aria-hidden="true"> *</span>
    <span className="sr-only"> (required)</span>
  </>
);

const ContactForm = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", message: "" });
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const formRenderTime = useRef(Date.now());

  const errors = validateAll(form, CHECKS);
  const shownError = (field: Field) => (touched[field] ? errors[field] ?? null : null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // Judge a field once it has been left with something in it, so tabbing past an
  // empty field does not shout; submit marks every field.
  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const name = e.target.name as Field;
    if (form[name].trim()) setTouched((prev) => ({ ...prev, [name]: true }));
  };

  const fieldProps = (field: "name" | "phone" | "email") => ({
    id: `contact-${field}`,
    name: field,
    value: form[field],
    onChange: handleChange,
    onBlur: handleBlur,
    "aria-invalid": shownError(field) ? true : undefined,
    "aria-describedby": `contact-${field}-message`,
    className: `pl-10 ${fieldStateClass(shownError(field), touched[field] && !errors[field] && !!form[field].trim())}`,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check honeypot
    const honeypot = (e.target as HTMLFormElement).querySelector<HTMLInputElement>('[name="_website"]');
    if (honeypot && honeypot.value) return;

    const invalid = Object.keys(validateAll(form, CHECKS));
    if (invalid.length > 0) {
      setTouched({ name: true, phone: true, email: true });
      document.getElementById(`contact-${invalid[0]}`)?.focus();
      return;
    }

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

      if (data?.success === false) {
        // Transport succeeded but the lead was not persisted server-side.
        // Never show the success state - offer the WhatsApp fallback instead.
        toast({
          title: "We couldn't save your details",
          description: data?.whatsappUrl
            ? "Please message us directly on WhatsApp and we'll take it from there."
            : "Please call us directly.",
          variant: "destructive",
        });
        if (data?.whatsappUrl) {
          window.open(data.whatsappUrl, "_blank");
        }
        return;
      }

      setSubmitted(true);
      toast({ title: "Message sent", description: "We'll get back to you shortly." });
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
      noValidate
      className="bg-card border border-border/50 rounded-2xl p-6 md:p-8 shadow-lg space-y-4"
      {...revealSection}
    >
      <h3 className="font-heading text-xl font-bold text-foreground mb-1">Send Us a Message</h3>
      <p className="text-muted-foreground text-sm mb-4">Fill out the form and we'll get back to you within a business day.</p>

      {/* Honeypot field - hidden from humans, visible to bots */}
      <div className="absolute opacity-0 -z-10" style={{ position: 'absolute', left: '-9999px' }} aria-hidden="true">
        <Input name="_website" tabIndex={-1} autoComplete="off" />
      </div>

      <p className="text-xs text-muted-foreground">
        Fields marked <span className="text-destructive" aria-hidden="true">*</span><span className="sr-only">with an asterisk</span> are required.
      </p>

      <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2">
        <div>
          <Label htmlFor="contact-name" className="text-xs font-semibold text-foreground mb-1.5 block">
            Your name<RequiredMark />
          </Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input {...fieldProps("name")} placeholder="As on your PAN card" maxLength={100} required aria-required="true" autoComplete="name" />
          </div>
          <FieldMessage id="contact-name-message" error={shownError("name")} />
        </div>
        <div>
          <Label htmlFor="contact-phone" className="text-xs font-semibold text-foreground mb-1.5 block">
            Mobile number<RequiredMark />
          </Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input {...fieldProps("phone")} placeholder="98765 43210" maxLength={20} required aria-required="true" type="tel" inputMode="tel" autoComplete="tel" />
          </div>
          <FieldMessage id="contact-phone-message" error={shownError("phone")} />
        </div>
      </div>

      <div>
        <Label htmlFor="contact-email" className="text-xs font-semibold text-foreground mb-1.5 block">
          Email <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
          <Input {...fieldProps("email")} type="email" inputMode="email" placeholder="name@example.com" maxLength={255} autoComplete="email" />
        </div>
        <FieldMessage id="contact-email-message" error={shownError("email")} />
      </div>

      <div>
        <Label htmlFor="contact-message" className="text-xs font-semibold text-foreground mb-1.5 block">
          Message <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <div className="relative">
          <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" aria-hidden="true" />
          {/* text-base below md: iOS zooms into any field under 16px. */}
          <Textarea id="contact-message" name="message" aria-describedby="contact-message-count" placeholder="How can we help?" value={form.message} onChange={handleChange} className="pl-10 min-h-[100px] text-base md:text-sm" maxLength={1000} />
        </div>
        <p id="contact-message-count" className="text-muted-foreground text-xs mt-1 text-right tabular-nums">{form.message.length} / 1000</p>
      </div>

      <RippleButton type="submit" disabled={loading} className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold">
        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
        {loading ? "Sending..." : "Send Message"}
      </RippleButton>
    </motion.form>
  );
};

export default ContactForm;
