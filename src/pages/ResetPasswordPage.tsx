import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Lock, Eye, EyeOff, CheckCircle, Loader2 } from "lucide-react";
import { motion } from "motion/react";
import SEOHead from "@/components/SEOHead";
import logo80 from "@/assets/logo-80.webp";
import PageTransition from "@/components/PageTransition";
import { validateMatch, validateNewPassword } from "@/lib/form-validation";
import { FieldMessage, PasswordMeter, fieldStateClass } from "@/components/ui/form-field";

const ResetPasswordPage = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [touched, setTouched] = useState({ password: false, confirm: false });
  const [linkInvalid, setLinkInvalid] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    setLinkInvalid(!window.location.hash.includes("type=recovery"));
  }, []);

  const passwordError = touched.password ? validateNewPassword(password) : null;
  const confirmError = touched.confirm ? validateMatch(password)(confirmPassword) : null;

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ password: true, confirm: true });
    if (validateNewPassword(password)) return document.getElementById("password")?.focus();
    if (validateMatch(password)(confirmPassword)) return document.getElementById("confirm")?.focus();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast({ title: "Password not updated", description: error.message, variant: "destructive" });
    } else {
      setSuccess(true);
      setTimeout(() => navigate("/auth"), 3000);
    }
  };

  if (success) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center" role="status">
            <CheckCircle className="w-16 h-16 text-secondary mx-auto mb-4" aria-hidden="true" />
            <h2 className="font-heading text-2xl font-bold text-foreground mb-2">Password updated</h2>
            <p className="text-muted-foreground">Taking you to sign in…</p>
          </motion.div>
        </div>
      </PageTransition>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <SEOHead title="Reset Password | Parasram India" description="Set your new password" noindex />
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="text-center mb-6">
          <img src={logo80} alt="Parasram India" width={80} height={80} className="h-12 w-auto mx-auto mb-4" />
          <h1 className="font-heading text-2xl font-bold text-foreground">Set a new password</h1>
          <p className="text-muted-foreground text-sm mt-1">Use at least 8 characters with a mix of letters, numbers or symbols.</p>
        </div>
        {linkInvalid && (
          <p role="alert" className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            This reset link is invalid or has expired. Request a new one from the sign-in page.
          </p>
        )}
        <form onSubmit={handleReset} noValidate className="space-y-2">
          <div>
            <Label htmlFor="password">New password</Label>
            <div className="relative mt-1.5">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => password && setTouched((t) => ({ ...t, password: true }))}
                placeholder="••••••••"
                className={`pl-10 pr-10 ${fieldStateClass(passwordError)}`}
                required
                autoComplete="new-password"
                aria-invalid={passwordError ? true : undefined}
                aria-describedby="password-message"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <PasswordMeter value={password} />
            <FieldMessage id="password-message" error={passwordError} />
          </div>
          <div>
            <Label htmlFor="confirm">Confirm password</Label>
            <div className="relative mt-1.5">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="confirm"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onBlur={() => confirmPassword && setTouched((t) => ({ ...t, confirm: true }))}
                placeholder="••••••••"
                className={`pl-10 ${fieldStateClass(confirmError, touched.confirm && !confirmError)}`}
                required
                autoComplete="new-password"
                aria-invalid={confirmError ? true : undefined}
                aria-describedby="confirm-message"
              />
            </div>
            <FieldMessage id="confirm-message" error={confirmError} />
          </div>
          <Button type="submit" disabled={loading || linkInvalid} className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold">
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> Updating…</> : "Update password"}
          </Button>
        </form>
      </motion.div>
    </div>
  );
};

export default ResetPasswordPage;
