import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  Plus, Pencil, Trash2, Save, X, LogOut, ArrowLeft, Megaphone,
  Info, AlertTriangle, CheckCircle, Sparkles, ExternalLink, Lock,
  Upload, ImageIcon, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import SEOHead from "@/components/SEOHead";
import logo80 from "@/assets/logo-80.webp";
import PageTransition from "@/components/PageTransition";

// ---- Types & Constants ----
type BannerMessage = {
  id: string;
  title: string | null;
  message: string;
  type: string;
  link_url: string | null;
  link_text: string | null;
  button_text: string | null;
  image_url: string | null;
  bg_theme: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
};

const BANNER_TYPES = [
  { value: "none", label: "No Icon", icon: Info, color: "bg-muted text-muted-foreground" },
  { value: "info", label: "Info", icon: Info, color: "bg-blue-500/10 text-blue-600" },
  { value: "warning", label: "Warning", icon: AlertTriangle, color: "bg-amber-500/10 text-amber-600" },
  { value: "success", label: "Success", icon: CheckCircle, color: "bg-emerald-500/10 text-emerald-600" },
  { value: "promo", label: "Promo", icon: Sparkles, color: "bg-purple-500/10 text-purple-600" },
];

const BG_THEMES = [
  { value: "default", label: "Light Theme" },
  { value: "dark", label: "Dark Theme" },
  { value: "brand-gradient", label: "Brand Gradient" },
];

// Note: For empty state we use empty strings to keep inputs controlled.
const emptyBanner = {
  title: "",
  message: "",
  type: "info",
  link_url: "",
  link_text: "",
  button_text: "Learn More",
  image_url: "",
  bg_theme: "default",
  is_active: true,
  display_order: 0,
};

