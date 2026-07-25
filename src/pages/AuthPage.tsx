import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, TrendingUp } from "lucide-react";
import SEOHead from "@/components/SEOHead";
import logo80 from "@/assets/logo-80.webp";
import logo160 from "@/assets/logo-160.webp";
import PageTransition from "@/components/PageTransition";

type AuthMode = "login" | "signup" | "forgot";

const AuthPage = () => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Welcome back!" });
      navigate("/");
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: "Password too short", description: "Must be at least 6 characters", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin,
      },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Signup failed", description: error.message, variant: "destructive" });
    } else {
      setEmailSent(true);
      toast({ title: "Check your email", description: "We've sent you a verification link." });
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setEmailSent(true);
      toast({ title: "Check your email", description: "Password reset link sent." });
    }
  };

  if (emailSent) {
    return (
    <PageTransition>
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <SEOHead title="Check Your Email | Parasram India" description="Verify your email to continue" noindex />
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-md">
          <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-secondary" />
          </div>
          <h2 className="font-heading text-2xl font-bold text-foreground mb-2">Check Your Email</h2>
          <p className="text-muted-foreground mb-6">
            {mode === "signup"
              ? "We've sent a verification link to your email. Please verify to continue."
              : "We've sent a password reset link. Check your inbox."}
          </p>
          <Button variant="outline" onClick={() => { setEmailSent(false); setMode("login"); }}>
            Back to Login
          </Button>
        </motion.div>
      </div>
    </PageTransition>
  );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <SEOHead
        title={mode === "login" ? "Login | Parasram India" : mode === "signup" ? "Sign Up | Parasram India" : "Reset Password | Parasram India"}
        description="Access your Parasram India account"
        noindex
      />

      {/* Left panel - branding (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 bg-hero relative overflow-hidden items-center justify-center p-12">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: "radial-gradient(circle at 20% 50%, hsl(var(--secondary)) 0%, transparent 50%), radial-gradient(circle at 80% 50%, hsl(var(--brand-gold)) 0%, transparent 50%)",
        }} />
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 text-center text-primary-foreground"
        >
          <Link to="/">
            <img src={logo160} alt="Parasram India" className="h-20 mx-auto mb-8" />
          </Link>
          <h2 className="font-heading text-3xl font-bold mb-4">The Science of Investment</h2>
          <p className="text-primary-foreground/70 text-lg mb-8 max-w-md">
            Join thousands of investors who trust Parasram India for disciplined wealth creation since 1970.
          </p>
          <div className="flex items-center justify-center gap-8 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-secondary">50+</div>
              <div className="text-primary-foreground/60">Years</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-secondary">10L+</div>
              <div className="text-primary-foreground/60">Clients</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-secondary">SEBI</div>
              <div className="text-primary-foreground/60">Registered</div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full max-w-md"
        >
          <Link to="/" className="lg:hidden flex justify-center mb-6">
            <img src={logo80} alt="Parasram India" className="h-12" />
          </Link>

          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <h1 className="font-heading text-2xl font-bold text-foreground mb-1">
                {mode === "login" ? "Welcome Back" : mode === "signup" ? "Create Account" : "Reset Password"}
              </h1>
              <p className="text-muted-foreground mb-6">
                {mode === "login"
                  ? "Sign in to your Parasram account"
                  : mode === "signup"
                  ? "Start your investment journey today"
                  : "Enter your email to receive a reset link"}
              </p>

              <form onSubmit={mode === "login" ? handleLogin : mode === "signup" ? handleSignup : handleForgot} className="space-y-4">
                {mode === "signup" && (
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="fullName"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Enter your full name"
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                {mode !== "forgot" && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="password">Password</Label>
                      {mode === "login" && (
                        <button
                          type="button"
                          onClick={() => setMode("forgot")}
                          className="text-xs text-secondary hover:underline"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="pl-10 pr-10"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        aria-pressed={showPassword}
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                <Button type="submit" disabled={loading} className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold">
                  {loading ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                      <TrendingUp className="w-4 h-4" />
                    </motion.div>
                  ) : (
                    <>
                      {mode === "login" ? "Sign In" : mode === "signup" ? "Create Account" : "Send Reset Link"}
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center text-sm text-muted-foreground">
                {mode === "login" ? (
                  <>Don't have an account?{" "}
                    <button onClick={() => setMode("signup")} className="text-secondary font-medium hover:underline">Sign up</button>
                  </>
                ) : mode === "signup" ? (
                  <>Already have an account?{" "}
                    <button onClick={() => setMode("login")} className="text-secondary font-medium hover:underline">Sign in</button>
                  </>
                ) : (
                  <button onClick={() => setMode("login")} className="text-secondary font-medium hover:underline">Back to login</button>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
};

export default AuthPage;
