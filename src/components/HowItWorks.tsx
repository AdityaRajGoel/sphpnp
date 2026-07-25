import { motion } from "motion/react";
import { Rocket, Shield, Users, Globe } from "lucide-react";
import ScrollySteps, { ScrollyStep } from "@/components/ScrollySteps";

const steps: ScrollyStep[] = [
  { icon: Globe, title: "Visit Our Branch Or Call Us", desc: "Walk into our Panipat office at Shakuntala Complex, call us or fill out the form for us to contact you.", num: "01", accent: "pulse" },
  { icon: Shield, title: "KYC Verification", desc: "Complete your KYC with Aadhaar, PAN, and bank details.", num: "02", accent: "check" },
  { icon: Users, title: "Account Opening", desc: "Open your Demat & Trading account in minutes.", num: "03", accent: "sparkle" },
  { icon: Rocket, title: "Start Trading", desc: "Begin investing in stocks, F&O, mutual funds, IPOs and more.", num: "04", accent: "chart" },
];

const HowItWorks = () => {
  return (
    <section className="py-10 md:py-20 bg-background relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute bottom-20 right-20 w-80 h-80 bg-secondary/5 rounded-full blur-3xl"
        />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="inline-block text-secondary font-semibold text-sm uppercase tracking-wider mb-3">
            Get Started
          </span>
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-4">
            How It Works
          </h2>
          <motion.div
            className="w-20 h-1 bg-gradient-to-r from-secondary to-brand-gold mx-auto rounded-full"
            initial={{ width: 0 }}
            whileInView={{ width: 80 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.6 }}
          />
        </motion.div>

        <ScrollySteps steps={steps} />
      </div>
    </section>
  );
};

export default HowItWorks;