const BannerManagerPage = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [banners, setBanners] = useState<BannerMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyBanner);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const fetchBanners = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("banner_messages" as never)
        .select("*")
        .order("display_order", { ascending: true });
      if (!error && data) setBanners(data as unknown as BannerMessage[]);
      else toast({ title: "Failed to load banners", variant: "destructive" });
    } catch {
      toast({ title: "Failed to load banners", variant: "destructive" });
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    if (user) fetchBanners();
  }, [user, fetchBanners]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${fileName}`;

    setIsUploading(true);
    try {
      const { error: uploadError } = await supabase.storage
        .from('banners')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('banners').getPublicUrl(filePath);
      
      setForm(prev => ({ ...prev, image_url: data.publicUrl }));
      toast({ title: "Image uploaded successfully" });
    } catch (error) {
      toast({ title: "Upload failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    } finally {
      setIsUploading(false);
      // Reset input so the same file could be chosen again if needed
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = () => {
    setForm(prev => ({ ...prev, image_url: "" }));
  };

  const handleCreate = async () => {
    if (!form.message.trim() && !form.title?.trim() && !form.image_url) {
      toast({ title: "Banner needs at least a title, message, or image", variant: "destructive" });
      return;
    }
    const { error } = await supabase
      .from("banner_messages" as never)
      .insert({
        title: form.title?.trim() || null,
        message: form.message.trim(),
        type: form.type,
        link_url: form.link_url?.trim() || null,
        link_text: form.link_text?.trim() || null,
        button_text: form.button_text?.trim() || null,
        image_url: form.image_url?.trim() || null,
        bg_theme: form.bg_theme,
        is_active: form.is_active,
        display_order: banners.length,
      } as never);
      
    if (!error) {
      toast({ title: "Banner created" });
      setCreating(false);
      setForm(emptyBanner);
      fetchBanners();
    } else {
      toast({ title: "Error creating banner", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    }
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    const { error } = await supabase
      .from("banner_messages" as never)
      .update({
        title: form.title?.trim() || null,
        message: form.message.trim(),
        type: form.type,
        link_url: form.link_url?.trim() || null,
        link_text: form.link_text?.trim() || null,
        button_text: form.button_text?.trim() || null,
        image_url: form.image_url?.trim() || null,
        bg_theme: form.bg_theme,
        is_active: form.is_active,
        display_order: form.display_order,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", editingId);
      
    if (!error) {
      toast({ title: "Banner updated" });
      setEditingId(null);
      setForm(emptyBanner);
      fetchBanners();
    } else {
      toast({ title: "Error updating banner", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this banner?")) return;
    const { error } = await supabase
      .from("banner_messages" as never)
      .delete()
      .eq("id", id);
    if (!error) {
      toast({ title: "Banner deleted" });
      fetchBanners();
    } else {
      toast({ title: "Error deleting banner", variant: "destructive" });
    }
  };

  const handleToggle = async (banner: BannerMessage) => {
    await supabase
      .from("banner_messages" as never)
      .update({ is_active: !banner.is_active, updated_at: new Date().toISOString() } as never)
      .eq("id", banner.id);
    fetchBanners();
  };

  const startEdit = (banner: BannerMessage) => {
    setEditingId(banner.id);
    setForm({
      title: banner.title || "",
      message: banner.message,
      type: banner.type,
      link_url: banner.link_url || "",
      link_text: banner.link_text || "",
      button_text: banner.button_text || "",
      image_url: banner.image_url || "",
      bg_theme: banner.bg_theme || "default",
      is_active: banner.is_active,
      display_order: banner.display_order,
    });
    setCreating(false);
  };

  const cancelForm = () => {
    setCreating(false);
    setEditingId(null);
    setForm(emptyBanner);
  };

  // Loading / auth gate
  if (authLoading) {
    return (
    <PageTransition>
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="space-y-3 w-full max-w-md">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    </PageTransition>
  );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <SEOHead title="Login | Banner Manager" description="Login to manage banners" noindex />
        <Card className="w-full max-w-sm shadow-xl border-secondary/20">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mb-4">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="font-heading text-2xl">Admin Login</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">Sign in to manage website popup banners</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={async (e) => {
              e.preventDefault();
              setIsLoggingIn(true);
              const { error } = await supabase.auth.signInWithPassword({ email, password });
              setIsLoggingIn(false);
              if (error) {
                toast({ title: "Login failed", description: error.message, variant: "destructive" });
              } else {
                toast({ title: "Welcome back!" });
              }
            }} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="admin@example.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={isLoggingIn}>
                {isLoggingIn ? "Signing in..." : "Sign In"}
              </Button>
              <div className="text-center pt-2">
                <Button variant="link" size="sm" onClick={() => navigate("/")} className="text-muted-foreground" type="button">
                  <ArrowLeft className="w-3 h-3 mr-1" /> Back to Website
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderForm = (title: string, onSave: () => void) => (
    <Card className="border-secondary/30 mb-6 shadow-md">
      <CardHeader className="p-4 sm:p-6 pb-2">
        <CardTitle className="text-base sm:text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 p-4 sm:p-6 pt-0 sm:pt-4">
        
        {/* Basic Content */}
        <div className="space-y-4 bg-muted/30 p-4 rounded-lg border border-border">
          <h3 className="text-sm font-semibold text-foreground border-b pb-2">Popup Content</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Popup Title (optional)</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. IPO Alert! 🚀"
                maxLength={200}
                className="mt-1"
              />
            </div>
            <div className="flex items-center gap-2 sm:mt-6 sm:justify-end">
              <Label className="cursor-pointer">Active Status</Label>
              <Switch checked={form.is_active} onCheckedChange={(c) => setForm({ ...form, is_active: c })} />
            </div>
          </div>

          <div>
            <Label>Main Message (optional)</Label>
            <Textarea
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="e.g. Don't miss out on opening a free Demat account today!"
              maxLength={500}
              rows={3}
              className="mt-1"
            />
          </div>
        </div>

        {/* Media Upload */}
        <div className="space-y-4 bg-muted/30 p-4 rounded-lg border border-border">
          <h3 className="text-sm font-semibold text-foreground border-b pb-2 flex items-center justify-between">
            Media
            <span className="text-xs font-normal text-muted-foreground">Optional image to show in popup</span>
          </h3>
          
          <div className="flex sm:items-center flex-col sm:flex-row gap-4">
            {form.image_url ? (
              <div className="relative w-full sm:w-48 h-32 rounded-md overflow-hidden border border-border bg-black/5 group">
                <img src={form.image_url} alt="Banner Preview" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Button size="sm" variant="destructive" onClick={removeImage} className="h-8">Remove</Button>
                </div>
              </div>
            ) : (
              <div className="w-full sm:w-48 h-32 rounded-md border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground bg-background">
                <ImageIcon className="w-8 h-8 opacity-20 mb-2" />
                <span className="text-xs">No image</span>
              </div>
            )}
            
            <div className="flex-1 space-y-2">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handleImageUpload}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full sm:w-auto"
              >
                {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                {form.image_url ? "Change Image" : "Upload Image"}
              </Button>
              <p className="text-[11px] text-muted-foreground leading-snug">
                For best results, upload a 16:9 or 4:3 image under 2MB. JPG, PNG, WEBP.
              </p>
            </div>
          </div>
        </div>

        {/* Customizations / Actions */}
        <div className="space-y-4 bg-muted/30 p-4 rounded-lg border border-border">
          <h3 className="text-sm font-semibold text-foreground border-b pb-2">Customizations & Actions</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
            <div>
              <Label>Background Theme</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {BG_THEMES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setForm({ ...form, bg_theme: t.value })}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                      form.bg_theme === t.value 
                      ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/20" 
                      : "border-border hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>Icon Type</Label>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {BANNER_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setForm({ ...form, type: t.value })}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-semibold border transition-[color,background-color,border-color,box-shadow,filter] ${
                      form.type === t.value ? "ring-2 ring-primary border-transparent" : "opacity-70 grayscale"
                    } ${t.color}`}
                  >
                    <t.icon className="w-3 h-3" />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t pt-4 mt-2">
              <div>
                <Label>Action Button Text</Label>
                <Input
                  value={form.button_text}
                  onChange={(e) => setForm({ ...form, button_text: e.target.value })}
                  placeholder="e.g. Learn More"
                  maxLength={50}
                  className="mt-1"
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Action URL / Link path</Label>
                <Input
                  value={form.link_url}
                  onChange={(e) => setForm({ ...form, link_url: e.target.value })}
                  placeholder="https://... or /open-account"
                  maxLength={1000}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button onClick={onSave} className="px-6">
            <Save className="w-4 h-4 mr-2" /> Save Popup
          </Button>
          <Button variant="outline" onClick={cancelForm} className="px-6">
            <X className="w-4 h-4 mr-2" /> Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background pb-12">
      <SEOHead title="Banner Manager | Parasram India" description="Manage website popup banners" noindex />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border/50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/">
              <img src={logo80} alt="Parasram India" className="h-8" />
            </Link>
            <div className="hidden sm:block h-6 w-px bg-border/50" />
            <h1 className="hidden sm:block font-heading text-lg font-semibold text-foreground">
              Popup Manager
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">{user.email}</span>
            <Button variant="outline" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Home
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await signOut();
                navigate("/auth");
              }}
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          {/* Title + Add button */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="font-heading text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-3">
                <Megaphone className="w-7 h-7 text-primary" />
                Website Popups
              </h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-lg">
                Create and manage popup modals that display to users when they visit the site.
              </p>
            </div>
            <Button
              onClick={() => {
                setCreating(true);
                setEditingId(null);
                setForm(emptyBanner);
              }}
              disabled={creating || !!editingId}
              size="default"
              className="shadow-sm"
            >
              <Plus className="w-4 h-4 mr-2" /> Create Popup
            </Button>
          </div>

          {/* Create / Edit forms */}
          {creating && renderForm("Create New Popup", handleCreate)}
          {editingId && renderForm("Edit Popup", handleUpdate)}

          {/* Banner list */}
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))}
            </div>
          ) : banners.length === 0 && !creating ? (
            <div className="text-center py-10 md:py-20 bg-muted/20 rounded-2xl border border-dashed border-border/60">
              <Megaphone className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground text-xl font-medium">No popups yet</p>
              <p className="text-muted-foreground text-sm mt-2 max-w-sm mx-auto">
                Click "Create Popup" to add an interactive modal that captures visitor attention.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {banners.map((banner) => {
                const typeInfo = BANNER_TYPES.find((t) => t.value === banner.type) || BANNER_TYPES[0];
                const TypeIcon = typeInfo.icon;
                
                return (
                  <Card key={banner.id} className={`transition-opacity overflow-hidden ${!banner.is_active ? "opacity-60 bg-muted/40" : ""}`}>
                    <CardContent className="p-0 flex flex-col sm:flex-row items-stretch">
                      
                      {banner.image_url ? (
                        <div className="w-full sm:w-48 h-32 sm:h-auto shrink-0 bg-muted border-b sm:border-b-0 sm:border-r border-border">
                          <img src={banner.image_url} alt="Popup Thumbnail" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="hidden sm:flex w-16 shrink-0 items-center justify-center bg-muted/50 border-r border-border">
                          <ImageIcon className="w-5 h-5 text-muted-foreground/40" />
                        </div>
                      )}
                      
                      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-center min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            {banner.title && (
                              <h4 className="font-heading font-semibold text-foreground text-base mb-1 truncate">
                                {banner.title}
                              </h4>
                            )}
                            <p className={`text-sm ${banner.title ? "text-muted-foreground" : "text-foreground font-medium"} line-clamp-2`}>
                              {banner.message}
                            </p>
                            
                            <div className="flex items-center gap-2 mt-3 flex-wrap">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${typeInfo.color}`}>
                                <TypeIcon className="w-2.5 h-2.5" />
                                {typeInfo.label}
                              </span>
                              
                              <span className="text-[10px] bg-secondary/10 text-secondary border border-secondary/20 px-2 py-0.5 rounded-full font-medium">
                                Theme: {BG_THEMES.find(t => t.value === banner.bg_theme)?.label || 'Light'}
                              </span>

                              {banner.link_url && (
                                <a
                                  href={banner.link_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] font-medium text-primary flex items-center gap-1 hover:underline ml-1"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  {banner.button_text || banner.link_text || "Link"}
                                </a>
                              )}
                              {!banner.is_active && (
                                <span className="text-[10px] bg-destructive/10 text-destructive border border-destructive/20 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ml-auto">
                                  Disabled
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 shrink-0 border-l pl-4 ml-2">
                            <div className="flex flex-col items-center gap-1 mr-2">
                              <Switch checked={banner.is_active} onCheckedChange={() => handleToggle(banner)} title="Toggle Active" />
                              <span className="text-[9px] text-muted-foreground font-medium uppercase">{banner.is_active ? 'On' : 'Off'}</span>
                            </div>
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => startEdit(banner)}
                              disabled={!!editingId || creating}
                              className="w-8 h-8 rounded-md"
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              className="text-destructive w-8 h-8 rounded-md border-destructive/30 hover:bg-destructive/10"
                              onClick={() => handleDelete(banner.id)}
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
};

export default BannerManagerPage;
